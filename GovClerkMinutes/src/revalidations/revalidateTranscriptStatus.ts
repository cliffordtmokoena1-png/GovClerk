import { mutate } from "swr";

export async function revalidateTranscriptStatus(transcriptId: number | undefined) {
  await mutate(
    transcriptId == null ? "/api/transcript-status" : `/api/transcript-status?tid=${transcriptId}`
  );
}
