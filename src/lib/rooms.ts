import "server-only";

import { and, asc, count, eq, inArray, max } from "drizzle-orm";

import {
  db,
  matches,
  movies,
  participants,
  rooms,
  screenings,
  seedVotes,
  votes,
  type Participant,
  type Room,
} from "@/db";
import { bracketSize, totalRounds } from "@/lib/bracket";
import { normalizeRoomCode } from "@/lib/codes";
import { nominationLimit, roomVersion } from "@/lib/nominations";
import { currentRound } from "@/lib/tournament";

import type { MatchView, MovieView } from "@/lib/room-types";

export type { MatchView, MovieView };

export type RoomState = {
  room: Room;
  me: Participant | null;
  members: Participant[];
  movies: MovieView[];
  myNominations: number;
  nominationLimit: number | null;
  version: string;
  /** Siembra: qué marcó quien mira, y cuánta gente ya marcó algo. */
  myApprovals: string[];
  membersWhoSeeded: number;
  /** Cuadro: vacío hasta que se sortea. */
  matches: MatchView[];
  rounds: number;
  /** Avance de la ronda abierta, para que el host sepa a quién espera. */
  roundProgress: { cast: number; expected: number } | null;
  /** Cartelera final, ordenada por posición. */
  lineup: { position: number; movie: MovieView }[];
};

export async function findRoomByCode(rawCode: string): Promise<Room | null> {
  const code = normalizeRoomCode(rawCode);
  if (!code) return null;

  const [room] = await db().select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return room ?? null;
}

/**
 * Huella del estado de la sala. La usan tanto el render como el latido del
 * polling, a propósito: si se calcularan por separado podrían discrepar y el
 * cliente se quedaría refrescando en bucle o sin enterarse de nada.
 */
export async function computeRoomVersion(room: Room): Promise<string> {
  const [movieStats] = await db()
    .select({ total: count(), last: max(movies.createdAt) })
    .from(movies)
    .where(eq(movies.roomId, room.id));

  const [memberStats] = await db()
    .select({ total: count() })
    .from(participants)
    .where(eq(participants.roomId, room.id));

  const fingerprint = {
    phase: room.phase,
    movieCount: movieStats.total,
    lastMovieAt: movieStats.last,
    memberCount: memberStats.total,
  };

  if (room.phase === "seeding") {
    const [seedStats] = await db()
      .select({ total: count() })
      .from(seedVotes)
      .where(eq(seedVotes.roomId, room.id));
    return roomVersion({ ...fingerprint, seedVoteCount: seedStats.total });
  }

  if (room.phase === "draw" || room.phase === "bracket") {
    const [voteStats] = await db()
      .select({ total: count() })
      .from(votes)
      .innerJoin(matches, eq(votes.matchId, matches.id))
      .where(eq(matches.roomId, room.id));

    const [decidedStats] = await db()
      .select({ total: count() })
      .from(matches)
      .where(and(eq(matches.roomId, room.id), eq(matches.status, "decided")));

    return roomVersion({
      ...fingerprint,
      voteCount: voteStats.total,
      decidedCount: decidedStats.total,
    });
  }

  return roomVersion(fingerprint);
}

