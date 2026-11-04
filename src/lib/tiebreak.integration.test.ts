import { afterEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";

import {
  db,
  matches,
  movies,
  participants,
  rooms,
  screenings,
  votes,
  type Room,
} from "@/db";
import { coinflip } from "@/lib/bracket";
import {
  decideMatchByHost,
  loadMatches,
  resolveOpenRound,
  settleTieByCoinflip,
} from "@/lib/tournament";

/** Empates y poder del host, contra la base real. */

const CODE = "ITEST2";

type Escenario = {
  room: Room;
  hostId: string;
  guestId: string;
  movieIds: string[];
  matchId: string;
};

async function montar(): Promise<Escenario> {
  await db().delete(rooms).where(eq(rooms.code, CODE));

  const [room] = await db()
    .insert(rooms)
    .values({
      code: CODE,
      name: "Empates",
      phase: "bracket",
      drawSeed: 11,
      tiebreakSeed: 22,
    })
    .returning();

  const [host, guest] = await db()
    .insert(participants)
    .values([
      { roomId: room.id, nickname: "Host", avatarSeed: 1, isHost: true, deviceToken: "tb-host" },
      { roomId: room.id, nickname: "Guest", avatarSeed: 2, deviceToken: "tb-guest" },
    ])
    .returning();

  const pelis = await db()
    .insert(movies)
    .values([
      { roomId: room.id, tmdbId: 95001, title: "Peli A", originalTitle: "Film A", year: 2001 },
      { roomId: room.id, tmdbId: 95002, title: "Peli B", originalTitle: "Film B", year: 2002 },
    ])
    .returning();

  const [match] = await db()
    .insert(matches)
    .values({
      roomId: room.id,
      round: 1,
      slot: 0,
      movieAId: pelis[0].id,
      movieBId: pelis[1].id,
      status: "open",
    })
    .returning();

  return {
    room,
    hostId: host.id,
    guestId: guest.id,
    movieIds: pelis.map((p) => p.id),
    matchId: match.id,
  };
}

afterEach(async () => {
  await db().delete(rooms).where(eq(rooms.code, CODE));
});

describe("empates", () => {
  it("un empate no se resuelve solo: queda esperando al host", async () => {
    const { room, hostId, guestId, movieIds, matchId } = await montar();

    // Uno vota cada lado.
    await db()
      .insert(votes)
      .values([
        { matchId, participantId: hostId, choiceMovieId: movieIds[0] },
        { matchId, participantId: guestId, choiceMovieId: movieIds[1] },
      ]);

    const result = await resolveOpenRound(room);
    expect(result).toEqual({ finished: false, ties: 1 });

    const [match] = await loadMatches(room.id);
    expect(match.status).toBe("tiebreak");
    expect(match.winnerId).toBeNull();

    // Y sin ganador no se arma cartelera ni ronda siguiente.
    const lineup = await db().select().from(screenings).where(eq(screenings.roomId, room.id));
    expect(lineup).toHaveLength(0);
  });

  it("el host desempata y el torneo cierra", async () => {
    const { room, hostId, guestId, movieIds, matchId } = await montar();

    await db()
      .insert(votes)
      .values([
        { matchId, participantId: hostId, choiceMovieId: movieIds[0] },
        { matchId, participantId: guestId, choiceMovieId: movieIds[1] },
      ]);
    await resolveOpenRound(room);

    const { finished } = await decideMatchByHost(room, matchId, movieIds[1]);
    expect(finished).toBe(true);

    const [match] = await loadMatches(room.id);
    expect(match.status).toBe("decided");
    expect(match.winnerId).toBe(movieIds[1]);
    expect(match.decidedBy).toBe("host");

    const lineup = await db()
      .select()
      .from(screenings)
      .where(eq(screenings.roomId, room.id))
      .orderBy(asc(screenings.position));
    expect(lineup.map((row) => row.movieId)).toEqual([movieIds[1], movieIds[0]]);
  });
});

describe("poder del host", () => {
  it("puede hacer pasar a la que perdió la votación", async () => {
    const { room, hostId, guestId, movieIds, matchId } = await montar();

    // Las dos personas votaron a la A: gana la A por 2 a 0.
    await db()
      .insert(votes)
      .values([
        { matchId, participantId: hostId, choiceMovieId: movieIds[0] },
        { matchId, participantId: guestId, choiceMovieId: movieIds[0] },
      ]);

    // El host hace pasar a la B igual.
    await decideMatchByHost(room, matchId, movieIds[1]);

    const [match] = await loadMatches(room.id);
    expect(match.winnerId).toBe(movieIds[1]);
    // Queda registrado cómo se decidió: el cuadro no miente sobre esto.
    expect(match.decidedBy).toBe("host");

    const lineup = await db()
      .select()
      .from(screenings)
      .where(eq(screenings.roomId, room.id))
      .orderBy(asc(screenings.position));
    expect(lineup[0].movieId).toBe(movieIds[1]);
  });

  it("decidir dos veces no duplica la cartelera", async () => {
    const { room, movieIds, matchId } = await montar();

    await decideMatchByHost(room, matchId, movieIds[0]);
    await decideMatchByHost(room, matchId, movieIds[0]);

    const lineup = await db().select().from(screenings).where(eq(screenings.roomId, room.id));
    expect(lineup).toHaveLength(2);
  });
});

describe("moneda", () => {
  it("desempata con el resultado que dicta tiebreak_seed, y tirarla dos veces no cambia nada", async () => {
    const { room, hostId, guestId, movieIds, matchId } = await montar();

    await db()
      .insert(votes)
      .values([
        { matchId, participantId: hostId, choiceMovieId: movieIds[0] },
        { matchId, participantId: guestId, choiceMovieId: movieIds[1] },
      ]);
    await resolveOpenRound(room);

    const [tied] = await loadMatches(room.id);
    const { finished } = await settleTieByCoinflip(room, tied);
    await settleTieByCoinflip(room, tied);
    expect(finished).toBe(true);

    const expected = coinflip(
      { key: matchId, movieAId: movieIds[0], movieBId: movieIds[1] },
      room.tiebreakSeed,
    );
    const [match] = await loadMatches(room.id);
    expect(match).toMatchObject({
      status: "decided",
      decidedBy: "coinflip",
      winnerId: expected.winnerId,
    });

    const lineup = await db().select().from(screenings).where(eq(screenings.roomId, room.id));
    expect(lineup).toHaveLength(2);
  });
});

describe("votos simultáneos", () => {
  /** Semifinales: el cruce de `montar` más otro, y los dos votaron por unanimidad. */
  async function montarSemis() {
    const base = await montar();
    const extra = await db()
      .insert(movies)
      .values([
        { roomId: base.room.id, tmdbId: 95003, title: "Peli C", originalTitle: "Film C", year: 2003 },
        { roomId: base.room.id, tmdbId: 95004, title: "Peli D", originalTitle: "Film D", year: 2004 },
      ])
      .returning();
    const [semi2] = await db()
      .insert(matches)
      .values({
        roomId: base.room.id,
        round: 1,
        slot: 1,
        movieAId: extra[0].id,
        movieBId: extra[1].id,
        status: "open",
      })
      .returning();

    await db()
      .insert(votes)
      .values([
        { matchId: base.matchId, participantId: base.hostId, choiceMovieId: base.movieIds[0] },
        { matchId: base.matchId, participantId: base.guestId, choiceMovieId: base.movieIds[0] },
        { matchId: semi2.id, participantId: base.hostId, choiceMovieId: extra[1].id },
        { matchId: semi2.id, participantId: base.guestId, choiceMovieId: extra[1].id },
      ]);

    return { ...base, finalists: [base.movieIds[0], extra[1].id] };
  }

  it("tres cierres a la vez arman una sola final, abierta y sin terminar el torneo", async () => {
    const { room, finalists } = await montarSemis();

    const results = await Promise.all([
      resolveOpenRound(room, 1),
      resolveOpenRound(room, 1),
      resolveOpenRound(room, 1),
    ]);
    expect(results.every((result) => !result.finished)).toBe(true);

    const final = (await loadMatches(room.id)).filter((match) => match.round === 2);
    expect(final).toHaveLength(1);
    expect(final[0]).toMatchObject({
      status: "open",
      movieAId: finalists[0],
      movieBId: finalists[1],
    });
  });

  it("un cierre que llega tarde no toca la ronda que ya se abrió", async () => {
    const { room } = await montarSemis();

    await resolveOpenRound(room, 1);
    // El segundo voto simultáneo llega cuando la final ya existe, con 0 votos.
    const late = await resolveOpenRound(room, 1);
    expect(late).toEqual({ finished: false, ties: 0 });

    const [final] = (await loadMatches(room.id)).filter((match) => match.round === 2);
    expect(final.status).toBe("open");
  });
});
