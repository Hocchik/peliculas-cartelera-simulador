import "server-only";

import { asc, eq } from "drizzle-orm";

import { db, movies, participants, rooms, type Participant, type Room } from "@/db";
import { normalizeRoomCode } from "@/lib/codes";

export type MovieView = {
  id: string;
  tmdbId: number;
  title: string;
  originalTitle: string;
  year: number | null;
  posterPath: string | null;
  runtime: number | null;
  voteAverage: number | null;
  /** La nominó quien está mirando. Sirve para dejarle retirarla. */
  mine: boolean;
  /** Solo se rellena para el host (invariante 4). Para el resto, `null`. */
  addedByNickname: string | null;
};

export type RoomState = {
  room: Room;
  me: Participant | null;
  members: Participant[];
  movies: MovieView[];
};

export async function findRoomByCode(rawCode: string): Promise<Room | null> {
  const code = normalizeRoomCode(rawCode);
  if (!code) return null;

  const [room] = await db().select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return room ?? null;
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

  return {
    room,
    me,
    members,
    movies: rows.map(({ addedBy, addedByNickname, ...movie }) => ({
      ...movie,
      mine: addedBy !== null && addedBy === me?.id,
      // La autoría se recorta acá, en el servidor. Ocultarla en el render no
      // bastaría: viajaría igual en el payload de la respuesta.
      addedByNickname: isHost ? addedByNickname : null,
    })),
  };
}
