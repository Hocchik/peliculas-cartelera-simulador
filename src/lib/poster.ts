/** Tamaños de póster que sirve TMDB. */
export type PosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "original";

const BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE ?? "https://image.tmdb.org/t/p";

/** Seguro para el cliente: solo arma una URL pública, no toca el token. */
export function posterUrl(path: string | null, size: PosterSize = "w342"): string | null {
  return path ? `${BASE}/${size}${path}` : null;
}
