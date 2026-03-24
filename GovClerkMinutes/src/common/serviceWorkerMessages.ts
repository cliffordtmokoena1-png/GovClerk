export type ServiceWorkerMessage =
  | {
      kind: "sw_fetch_starting";
      properties: {
        transcriptId: number;
        uploadId: string;
        partNumber: number;
      };
    }
  | {
      kind: "sw_fetch_finished";
      properties: {
        transcriptId: number;
        partNumber: number;
        durationSecs: number;
        response: string;
      };
    }
  | {
      kind: "sw_fetch_fully_finished";
      properties: {
        transcriptId: number;
        response: string;
        duration: number;
        isAdaptive: boolean;
      };
    }
  | {
      kind: "sw_fetch_errored";
      properties: {
        transcriptId: number;
        partNumber?: number;
        isAdaptive: boolean;
        error: string;
      };
    }
  | {
      kind: "sw_pending_fetch_errored";
      properties: {
        transcriptId: number;
        isAdaptive: boolean;
        error: string;
      };
    }
  | {
      kind: "sw_pending_fetch_starting";
      properties: {
        transcriptId: number;
        uploadId: string;
        partNumber: number;
      };
    }
  | {
      kind: "sw_pending_fetch_finished";
      properties: {
        transcriptId: number;
        partNumber: number;
        durationSecs: number;
        response: string;
      };
    }
  | {
      kind: "sw_pending_fetch_fully_finished";
      properties: {
        transcriptId: number;
        response: string;
      };
    }
  | {
      kind: "sw_all_pending_fetch_errored";
      properties: {
        error: string;
      };
    }
  | {
      kind: "sw_fetch_chunk_upload";
      properties: object;
    }
  | {
      kind: "sw_url_refresh";
      properties: {
        transcriptId: number;
      };
    }
  | {
      kind: "sw_fetch_retry";
      properties: object;
    };
