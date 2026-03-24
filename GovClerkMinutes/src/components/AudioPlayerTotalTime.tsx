import { Text } from "@chakra-ui/react";
import { formatSecondsToTime } from "@/utils/time";

type Props = {
  audioRef?: HTMLAudioElement | null;
  calculatedDuration?: number | null; // Override duration when native duration is invalid
};

export default function AudioPlayerTotalTime({ audioRef, calculatedDuration }: Props) {
  const effectiveDuration =
    audioRef != null && !Number.isNaN(audioRef.duration) && isFinite(audioRef.duration)
      ? audioRef.duration
      : calculatedDuration;

  if (effectiveDuration == null) {
    return (
      <Text fontSize="sm" fontWeight="medium" color="gray.500">
        --:--
      </Text>
    );
  }

  return (
    <Text fontSize="sm" fontWeight="medium" color="gray.600">
      {formatSecondsToTime(effectiveDuration)}
    </Text>
  );
}
