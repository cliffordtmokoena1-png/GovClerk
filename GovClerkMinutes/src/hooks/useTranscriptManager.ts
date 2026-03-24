import { useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import useSWR from "swr";
import { useRouter } from "next/router";

import { ApiTranscriptStatusResponseResult } from "@/pages/api/transcript-status";
import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import { ApiGetMinutesResponseResult } from "@/components/Minutes";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { Speaker } from "@/lib/speakerLabeler";
import { safeCapture } from "@/utils/safePosthog";

type UseTranscriptManagerParams = {
  transcriptId?: number | null;
  initialTranscriptStatus?: ApiTranscriptStatusResponseResult | null;
  country: string | null;
};

type UseTranscriptManagerResult = {
  // Transcript status and metadata
  transcriptStatus?: ApiTranscriptStatusResponseResult;
  mutateTranscriptStatus: (data: ApiTranscriptStatusResponseResult, revalidate: boolean) => void;
  getMinutesData?: ApiGetMinutesResponseResult;
  customerDetails?: ApiGetCustomerDetailsResponse;

  // Business logic states
  showPaywall: boolean;
  showProgress: boolean;
  showFinishTranscribingButton: boolean;

  // Transcript content and speaker data
  transcriptData?: ApiLabelSpeakerResponseResult1;
  isTranscriptLoading: boolean;
  transcriptError: any;

  // Speaker management functions
  triggerSpeakerLabel: (speaker: Speaker, selectedLabel: string) => void;
  handleSegmentRelabel: (
    segmentStart: string,
    segmentStop: string,
    newSpeakerLabel: string
  ) => void;

  // Computed states
  transcribeFinished: boolean;
  isDataReady: boolean;
};

/**
 * Unified hook that manages all transcript-related data and functionality.
 *
 * This hook provides a complete interface for:
 * - Transcript status polling and management
 * - Speaker data and labeling functionality
 * - Minutes generation status
 * - Paywall and progress visibility logic
 * - User authentication and analytics tracking
 */
export default function useTranscriptManager({
  transcriptId,
  initialTranscriptStatus,
  country,
}: UseTranscriptManagerParams): UseTranscriptManagerResult {
  const router = useRouter();
  const { user, isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  // Check if redirected from purchase
  const redirectFromPurchase = router.query.purchased === "true";

  const { data: customerDetails } = useSWR<ApiGetCustomerDetailsResponse>(
    "/api/get-customer-details",
    async (uri: string) => {
      const response = await fetch(uri, {
        method: "POST",
      });

      if (!response.ok) {
        console.error(`get-customer-details: ${response.status} ${response.statusText}`);
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true,
      errorRetryInterval: 5000,
      errorRetryCount: 3,
    }
  );

  let { data: transcriptStatus, mutate: mutateTranscriptStatus } =
    useSWR<ApiTranscriptStatusResponseResult>(
      transcriptId == null
        ? "/api/transcript-status"
        : `/api/transcript-status?tid=${transcriptId}`,
      async (uri) => {
        const response = await fetch(uri);

        if (!response.ok) {
          console.error(`transcript-status: ${response.status} ${response.statusText}`);
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      },
      {
        refreshWhenHidden: true,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        keepPreviousData: true,
        errorRetryInterval: 5000,
        errorRetryCount: 10,
        refreshInterval: (latestData) => {
          if (!latestData?.transcribeFinished && !latestData?.transcribeFailed) {
            return 5000;
          }
          return 0;
        },
      }
    );

  transcriptStatus = transcriptStatus ?? initialTranscriptStatus ?? undefined;

  const { data: getMinutesData } = useSWR<ApiGetMinutesResponseResult, string, [string, number?]>(
    ["/api/get-minutes", transcriptId ?? undefined],
    async ([_, transcriptId]) => {
      const response = await fetch("/api/get-minutes", {
        method: "POST",
        body: JSON.stringify({
          transcriptId,
        }),
      });

      if (!response.ok) {
        console.error(`get-minutes: ${response.status} ${response.statusText}`);
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    },
    {
      refreshWhenHidden: true,
      revalidateOnFocus: false,
      revalidateIfStale: true,
      errorRetryInterval: 5000,
      errorRetryCount: 10,
      dedupingInterval: 2000,
      keepPreviousData: true,
      refreshInterval: (latestData) => {
        if (latestData == null) {
          return 5000;
        }
        const shouldStop = latestData.status === "COMPLETE";
        return shouldStop ? 0 : 5000;
      },
    }
  );

  const transcribeFinished = Boolean(transcriptStatus?.transcribeFinished);

  const {
    data: transcriptData,
    mutate,
    error: transcriptError,
    isLoading: isTranscriptLoading,
  } = useSWR<ApiLabelSpeakerResponseResult1>(
    transcriptId ? `/api/label-speaker?tid=${transcriptId}` : null,
    async (url: string) => {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`label-speaker: ${response.status} ${response.statusText}`);
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    },
    {
      refreshInterval: (latestData) => {
        if (latestData?.isFallback || !transcribeFinished) {
          return 1000;
        }
        return 0;
      },
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      keepPreviousData: true,
      errorRetryInterval: 5000,
      errorRetryCount: 10,
    }
  );

  // Track first signin for Meta conversions API
  useSWR(
    isLoaded && isSignedIn && user && !localStorage.getItem(`mg-first-sign-in-${user.id}`)
      ? "/api/meta-conversions-api-complete-registration"
      : null,
    async (uri) => {
      const firstSignInKey = `mg-first-sign-in-${user?.id}`;
      const isFirstSignIn = !localStorage.getItem(firstSignInKey);
      if (isLoaded && isSignedIn && user && isFirstSignIn) {
        fetch(uri, {
          method: "POST",
          body: JSON.stringify({
            eventName: "CompleteRegistration",
            firstName: user.firstName,
            lastName: user.lastName,
          }),
        });

        safeCapture("user_signup_browser", {
          user_id: user.id,
          email: user.emailAddresses?.[0]?.emailAddress,
          first_name: user.firstName,
          last_name: user.lastName,
        });

        localStorage.setItem(firstSignInKey, "done");
      }
    }
  );

  // Calculate paywall visibility
  let showPaywall =
    transcriptStatus?.tokensRequired != null &&
    transcriptStatus.currentBalance != null &&
    transcriptStatus.tokensRequired > transcriptStatus.currentBalance;

  if (transcriptStatus?.uploadKind === "audio") {
    showPaywall = Boolean(
      showPaywall && transcriptStatus.transcribePaused && transcriptStatus.previewTranscribeFinished
    );
  } else {
    // For word/text uploads, still check transcribePaused even though they might have transcribeFinished=true
    showPaywall = Boolean(
      showPaywall &&
        (transcriptStatus?.transcribePaused || getMinutesData?.status === "NOT_STARTED")
    );
  }

  const showProgress =
    transcriptId != null &&
    transcriptStatus?.uploadKind === "audio" &&
    !transcriptStatus?.transcribeFinished &&
    !transcriptStatus?.transcribeFailed;

  const showFinishTranscribingButton = Boolean(
    !redirectFromPurchase &&
      transcriptStatus?.transcribePaused &&
      transcriptStatus?.tokensRequired != null &&
      transcriptStatus?.currentBalance != null &&
      transcriptStatus?.tokensRequired <= transcriptStatus.currentBalance &&
      (transcriptStatus?.uploadKind === "audio" ||
        transcriptStatus?.uploadKind === "text" ||
        transcriptStatus?.uploadKind === "word")
  );

  // Track paywall views
  useEffect(() => {
    if (showPaywall && user != null && transcriptStatus) {
      const firstPaywallKey = `mg-user-sees-paywall-${transcriptId}`;
      const isFirstPaywall = !localStorage.getItem(firstPaywallKey);
      if (isFirstPaywall) {
        fetch("/api/meta-conversions-api-initiate-checkout", {
          method: "POST",
          body: JSON.stringify({
            firstName: user.firstName,
            lastName: user.lastName,
          }),
        });

        localStorage.setItem(firstPaywallKey, "done");
      }

      safeCapture("user_sees_paywall", {
        country,
        transcript_id: transcriptId,
        upload_kind: transcriptStatus?.uploadKind,
        tokens_required: transcriptStatus?.tokensRequired,
        current_balance: transcriptStatus?.currentBalance,
      });
    }
  }, [country, showPaywall, transcriptId, transcriptStatus, user]);

  // Speaker labeling
  const triggerSpeakerLabel = useCallback(
    (speaker: Speaker, selectedLabel: string) => {
      mutate(
        async () => {
          await fetch("/api/label-speaker", {
            method: "POST",
            body: JSON.stringify(speaker),
          }).then((resp) => resp.json());

          if (transcriptData == null || transcriptData.labelsToSpeaker == null) {
            console.error("RETURNING UNDEFINED IN MUTATE??");
            return undefined;
          }

          return {
            ...transcriptData,
            labelsToSpeaker: {
              ...transcriptData.labelsToSpeaker,
              [selectedLabel]: speaker,
            },
          };
        },
        {
          optimisticData: transcriptData
            ? {
                ...transcriptData,
                labelsToSpeaker: {
                  ...transcriptData.labelsToSpeaker,
                  [selectedLabel]: speaker,
                },
              }
            : undefined,
        }
      );
    },
    [transcriptData, mutate]
  );

  // Segment relabeling
  const handleSegmentRelabel = useCallback(
    (segmentStart: string, segmentStop: string, newSpeakerLabel: string) => {
      if (!transcriptData) {
        return;
      }

      // Find the target segment index
      const targetIndex = transcriptData.transcript.segments.findIndex(
        (segment) => segment.start === segmentStart && segment.stop === segmentStop
      );

      if (targetIndex === -1) {
        return;
      }

      const newSegments = [...transcriptData.transcript.segments];
      newSegments[targetIndex] = {
        ...newSegments[targetIndex],
        speaker: newSpeakerLabel,
      };

      mutate(
        {
          ...transcriptData,
          transcript: {
            ...transcriptData.transcript,
            segments: newSegments,
          },
        },
        false
      );
    },
    [transcriptData, mutate]
  );

  // Determine if all necessary data is ready
  const isDataReady = Boolean(
    transcriptStatus && (transcriptId ? transcriptData : true) // Only require transcript data if we have an ID
  );

  return {
    // Status and metadata
    transcriptStatus,
    mutateTranscriptStatus,
    getMinutesData,
    customerDetails,

    // Business logic
    showPaywall,
    showProgress,
    showFinishTranscribingButton,

    // Transcript content
    transcriptData,
    isTranscriptLoading,
    transcriptError,

    // Speaker management
    triggerSpeakerLabel,
    handleSegmentRelabel,

    // Computed states
    transcribeFinished,
    isDataReady,
  };
}
