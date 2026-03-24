import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  CheckIcon,
  XIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  RotateCwIcon,
  AlertCircleIcon,
  FileTextIcon,
  VideoIcon,
  FileOutputIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  meetingId: number;
  orgId: string;
};

type OperationType = "recording" | "minutes_generation" | "minutes_export" | "transcript_export";
type ProgressStatus = "pending" | "in_progress" | "completed" | "failed";

type ProgressOperation = {
  id: number;
  meetingId: number;
  operationType: OperationType;
  status: ProgressStatus;
  progressPercent: number;
  metadata: {
    recordingId?: number;
    stage?: "recording" | "processing";
    bytesUploaded?: number;
    elapsedMs?: number;
    s3Key?: string;
    durationMs?: number;
    thumbnailKey?: string;
  } | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProgressResponse = {
  operations: ProgressOperation[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getOperationLabel(operationType: OperationType, status: ProgressStatus): string {
  switch (operationType) {
    case "recording":
      return status === "completed" ? "Recording complete" : "Recording meeting";
    case "minutes_generation":
      return status === "completed" ? "Minutes generated" : "Generating minutes";
    case "minutes_export":
      return status === "completed" ? "Minutes exported" : "Exporting minutes";
    case "transcript_export":
      return status === "completed" ? "Transcript exported" : "Exporting transcript";
    default:
      return "Processing";
  }
}

function getOperationIcon(operationType: OperationType) {
  switch (operationType) {
    case "recording":
      return VideoIcon;
    case "minutes_generation":
      return FileTextIcon;
    case "minutes_export":
    case "transcript_export":
      return FileOutputIcon;
    default:
      return FileTextIcon;
  }
}

function CircularProgress({ percent, size = 16 }: { percent: number; size?: number }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const isIndeterminate = percent <= 0;

  return (
    <svg
      width={size}
      height={size}
      className={cn("shrink-0", isIndeterminate ? "animate-spin" : "-rotate-90")}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={isIndeterminate ? circumference * 0.75 : offset}
        className="stroke-primary transition-[stroke-dashoffset] duration-300"
      />
    </svg>
  );
}

function getStatusDetail(op: ProgressOperation): string | null {
  if (
    op.operationType === "recording" &&
    op.status === "in_progress" &&
    op.metadata?.bytesUploaded
  ) {
    return formatBytes(op.metadata.bytesUploaded) + " uploaded";
  }
  return null;
}

async function retryRecording(recordingId: number, orgId: string): Promise<void> {
  const response = await fetch(`/api/portal/recordings/${recordingId}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId }),
  });

  if (!response.ok) {
    throw new Error("Failed to retry recording");
  }
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProcessingToast({ meetingId, orgId }: Props) {
  const previousHasActiveRef = useRef<boolean | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dismissedOpIds, setDismissedOpIds] = useState<Set<number>>(new Set());
  const mountedAtRef = useRef<string>(new Date().toISOString());

  const { data, mutate } = useSWR<ProgressResponse>(
    `/api/portal/progress/${meetingId}?orgId=${orgId}`,
    fetcher,
    {
      refreshInterval: (latestData: ProgressResponse | undefined) => {
        const latestOperations = latestData?.operations ?? [];
        const latestHasActive = latestOperations.some(
          (operation) => operation.status === "in_progress" || operation.status === "pending"
        );
        const latestHasFailed = latestOperations.some((operation) => operation.status === "failed");
        return latestHasActive || latestHasFailed ? 2000 : 0;
      },
    }
  );

  const allOperations = data?.operations ?? [];
  const operations = allOperations.filter((op) => {
    if (dismissedOpIds.has(op.id)) {
      return false;
    }
    if (op.status === "in_progress" || op.status === "pending") {
      return true;
    }
    if (op.completedAt && new Date(op.completedAt) > new Date(mountedAtRef.current)) {
      return true;
    }
    if (op.status === "failed" && op.updatedAt) {
      const updatedAt = new Date(op.updatedAt);
      const sixtySecondsAgo = new Date(Date.now() - 60_000);
      return updatedAt > sixtySecondsAgo;
    }
    return false;
  });

  const hasActive = operations.some((op) => op.status === "in_progress" || op.status === "pending");
  const hasFailed = operations.some((op) => op.status === "failed");
  const activeCount = operations.filter(
    (op) => op.status === "in_progress" || op.status === "pending"
  ).length;
  const completedCount = operations.filter((op) => op.status === "completed").length;
  const failedCount = operations.filter((op) => op.status === "failed").length;

  useEffect(() => {
    if (
      previousHasActiveRef.current === true &&
      !hasActive &&
      operations.length > 0 &&
      !hasFailed
    ) {
      toast.success("Processed successfully!");
    }
    previousHasActiveRef.current = hasActive;
  }, [hasActive, hasFailed, operations.length]);

  useEffect(() => {
    if (isDismissed && hasActive) {
      setIsDismissed(false);
    }
  }, [isDismissed, hasActive]);

  if (operations.length === 0 || isDismissed) {
    return null;
  }

  const headerText =
    activeCount > 0
      ? `Processing ${activeCount} item${activeCount !== 1 ? "s" : ""}`
      : hasFailed
        ? `${failedCount} failed`
        : `${completedCount} complete`;

  const handleDismiss = () => {
    const terminalIds = operations
      .filter((op) => op.status === "completed" || op.status === "failed")
      .map((op) => op.id);
    setDismissedOpIds((prev) => {
      const next = new Set(prev);
      for (const id of terminalIds) {
        next.add(id);
      }
      return next;
    });
    setIsDismissed(true);
  };

  const handleDismissOp = (opId: number) => {
    setDismissedOpIds((prev) => {
      const next = new Set(prev);
      next.add(opId);
      return next;
    });
  };

  return (
    <div
      className={cn(
        "fixed bottom-20 right-4 z-50 w-80",
        "bg-card text-card-foreground",
        "shadow-lg rounded-lg border border-border",
        "transition-all duration-200"
      )}
      data-testid="processing-toast"
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-sm font-medium truncate">{headerText}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Dismiss"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <ul className="border-t border-border">
          {operations.map((op) => {
            const Icon = getOperationIcon(op.operationType);
            const detail = getStatusDetail(op);
            const canRetry =
              op.status === "failed" &&
              op.operationType === "recording" &&
              op.metadata?.recordingId;
            const isTerminal = op.status === "completed" || op.status === "failed";

            return (
              <li
                key={op.id}
                className="group flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0"
                data-testid="progress-item"
              >
                <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {getOperationLabel(op.operationType, op.status)}
                  </p>
                  {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                  {op.status === "failed" && op.errorMessage && (
                    <p className="text-xs text-destructive mt-0.5 truncate" title={op.errorMessage}>
                      {op.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {(op.status === "in_progress" || op.status === "pending") && (
                    <CircularProgress percent={op.progressPercent} />
                  )}
                  {op.status === "completed" && <CheckIcon className="w-4 h-4 text-green-500" />}
                  {op.status === "failed" && !canRetry && (
                    <AlertCircleIcon className="w-4 h-4 text-destructive" />
                  )}
                  {canRetry && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await retryRecording(op.metadata!.recordingId!, orgId);
                          mutate();
                          toast.success("Retry initiated");
                        } catch {
                          toast.error("Failed to retry recording");
                        }
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Retry"
                    >
                      <RotateCwIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isTerminal && (
                    <button
                      type="button"
                      onClick={() => handleDismissOp(op.id)}
                      className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                      aria-label="Dismiss"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
