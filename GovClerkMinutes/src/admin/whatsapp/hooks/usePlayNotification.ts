// Plays a notification sound when SWR revalidation yields a newer inbound message.
// It ignores the first successful load, no-op revalidations, conversation start time changes,
// and outbound-only updates.
//
// Contract:
// - conversations: list of conversations, each with messages (ISO timestamps).
// - isValidating: SWR's isValidating to detect revalidation cycles.
// - audioUrl: optional path to the notification sound; defaults to "/notification.mp3".
// - volume: optional audio volume (0..1), defaults to 0.6.
//
import { useEffect, useMemo, useRef } from "react";
import type { Conversation } from "@/admin/whatsapp/types";

type Options = {
  conversations: Conversation[];
  isValidating: boolean;
  audioUrl?: string;
  volume?: number;
};

export default function usePlayNotification(options: Options) {
  const { conversations, isValidating, audioUrl = "/notification.mp3", volume = 0.6 } = options;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasLoadedRef = useRef<boolean>(false);
  const prevLatestInboundTsRef = useRef<number | null>(null);
  const isRevalidatingRef = useRef<boolean>(false);
  const revalidationInboundBaselineRef = useRef<number | null>(null);
  const warmedUpRef = useRef<boolean>(false);

  // Compute the latest inbound message timestamp; ignore startedAt and outbound messages
  const latestInboundTimestamp = useMemo(() => {
    let latest = 0;
    for (const conversation of conversations) {
      for (const message of conversation.messages ?? []) {
        if (message.direction !== "inbound") {
          continue;
        }
        const ts = Date.parse(message.timestamp);
        if (Number.isFinite(ts) && ts > latest) {
          latest = ts;
        }
      }
    }
    return latest;
  }, [conversations]);

  const hasData = conversations.length > 0;

  // Warm up the audio element after the first user interaction to satisfy autoplay policies
  useEffect(() => {
    // SSR guard
    if (typeof window === "undefined") {
      return;
    }
    const onFirstInteract = () => {
      if (warmedUpRef.current) {
        return;
      }
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.preload = "auto";
        audioRef.current.volume = volume;
      }
      const el = audioRef.current;
      if (!el) {
        return;
      }
      const prevMuted = el.muted;
      try {
        el.muted = true;
        const maybePromise = el.play();
        if (maybePromise && typeof (maybePromise as any).then === "function") {
          (maybePromise as Promise<void>)
            .then(() => {
              try {
                el.pause();
                el.currentTime = 0;
              } finally {
                el.muted = prevMuted;
                warmedUpRef.current = true;
              }
            })
            .catch(() => {
              try {
                el.load();
              } finally {
                el.muted = prevMuted;
                warmedUpRef.current = true;
              }
            });
        } else {
          // Fallback: just load
          try {
            el.load();
          } finally {
            el.muted = prevMuted;
            warmedUpRef.current = true;
          }
        }
      } catch {
        // Ignore warm-up errors
        el.muted = prevMuted;
        warmedUpRef.current = true;
      }
    };

    window.addEventListener("click", onFirstInteract, { once: true });
    window.addEventListener("keydown", onFirstInteract, { once: true });
    window.addEventListener("touchstart", onFirstInteract, { once: true });
    return () => {
      window.removeEventListener("click", onFirstInteract);
      window.removeEventListener("keydown", onFirstInteract);
      window.removeEventListener("touchstart", onFirstInteract);
    };
  }, [audioUrl, volume]);

  // Track revalidation start and capture inbound baseline timestamp
  useEffect(() => {
    if (isValidating) {
      if (hasLoadedRef.current) {
        isRevalidatingRef.current = true;
        revalidationInboundBaselineRef.current =
          prevLatestInboundTsRef.current ?? latestInboundTimestamp;
      }
    }
  }, [isValidating, latestInboundTimestamp]);

  // Respond to data changes
  useEffect(() => {
    if (!hasData) {
      return;
    }

    // First successful load: set baseline, do not play
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      prevLatestInboundTsRef.current = latestInboundTimestamp;
      return;
    }

    if (!isRevalidatingRef.current) {
      // Update baseline on out-of-band inbound data without playing
      if (
        prevLatestInboundTsRef.current !== null &&
        latestInboundTimestamp > prevLatestInboundTsRef.current
      ) {
        prevLatestInboundTsRef.current = latestInboundTimestamp;
      }
      return;
    }

    const prev = prevLatestInboundTsRef.current ?? 0;
    const baseline = revalidationInboundBaselineRef.current ?? prev;
    if (latestInboundTimestamp > baseline) {
      prevLatestInboundTsRef.current = latestInboundTimestamp;

      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.preload = "auto";
        audioRef.current.volume = volume;
      }

      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      prevLatestInboundTsRef.current = Math.max(prev, latestInboundTimestamp);
    }

    // Reset for the next cycle
    isRevalidatingRef.current = false;
    revalidationInboundBaselineRef.current = null;
  }, [hasData, latestInboundTimestamp, audioUrl, volume]);
}
