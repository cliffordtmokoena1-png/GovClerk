import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import useSWR, { mutate } from "swr";
import {
  LuFileText,
  LuAlertCircle,
  LuPlay,
  LuRotateCw,
  LuLoader2,
  LuPin,
  LuDownload,
  LuUpload,
  LuPencil,
  LuCheck,
  LuX,
  LuChevronDown,
  LuChevronUp,
} from "react-icons/lu";
import { toast } from "sonner";
import { useOrgContext } from "@/contexts/OrgContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import MinutesProgressStepper from "@/components/MinutesProgressStepper";
import MinutesEditor from "@/components/editor/MinutesEditor";
import { VersionTabs } from "@/components/editor/VersionTabs";
import { RecordingPlayer, RecordingPlayerHandle } from "./RecordingPlayer";
import { TranscriptPanel } from "./TranscriptPanel";
import { SpeakerLabelerPopover, SpeakerLabelerDrawer } from "./SpeakerLabeler";
import { SpeakerTagInput } from "./SpeakerTagInput";
import { TranscriptExportMenu } from "./TranscriptExportMenu";
import { useMinutesRegenerate } from "@/hooks/useMinutesRegenerate";
import type { PortalMeetingWithArtifacts } from "@/types/portal";
import type { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import type { SpeakerLabelerOptions } from "@/lib/speakerLabeler";

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Auto-detect (recommended)" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "ru", label: "Russian" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "tr", label: "Turkish" },
];

type ApiGetMinutesResponseResult = {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  minutes?: string[];
  rating?: string;
  steps?: { name: string; status: string }[];
  transcribeFailed?: boolean;
};

type BroadcastSegmentsCheckResult = {
  hasSegments: boolean;
  segmentCount: number;
  speakerLabeledCount?: number;
  estimatedDurationMs?: number | null;
  quality?: "good" | "fair" | "basic" | null;
};

type RecordingUrlResult = {
  url: string;
  durationMs: number | null;
};

type Props = {
  meeting: PortalMeetingWithArtifacts;
  onUpdate?: () => void;
};

