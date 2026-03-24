/**
 * Returns true when the given error is a MySQL "Unknown column" (errno 1054)
 * or "Table doesn't exist" (errno 1146) error.
 *
 * Use this helper to detect when production code references a column or table
 * that has not yet been created in the database (e.g. a pending schema
 * migration), so that the caller can gracefully degrade instead of crashing.
 */
export function isUnknownColumnOrMissingTableError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const e = error as { errno?: number; message?: string };
  return (
    e.errno === 1054 ||
    e.errno === 1146 ||
    (typeof e.message === "string" &&
      (e.message.includes("1054") ||
        e.message.includes("Unknown column") ||
        e.message.includes("1146") ||
        e.message.includes("doesn't exist")))
  );
}
