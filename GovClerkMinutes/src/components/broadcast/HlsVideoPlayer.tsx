import React, { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import {
  LuRadio,
  LuPlay,
  LuPause,
  LuVolume2,
  LuVolumeX,
  LuMaximize,
  LuMinimize,
  LuDot,
} from "react-icons/lu";
import { formatDuration } from "@/utils/format";

type Props = {
  streamUrl: string;
  showLiveLabel?: boolean;
  liveLabel?: string;
  waitingMessage?: string;
  waitingSubMessage?: string;
  onStreamAvailable?: (available: boolean) => void;
};

function getStatusContent(
  isStreamAvailable: boolean,
  showLiveLabel: boolean,
  isLiveEdge: boolean,
  liveLabel: string,
  currentTime: number,
  jumpToLive: () => void
) {
  if (isStreamAvailable && showLiveLabel) {
    const buttonClass = isLiveEdge
      ? "flex items-center gap-1.5 px-2 py-1 rounded transition-colors bg-red-600"
      : "flex items-center gap-1.5 px-2 py-1 rounded transition-colors bg-gray-600 hover:bg-red-600";
    const dotClass = isLiveEdge
      ? "w-2 h-2 rounded-full bg-white animate-pulse"
      : "w-2 h-2 rounded-full bg-white";
    return (
      <>
        <button type="button" onClick={jumpToLive} className={buttonClass}>
          <div className={dotClass} />
          <span className="text-white text-xs font-bold uppercase">{liveLabel}</span>
        </button>
        <LuDot className="w-4 h-4 text-white/50" />
        <span className="text-white/80 text-xs font-mono">{formatDuration(currentTime)}</span>
      </>
    );
  }
  if (!isStreamAvailable) {
    return <span className="text-muted-foreground text-sm">Waiting for stream...</span>;
  }
  return null;
}

function tryPlayVideo(video: HTMLVideoElement): void {
  video.play().catch(() => {});
}

function useHlsVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  streamUrl: string,
  setIsStreamAvailable: (v: boolean) => void,
  setCurrentTime: (v: number) => void,
  setDuration: (v: number) => void,
  setIsLiveEdge: (v: boolean) => void
) {
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    const video = videoRef.current;
    let retryTimeout: NodeJS.Timeout | null = null;
    let destroyed = false;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration && Number.isFinite(video.duration)) {
        setIsLiveEdge(video.duration - video.currentTime < 2);
      }
    };

    const handleDurationChange = () => {
      if (Number.isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    const scheduleRetry = () => {
      if (!destroyed) {
        retryTimeout = setTimeout(setupHls, 3000);
      }
    };

    const handleManifestParsed = () => {
      setIsStreamAvailable(true);
      tryPlayVideo(video);
    };

    const handleHlsError = (hls: Hls, data: { fatal: boolean }) => {
      if (data.fatal) {
        setIsStreamAvailable(false);
        hls.destroy();
        hlsRef.current = null;
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("durationchange", handleDurationChange);
        scheduleRetry();
      }
    };

    const handleLoadedMetadata = () => {
      setIsStreamAvailable(true);
      tryPlayVideo(video);
    };

    const handleNativeError = () => {
      setIsStreamAvailable(false);
      scheduleRetry();
    };

    const setupHls = () => {
      if (destroyed) {
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
        });

        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("durationchange", handleDurationChange);
        hls.on(Hls.Events.ERROR, (_, data) => handleHlsError(hls, data));

        return () => {
          video.removeEventListener("timeupdate", handleTimeUpdate);
          video.removeEventListener("durationchange", handleDurationChange);
          hls.destroy();
          hlsRef.current = null;
        };
      }

      // Native HLS support (Safari)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("error", handleNativeError);
      }

      return undefined;
    };

    const cleanup = setupHls();

    return () => {
      destroyed = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      cleanup?.();
    };
  }, [streamUrl, videoRef, setIsStreamAvailable, setCurrentTime, setDuration, setIsLiveEdge]);

  return hlsRef;
}

