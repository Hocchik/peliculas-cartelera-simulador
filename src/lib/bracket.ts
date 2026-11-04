import type { DecidedBy, MatchStatus } from "../db/schema";

/**
 * Lógica del cuadro. Este módulo es PURO: sin I/O, sin `Date.now()`, sin
 * `Math.random()`. Todo el azar entra como semilla, de modo que el sorteo y los
 * desempates sean reproducibles y auditables (invariante 5 de CLAUDE.md).
 */

/** Tope de nominaciones por sala. */
export const MAX_MOVIES = 16;

export type Nominee = {
  movieId: string;
  /** Votos de aprobación recibidos en la fase de siembra. */
  approvals: number;
};

/** Una casilla del cuadro: la película sembrada ahí, o `null` si es un bye. */
export type Slot = string | null;

export type BracketMatch = {
  /** 1 = primera ronda. La final es la ronda `totalRounds(size)`. */
  round: number;
  /** Posición dentro de la ronda, de arriba a abajo, empezando en 0. */
  slot: number;
  movieAId: string | null;
  movieBId: string | null;
  winnerId: string | null;
  decidedBy: DecidedBy | null;
  status: MatchStatus;
};

/** Conteo de votos por película dentro de un cruce. */
export type Tally = Readonly<Record<string, number>>;

export type MatchOutcome = {
  winnerId: string;
  decidedBy: DecidedBy;
};

// ---------------------------------------------------------------------------
// Azar determinista
// ---------------------------------------------------------------------------

/** PRNG mulberry32: misma semilla, misma secuencia, en cualquier máquina. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Forma del cuadro
// ---------------------------------------------------------------------------

/** Tamaño del cuadro: la siguiente potencia de dos. Las faltantes serán byes. */
export function bracketSize(movieCount: number): number {
  if (movieCount < 2) {
    throw new Error("Hacen falta al menos 2 películas para armar el cuadro");
  }
  if (movieCount > MAX_MOVIES) {
    throw new Error(`El cuadro admite como máximo ${MAX_MOVIES} películas`);
  }
  let size = 2;
  while (size < movieCount) size *= 2;
  return size;
}

export function totalRounds(size: number): number {
  let rounds = 0;
  let remaining = size;
  while (remaining > 1) {
    remaining /= 2;
    rounds++;
  }
  return rounds;
}

export function roundName(round: number, size: number): string {
  const teams = size / 2 ** (round - 1);
  switch (teams) {
    case 2:
      return "Final";
    case 4:
      return "Semifinales";
    case 8:
      return "Cuartos de final";
    case 16:
      return "Octavos de final";
    default:
      return `Ronda ${round}`;
  }
}

/**
 * Siembra estándar de eliminación simple: devuelve, para cada casilla, el
 * número de cabeza de serie que le corresponde. Garantiza que 1 y 2 solo se
 * crucen en la final, y que las cuatro primeras caigan en cuartos distintos.
 *
 * Tamaño 4 → [1, 4, 2, 3]; tamaño 8 → [1, 8, 4, 5, 2, 7, 3, 6].
 */
