export function getClientReferenceId(
  transcriptId: number | null | undefined,
  userId: string | undefined
): string {
  return `${transcriptId || ""}_____${userId}_____${""}`;
}