export async function getRoomState(
  rawCode: string,
  deviceToken: string | null,
): Promise<RoomState | null> {
  const room = await findRoomByCode(rawCode);
  if (!room) return null;

  const members = await db()
    .select()
    .from(participants)
    .where(eq(participants.roomId, room.id))
    .orderBy(asc(participants.createdAt));

  const me = deviceToken
    ? (members.find((p) => p.deviceToken === deviceToken) ?? null)
    : null;

  const rows = await db()
    .select({
      id: movies.id,
      tmdbId: movies.tmdbId,
      title: movies.title,
      originalTitle: movies.originalTitle,
      year: movies.year,
      posterPath: movies.posterPath,
      runtime: movies.runtime,
      voteAverage: movies.voteAverage,
      addedBy: movies.addedBy,
      addedByNickname: participants.nickname,
    })
    .from(movies)
    .leftJoin(participants, eq(movies.addedBy, participants.id))
    .where(eq(movies.roomId, room.id))
    .orderBy(asc(movies.createdAt));

  const isHost = me?.isHost ?? false;

  // Lista explícita a propósito: esto es exactamente lo que sale del servidor.
  // `addedBy` se queda acá. Ocultar la autoría en el render no bastaría,
  // viajaría igual en el payload de la respuesta (invariante 4).
  const movieViews: MovieView[] = rows.map((row) => ({
    id: row.id,
    tmdbId: row.tmdbId,
    title: row.title,
    originalTitle: row.originalTitle,
    year: row.year,
    posterPath: row.posterPath,
    runtime: row.runtime,
    voteAverage: row.voteAverage,
    mine: row.addedBy !== null && row.addedBy === me?.id,
    addedByNickname: isHost ? row.addedByNickname : null,
  }));

  const byId = new Map(movieViews.map((movie) => [movie.id, movie]));

  const state: RoomState = {
    room,
    me,
    members,
    movies: movieViews,
    myNominations: me ? rows.filter((row) => row.addedBy === me.id).length : 0,
    nominationLimit: nominationLimit(room.settings, isHost),
    version: await computeRoomVersion(room),
    myApprovals: [],
    membersWhoSeeded: 0,
    matches: [],
    rounds: rows.length >= 2 ? totalRounds(bracketSize(rows.length)) : 0,
    roundProgress: null,
    lineup: [],
  };

  if (room.phase === "seeding" && me) {
    const mine = await db()
      .select({ movieId: seedVotes.movieId })
      .from(seedVotes)
      .where(and(eq(seedVotes.roomId, room.id), eq(seedVotes.participantId, me.id)));
    state.myApprovals = mine.map((row) => row.movieId);

    // Solo el recuento de gente, nunca qué marcó cada quien: la siembra también
    // se contamina si se ve en vivo lo que van eligiendo los demás.
    const seeded = await db()
      .select({ participantId: seedVotes.participantId })
      .from(seedVotes)
      .where(eq(seedVotes.roomId, room.id))
      .groupBy(seedVotes.participantId);
    state.membersWhoSeeded = seeded.length;
  }

  if (room.phase === "draw" || room.phase === "bracket" || room.phase === "finished") {
    const allMatches = await db()
      .select()
      .from(matches)
      .where(eq(matches.roomId, room.id))
      .orderBy(asc(matches.round), asc(matches.slot));

    const matchIds = allMatches.map((match) => match.id);
    const myVotes = new Map<string, string>();
    const tallies = new Map<string, Record<string, number>>();

    if (matchIds.length > 0) {
      if (me) {
        const rowsVotes = await db()
          .select({ matchId: votes.matchId, choice: votes.choiceMovieId })
          .from(votes)
          .where(and(inArray(votes.matchId, matchIds), eq(votes.participantId, me.id)));
        for (const row of rowsVotes) myVotes.set(row.matchId, row.choice);
      }

      // Un cruce empatado ya cerró la votación, así que su marcador puede verse:
      // es justamente lo que el host necesita para decidir.
      const closedIds = allMatches
        .filter((m) => m.status === "decided" || m.status === "tiebreak")
        .map((m) => m.id);
      if (closedIds.length > 0) {
        const counted = await db()
          .select({ matchId: votes.matchId, choice: votes.choiceMovieId, total: count() })
          .from(votes)
          .where(inArray(votes.matchId, closedIds))
          .groupBy(votes.matchId, votes.choiceMovieId);
        for (const row of counted) {
          const tally = tallies.get(row.matchId) ?? {};
          tally[row.choice] = row.total;
          tallies.set(row.matchId, tally);
        }
      }
    }

    state.matches = allMatches.map((match) => {
      const tally = tallies.get(match.id);
      return {
        id: match.id,
        round: match.round,
        slot: match.slot,
        movieA: match.movieAId ? (byId.get(match.movieAId) ?? null) : null,
        movieB: match.movieBId ? (byId.get(match.movieBId) ?? null) : null,
        winnerId: match.winnerId,
        decidedBy: match.decidedBy,
        status: match.status,
        myChoice: myVotes.get(match.id) ?? null,
        tally:
          match.status === "decided" || match.status === "tiebreak"
            ? {
                a: match.movieAId ? (tally?.[match.movieAId] ?? 0) : 0,
                b: match.movieBId ? (tally?.[match.movieBId] ?? 0) : 0,
              }
            : null,
      };
    });

    const open = currentRound(allMatches).filter((match) => match.status === "open");
    if (open.length > 0) {
      const [{ total }] = await db()
        .select({ total: count() })
        .from(votes)
        .where(
          inArray(
            votes.matchId,
            open.map((match) => match.id),
          ),
        );
      state.roundProgress = { cast: total, expected: open.length * members.length };
    }
  }

  if (room.phase === "finished") {
    const lineup = await db()
      .select({ position: screenings.position, movieId: screenings.movieId })
      .from(screenings)
      .where(eq(screenings.roomId, room.id))
      .orderBy(asc(screenings.position));

    state.lineup = lineup.flatMap((row) => {
      const movie = byId.get(row.movieId);
      return movie ? [{ position: row.position, movie }] : [];
    });
  }

  return state;
}
