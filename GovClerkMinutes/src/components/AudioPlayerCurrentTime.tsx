import { Flex, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { formatSecondsToTime } from "@/utils/time";

type Props = {
  audioRef?: HTMLAudioElement | null;
  progressBar?: HTMLDivElement | null;
  calculatedDuration?: number | null; // Override duration when native duration is invalid
};

export default function AudioPlayerCurrentTime({
  audioRef,
  progressBar,
  calculatedDuration,
}: Props) {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (progressBar == null) {
      return;
    }

    const indicator = progressBar?.querySelector(".rhap_progress-indicator");
    if (indicator == null || audioRef == null) {
      return;
    }

    let mouseDown = false;

    const updateTime = () => {
      if (!mouseDown) {
        const effectiveDuration =
          audioRef != null && !Number.isNaN(audioRef.duration) && isFinite(audioRef.duration)
            ? audioRef.duration
            : calculatedDuration;

        if (effectiveDuration && effectiveDuration > 0) {
          setCurrentTime(audioRef.currentTime / effectiveDuration);
        }
      }
    };

    audioRef.addEventListener("timeupdate", updateTime);

    const onMouseMove = () => {
      try {
        const percentStr = indicator.getAttribute("style");
        if (percentStr == null) {
          return;
        }

        const matches = percentStr.match(/.* (.*)%.*/);
        if (matches == null) {
          return;
        }

        const percent = parseFloat(matches[1]) / 100.0;
        if (isNaN(percent) || !isFinite(percent)) {
          return;
        }

        setCurrentTime(Math.max(0, Math.min(1, percent)));
      } catch {
        // ignore seeking errors bcs they're not critical
      }
    };

    const onMouseDown = () => {
      mouseDown = true;
      document.addEventListener("mousemove", onMouseMove);
    };

    indicator.addEventListener("mousedown", onMouseDown);

    const onMouseUp = () => {
      mouseDown = false;
      document.removeEventListener("mousemove", onMouseMove);
    };

    document.addEventListener("mouseup", onMouseUp);

    return () => {
      audioRef.removeEventListener("timeupdate", updateTime);
      indicator.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [audioRef, progressBar, calculatedDuration]);

  const effectiveDuration =
    audioRef != null && !Number.isNaN(audioRef.duration) && isFinite(audioRef.duration)
      ? audioRef.duration
      : calculatedDuration;

  if (audioRef == null || effectiveDuration == null) {
    return (
      <Text fontSize="sm" fontWeight="medium" color="gray.500">
        --:--
      </Text>
    );
  }

  return (
    <Flex minW="5ch" align="center">
      <Text fontSize="sm" fontWeight="medium" color="gray.600">
        {formatSecondsToTime(effectiveDuration * currentTime)}
      </Text>
    </Flex>
  );
}