export function HlsVideoPlayer({
  streamUrl,
  showLiveLabel = true,
  liveLabel = "Live",
  waitingMessage = "Connecting to stream...",
  waitingSubMessage = "This may take a moment",
  onStreamAvailable,
}: Readonly<Props>) {
  const containerRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreamAvailable, setIsStreamAvailable] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLiveEdge, setIsLiveEdge] = useState(true);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Use custom hook for HLS video management
  useHlsVideo(
    videoRef,
    streamUrl,
    setIsStreamAvailable,
    setCurrentTime,
    setDuration,
    setIsLiveEdge
  );

  // Notify parent of stream availability changes
  useEffect(() => {
    onStreamAvailable?.(isStreamAvailable);
  }, [isStreamAvailable, onStreamAvailable]);

  // Handle seek
  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const newTime = Number.parseFloat(e.target.value);
      video.currentTime = newTime;
      setCurrentTime(newTime);
      const atLiveEdge = duration > 0 && duration - newTime < 2;
      setIsLiveEdge(atLiveEdge);
    },
    [duration]
  );

  // Jump to live
  const jumpToLive = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(duration)) {
      return;
    }
    video.currentTime = duration;
    setIsLiveEdge(true);
  }, [duration]);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Handle mute/unmute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const newVolume = Number.parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0 && video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, []);

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      container.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (isPlaying) {
      setShowControls(false);
    }
  }, [isPlaying]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Calculate seek bar background
  const seekProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const seekBarBackground = `linear-gradient(to right, #ef4444 0%, #ef4444 ${seekProgress}%, rgba(255,255,255,0.3) ${seekProgress}%, rgba(255,255,255,0.3) 100%)`;

  // Determine overlay visibility
  const topOverlayClass = showControls || !isStreamAvailable ? "opacity-100" : "opacity-0";
  const bottomOverlayClass =
    showControls && isStreamAvailable ? "opacity-100" : "opacity-0 pointer-events-none";

  // Volume icon component
  const VolumeIcon = isMuted || volume === 0 ? LuVolumeX : LuVolume2;

  // Fullscreen icon component
  const FullscreenIcon = isFullscreen ? LuMinimize : LuMaximize;

  return (
    <section
      ref={containerRef}
      aria-label="Video player"
      className="bg-black rounded-xl overflow-hidden relative group"
      onMouseMove={resetHideTimer}
      onMouseLeave={handleMouseLeave}
    >
      <div className="aspect-video relative">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          muted
          playsInline
          onClick={togglePlay}
        />

        <div
          className={`absolute inset-x-0 top-0 h-20 bg-linear-to-b from-black/80 to-transparent transition-opacity duration-300 ${topOverlayClass}`}
        >
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              {getStatusContent(
                isStreamAvailable,
                showLiveLabel,
                isLiveEdge,
                liveLabel,
                currentTime,
                jumpToLive
              )}
            </div>
          </div>
        </div>

        <div
          className={`absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/80 to-transparent transition-opacity duration-300 ${bottomOverlayClass}`}
        >
          <div className="absolute bottom-12 inset-x-3">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 accent-red-500 cursor-pointer appearance-none bg-white/30 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-125 [&::-webkit-slider-thumb]:transition-transform"
              style={{ background: seekBarBackground }}
            />
          </div>
          <div className="absolute bottom-0 inset-x-0 p-3 flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="text-white hover:text-white/80 transition-colors"
            >
              {isPlaying ? <LuPause className="w-6 h-6" /> : <LuPlay className="w-6 h-6" />}
            </button>

            <div className="flex items-center gap-2 group/volume">
              <button
                onClick={toggleMute}
                className="text-white hover:text-white/80 transition-colors"
              >
                <VolumeIcon className="w-5 h-5" />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 opacity-0 group-hover/volume:opacity-100 transition-all duration-200 accent-white h-1 cursor-pointer"
              />
            </div>

            <div className="flex-1" />

            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-white/80 transition-colors"
            >
              <FullscreenIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isStreamAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <LuRadio className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-pulse" />
              <p className="text-muted-foreground text-sm">{waitingMessage}</p>
              <p className="text-muted-foreground/70 text-xs mt-1">{waitingSubMessage}</p>
            </div>
          </div>
        )}

        {isStreamAvailable && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center">
              <LuPlay className="w-8 h-8 text-white ml-1" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
