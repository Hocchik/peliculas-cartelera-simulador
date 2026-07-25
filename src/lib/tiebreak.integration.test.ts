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
import { decideMatchByHost, loadMatches, resolveOpenRound } from "@/lib/tournament";

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
