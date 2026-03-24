// Formats for Hubspot Date field
export function formatDueDate(dueDate: string): string {
  const d = new Date(dueDate);
  const midnightUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return String(midnightUtc);
}
