import { mutate } from "swr";

export async function revalidateCustomerDetails(
  transcriptId: number | null | undefined,
  userId: string
) {
  return Promise.all([
    mutate(
      transcriptId == null ? "/api/transcript-status" : `/api/transcript-status?tid=${transcriptId}`
    ),
    mutate(["/api/get-tokens", userId]),
    mutate("/api/get-customer-details"),
  ]);
}
