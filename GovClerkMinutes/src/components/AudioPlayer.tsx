import { useState } from "react";
import { RiForward30Fill, RiReplay30Fill, RiPlayFill, RiPauseFill } from "react-icons/ri";
import H5AudioPlayer, { RHAP_UI } from "react-h5-audio-player";
import { Box, useToken } from "@chakra-ui/react";
import PlaybackRateControl from "./PlaybackRateControl";
import AudioPlayerCurrentTime from "./AudioPlayerCurrentTime";
import AudioPlayerTotalTime from "./AudioPlayerTotalTime";

type Props = {
  onDuration: (duration: number | undefined) => void;
  onAudioLoadError: (error: Event) => void;
  audioSrc: string | null | undefined;
  audioPlayerRef: React.RefObject<H5AudioPlayer | null>;
};

const AudioPlayer = ({ onDuration, onAudioLoadError, audioSrc, audioPlayerRef }: Props) => {
  const [loadedAudioSrc, setLoadedAudioSrc] = useState("");
  const [calculatedDuration, setCalculatedDuration] = useState<number | null>(null);
  const [blue500] = useToken("colors", ["blue.500"]);

  const calculateDurationFromAudioData = async (audioUrl: string): Promise<number | null> => {
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        await audioContext.close();
        return audioBuffer.duration;
      } catch {
        await audioContext.close();
        return null;
      }
    } catch {
      return null;
    }
  };

  if (audioSrc == null || audioPlayerRef == null) {
    return null;
  }

  return (
    <Box
      sx={{
        ".rhap_container": {
          backgroundColor: "white",
          boxShadow: "none",
          borderBottom: "1px solid var(--chakra-colors-gray-100)",
          padding: "12px 16px",
        },
        ".rhap_progress-bar": {
          backgroundColor: "var(--chakra-colors-gray-100)",
          height: "4px",
        },
        ".rhap_progress-filled": {
          backgroundColor: blue500,
        },
        ".rhap_progress-indicator": {
          width: "12px",
          height: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          marginTop: "0",
          backgroundColor: blue500,
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
        },
        ".rhap_progress-section": {
          display: "flex",
          alignItems: "center",
        },
        ".rhap_time": {
          fontSize: "14px",
          fontWeight: "500",
          color: "var(--chakra-colors-gray-600)",
        },
        ".rhap_button-clear": {
          color: "var(--chakra-colors-gray-600)",
          transition: "color 0.2s",
          "&:hover": {
            color: "var(--chakra-colors-gray-800)",
          },
        },
        ".rhap_main-controls-button": {
          color: blue500,
          transition: "color 0.2s",
          "&:hover": {
            color: "var(--chakra-colors-blue-600)",
          },
        },
        ".rhap_volume-controls": {
          display: "none",
        },
        ".rhap_additional-controls": {
          flex: "none",
        },
      }}
    >
      <H5AudioPlayer
        ref={audioPlayerRef}
        onLoadedData={async (e) => {
          const audioHtml = e?.target as HTMLAudioElement | null;
          const duration = audioHtml?.duration;

          if (
            duration != null &&
            typeof duration === "number" &&
            !isNaN(duration) &&
            isFinite(duration)
          ) {
            onDuration(duration);
            setCalculatedDuration(null);
            setLoadedAudioSrc(audioSrc);
          } else {
            try {
              const fallbackDuration = await calculateDurationFromAudioData(audioSrc);
              if (fallbackDuration != null) {
                // Override the native duration property on the audio element for RHAP
                if (audioHtml) {
                  try {
                    Object.defineProperty(audioHtml, "duration", {
                      value: fallbackDuration,
                      writable: false,
                      configurable: true,
                    });
                  } catch {
                    // Fallback: set custom property if direct override fails
                    (audioHtml as any)._calculatedDuration = fallbackDuration;
                  }
                }

                onDuration(fallbackDuration);
                setCalculatedDuration(fallbackDuration);
                setLoadedAudioSrc(audioSrc);
              } else {
                onDuration(undefined);
                setCalculatedDuration(null);
                setLoadedAudioSrc(audioSrc);
              }
            } catch {
              onDuration(undefined);
              setCalculatedDuration(null);
              setLoadedAudioSrc(audioSrc);
            }
          }
        }}
        onError={onAudioLoadError}
        src={loadedAudioSrc || audioSrc}
        showDownloadProgress
        showJumpControls
        autoPlayAfterSrcChange={false}
        progressJumpSteps={{
          backward: 30000,
          forward: 30000,
        }}
        customIcons={{
          play: <RiPlayFill size={20} />,
          pause: <RiPauseFill size={20} />,
          forward: <RiForward30Fill size={20} />,
          rewind: <RiReplay30Fill size={20} />,
        }}
        customControlsSection={[RHAP_UI.MAIN_CONTROLS, RHAP_UI.ADDITIONAL_CONTROLS]}
        customProgressBarSection={[
          <AudioPlayerCurrentTime
            key="current-time"
            audioRef={audioPlayerRef?.current?.audio?.current}
            progressBar={audioPlayerRef?.current?.progressBar?.current}
            calculatedDuration={calculatedDuration}
          />,
          RHAP_UI.PROGRESS_BAR,
          <AudioPlayerTotalTime
            key="total-time"
            audioRef={audioPlayerRef?.current?.audio?.current}
            calculatedDuration={calculatedDuration}
          />,
        ]}
        customAdditionalControls={[
          <PlaybackRateControl
            key="rate"
            onPlaybackRateChange={(rate: number) => {
              const element = audioPlayerRef?.current?.audio?.current;
              if (element) {
                element.playbackRate = rate;
              }
            }}
          />,
        ]}
        customVolumeControls={[]}
      />
    </Box>
  );
};

export default AudioPlayer;
