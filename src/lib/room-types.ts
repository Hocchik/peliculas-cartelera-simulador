import type { DecidedBy, MatchStatus } from "@/db/schema";

/**
 * Lo que el servidor deja salir al cliente. Vive aparte de `@/lib/rooms`
 * porque ese módulo es `server-only` y estos tipos los usan los componentes
 * de cliente.
 */

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

export type MatchView = {
  id: string;
  round: number;
  slot: number;
  movieA: MovieView | null;
  movieB: MovieView | null;
  winnerId: string | null;
  decidedBy: DecidedBy | null;
  status: MatchStatus;
  /** Qué votó quien mira. El resto de los votos no viaja hasta que cierra. */
  myChoice: string | null;
  /** Solo cuando el cruce ya está decidido (invariante 3). */
  tally: { a: number; b: number } | null;
};
