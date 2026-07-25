"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db, movies, participants, type Participant, type Room } from "@/db";
import { MAX_MOVIES } from "@/lib/bracket";
import { isUniqueViolation } from "@/lib/db-errors";
import { nominationLimit } from "@/lib/nominations";
import { findRoomByCode } from "@/lib/rooms";
import { readDeviceToken } from "@/lib/session";
import { getMovie } from "@/lib/tmdb";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Las Server Actions se pueden invocar con un POST directo, sin pasar por la
 * UI. Cada una tiene que comprobar por sí misma quién llama y a qué sala.
 */
async function requireParticipant(
  code: string,
): Promise<{ room: Room; me: Participant } | { error: string }> {
  const deviceToken = await readDeviceToken();
  if (!deviceToken) return { error: "No estás en esta sala" };

  const room = await findRoomByCode(code);
  if (!room) return { error: "La sala no existe" };

  const [me] = await db()
    .select()
    .from(participants)
    .where(and(eq(participants.roomId, room.id), eq(participants.deviceToken, deviceToken)))
    .limit(1);

  if (!me) return { error: "No estás en esta sala" };
  return { room, me };
}

const addMovieSchema = z.object({
  code: z.string().min(1),
  tmdbId: z.number().int().positive(),
});

export async function addMovie(input: {
  code: string;
  tmdbId: number;
}): Promise<ActionResult> {
  const parsed = addMovieSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const auth = await requireParticipant(parsed.data.code);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { room, me } = auth;

  if (room.phase !== "nominating") {
    return { ok: false, error: "Las nominaciones ya están cerradas" };
  }

  const [{ total }] = await db()
    .select({ total: count() })
    .from(movies)
    .where(eq(movies.roomId, room.id));

  if (total >= MAX_MOVIES) {
    return { ok: false, error: `La sala ya llegó al tope de ${MAX_MOVIES} películas` };
  }

  const limit = nominationLimit(room.settings, me.isHost);
  if (limit !== null) {
    const [{ total: mine }] = await db()
      .select({ total: count() })
      .from(movies)
      .where(and(eq(movies.roomId, room.id), eq(movies.addedBy, me.id)));
    if (mine >= limit) {
      return {
        ok: false,
        error: `Solo puedes nominar ${limit} películas. Retira una si quieres cambiarla.`,
      };
    }
  }

  const movie = await getMovie(parsed.data.tmdbId);
  if (!movie) return { ok: false, error: "TMDB no encontró esa película" };

  try {
    await db().insert(movies).values({
      roomId: room.id,
      tmdbId: movie.tmdbId,
      title: movie.title,
      originalTitle: movie.originalTitle,
      year: movie.year,
      posterPath: movie.posterPath,
      runtime: movie.runtime,
      overview: movie.overview,
      voteAverage: movie.voteAverage,
      addedBy: me.id,
    });
  } catch (error) {
    if (isUniqueViolation(error, "movies_room_tmdb_unq")) {
      return { ok: false, error: `"${movie.title}" ya estaba nominada` };
    }
    throw error;
  }

  revalidatePath(`/sala/${room.code}`);
  return { ok: true };
}

const removeMovieSchema = z.object({
  code: z.string().min(1),
  movieId: z.string().uuid(),
});

export async function removeMovie(input: {
  code: string;
  movieId: string;
}): Promise<ActionResult> {
  const parsed = removeMovieSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const auth = await requireParticipant(parsed.data.code);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { room, me } = auth;

  if (room.phase !== "nominating") {
    return { ok: false, error: "Ya no se pueden retirar nominaciones" };
  }

  const [movie] = await db()
    .select()
    .from(movies)
    .where(and(eq(movies.id, parsed.data.movieId), eq(movies.roomId, room.id)))
    .limit(1);

  if (!movie) return { ok: false, error: "Esa película ya no está en la sala" };

  // Cada uno retira las suyas; el host retira cualquiera (es su filtro previo).
  if (movie.addedBy !== me.id && !me.isHost) {
    return { ok: false, error: "Solo el host puede retirar nominaciones ajenas" };
  }

  await db().delete(movies).where(eq(movies.id, movie.id));
  revalidatePath(`/sala/${room.code}`);
  return { ok: true };
}
