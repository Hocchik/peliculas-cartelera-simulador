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

/** Identidad del estado de una sala. Si cambia, hay algo nuevo que mostrar. */
export function roomVersion(input: {
  phase: string;
  movieCount: number;
  lastMovieAt: Date | string | null;
  memberCount: number;
}): string {
  const last = input.lastMovieAt
    ? new Date(input.lastMovieAt).toISOString()
    : "";
  return [input.phase, input.movieCount, last, input.memberCount].join("|");
}
