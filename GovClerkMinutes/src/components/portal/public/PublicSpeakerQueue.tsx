import { useEffect, useState } from "react";
import type { SpeakerQueueEntry } from "@/types/liveSession";

type Props = {
  queue: SpeakerQueueEntry[];
};

const SPEAKER_TYPE_LABELS: Record<string, string> = {
  council_member: "Council Member",
  public: "Public",
  staff: "Staff",
  guest: "Guest",
};

function SpeakerTimer({ startedAt, limitSeconds }: { startedAt: string; limitSeconds: number }) {
  const [remaining, setRemaining] = useState<number>(() => {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return Math.max(0, limitSeconds - elapsed);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setRemaining(Math.max(0, limitSeconds - elapsed));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, limitSeconds]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isLow = remaining < 30;

  return (
    <span className={`text-xs font-mono font-bold ${isLow ? "text-red-600" : "text-green-700"}`}>
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}

export function PublicSpeakerQueue({ queue }: Props) {
  if (queue.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        No speakers in the queue
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {queue.map((entry, index) => {
        const isSpeaking = entry.status === "speaking";
        return (
          <div
            key={entry.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              isSpeaking
                ? "bg-green-50 border-green-300"
                : "bg-white border-gray-200"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isSpeaking ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {isSpeaking ? "🎤" : index + 1}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isSpeaking ? "text-green-800" : "text-gray-900"}`}>
                {entry.speakerName}
              </p>
              <p className="text-xs text-gray-500">
                {SPEAKER_TYPE_LABELS[entry.speakerType] ?? entry.speakerType}
                {" · "}
                {Math.floor(entry.timeLimitSeconds / 60)} min limit
              </p>
            </div>

            {isSpeaking && entry.startedSpeakingAt && (
              <SpeakerTimer
                startedAt={entry.startedSpeakingAt}
                limitSeconds={entry.timeLimitSeconds}
              />
            )}

            {isSpeaking && (
              <div className="flex items-center gap-1 text-xs text-green-700 font-semibold">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Speaking
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
