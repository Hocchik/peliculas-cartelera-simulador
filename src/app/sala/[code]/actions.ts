"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  db,
  matches,
  movies,
  participants,
  rooms,
  seedVotes,
  votes,
  type Participant,
  type Room,
} from "@/db";
import { MAX_MOVIES } from "@/lib/bracket";
import { isUniqueViolation } from "@/lib/db-errors";
import { nominationLimit } from "@/lib/nominations";
import { findRoomByCode } from "@/lib/rooms";
import { readDeviceToken } from "@/lib/session";
import { getMovie } from "@/lib/tmdb";
import {
  closeRoundIfComplete,
  generateBracket,
  resolveOpenRound,
} from "@/lib/tournament";

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

async function requireHost(code: string) {
  const auth = await requireParticipant(code);
  if ("error" in auth) return auth;
  if (!auth.me.isHost) return { error: "Solo el host puede hacer eso" };
  return auth;
}

async function memberCount(roomId: string): Promise<number> {
  const [{ total }] = await db()
    .select({ total: count() })
    .from(participants)
    .where(eq(participants.roomId, roomId));
  return total;
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

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

const MIN_MOVIES = 2;

/** Cierra las nominaciones y abre la encuesta de siembra. */
export async function startSeeding(code: string): Promise<ActionResult> {
  const auth = await requireHost(code);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { room } = auth;

  if (room.phase !== "nominating") {
    return { ok: false, error: "Las nominaciones ya estaban cerradas" };
  }

  const [{ total }] = await db()
    .select({ total: count() })
    .from(movies)
    .where(eq(movies.roomId, room.id));

  if (total < MIN_MOVIES) {
    return { ok: false, error: `Hacen falta al menos ${MIN_MOVIES} películas` };
  }

  await db().update(rooms).set({ phase: "seeding" }).where(eq(rooms.id, room.id));
  revalidatePath(`/sala/${room.code}`);
  return { ok: true };
}

const approvalSchema = z.object({ code: z.string().min(1), movieId: z.string().uuid() });

/** Marca o desmarca una película en la siembra. */
export async function toggleApproval(input: {
  code: string;
  movieId: string;
}): Promise<ActionResult> {
  const parsed = approvalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const auth = await requireParticipant(parsed.data.code);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { room, me } = auth;

  if (room.phase !== "seeding") {
    return { ok: false, error: "La siembra no está abierta" };
  }

  const [movie] = await db()
    .select({ id: movies.id })
    .from(movies)
    .where(and(eq(movies.id, parsed.data.movieId), eq(movies.roomId, room.id)))
    .limit(1);

  if (!movie) return { ok: false, error: "Esa película no está en la sala" };

  const [existing] = await db()
    .select({ id: seedVotes.id })
    .from(seedVotes)
    .where(and(eq(seedVotes.participantId, me.id), eq(seedVotes.movieId, movie.id)))
    .limit(1);

  if (existing) {
    await db().delete(seedVotes).where(eq(seedVotes.id, existing.id));
  } else {
    try {
      await db()
        .insert(seedVotes)
        .values({ roomId: room.id, participantId: me.id, movieId: movie.id });
    } catch (error) {
      // Doble clic rápido: ya estaba marcada, no es un error para el usuario.
      if (!isUniqueViolation(error, "seed_votes_unq")) throw error;
    }
  }

  revalidatePath(`/sala/${room.code}`);
  return { ok: true };
}

/** Cierra la siembra, sortea el cuadro y deja la sala en la pantalla del sorteo. */
export async function startDraw(code: string): Promise<ActionResult> {
  const auth = await requireHost(code);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { room } = auth;

  if (room.phase !== "seeding") {
    return { ok: false, error: "La siembra no está abierta" };
  }

  await generateBracket(room);
  await db().update(rooms).set({ phase: "draw" }).where(eq(rooms.id, room.id));
  revalidatePath(`/sala/${room.code}`);
  return { ok: true };
}

/** Termina la animación del sorteo y abre los versus. */
export async function startBracket(code: string): Promise<ActionResult> {
  const auth = await requireHost(code);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { room } = auth;

  if (room.phase !== "draw") {
    return { ok: false, error: "El sorteo no está en curso" };
  }

  await db().update(rooms).set({ phase: "bracket" }).where(eq(rooms.id, room.id));
  revalidatePath(`/sala/${room.code}`);
  return { ok: true };
}

const voteSchema = z.object({
  code: z.string().min(1),
  matchId: z.string().uuid(),
  choiceMovieId: z.string().uuid(),
});

export async function castVote(input: {
  code: string;
  matchId: string;
  choiceMovieId: string;
}): Promise<ActionResult> {
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const auth = await requireParticipant(parsed.data.code);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { room, me } = auth;

  if (room.phase !== "bracket") {
    return { ok: false, error: "No hay versus abiertos" };
  }

  const [match] = await db()
    .select()
    .from(matches)
    .where(and(eq(matches.id, parsed.data.matchId), eq(matches.roomId, room.id)))
    .limit(1);

  if (!match) return { ok: false, error: "Ese cruce no existe" };
  if (match.status !== "open") return { ok: false, error: "Ese cruce ya se cerró" };

  // El voto tiene que ser por una de las dos de ESE cruce, no por cualquiera.
  if (![match.movieAId, match.movieBId].includes(parsed.data.choiceMovieId)) {
    return { ok: false, error: "Esa película no juega este cruce" };
  }

  try {
    await db().insert(votes).values({
      matchId: match.id,
      participantId: me.id,
      choiceMovieId: parsed.data.choiceMovieId,
    });
  } catch (error) {
    if (isUniqueViolation(error, "votes_match_participant_unq")) {
      return { ok: false, error: "Ya votaste este cruce" };
    }
    throw error;
  }

  const closed = await closeRoundIfComplete(room, await memberCount(room.id));
  if (closed?.finished) {
    await db().update(rooms).set({ phase: "finished" }).where(eq(rooms.id, room.id));
  }

  revalidatePath(`/sala/${room.code}`);
  return { ok: true };
}

/** Cierre forzado por el host, con los votos que haya. */
export async function forceCloseRound(code: string): Promise<ActionResult> {
  const auth = await requireHost(code);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { room } = auth;

  if (room.phase !== "bracket") {
    return { ok: false, error: "No hay una ronda abierta" };
  }

  const { finished } = await resolveOpenRound(room);
  if (finished) {
    await db().update(rooms).set({ phase: "finished" }).where(eq(rooms.id, room.id));
  }

  revalidatePath(`/sala/${room.code}`);
  return { ok: true };
}