export default function MeetingMinutesTab({ meeting, onUpdate }: Props) {
  const { orgId } = useOrgContext();
  const router = useRouter();

  const [autoStartTimedOut, setAutoStartTimedOut] = useState(false);

  const isAutoStarting =
    router.query.autostart === "true" &&
    !!onUpdate &&
    !autoStartTimedOut &&
    !meeting.minutesTranscriptId;

  const [isStarting, setIsStarting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [isPinning, setIsPinning] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSavingToDocuments, setIsSavingToDocuments] = useState(false);
  const hasTriggeredArtifactGeneration = useRef(false);
  const prevMinutesCountRef = useRef<number | null>(null);

  // Feature 1: Audio upload state
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // Feature 3: Language selection
  const [selectedLanguage, setSelectedLanguage] = useState("auto");

  // Feature 4: Expected speakers
  const [expectedSpeakers, setExpectedSpeakers] = useState<string[]>([]);
  const [showSpeakerInput, setShowSpeakerInput] = useState(false);

  // Feature 2: Transcript editing
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);

  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const playerRef = useRef<RecordingPlayerHandle>(null);

  const [selectedSpeakerLabel, setSelectedSpeakerLabel] = useState<string | null>(null);
  const [speakerLabelerAnchor, setSpeakerLabelerAnchor] = useState<HTMLElement | null>(null);
  const [isLabelerOpen, setIsLabelerOpen] = useState(false);
  const [userInputName, setUserInputName] = useState("");

  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const lastClickTargetRef = useRef<HTMLElement | null>(null);

  const { data: segmentsCheck, isLoading: isCheckingSegments } =
    useSWR<BroadcastSegmentsCheckResult>(
      !meeting.minutesTranscriptId
        ? `/api/portal/meetings/${meeting.id}/minutes/check-segments`
        : null,
      async (url: string) => {
        const res = await fetch(`${url}?orgId=${orgId}`);
        if (!res.ok) {
          return { hasSegments: false, segmentCount: 0 };
        }
        return res.json();
      }
    );

  const { data: minutesData } = useSWR<ApiGetMinutesResponseResult>(
    meeting.minutesTranscriptId ? `/api/get-minutes/${meeting.id}` : null,
    async () => {
      const res = await fetch("/api/get-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptId: meeting.minutesTranscriptId }),
      });
      return res.json();
    },
    {
      refreshInterval: (data) =>
        (data?.status === "IN_PROGRESS" || data?.status === "NOT_STARTED") && !data?.transcribeFailed ? 3000 : 0,
    }
  );

  const speakerDataKey =
    meeting.minutesTranscriptId && minutesData?.status === "COMPLETE"
      ? `/api/label-speaker?tid=${meeting.minutesTranscriptId}`
      : null;

  const { data: speakerApiData, mutate: mutateSpeakerData } =
    useSWR<ApiLabelSpeakerResponseResult1>(speakerDataKey, async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch speaker data");
      }
      return res.json();
    });

  const { data: recordingUrlData } = useSWR<RecordingUrlResult>(
    meeting.minutesTranscriptId && minutesData?.status === "COMPLETE"
      ? `/api/portal/meetings/${meeting.id}/recording-url?orgId=${orgId}`
      : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch recording URL");
      }
      return res.json();
    }
  );

  const { regenerate, isRegenerating, canRegenerate } = useMinutesRegenerate({
    transcriptId: meeting.minutesTranscriptId ?? null,
    currentVersionCount: minutesData?.minutes?.length ?? 0,
    orgId,
    onSuccess: () => {
      mutate(`/api/get-minutes/${meeting.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Auto-select latest version when a new version appears after regeneration
  useEffect(() => {
    const currentCount = minutesData?.minutes?.length ?? 0;
    if (prevMinutesCountRef.current !== null && currentCount > prevMinutesCountRef.current) {
      setSelectedVersion(currentCount - 1);
    }
    prevMinutesCountRef.current = currentCount;
  }, [minutesData?.minutes?.length]);

  useEffect(() => {
    if (
      minutesData?.status === "COMPLETE" &&
      meeting.minutesTranscriptId &&
      !hasTriggeredArtifactGeneration.current
    ) {
      hasTriggeredArtifactGeneration.current = true;

      fetch(`/api/portal/meetings/${meeting.id}/minutes/generate-artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      })
        .then((res) => {
          if (res.ok && onUpdate) {
            onUpdate();
          }
        })
        .catch((err) => {
          console.error("Failed to generate artifacts:", err);
        });
    }
  }, [minutesData?.status, meeting.minutesTranscriptId, meeting.id, orgId, onUpdate]);

  useEffect(() => {
    if (!isAutoStarting) {
      return;
    }

    const interval = setInterval(() => {
      onUpdate!();
    }, 3000);

    const timeout = setTimeout(() => {
      setAutoStartTimedOut(true);
    }, 60_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isAutoStarting, onUpdate]);

  const sortedSpeakers = useMemo(() => {
    if (!speakerApiData?.labelsToSpeaker) {
      return [];
    }
    return Object.entries(speakerApiData.labelsToSpeaker).sort(
      ([, speakerA], [, speakerB]) => speakerB.uses - speakerA.uses
    );
  }, [speakerApiData?.labelsToSpeaker]);

  const handleSpeakerLabeled = useCallback(
    async (name: string, label: string, options?: SpeakerLabelerOptions) => {
      const tid = meeting.minutesTranscriptId;
      if (!tid) {
        return;
      }
      const existingSpeaker = speakerApiData?.labelsToSpeaker?.[label];
      if (!existingSpeaker) {
        return;
      }
      const updatedSpeaker = {
        ...existingSpeaker,
        name,
        uses: options?.resetUses ? 0 : existingSpeaker.uses,
        suggestedSpeakers: options?.clearSuggestions
          ? undefined
          : existingSpeaker.suggestedSpeakers,
      };

      const optimisticData = speakerApiData
        ? {
            ...speakerApiData,
            labelsToSpeaker: {
              ...speakerApiData.labelsToSpeaker,
              [label]: updatedSpeaker,
            },
          }
        : undefined;

      mutateSpeakerData(
        async () => {
          await fetch("/api/label-speaker", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedSpeaker),
          });
          return optimisticData;
        },
        { optimisticData }
      );
    },
    [meeting.minutesTranscriptId, speakerApiData, mutateSpeakerData]
  );

  const handlePinVersion = async (version: number) => {
    setIsPinning(true);
    try {
      const res = await fetch(`/api/portal/meetings/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, minutesVersion: version, mgBoardId: meeting.mgBoardId }),
      });
      if (!res.ok) {
        throw new Error("Failed to pin version");
      }
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to pin version:", error);
    } finally {
      setIsPinning(false);
    }
  };

  const handleStartMinutes = async () => {
    setIsStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/portal/meetings/${meeting.id}/minutes/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          language: selectedLanguage !== "auto" ? selectedLanguage : undefined,
          expectedSpeakers: expectedSpeakers.length > 0 ? expectedSpeakers : undefined,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start minutes");
      }
      const data = await res.json();
      if (data.alreadyExists) {
        if (onUpdate) {
          onUpdate();
        }
        return;
      }
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to start minutes:", error);
      setStartError(error instanceof Error ? error.message : "Failed to start minutes generation");
    } finally {
      setIsStarting(false);
    }
  };

  const handleRetryMinutes = async () => {
    setIsRetrying(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/portal/meetings/${meeting.id}/minutes/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to retry minutes generation");
      }
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to retry minutes:", error);
      setStartError(error instanceof Error ? error.message : "Failed to retry minutes generation");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveMinutes = useCallback(
    async (content: string) => {
      setIsSaving(true);
      try {
        await fetch("/api/save-minutes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcriptId: meeting.minutesTranscriptId,
            content: content,
            version: selectedVersion + 1,
          }),
        });
        setLastSaved(new Date());
      } catch (err) {
        console.error("Failed to save minutes:", err);
        toast.error("Failed to save minutes");
      } finally {
        setIsSaving(false);
      }
    },
    [meeting.minutesTranscriptId, selectedVersion]
  );

  // Feature 1: Audio upload handler
  const handleAudioFileSelect = async (file: File) => {
    if (!file) return;

    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/m4a",
      "audio/x-m4a",
      "audio/webm",
      "audio/ogg",
      "audio/flac",
      "audio/x-flac",
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Unsupported file type. Please upload mp3, wav, m4a, mp4, webm, ogg, or flac.");
      return;
    }
    const maxSize = 2 * 1024 * 1024 * 1024; // 2 GB
    if (file.size > maxSize) {
      toast.error("File is too large. Maximum size is 2 GB.");
      return;
    }

    setIsUploadingAudio(true);
    setUploadProgress(0);
    setStartError(null);

    try {
      // Phase 1: create transcript record and get presigned URL (or multipart credentials)
      const initRes = await fetch(`/api/portal/meetings/${meeting.id}/minutes/upload-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          language: selectedLanguage !== "auto" ? selectedLanguage : undefined,
        }),
      });

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to initialize upload");
      }

      const { transcriptId, uploadUrl, multipartUpload, alreadyExists } = await initRes.json();
      if (alreadyExists) {
        onUpdate?.();
        return;
      }

      // Phase 2: upload file to S3
      if (multipartUpload) {
        // Large file: upload in parts using S3 multipart upload
        const { uploadId, partSize, parts } = multipartUpload as {
          uploadId: string;
          partSize: number;
          parts: Array<{ partNumber: number; url: string }>;
        };

        const completedParts: Array<{ partNumber: number; etag: string }> = [];
        let totalUploaded = 0;

        for (const part of parts) {
          const start = (part.partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const chunk = file.slice(start, end);

          const etag = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (event) => {
              if (event.lengthComputable) {
                const chunkUploaded = totalUploaded + event.loaded;
                setUploadProgress(Math.round((chunkUploaded / file.size) * 100));
              }
            });
            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                const responseEtag = xhr.getResponseHeader("ETag") ?? "";
                totalUploaded += chunk.size;
                resolve(responseEtag);
              } else {
                reject(new Error(`Part ${part.partNumber} upload failed: ${xhr.status}`));
              }
            });
            xhr.addEventListener("error", () =>
              reject(new Error(`Network error uploading part ${part.partNumber}`))
            );
            xhr.open("PUT", part.url);
            xhr.setRequestHeader("Content-Type", file.type);
            xhr.send(chunk);
          });

          completedParts.push({ partNumber: part.partNumber, etag });
        }

        // Phase 2.5: complete the multipart upload
        const completeRes = await fetch(
          `/api/portal/meetings/${meeting.id}/minutes/upload-audio`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orgId,
              action: "complete-multipart",
              transcriptId,
              uploadId,
              parts: completedParts,
            }),
          }
        );

        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to complete multipart upload");
        }
      } else {
        // Small file: single presigned PUT upload
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`S3 upload failed: ${xhr.status}`));
            }
          });
          xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });
      }

      setUploadProgress(100);

      // Phase 3: link to meeting and trigger diarization
      const triggerRes = await fetch(`/api/portal/meetings/${meeting.id}/minutes/upload-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, transcriptId }),
      });

      if (!triggerRes.ok) {
        const err = await triggerRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start processing");
      }

      toast.success("Audio uploaded! Transcription and minutes generation has started.");
      onUpdate?.();
    } catch (error) {
      console.error("Audio upload failed:", error);
      setStartError(error instanceof Error ? error.message : "Failed to upload audio");
      toast.error(error instanceof Error ? error.message : "Failed to upload audio");
    } finally {
      setIsUploadingAudio(false);
      setUploadProgress(0);
      if (audioFileInputRef.current) {
        audioFileInputRef.current.value = "";
      }
    }
  };

  // Feature 2: Transcript editing handlers
  const handleSaveTranscriptEdits = async () => {
    const changedIndices = Object.keys(editedTexts).map(Number);
    if (changedIndices.length === 0) {
      setIsEditingTranscript(false);
      return;
    }

    setIsSavingTranscript(true);
    try {
      const segments = changedIndices.map((index) => ({
        index,
        text: editedTexts[index],
      }));

      const res = await fetch(`/api/portal/meetings/${meeting.id}/minutes/edit-transcript`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, segments }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save transcript");
      }

      toast.success("Transcript updated successfully.");
      setEditedTexts({});
      setIsEditingTranscript(false);
      // Invalidate speaker data cache to refetch transcript
      mutate(`/api/label-speaker?tid=${meeting.minutesTranscriptId}`);
    } catch (error) {
      console.error("Failed to save transcript edits:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save transcript");
    } finally {
      setIsSavingTranscript(false);
    }
  };

  const handleCancelTranscriptEdit = () => {
    setEditedTexts({});
    setIsEditingTranscript(false);
  };

  const handleTextChange = useCallback((segmentIndex: number, text: string) => {
    setEditedTexts((prev) => ({ ...prev, [segmentIndex]: text }));
  }, []);

  const handleSaveToDocuments = async () => {
    if (!meeting.minutesTranscriptId) {
      return;
    }

    setIsSavingToDocuments(true);
    try {
      const res = await fetch(`/api/portal/meetings/${meeting.id}/minutes/generate-artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, version: selectedVersion + 1 }),
      });

      if (!res.ok) {
        throw new Error(`Failed: ${res.status}`);
      }

      toast.success("Minutes saved to documents.");
      onUpdate?.();
    } catch {
      toast.error("Failed to save minutes to documents.");
    } finally {
      setIsSavingToDocuments(false);
    }
  };

  const handleRegenerateSubmit = async () => {
    if (!feedbackText.trim()) {
      toast.error("Please provide feedback for regeneration");
      return;
    }

    setIsRegenerateModalOpen(false);
    setFeedbackText("");

    try {
      await regenerate(feedbackText);
      toast.success("Minutes regeneration started. A new version will appear shortly.");
    } catch {
      // Error is already handled by the hook
    }
  };

  if (!meeting.minutesTranscriptId) {
    if (isAutoStarting) {
      return (
        <div className="p-4 md:p-6">
          <div className="max-w-5xl mx-auto w-full flex flex-col items-center justify-center py-12">
            <div className="max-w-lg w-full mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Starting Minutes Generation
                </h3>
                <p className="text-sm text-muted-foreground">
                  Processing the broadcast recording and preparing for transcription...
                </p>
              </div>

              <div className="flex items-center justify-center">
                <Spinner className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    const canStart = segmentsCheck?.hasSegments === true;
    const noSegments = segmentsCheck?.hasSegments === false && !isCheckingSegments;
    const quality = segmentsCheck?.quality;
    const speakerLabeledCount = segmentsCheck?.speakerLabeledCount ?? 0;
    const segmentCount = segmentsCheck?.segmentCount ?? 0;
    const estimatedDurationMs = segmentsCheck?.estimatedDurationMs;

    const qualityBadge =
      quality === "good"
        ? { label: "Good quality", className: "bg-green-100 text-green-700" }
        : quality === "fair"
          ? { label: "Fair quality", className: "bg-yellow-100 text-yellow-700" }
          : quality === "basic"
            ? { label: "Basic quality", className: "bg-orange-100 text-orange-700" }
            : null;

    return (
      <div className="p-4 md:p-6">
        {/* Hidden file input for audio upload */}
        <input
          ref={audioFileInputRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleAudioFileSelect(file);
          }}
        />

        <div className="max-w-5xl mx-auto w-full flex flex-col items-center justify-center py-12 bg-muted/30 rounded-lg border border-dashed border-border">
          <div className="max-w-md mx-auto text-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-muted">
              <LuFileText className="w-8 h-8 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">No Minutes Yet</h3>
              <p className="text-sm text-muted-foreground">
                {noSegments
                  ? "No broadcast transcript found. Upload an audio/video file to generate minutes."
                  : "Minutes can be generated from live broadcast transcripts or by uploading an audio/video file."}
              </p>
            </div>

            {startError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                <LuAlertCircle className="w-4 h-4 shrink-0" />
                <span>{startError}</span>
              </div>
            )}

            {/* Feature 3: Language selector */}
            <div className="text-left space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Transcription Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={isStarting || isUploadingAudio}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Feature 4: Expected speakers */}
            <div className="text-left space-y-1">
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowSpeakerInput((v) => !v)}
              >
                {showSpeakerInput ? (
                  <LuChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <LuChevronDown className="w-3.5 h-3.5" />
                )}
                Add Expected Speakers (optional)
                {expectedSpeakers.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                    {expectedSpeakers.length}
                  </span>
                )}
              </button>
              {showSpeakerInput && (
                <SpeakerTagInput
                  speakers={expectedSpeakers}
                  onChange={setExpectedSpeakers}
                  disabled={isStarting || isUploadingAudio}
                />
              )}
            </div>

            {/* Feature 6: Segment quality indicator */}
            {canStart && segmentCount > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg text-left space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {speakerLabeledCount} of {segmentCount} segments with speaker labels
                  </span>
                  {qualityBadge && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${qualityBadge.className}`}
                    >
                      {qualityBadge.label}
                    </span>
                  )}
                </div>
                {estimatedDurationMs !== null && estimatedDurationMs !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Estimated duration:{" "}
                    {estimatedDurationMs >= 3600000
                      ? `${Math.floor(estimatedDurationMs / 3600000)}h ${Math.floor((estimatedDurationMs % 3600000) / 60000)}m`
                      : `${Math.floor(estimatedDurationMs / 60000)}m ${Math.floor((estimatedDurationMs % 60000) / 1000)}s`}
                  </p>
                )}
              </div>
            )}

            {/* Upload progress */}
            {isUploadingAudio && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="w-4 h-4" />
                  <span>
                    {uploadProgress < 100
                      ? `Uploading... ${uploadProgress}%`
                      : "Processing upload..."}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary rounded-full h-1.5 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {isCheckingSegments ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner className="w-4 h-4" />
                <span>Checking broadcast data...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {!noSegments && (
                  <Button
                    onClick={handleStartMinutes}
                    disabled={isStarting || isUploadingAudio || !canStart}
                    className="w-full"
                  >
                    {isStarting ? (
                      <>
                        <Spinner className="w-4 h-4" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <LuPlay className="w-4 h-4" />
                        Start Minutes Generation
                      </>
                    )}
                  </Button>
                )}

                <div className="flex items-center gap-2">
                  {!noSegments && <div className="flex-1 border-t border-border" />}
                  {!noSegments && <span className="text-xs text-muted-foreground px-1">or</span>}
                  {!noSegments && <div className="flex-1 border-t border-border" />}
                </div>

                <Button
                  variant="outline"
                  onClick={() => audioFileInputRef.current?.click()}
                  disabled={isStarting || isUploadingAudio}
                  className="w-full"
                >
                  <LuUpload className="w-4 h-4" />
                  Upload Audio/Video File
                </Button>
                <p className="text-xs text-muted-foreground">
                  Supports mp3, wav, m4a, mp4, webm, ogg, flac — up to 500 MB
                </p>
              </div>
            )}

            {canStart && (
              <p className="text-xs text-muted-foreground">
                This will process the broadcast transcript ({segmentsCheck?.segmentCount} segments)
                to generate meeting minutes.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (minutesData?.status === "IN_PROGRESS") {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center justify-center py-12">
          <div className="max-w-lg w-full mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Generating Minutes</h3>
              <p className="text-sm text-muted-foreground">
                Processing the transcript and generating meeting minutes...
              </p>
            </div>

            <MinutesProgressStepper steps={minutesData.steps} isPaused={false} />

            {minutesData.minutes && minutesData.minutes.length > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <h4 className="font-medium text-sm text-foreground mb-2">Partial Minutes</h4>
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: minutesData.minutes[0].replace(/\n/g, "<br>"),
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (minutesData?.status === "COMPLETE" && minutesData.minutes) {
    return (
      <div className="h-full flex flex-col p-4 md:p-6">
        <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row flex-1 min-h-0 gap-4">
          <div className="lg:w-1/2 flex flex-col min-h-0 gap-4">
            {recordingUrlData?.url && (
              <div className="shrink-0 bg-card rounded-lg border border-border">
                <RecordingPlayer
                  ref={playerRef}
                  src={recordingUrlData.url}
                  onTimeUpdate={(time) => setCurrentAudioTime(time)}
                />
              </div>
            )}

            <div className="flex-1 min-h-0 bg-card rounded-lg border border-border flex flex-col">
              <div className="px-4 py-3 bg-muted/50 border-b border-border shrink-0 flex items-center justify-between">
                <h3 className="font-medium text-sm text-foreground">Transcript</h3>
                <div className="flex items-center gap-1">
                  {isEditingTranscript ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1 text-destructive hover:text-destructive"
                        onClick={handleCancelTranscriptEdit}
                        disabled={isSavingTranscript}
                      >
                        <LuX className="w-3.5 h-3.5" />
                        <span className="text-xs">Cancel</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1"
                        onClick={handleSaveTranscriptEdits}
                        disabled={isSavingTranscript}
                      >
                        {isSavingTranscript ? (
                          <LuLoader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <LuCheck className="w-3.5 h-3.5" />
                        )}
                        <span className="text-xs">Save Changes</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1"
                        onClick={() => setIsEditingTranscript(true)}
                        title="Edit transcript"
                      >
                        <LuPencil className="w-3.5 h-3.5" />
                        <span className="text-xs">Edit</span>
                      </Button>
                      <TranscriptExportMenu meeting={meeting} orgId={orgId} />
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                {speakerApiData?.transcript ? (
                  <div
                    className="flex-1 min-h-0 flex flex-col"
                    onClickCapture={(event) => {
                      lastClickTargetRef.current = event.target as HTMLElement;
                    }}
                  >
                    <TranscriptPanel
                      transcript={speakerApiData.transcript}
                      labelsToSpeaker={speakerApiData.labelsToSpeaker || {}}
                      currentAudioTime={currentAudioTime}
                      onSegmentClick={(timestamp) => playerRef.current?.seek(timestamp)}
                      onSpeakerClick={(label) => {
                        if (isEditingTranscript) return;
                        setSelectedSpeakerLabel(label);
                        setUserInputName(speakerApiData?.labelsToSpeaker?.[label]?.name || "");
                        setSpeakerLabelerAnchor(lastClickTargetRef.current);
                        setIsLabelerOpen(true);
                      }}
                      editable={isEditingTranscript}
                      editedTexts={editedTexts}
                      onTextChange={handleTextChange}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Spinner className="w-6 h-6 mb-2" />
                    <p className="text-sm">Loading transcript...</p>
                  </div>
                )}
              </div>
            </div>

            {isDesktop ? (
              <SpeakerLabelerPopover
                isOpen={isLabelerOpen}
                onClose={() => setIsLabelerOpen(false)}
                anchorEl={speakerLabelerAnchor}
                labelsToSpeaker={speakerApiData?.labelsToSpeaker || {}}
                knownSpeakers={speakerApiData?.knownSpeakers || []}
                selectedLabel={selectedSpeakerLabel || ""}
                sortedSpeakers={sortedSpeakers}
                onSpeakerLabeled={handleSpeakerLabeled}
                menuOnClose={() => setIsLabelerOpen(false)}
                userInputName={userInputName}
                setUserInputName={setUserInputName}
                isDesktop
              />
            ) : (
              <SpeakerLabelerDrawer
                isOpen={isLabelerOpen}
                onClose={() => setIsLabelerOpen(false)}
                labelsToSpeaker={speakerApiData?.labelsToSpeaker || {}}
                knownSpeakers={speakerApiData?.knownSpeakers || []}
                selectedLabel={selectedSpeakerLabel || ""}
                sortedSpeakers={sortedSpeakers}
                onSpeakerLabeled={handleSpeakerLabeled}
                menuOnClose={() => setIsLabelerOpen(false)}
                userInputName={userInputName}
                setUserInputName={setUserInputName}
              />
            )}
          </div>

          <div className="lg:w-1/2 flex flex-col min-h-0 bg-card rounded-lg border border-border">
            <div className="px-4 py-3 bg-muted/50 border-b border-border shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <VersionTabs
                  versions={minutesData.minutes || []}
                  selectedVersion={selectedVersion}
                  onVersionChange={setSelectedVersion}
                  pinnedVersion={meeting.minutesVersion}
                  onPinVersion={handlePinVersion}
                  isPinning={isPinning}
                />

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gap-1"
                    onClick={() => handlePinVersion(selectedVersion + 1)}
                    disabled={isPinning || meeting.minutesVersion === selectedVersion + 1}
                    title={
                      meeting.minutesVersion === selectedVersion + 1
                        ? "This version is pinned"
                        : "Pin this version"
                    }
                  >
                    {isPinning ? (
                      <LuLoader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LuPin
                        className={cn(
                          "w-3.5 h-3.5",
                          meeting.minutesVersion === selectedVersion + 1 &&
                            "text-primary fill-primary"
                        )}
                      />
                    )}
                    <span className="text-xs">Pin</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gap-1"
                    onClick={handleSaveToDocuments}
                    disabled={isSavingToDocuments || isRegenerating}
                    title="Save to Documents"
                  >
                    {isSavingToDocuments ? (
                      <LuLoader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LuDownload className="w-3.5 h-3.5" />
                    )}
                    <span className="text-xs">Save</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isRegenerating ? (
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <LuLoader2 className="w-4 h-4 animate-spin" />
                    <span>Regenerating minutes with your feedback...</span>
                  </div>
                  <div className="animate-pulse space-y-3">
                    <div className="h-6 w-3/4 bg-muted rounded" />
                    <div className="h-4 w-full bg-muted rounded" />
                    <div className="h-4 w-full bg-muted rounded" />
                    <div className="h-4 w-5/6 bg-muted rounded" />
                    <div className="h-6 w-2/3 bg-muted rounded mt-4" />
                    <div className="h-4 w-full bg-muted rounded" />
                    <div className="h-4 w-4/5 bg-muted rounded" />
                    <div className="h-4 w-full bg-muted rounded" />
                    <div className="h-6 w-1/2 bg-muted rounded mt-4" />
                    <div className="h-4 w-full bg-muted rounded" />
                    <div className="h-4 w-3/4 bg-muted rounded" />
                  </div>
                </div>
              ) : (
                <MinutesEditor
                  content={minutesData.minutes[selectedVersion] || ""}
                  onSave={handleSaveMinutes}
                  speakerData={speakerApiData}
                  onSpeakerUpdate={(speaker, label) => handleSpeakerLabeled(speaker.name, label)}
                  version={selectedVersion}
                  className="h-full border-none"
                  onRegenerate={() => setIsRegenerateModalOpen(true)}
                  isRegenerating={isRegenerating}
                  canRegenerate={canRegenerate}
                />
              )}
            </div>
          </div>
        </div>

        <Dialog open={isRegenerateModalOpen} onOpenChange={setIsRegenerateModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regenerate Minutes</DialogTitle>
              <DialogDescription>
                Provide feedback to improve the meeting minutes. This will create a new version.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label htmlFor="feedback" className="block text-sm font-medium mb-2">
                  What would you like to improve?
                </label>
                <textarea
                  id="feedback"
                  placeholder="e.g., Include more details about the technical discussion, reorganize by topic, etc."
                  value={feedbackText}
                  onChange={(event) => setFeedbackText(event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRegenerateModalOpen(false);
                  setFeedbackText("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRegenerateSubmit}
                disabled={isRegenerating || !feedbackText.trim()}
              >
                {isRegenerating ? (
                  <>
                    <LuLoader2 className="w-3 h-3 animate-spin mr-1" />
                    Regenerating...
                  </>
                ) : (
                  "Regenerate Minutes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (minutesData?.status === "NOT_STARTED" && meeting.minutesTranscriptId) {
    const hasActiveSteps = minutesData.steps?.some((step) => step.status === "InProgress");

    if (hasActiveSteps) {
      return (
        <div className="p-4 md:p-6">
          <div className="max-w-5xl mx-auto w-full flex flex-col items-center justify-center py-12">
            <div className="max-w-lg w-full mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Generating Minutes</h3>
                <p className="text-sm text-muted-foreground">
                  Processing the transcript and generating meeting minutes...
                </p>
              </div>

              <MinutesProgressStepper steps={minutesData.steps} isPaused={false} />
            </div>
          </div>
        </div>
      );
    }

    if (minutesData.transcribeFailed) {
      return (
        <div className="p-4 md:p-6">
          <div className="max-w-5xl mx-auto w-full flex flex-col items-center justify-center py-12 bg-destructive/5 rounded-lg border border-destructive/20">
            <div className="max-w-md mx-auto text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-destructive/10">
                <LuAlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Transcription Failed</h3>
                <p className="text-sm text-muted-foreground">
                  The audio could not be transcribed. This can happen with very large or long
                  recordings. You can retry transcription using the uploaded audio, or upload a
                  new recording.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  variant="default"
                  disabled={isRetrying}
                  onClick={async () => {
                    setIsRetrying(true);
                    try {
                      const res = await fetch(
                        `/api/portal/meetings/${meeting.id}/minutes/upload-audio`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            orgId,
                            action: "retry-diarization",
                            transcriptId: meeting.minutesTranscriptId,
                          }),
                        }
                      );
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || "Failed to retry");
                      }
                      toast.success("Transcription retry started.");
                      onUpdate?.();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to retry");
                    } finally {
                      setIsRetrying(false);
                    }
                  }}
                >
                  {isRetrying ? (
                    <>
                      <Spinner className="w-4 h-4" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <LuRotateCw className="w-4 h-4" />
                      Retry Transcription
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 md:p-6">
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center justify-center py-12 bg-destructive/5 rounded-lg border border-destructive/20">
          <div className="max-w-md mx-auto text-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-destructive/10">
              <LuAlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Minutes Generation Failed</h3>
              <p className="text-sm text-muted-foreground">
                Something went wrong while generating minutes.
              </p>
            </div>

            {startError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                <LuAlertCircle className="w-4 h-4 shrink-0" />
                <span>{startError}</span>
              </div>
            )}

            <Button onClick={handleRetryMinutes} disabled={isRetrying} variant="outline">
              {isRetrying ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Retrying...
                </>
              ) : (
                <>
                  <LuRotateCw className="w-4 h-4" />
                  Retry Generation
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto w-full flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <Spinner className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading minutes...</p>
        </div>
      </div>
    </div>
  );
}
