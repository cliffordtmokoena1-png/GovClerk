import useSWRMutation, { SWRMutationResponse } from "swr/mutation";

export default function useTranscribeSegmentsMutation(
  transcriptId: number | null | undefined
): SWRMutationResponse<Response, Error> {
  return useSWRMutation(
    transcriptId == null ? null : `/api/resume-transcribe?transcriptId=${transcriptId}`,
    async (uri: string) => {
      return await fetch(uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  );
}
