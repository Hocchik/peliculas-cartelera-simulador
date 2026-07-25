/** Tope de nominaciones por invitado cuando la sala no dice otra cosa. */
export const DEFAULT_MAX_PER_GUEST = 4;

export type NominationSettings = { maxPerPerson?: number };

/**
 * Cuántas puede nominar alguien. `null` = sin tope.
 *
 * El host no tiene tope a propósito: es quien rellena el cuadro si falta gente
 * y quien modera. El resto va limitado para que nadie acapare las 16.
 */
export function nominationLimit(
  settings: NominationSettings,
  isHost: boolean,
): number | null {
  if (isHost) return null;
  return settings.maxPerPerson ?? DEFAULT_MAX_PER_GUEST;
}

export function remainingNominations(limit: number | null, mine: number): number | null {
  return limit === null ? null : Math.max(0, limit - mine);
}

export type RoomFingerprint = {
  phase: string;
  movieCount: number;
  /** Distingue "retiraron una y agregaron otra" de "no pasó nada". */
  lastMovieAt: Date | string | null;
  memberCount: number;
  seedVoteCount?: number;
  voteCount?: number;
  /** Cuántos cruces ya tienen ganador: mueve el cuadro aunque nadie vote más. */
  decidedCount?: number;
};

/** Identidad del estado de una sala. Si cambia, hay algo nuevo que mostrar. */
export function roomVersion(input: RoomFingerprint): string {
  return [
    input.phase,
    input.movieCount,
    input.lastMovieAt ? new Date(input.lastMovieAt).toISOString() : "",
    input.memberCount,
    input.seedVoteCount ?? 0,
    input.voteCount ?? 0,
    input.decidedCount ?? 0,
  ].join("|");
}