export function seedPositions(size: number): number[] {
  let positions = [1, 2];
  while (positions.length < size) {
    const complement = positions.length * 2 + 1;
    const next: number[] = [];
    for (const seed of positions) {
      next.push(seed, complement - seed);
    }
    positions = next;
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Sorteo
// ---------------------------------------------------------------------------

/**
 * El sorteo. TODAS las películas se siembran por aprobaciones con la siembra
 * estándar (`seedPositions`), no solo las primeras cuatro: así la más querida
 * debuta contra la menos querida, y las favoritas se van eliminando entre
 * ellas lo más tarde posible —la 1 y la 2 solo en la final, el top 4 recién en
 * semis, el top 8 en cuartos—. Antes solo se protegía al top 4 y el resto se
 * barajaba, de modo que la 5.ª más querida podía caer contra la 1.ª de entrada.
 *
 * El azar (reproducible, con `draw_seed`) desempata aprobaciones iguales, que
 * con 4 a 10 personas votando son lo habitual. Los byes recaen en las mejor
 * sembradas, como en el Mundial.
 */
export function drawSlots(nominees: readonly Nominee[], drawSeed: number): Slot[] {
  const size = bracketSize(nominees.length);
  const rng = createRng(drawSeed);

  // Barajar antes de ordenar hace que los empates de aprobaciones se desempaten
  // al azar y no por orden de inserción (`sort` es estable en JS).
  const ranked = shuffle(nominees, rng).sort((a, b) => b.approvals - a.approvals);

  return seedPositions(size).map((seed) => ranked[seed - 1]?.movieId ?? null);
}

/**
 * Primera ronda a partir del cuadro sorteado. Los cruces sin rival quedan
 * resueltos de entrada como `bye`: nadie vota un versus de uno solo.
 */
export function initialMatches(slots: readonly Slot[]): BracketMatch[] {
  const matches: BracketMatch[] = [];
  for (let i = 0; i < slots.length / 2; i++) {
    const movieAId = slots[2 * i] ?? null;
    const movieBId = slots[2 * i + 1] ?? null;
    if (movieAId === null && movieBId === null) {
      throw new Error(`El cruce ${i} quedó sin participantes: el sorteo está mal armado`);
    }
    const isBye = movieAId === null || movieBId === null;
    matches.push({
      round: 1,
      slot: i,
      movieAId,
      movieBId,
      winnerId: isBye ? (movieAId ?? movieBId) : null,
      decidedBy: isBye ? "bye" : null,
      status: isBye ? "decided" : "pending",
    });
  }
  return matches;
}

/**
 * Resuelve un cruce por votos. Devuelve `null` si hay empate: en ese caso no se
 * resuelve solo; el host elige o tira la moneda (`coinflip`) desde el versus.
 */
export function resolveMatch(
  match: Pick<BracketMatch, "movieAId" | "movieBId">,
  tally: Tally,
): MatchOutcome | null {
  const { movieAId, movieBId } = match;

  if (movieAId === null && movieBId === null) {
    throw new Error("No se puede resolver un cruce sin participantes");
  }
  if (movieBId === null) return { winnerId: movieAId!, decidedBy: "bye" };
  if (movieAId === null) return { winnerId: movieBId, decidedBy: "bye" };

  const votesA = tally[movieAId] ?? 0;
  const votesB = tally[movieBId] ?? 0;

  if (votesA > votesB) return { winnerId: movieAId, decidedBy: "votes" };
  if (votesB > votesA) return { winnerId: movieBId, decidedBy: "votes" };
  return null;
}

/** FNV-1a de 32 bits: convierte el id de un cruce en un número estable. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Moneda al aire para un empate. Sale de `tiebreak_seed` mezclada con la clave
 * del cruce: la misma moneda cae siempre del mismo lado (un refresh no la
 * cambia) y cada cruce tiene la suya, aunque la sala tenga una sola semilla.
 */
export function coinflip(
  match: { key: string; movieAId: string; movieBId: string },
  tiebreakSeed: number,
): MatchOutcome {
  const heads = createRng((tiebreakSeed ^ hashString(match.key)) >>> 0)() < 0.5;
  return { winnerId: heads ? match.movieAId : match.movieBId, decidedBy: "coinflip" };
}

/**
 * Arma la ronda siguiente con los ganadores. Devuelve `[]` si la ronda recibida
 * era la final.
 */
export function buildNextRound(decided: readonly BracketMatch[]): BracketMatch[] {
  if (decided.length === 0) {
    throw new Error("No hay cruces de los que avanzar");
  }

  const sorted = [...decided].sort((a, b) => a.slot - b.slot);
  const pending = sorted.find((match) => match.winnerId === null);
  if (pending) {
    throw new Error(`El cruce ${pending.slot} todavía no tiene ganador`);
  }

  if (sorted.length === 1) return [];

  const round = sorted[0].round + 1;
  const next: BracketMatch[] = [];
  for (let i = 0; i < sorted.length / 2; i++) {
    next.push({
      round,
      slot: i,
      movieAId: sorted[2 * i].winnerId,
      movieBId: sorted[2 * i + 1].winnerId,
      winnerId: null,
      decidedBy: null,
      status: "pending",
    });
  }
  return next;
}
