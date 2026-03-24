import React, { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import {
  LuRadio,
  LuCopy,
  LuCheck,
  LuEye,
  LuEyeOff,
  LuPlay,
  LuPause,
  LuVolume2,
  LuVolumeX,
  LuMaximize,
  LuMinimize,
  LuDot,
} from "react-icons/lu";
import { getHlsStreamUrl, getRtmpUrl } from "@/sophon/config";
import { formatDuration } from "@/utils/format";

function silentCatch(): void {
  // Intentionally empty - used for video.play() Promise rejection when autoplay is blocked
}

type Props = {
  streamKey: string;
  status: "setup" | "live" | "paused" | "ended";
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onStreamAvailabilityChange?: (isAvailable: boolean) => void;
};

type SetupGuideProps = {
  streamKey: string;
};

export function BroadcastSetupGuide({ streamKey }: Readonly<SetupGuideProps>) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const rtmpUrl = getRtmpUrl();

  const handleCopyStreamKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(streamKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [streamKey]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rtmpUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [rtmpUrl]);

  return (
    <div className="bg-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-foreground font-medium">Quick Setup Guide</h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
          <ol className="text-primary text-sm space-y-1">
            <li>1. Open OBS Studio or your streaming software</li>
            <li>2. Go to Settings → Stream</li>
            <li>3. Select &quot;Custom&quot; as the service</li>
            <li>4. Paste the Server URL and Stream Key below</li>
            <li>5. Click &quot;Start Streaming&quot;</li>
          </ol>
        </div>

        <div>
          <span className="block text-xs font-medium text-muted-foreground mb-1">Server URL</span>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted text-foreground px-3 py-2 rounded-lg text-sm font-mono overflow-x-auto">
              {rtmpUrl}
            </code>
            <button
              onClick={handleCopyUrl}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {copiedUrl ? (
                <LuCheck className="w-4 h-4 text-green-500" />
              ) : (
                <LuCopy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-muted-foreground mb-1">Stream Key</span>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted text-foreground px-3 py-2 rounded-lg text-sm font-mono overflow-x-auto">
              {showStreamKey ? streamKey : "••••••••••••••••"}
            </code>
            <button
              onClick={() => setShowStreamKey(!showStreamKey)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {showStreamKey ? <LuEyeOff className="w-4 h-4" /> : <LuEye className="w-4 h-4" />}
            </button>
            <button
              onClick={handleCopyStreamKey}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {copiedKey ? (
                <LuCheck className="w-4 h-4 text-green-500" />
              ) : (
                <LuCopy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BroadcastStreamView({
  streamKey,
  status,
  videoRef: externalVideoRef,
  onStreamAvailabilityChange,
}: Readonly<Props>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const hlsRef = useRef<Hls | null>(null);
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

  const streamUrl = getHlsStreamUrl(streamKey);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const newTime = Number.parseFloat(e.target.value);
      video.currentTime = newTime;
      setCurrentTime(newTime);
      // Check if we're at live edge
      if (duration > 0 && duration - newTime < 2) {
        setIsLiveEdge(true);
      } else {
        setIsLiveEdge(false);
      }
    },
    [duration, videoRef]
  );

  // Jump to live
  const jumpToLive = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(duration)) {
      return;
    }
    video.currentTime = duration;
    setIsLiveEdge(true);
  }, [duration, videoRef]);

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
  }, [videoRef]);

  // Handle mute/unmute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, [videoRef]);

  // Handle volume change
  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [videoRef]
  );

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

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    const video = videoRef.current;

    let retryTimeout: NodeJS.Timeout | null = null;
    let destroyed = false;

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

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsStreamAvailable(true);
          onStreamAvailabilityChange?.(true);
          video.play().catch(silentCatch);
        });

        // Track time updates
        const handleTimeUpdate = () => {
          setCurrentTime(video.currentTime);
          // Check if at live edge (within 2 seconds)
          if (video.duration && Number.isFinite(video.duration)) {
            setIsLiveEdge(video.duration - video.currentTime < 2);
          }
        };

        const handleDurationChange = () => {
          if (Number.isFinite(video.duration)) {
            setDuration(video.duration);
          }
        };

        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("durationchange", handleDurationChange);

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setIsStreamAvailable(false);
            onStreamAvailabilityChange?.(false);
            // Retry after 3 seconds if stream becomes unavailable
            hls.destroy();
            hlsRef.current = null;
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("durationchange", handleDurationChange);
            if (!destroyed) {
              retryTimeout = setTimeout(setupHls, 3000);
            }
          }
        });

        return () => {
          video.removeEventListener("timeupdate", handleTimeUpdate);
          video.removeEventListener("durationchange", handleDurationChange);
          hls.destroy();
          hlsRef.current = null;
        };
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", () => {
          setIsStreamAvailable(true);
          onStreamAvailabilityChange?.(true);
          video.play().catch(silentCatch);
        });
      }
    };

    const cleanup = setupHls();

    return () => {
      destroyed = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- videoRef is stable
  }, [streamKey, streamUrl, onStreamAvailabilityChange]);

  return (
    <section
      ref={containerRef}
      className="bg-black rounded-xl overflow-hidden relative group ring-1 ring-border"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      aria-label="Video player"
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
          className={`absolute inset-x-0 top-0 h-20 bg-linear-to-b from-black/80 to-transparent transition-opacity duration-300 ${
            showControls || !isStreamAvailable ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              {isStreamAvailable ? (
                <>
                  <button
                    type="button"
                    onClick={jumpToLive}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                      isLiveEdge ? "bg-red-600" : "bg-muted hover:bg-red-600"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full bg-white ${isLiveEdge ? "animate-pulse" : ""}`}
                    />
                    <span className="text-white text-xs font-bold uppercase">
                      {status === "live" ? "Live" : "Preview"}
                    </span>
                  </button>
                  <LuDot className="w-4 h-4 text-white/50" />
                  <span className="text-white/80 text-xs font-mono">
                    {formatDuration(currentTime)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">Waiting for stream...</span>
              )}
            </div>
            <span className="text-white/70 text-xs bg-black/40 px-2 py-1 rounded">
              {streamKey.slice(0, 8)}...
            </span>
          </div>
        </div>

        <div
          className={`absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/80 to-transparent transition-opacity duration-300 ${
            showControls && isStreamAvailable ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
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
              style={{
                background:
                  duration > 0
                    ? `linear-gradient(to right, #ef4444 0%, #ef4444 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) 100%)`
                    : "rgba(255,255,255,0.3)",
              }}
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
                {isMuted || volume === 0 ? (
                  <LuVolumeX className="w-5 h-5" />
                ) : (
                  <LuVolume2 className="w-5 h-5" />
                )}
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
              {isFullscreen ? (
                <LuMinimize className="w-5 h-5" />
              ) : (
                <LuMaximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {!isStreamAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <LuRadio className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Waiting for stream...</p>
              <p className="text-muted-foreground/70 text-xs mt-1">Start streaming from OBS</p>
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
