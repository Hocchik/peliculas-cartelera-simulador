import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";

import {
  db,
  matches,
  movies,
  participants,
  rooms,
  screenings,
  seedVotes,
  votes,
  type Room,
} from "@/db";
import {
  currentRound,
  generateBracket,
  loadMatches,
  resolveOpenRound,
} from "@/lib/tournament";

/**
 * Torneo completo contra la base real. Cubre lo que los tests puros no pueden:
 * que el cuadro se escriba bien, que las rondas encadenen y que el podio acabe
 * en la cartelera.
 */

const CODE = "ITEST1";
const MOVIE_COUNT = 11; // impar a propósito: obliga a repartir byes
const MEMBERS = 3;

let room: Room;
let memberIds: string[] = [];
let movieIds: string[] = [];

async function wipe() {
  await db().delete(rooms).where(eq(rooms.code, CODE));
}

beforeAll(async () => {
  await wipe();

  [room] = await db()
    .insert(rooms)
    .values({
      code: CODE,
      name: "Sala de integración",
      phase: "seeding",
      drawSeed: 20260724,
      tiebreakSeed: 777,
    })
    .returning();

  const people = await db()
    .insert(participants)
    .values(
      Array.from({ length: MEMBERS }, (_, i) => ({
        roomId: room.id,
        nickname: `Persona ${i + 1}`,
        avatarSeed: i,
        isHost: i === 0,
        deviceToken: `itest-${i}`,
      })),
    )
    .returning();
  memberIds = people.map((p) => p.id);

  const inserted = await db()
    .insert(movies)
    .values(
      Array.from({ length: MOVIE_COUNT }, (_, i) => ({
        roomId: room.id,
        tmdbId: 90000 + i,
        title: `Peli ${i + 1}`,
        originalTitle: `Movie ${i + 1}`,
        year: 2000 + i,
        addedBy: memberIds[i % MEMBERS],
      })),
    )
    .returning();
  movieIds = inserted.map((m) => m.id);

  // Siembra desigual: la primera película la aprueban los tres, la segunda dos,
  // la tercera uno. El resto queda sin aprobaciones.
  await db()
    .insert(seedVotes)
    .values([
      ...memberIds.map((participantId) => ({
        roomId: room.id,
        participantId,
        movieId: movieIds[0],
      })),
      ...memberIds.slice(0, 2).map((participantId) => ({
        roomId: room.id,
        participantId,
        movieId: movieIds[1],
      })),
      { roomId: room.id, participantId: memberIds[0], movieId: movieIds[2] },
    ]);
});

afterAll(wipe);

describe("torneo completo", () => {
  it("sortea un cuadro de 16 con byes para las cabezas de serie", async () => {
    await generateBracket(room);
    const all = await loadMatches(room.id);

    // 11 películas → cuadro de 16 → 8 cruces en la primera ronda.
    expect(all).toHaveLength(8);
    expect(all.filter((m) => m.decidedBy === "bye")).toHaveLength(5);

    // La más aprobada no juega la primera ronda: le toca bye.
    const favorita = all.find(
      (m) => m.movieAId === movieIds[0] || m.movieBId === movieIds[0],
    );
    expect(favorita?.decidedBy).toBe("bye");
    expect(favorita?.winnerId).toBe(movieIds[0]);

    // Ningún cruce queda con las dos casillas vacías.
    for (const match of all) {
      expect(match.movieAId === null && match.movieBId === null).toBe(false);
    }
  });

  it("encadena las rondas hasta dejar una sola campeona", async () => {
    let rounds = 0;

    for (;;) {
      const open = currentRound(await loadMatches(room.id)).filter((m) => m.status === "open");
      if (open.length === 0) break;

      // Todos votan por el lado A: gana siempre por votos, sin monedas.
      await db()
        .insert(votes)
        .values(
          open.flatMap((match) =>
            memberIds.map((participantId) => ({
              matchId: match.id,
              participantId,
              choiceMovieId: match.movieAId!,
            })),
          ),
        );

      const { finished } = await resolveOpenRound(room);
      rounds++;
      if (finished) break;
      expect(rounds).toBeLessThan(10); // red de seguridad contra un bucle infinito
    }

    const all = await loadMatches(room.id);
    expect(all.every((m) => m.status === "decided")).toBe(true);

    // Cuadro de 16 → 4 rondas → 15 cruces en total.
    expect(all).toHaveLength(15);
    expect(Math.max(...all.map((m) => m.round))).toBe(4);
  });

  it("deja el podio en la cartelera", async () => {
    const lineup = await db()
      .select()
      .from(screenings)
      .where(eq(screenings.roomId, room.id))
      .orderBy(asc(screenings.position));

    expect(lineup).toHaveLength(4);
    expect(lineup.map((row) => row.position)).toEqual([1, 2, 3, 4]);

    const all = await loadMatches(room.id);
    const final = all.find((m) => m.round === 4);
    expect(lineup[0].movieId).toBe(final?.winnerId);

    // Nadie repetido en la cartelera.
    expect(new Set(lineup.map((row) => row.movieId)).size).toBe(4);
  });

  it("resolver una ronda ya cerrada no rompe ni duplica cruces", async () => {
    const antes = await loadMatches(room.id);
    const { finished } = await resolveOpenRound(room);
    const despues = await loadMatches(room.id);

    expect(finished).toBe(true);
    expect(despues).toHaveLength(antes.length);

    const cartelera = await db()
      .select()
      .from(screenings)
      .where(eq(screenings.roomId, room.id));
    expect(cartelera).toHaveLength(4);
  });

  it("borrar la sala se lleva todo lo colgado", async () => {
    await db().delete(rooms).where(eq(rooms.id, room.id));

    const [{ length: quedan }] = [await db().select().from(matches).where(eq(matches.roomId, room.id))];
    expect(quedan).toBe(0);
  });
});
