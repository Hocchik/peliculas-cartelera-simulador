import { describe, expect, it } from "vitest";

import {
  MAX_MOVIES,
  bracketSize,
  buildNextRound,
  coinflip,
  createRng,
  drawSlots,
  initialMatches,
  resolveMatch,
  roundName,
  totalRounds,
  type BracketMatch,
  type Nominee,
} from "./bracket";

/** n películas con aprobaciones descendentes: m1 es la más votada. */
function nominees(n: number): Nominee[] {
  return Array.from({ length: n }, (_, i) => ({
    movieId: `m${i + 1}`,
    approvals: n - i,
  }));
}

describe("createRng", () => {
  it("es determinista para la misma semilla", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produce valores en [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("da secuencias distintas para semillas distintas", () => {
    expect(createRng(1)()).not.toEqual(createRng(2)());
  });
});

describe("bracketSize", () => {
  it("redondea a la siguiente potencia de dos", () => {
    expect(bracketSize(2)).toBe(2);
    expect(bracketSize(3)).toBe(4);
    expect(bracketSize(4)).toBe(4);
    expect(bracketSize(5)).toBe(8);
    expect(bracketSize(8)).toBe(8);
    expect(bracketSize(9)).toBe(16);
    expect(bracketSize(16)).toBe(16);
  });

  it("rechaza cuadros imposibles", () => {
    expect(() => bracketSize(1)).toThrow();
    expect(() => bracketSize(MAX_MOVIES + 1)).toThrow();
  });
});

describe("totalRounds y roundName", () => {
  it("cuenta las rondas del cuadro", () => {
    expect(totalRounds(2)).toBe(1);
    expect(totalRounds(4)).toBe(2);
    expect(totalRounds(8)).toBe(3);
    expect(totalRounds(16)).toBe(4);
  });

  it("nombra las rondas en español", () => {
    expect(roundName(1, 16)).toBe("Octavos de final");
    expect(roundName(2, 16)).toBe("Cuartos de final");
    expect(roundName(3, 16)).toBe("Semifinales");
    expect(roundName(4, 16)).toBe("Final");
    // Con pocas películas se arranca directo en semis.
    expect(roundName(1, 4)).toBe("Semifinales");
    expect(roundName(1, 2)).toBe("Final");
  });
});

describe("drawSlots", () => {
  it("es determinista: la misma semilla da el mismo cuadro", () => {
    const a = drawSlots(nominees(16), 999);
    const b = drawSlots(nominees(16), 999);
    expect(a).toEqual(b);
  });

  it("sin empates de aprobaciones, el cuadro sale solo del ranking: la semilla no cambia nada", () => {
    const draws = [1, 2, 3, 4, 5].map((seed) => drawSlots(nominees(16), seed).join(","));
    expect(new Set(draws).size).toBe(1);
  });

  it("con empates de aprobaciones, semillas distintas producen sorteos distintos", () => {
    // De a cuatro empatadas: 4,4,4,4,3,3,3,3,…
    const porGrupos: Nominee[] = Array.from({ length: 16 }, (_, i) => ({
      movieId: `m${i + 1}`,
      approvals: 4 - Math.floor(i / 4),
    }));
    const draws = [1, 2, 3, 4, 5].map((seed) => drawSlots(porGrupos, seed).join(","));
    expect(new Set(draws).size).toBeGreaterThan(1);
  });

  it("coloca las 4 más aprobadas en cuartos distintos del cuadro", () => {
    const slots = drawSlots(nominees(16), 42);
    const quarterOf = (movieId: string) => Math.floor(slots.indexOf(movieId) / 4);
    const quarters = ["m1", "m2", "m3", "m4"].map(quarterOf);
    expect(new Set(quarters).size).toBe(4);
  });

  it("mantiene a las dos más aprobadas en mitades opuestas (solo se cruzan en la final)", () => {
    const slots = drawSlots(nominees(16), 2024);
    const halfOf = (movieId: string) => Math.floor(slots.indexOf(movieId) / 8);
    expect(halfOf("m1")).not.toBe(halfOf("m2"));
  });

  it("no pierde ni duplica películas", () => {
    const slots = drawSlots(nominees(11), 5);
    const placed = slots.filter((s): s is string => s !== null);
    expect(placed).toHaveLength(11);
    expect(new Set(placed).size).toBe(11);
    expect(slots).toHaveLength(16);
  });

  it("en la primera ronda la más querida enfrenta a la menos querida (1-16, 2-15, …)", () => {
    const slots = drawSlots(nominees(16), 11);
    const rank = (id: string | null) => Number(id!.slice(1));
    for (let i = 0; i < 16; i += 2) {
      expect(rank(slots[i]) + rank(slots[i + 1])).toBe(17);
    }
  });

  it("el top k no se cruza entre sí hasta la ronda en que quedan k (8 → cuartos, 4 → semis, 2 → final)", () => {
    for (const seed of [3, 99, 2024]) {
      const slots = drawSlots(nominees(16), seed);
      for (const k of [2, 4, 8]) {
        // Cada bloque de 16/k casillas es un subcuadro del que sale una sola.
        const blockOf = (id: string) => Math.floor(slots.indexOf(id) / (16 / k));
        const top = Array.from({ length: k }, (_, i) => blockOf(`m${i + 1}`));
        expect(new Set(top).size).toBe(k);
      }
    }
  });

  it("desempata aprobaciones iguales sin caer siempre del mismo lado", () => {
    const empatadas: Nominee[] = Array.from({ length: 16 }, (_, i) => ({
      movieId: `m${i + 1}`,
      approvals: 3,
    }));
    const a = drawSlots(empatadas, 1);
    const b = drawSlots(empatadas, 2);
    expect(a).not.toEqual(b);
  });
});

describe("initialMatches", () => {
  it("empareja slots contiguos y numera desde 0", () => {
    const slots = ["a", "b", "c", "d"];
    const ms = initialMatches(slots);
    expect(ms).toHaveLength(2);
    expect(ms[0]).toMatchObject({ round: 1, slot: 0, movieAId: "a", movieBId: "b" });
    expect(ms[1]).toMatchObject({ round: 1, slot: 1, movieAId: "c", movieBId: "d" });
  });

  it("resuelve los byes de entrada, a favor de las cabezas de serie", () => {
    const slots = drawSlots(nominees(9), 3);
    const ms = initialMatches(slots);
    const byes = ms.filter((m) => m.decidedBy === "bye");

    // 9 películas en un cuadro de 16 → 7 byes.
    expect(byes).toHaveLength(7);
    // La más aprobada nunca juega la primera ronda: le toca bye.
    expect(byes.some((m) => m.winnerId === "m1")).toBe(true);
    for (const bye of byes) {
      expect(bye.status).toBe("decided");
      expect(bye.winnerId).not.toBeNull();
    }
  });

  it("nunca deja un cruce con las dos casillas vacías", () => {
    for (let n = 2; n <= MAX_MOVIES; n++) {
      const ms = initialMatches(drawSlots(nominees(n), n));
      for (const m of ms) {
        expect(m.movieAId === null && m.movieBId === null).toBe(false);
      }
    }
  });
});

describe("resolveMatch", () => {
  const base: BracketMatch = {
    round: 1,
    slot: 0,
    movieAId: "a",
    movieBId: "b",
    winnerId: null,
    decidedBy: null,
    status: "open",
  };

  it("gana quien tiene más votos", () => {
    expect(resolveMatch(base, { a: 3, b: 1 })).toEqual({ winnerId: "a", decidedBy: "votes" });
    expect(resolveMatch(base, { a: 1, b: 4 })).toEqual({ winnerId: "b", decidedBy: "votes" });
  });

  it("trata los votos ausentes como cero", () => {
    expect(resolveMatch(base, { a: 1 })).toEqual({ winnerId: "a", decidedBy: "votes" });
  });

  it("no resuelve los empates: los decide el host", () => {
    expect(resolveMatch(base, { a: 2, b: 2 })).toBeNull();
  });

  it("un cruce sin votos también queda empatado a cero", () => {
    expect(resolveMatch(base, {})).toBeNull();
  });

  it("un cruce sin rival se resuelve como bye, sin mirar los votos", () => {
    expect(resolveMatch({ ...base, movieBId: null }, {})).toEqual({
      winnerId: "a",
      decidedBy: "bye",
    });
    expect(resolveMatch({ ...base, movieAId: null }, {})).toEqual({
      winnerId: "b",
      decidedBy: "bye",
    });
  });

  it("falla si el cruce no tiene participantes", () => {
    expect(() => resolveMatch({ ...base, movieAId: null, movieBId: null }, {})).toThrow();
  });
});

describe("coinflip", () => {
  const cruce = (key: string) => ({ key, movieAId: "a", movieBId: "b" });

  it("es reproducible: la misma moneda cae siempre del mismo lado", () => {
    expect(coinflip(cruce("x"), 42)).toEqual(coinflip(cruce("x"), 42));
  });

  it("queda grabada como moneda y elige a una de las dos", () => {
    const outcome = coinflip(cruce("x"), 42);
    expect(outcome.decidedBy).toBe("coinflip");
    expect(["a", "b"]).toContain(outcome.winnerId);
  });

  it("es pareja: en muchos cruces cae más o menos la mitad de cada lado", () => {
    const heads = Array.from({ length: 2000 }, (_, i) => coinflip(cruce(`match-${i}`), 7)).filter(
      (outcome) => outcome.winnerId === "a",
    ).length;
    expect(heads).toBeGreaterThan(900);
    expect(heads).toBeLessThan(1100);
  });

  it("cada sala tira su propia moneda para el mismo cruce", () => {
    const sides = new Set(
      Array.from({ length: 32 }, (_, seed) => coinflip(cruce("mismo"), seed).winnerId),
    );
    expect(sides.size).toBe(2);
  });
});

describe("buildNextRound", () => {
  it("empareja ganadores consecutivos y avanza de ronda", () => {
    const decided: BracketMatch[] = [
      { round: 1, slot: 0, movieAId: "a", movieBId: "b", winnerId: "a", decidedBy: "votes", status: "decided" },
      { round: 1, slot: 1, movieAId: "c", movieBId: "d", winnerId: "d", decidedBy: "votes", status: "decided" },
      { round: 1, slot: 2, movieAId: "e", movieBId: "f", winnerId: "e", decidedBy: "votes", status: "decided" },
      { round: 1, slot: 3, movieAId: "g", movieBId: "h", winnerId: "h", decidedBy: "votes", status: "decided" },
    ];
    const next = buildNextRound(decided);
    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({ round: 2, slot: 0, movieAId: "a", movieBId: "d" });
    expect(next[1]).toMatchObject({ round: 2, slot: 1, movieAId: "e", movieBId: "h" });
  });

  it("ordena por slot aunque lleguen desordenados", () => {
    const decided: BracketMatch[] = [
      { round: 1, slot: 1, movieAId: "c", movieBId: "d", winnerId: "c", decidedBy: "votes", status: "decided" },
      { round: 1, slot: 0, movieAId: "a", movieBId: "b", winnerId: "b", decidedBy: "votes", status: "decided" },
    ];
    expect(buildNextRound(decided)[0]).toMatchObject({ movieAId: "b", movieBId: "c" });
  });

  it("devuelve vacío cuando la ronda recibida es la final", () => {
    const final: BracketMatch[] = [
      { round: 4, slot: 0, movieAId: "a", movieBId: "b", winnerId: "a", decidedBy: "votes", status: "decided" },
    ];
    expect(buildNextRound(final)).toEqual([]);
  });

  it("exige que la ronda esté completamente resuelta", () => {
    const incompleta: BracketMatch[] = [
      { round: 1, slot: 0, movieAId: "a", movieBId: "b", winnerId: "a", decidedBy: "votes", status: "decided" },
      { round: 1, slot: 1, movieAId: "c", movieBId: "d", winnerId: null, decidedBy: null, status: "open" },
    ];
    expect(() => buildNextRound(incompleta)).toThrow();
  });
});

describe("torneo completo", () => {
  it("juega 16 películas en 15 cruces y deja una campeona", () => {
    const slots = drawSlots(nominees(16), 2026);
    let round = initialMatches(slots);
    let played = round.length;

    while (round.length > 1) {
      const decided = round.map((m) => {
        if (m.winnerId) return m;
        // Voto arbitrario pero determinista para la simulación.
        const tally = { [m.movieAId!]: 2, [m.movieBId!]: 1 };
        const outcome = resolveMatch(m, tally)!;
        return { ...m, ...outcome, status: "decided" as const };
      });
      round = buildNextRound(decided);
      played += round.length;
    }

    expect(played).toBe(15);
    expect(round[0].round).toBe(4);
    expect(resolveMatch(round[0], { [round[0].movieAId!]: 1 })?.winnerId).toBeTruthy();
  });

  it("con cualquier cantidad entre 2 y 16 termina en una sola campeona", () => {
    for (let n = 2; n <= MAX_MOVIES; n++) {
      let round = initialMatches(drawSlots(nominees(n), n * 13));
      while (round.length > 1) {
        const decided = round.map((m) => {
          if (m.winnerId) return m;
          const outcome = resolveMatch(m, { [m.movieBId!]: 1 })!;
          return { ...m, ...outcome, status: "decided" as const };
        });
        round = buildNextRound(decided);
      }
      expect(round).toHaveLength(1);
      expect(round[0].round).toBe(totalRounds(bracketSize(n)));
    }
  });

  it("un empate deja la ronda sin poder avanzar hasta que alguien decida", () => {
    const round = initialMatches(drawSlots(nominees(4), 3));
    const empatados = round.map((m) => ({
      ...m,
      outcome: resolveMatch(m, { [m.movieAId!]: 1, [m.movieBId!]: 1 }),
    }));

    // Ninguno se resuelve solo, así que el cuadro no puede seguir.
    expect(empatados.every((m) => m.outcome === null)).toBe(true);
    expect(() => buildNextRound(round)).toThrow();
  });
});
