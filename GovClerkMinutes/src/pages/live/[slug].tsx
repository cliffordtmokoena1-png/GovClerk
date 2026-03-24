import Hls from "hls.js";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import { getHlsStreamUrl } from "@/sophon/config";

export default function LiveStream() {
  const router = useRouter();
  const { slug } = router.query;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!slug || !videoRef.current) {
      return;
    }

    const streamUrl = getHlsStreamUrl(String(slug));
    const video = videoRef.current;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((err) => console.error("Auto-play failed", err));
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch((err) => console.error("Auto-play failed", err));
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [slug]);

  if (!slug) {
    return <div className="p-5">Loading...</div>;
  }

  return (
    <div className="p-5">
      <h1 className="text-xl font-semibold text-foreground mb-4">Live Stream: {slug}</h1>
      <video ref={videoRef} controls autoPlay muted width="640" className="bg-black rounded-lg" />
    </div>
  );
}
