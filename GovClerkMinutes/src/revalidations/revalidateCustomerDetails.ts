import { mutate } from "swr";

export async function revalidateCustomerDetails(
  transcriptId: number | null | undefined,
  userId: string,
  orgId?: string | null
) {
  return Promise.all([
    mutate(
      transcriptId == null ? "/api/transcript-status" : `/api/transcript-status?tid=${transcriptId}`
    ),
    mutate(["/api/get-tokens", userId]),
    mutate(["/api/get-tokens", orgId ?? null]),
    mutate("/api/get-tokens"),   // catch-all for any key variant
    mutate("/api/get-customer-details"),
  ]);
}
