import React, { useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { LuPlay, LuPause, LuLoader2 } from "react-icons/lu";
import { formatSecondsToTime } from "@/utils/time";

export interface RecordingPlayerHandle {
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

type RecordingPlayerProps = {
  src: string;
  onTimeUpdate?: (time: number) => void;
  className?: string;
};

export const RecordingPlayer = forwardRef<RecordingPlayerHandle, RecordingPlayerProps>(
  function RecordingPlayer({ src, onTimeUpdate, className = "" }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const progressRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
        }
      },
      play: () => audioRef.current?.play(),
      pause: () => audioRef.current?.pause(),
      getCurrentTime: () => audioRef.current?.currentTime ?? 0,
    }));

    const handleTimeUpdate = useCallback(() => {
      if (audioRef.current) {
        const time = audioRef.current.currentTime;
        setCurrentTime(time);
        onTimeUpdate?.(time);
      }
    }, [onTimeUpdate]);

    const handleLoadedMetadata = useCallback(() => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration);
        setIsLoading(false);
      }
    }, []);

    const handlePlay = useCallback(() => setIsPlaying(true), []);
    const handlePause = useCallback(() => setIsPlaying(false), []);
    const handleError = useCallback(() => {
      setError("Failed to load recording");
      setIsLoading(false);
    }, []);

    const togglePlayback = useCallback(() => {
      if (!audioRef.current) {
        return;
      }
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }, [isPlaying]);

    const handleProgressClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !audioRef.current || !duration) {
          return;
        }
        const rect = progressRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      },
      [duration]
    );

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (error) {
      return (
        <div
          className={`flex items-center gap-2 px-4 py-2 text-sm text-destructive bg-destructive/5 rounded-lg ${className}`}
        >
          <span>{error}</span>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-lg ${className}`}>
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
          preload="metadata"
        />

        <button
          type="button"
          onClick={togglePlayback}
          disabled={isLoading}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <LuLoader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <LuPause className="w-4 h-4" />
          ) : (
            <LuPlay className="w-4 h-4 ml-0.5" />
          )}
        </button>

        <span className="text-xs text-muted-foreground font-mono min-w-[40px]">
          {formatSecondsToTime(currentTime)}
        </span>

        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="flex-1 h-1.5 bg-gray-200 rounded-full cursor-pointer group relative"
        >
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        <span className="text-xs text-muted-foreground font-mono min-w-[40px]">
          {formatSecondsToTime(duration)}
        </span>
      </div>
    );
  }
);
