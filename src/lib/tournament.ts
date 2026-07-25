import "server-only";

import { and, asc, count, eq, inArray } from "drizzle-orm";

import {
  db,
  matches,
  movies,
  screenings,
  seedVotes,
  votes,
  type Match,
  type Room,
} from "@/db";
import {
  bracketSize,
  buildNextRound,
  drawSlots,
  initialMatches,
  resolveMatch,
  totalRounds,
  type Nominee,
  type Tally,
} from "@/lib/bracket";

/**
 * Orquesta el torneo contra la base. Toda la matemática del cuadro vive en
 * `@/lib/bracket`, que es puro y está testeado; acá solo se lee, se escribe y
 * se decide cuándo cerrar una ronda.
 */

/** Los cruces de la ronda que se está jugando, o `[]` si el torneo terminó. */
export function currentRound(all: Match[]): Match[] {
  const pending = all.filter((m) => m.status !== "decided");
  if (pending.length === 0) return [];
  const round = Math.min(...pending.map((m) => m.round));
  return all.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);
}

export async function loadMatches(roomId: string): Promise<Match[]> {
  return db()
    .select()
    .from(matches)
    .where(eq(matches.roomId, roomId))
    .orderBy(asc(matches.round), asc(matches.slot));
}

/**
 * Cierra la siembra y arma el cuadro. Las más aprobadas quedan protegidas como
 * cabezas de serie; el resto se sortea con `draw_seed`.
 */
export async function generateBracket(room: Room): Promise<void> {
  const nominees = await db()
    .select({ movieId: movies.id, approvals: count(seedVotes.id) })
    .from(movies)
    .leftJoin(seedVotes, eq(seedVotes.movieId, movies.id))
    .where(eq(movies.roomId, room.id))
    .groupBy(movies.id);

  const slots = drawSlots(nominees as Nominee[], room.drawSeed);

  await db()
    .insert(matches)
    .values(
      initialMatches(slots).map((match) => ({
        roomId: room.id,
        round: match.round,
        slot: match.slot,
        movieAId: match.movieAId,
        movieBId: match.movieBId,
        winnerId: match.winnerId,
        decidedBy: match.decidedBy,
        // La primera ronda ya está en juego; los byes nacen resueltos.
        status: match.winnerId ? ("decided" as const) : ("open" as const),
      })),
    );
}

/** Conteo de votos por película dentro de cada cruce. */
async function talliesFor(matchIds: string[]): Promise<Map<string, Tally>> {
  const result = new Map<string, Tally>();
  if (matchIds.length === 0) return result;

  const rows = await db()
    .select({
      matchId: votes.matchId,
      choice: votes.choiceMovieId,
      total: count(),
    })
    .from(votes)
    .where(inArray(votes.matchId, matchIds))
    .groupBy(votes.matchId, votes.choiceMovieId);

  for (const row of rows) {
    const tally = { ...(result.get(row.matchId) ?? {}) };
    tally[row.choice] = row.total;
    result.set(row.matchId, tally);
  }
  return result;
}

/** Cuántos votos faltan para que la ronda se cierre sola. */
export async function pendingVotes(
  room: Room,
  memberCount: number,
): Promise<{ cast: number; expected: number }> {
  const open = currentRound(await loadMatches(room.id)).filter((m) => m.status === "open");
  if (open.length === 0) return { cast: 0, expected: 0 };

  const [{ total }] = await db()
    .select({ total: count() })
    .from(votes)
    .where(
      inArray(
        votes.matchId,
        open.map((m) => m.id),
      ),
    );

  return { cast: total, expected: open.length * memberCount };
}

/**
 * Resuelve la ronda abierta y arma la siguiente. Los cruces sin votos se
 * deciden igual: con empate a cero manda la moneda al aire, que es
 * determinista a partir de `(tiebreak_seed, round, slot)`.
 */
export async function resolveOpenRound(room: Room): Promise<{ finished: boolean }> {
  const all = await loadMatches(room.id);
  const round = currentRound(all);
  if (round.length === 0) return { finished: true };

  const open = round.filter((m) => m.status === "open");
  const tallies = await talliesFor(open.map((m) => m.id));

  const decided = round.map((match) => {
    if (match.status === "decided") return match;
    const outcome = resolveMatch(match, tallies.get(match.id) ?? {}, room.tiebreakSeed);
    return { ...match, ...outcome, status: "decided" as const };
  });

  for (const match of decided) {
    if (match.status === "decided" && all.find((m) => m.id === match.id)?.status !== "decided") {
      await db()
        .update(matches)
        .set({ winnerId: match.winnerId, decidedBy: match.decidedBy, status: "decided" })
        .where(eq(matches.id, match.id));
    }
  }

  const next = buildNextRound(decided);
  if (next.length > 0) {
    await db()
      .insert(matches)
      .values(
        next.map((match) => ({
          roomId: room.id,
          round: match.round,
          slot: match.slot,
          movieAId: match.movieAId,
          movieBId: match.movieBId,
          status: "open" as const,
        })),
      );
    return { finished: false };
  }

  await buildScreenings(room, [...all.filter((m) => m.round !== round[0].round), ...decided]);
  return { finished: true };
}

/**
 * El podio arma la cartelera: campeona, subcampeona y las dos semifinalistas,
 * en ese orden. Con cuadros de 2 o 4 simplemente hay menos posiciones.
 */
async function buildScreenings(room: Room, all: Match[]): Promise<void> {
  const last = Math.max(...all.map((m) => m.round));
  const final = all.find((m) => m.round === last);
  if (!final?.winnerId) return;

  const loserOf = (match: Match) =>
    match.winnerId === match.movieAId ? match.movieBId : match.movieAId;

  const podium: string[] = [final.winnerId];
  const runnerUp = loserOf(final);
  if (runnerUp) podium.push(runnerUp);

  for (const semi of all.filter((m) => m.round === last - 1).sort((a, b) => a.slot - b.slot)) {
    const loser = loserOf(semi);
    if (loser) podium.push(loser);
  }

  await db()
    .insert(screenings)
    .values(podium.map((movieId, index) => ({ roomId: room.id, movieId, position: index + 1 })));
}

/** Tras cada voto: si ya votaron todos, la ronda se cierra sola. */
export async function closeRoundIfComplete(
  room: Room,
  memberCount: number,
): Promise<{ finished: boolean } | null> {
  const { cast, expected } = await pendingVotes(room, memberCount);
  if (expected === 0 || cast < expected) return null;
  return resolveOpenRound(room);
}

/** Cuántas rondas tendrá el cuadro de esta sala. */
export async function roundsForRoom(roomId: string): Promise<number> {
  const [{ total }] = await db()
    .select({ total: count() })
    .from(movies)
    .where(eq(movies.roomId, roomId));
  return totalRounds(bracketSize(total));
}

export async function hasVoted(matchId: string, participantId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: votes.id })
    .from(votes)
    .where(and(eq(votes.matchId, matchId), eq(votes.participantId, participantId)))
    .limit(1);
  return Boolean(row);
}
