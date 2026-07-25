/** Violación de índice único en Postgres. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, constraint: violated } = error as { code?: string; constraint?: string };
  if (code !== "23505") return false;
  return constraint ? violated === constraint : true;
}
