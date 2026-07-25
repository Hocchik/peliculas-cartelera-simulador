import "server-only";

import { z } from "zod";

import type { TmdbMovie } from "./tmdb-types";

export type { TmdbMovie };

/**
 * Cliente de TMDB. Vive solo en el servidor: el token nunca debe llegar al
 * bundle del cliente (invariante 8 de CLAUDE.md). Para armar URLs de pósters
 * desde el cliente, usar `@/lib/poster`.
 */

const BASE = "https://api.themoviedb.org/3";
const LANGUAGE = "es-MX";

/** Un día. Los metadatos de una película no cambian de un minuto a otro. */
const REVALIDATE_SECONDS = 60 * 60 * 24;

const tmdbMovieSchema = z.object({
  id: z.number(),
  title: z.string(),
  original_title: z.string(),
  release_date: z.string().nullish(),
  poster_path: z.string().nullish(),
  overview: z.string().nullish(),
  vote_average: z.number().nullish(),
  runtime: z.number().nullish(),
});

const searchResponseSchema = z.object({
  results: z.array(tmdbMovieSchema),
});

function accessToken(): string {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Falta TMDB_ACCESS_TOKEN (ver .env.example)");
  }
  return token;
}

function toMovie(raw: z.infer<typeof tmdbMovieSchema>): TmdbMovie {
  const year = raw.release_date ? Number(raw.release_date.slice(0, 4)) : NaN;
  return {
    tmdbId: raw.id,
    title: raw.title,
    originalTitle: raw.original_title,
    year: Number.isFinite(year) ? year : null,
    posterPath: raw.poster_path ?? null,
    overview: raw.overview ?? null,
    voteAverage: raw.vote_average ?? null,
    runtime: raw.runtime ?? null,
  };
}

async function request(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("language", LANGUAGE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      accept: "application/json",
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    throw new Error(`TMDB respondió ${res.status} en ${path}`);
  }
  return res.json();
}

export async function searchMovies(query: string): Promise<TmdbMovie[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const parsed = searchResponseSchema.safeParse(
    await request("/search/movie", {
      query: trimmed,
      include_adult: "false",
      page: "1",
    }),
  );

  if (!parsed.success) {
    throw new Error("TMDB devolvió una búsqueda con forma inesperada");
  }

  // Sin póster la tarjeta queda coja y la grilla del cuadro se rompe visualmente.
  return parsed.data.results.filter((r) => r.poster_path).map(toMovie);
}

export async function getMovie(tmdbId: number): Promise<TmdbMovie | null> {
  const parsed = tmdbMovieSchema.safeParse(await request(`/movie/${tmdbId}`));
  return parsed.success ? toMovie(parsed.data) : null;
}
