import "server-only";

import { asc, eq } from "drizzle-orm";

import { db, movies, participants, rooms, type Participant, type Room } from "@/db";
import { normalizeRoomCode } from "@/lib/codes";
import { nominationLimit, roomVersion } from "@/lib/nominations";

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
  /** Cuántas nominó quien está mirando. */
  myNominations: number;
  /** Su tope personal. `null` = sin tope (el host). */
  nominationLimit: number | null;
  /** Huella del estado; el polling la compara para saber si hay novedades. */
  version: string;
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
      createdAt: movies.createdAt,
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
    // Lista explícita a propósito: esto es exactamente lo que sale del servidor.
    // `createdAt` y `addedBy` se quedan acá. Ocultar la autoría en el render no
    // bastaría, viajaría igual en el payload de la respuesta (invariante 4).
    movies: rows.map((row) => ({
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
    })),
    myNominations: me ? rows.filter((row) => row.addedBy === me.id).length : 0,
    nominationLimit: nominationLimit(room.settings, isHost),
    // Las filas vienen ordenadas por created_at, así que la última es la más nueva.
    version: roomVersion({
      phase: room.phase,
      movieCount: rows.length,
      lastMovieAt: rows.at(-1)?.createdAt ?? null,
      memberCount: members.length,
    }),
  };
}
