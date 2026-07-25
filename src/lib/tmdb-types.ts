/**
 * Tipos de TMDB compartidos entre servidor y cliente.
 * Viven aparte de `@/lib/tmdb` porque ese módulo es `server-only`.
 */
export type TmdbMovie = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  year: number | null;
  posterPath: string | null;
  overview: string | null;
  voteAverage: number | null;
  runtime: number | null;
};
