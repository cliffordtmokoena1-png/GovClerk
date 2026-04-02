import type { StreamConfig } from "@/types/liveSession";

type Props = {
  streamConfig: StreamConfig | null;
};

function youtubeUrlToEmbed(url: string): string {
  // Convert standard YouTube URLs to embed format
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1`;
  }
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=1`;
  }
  // If it's already an embed URL or a channel live URL, use as-is
  if (url.includes("youtube.com/embed")) return url;
  // Fall back: try treating the whole URL as an embed src
  return url;
}

export function PublicStreamEmbed({ streamConfig }: Props) {
  if (!streamConfig || !streamConfig.isActive) {
    return (
      <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-sm font-medium">No live stream available</p>
          <p className="text-xs mt-1 text-gray-500">
            Stream has not been configured for this meeting
          </p>
        </div>
      </div>
    );
  }

  const { preferredPlatform } = streamConfig;

  if (preferredPlatform === "youtube" && streamConfig.youtubeLiveUrl) {
    const embedUrl = youtubeUrlToEmbed(streamConfig.youtubeLiveUrl);
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Live Meeting Stream"
        />
      </div>
    );
  }

  if (preferredPlatform === "zoom" && streamConfig.zoomJoinUrl) {
    return (
      <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">📹</div>
          <p className="text-white font-semibold mb-3">This meeting is on Zoom</p>
          <a
            href={streamConfig.zoomJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Join Zoom Meeting
          </a>
        </div>
      </div>
    );
  }

  if (preferredPlatform === "google_meet" && streamConfig.googleMeetUrl) {
    return (
      <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🎥</div>
          <p className="text-white font-semibold mb-3">This meeting is on Google Meet</p>
          <a
            href={streamConfig.googleMeetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Join Google Meet
          </a>
        </div>
      </div>
    );
  }

  if (preferredPlatform === "facebook" && streamConfig.facebookLiveUrl) {
    const facebookEmbedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(streamConfig.facebookLiveUrl)}&show_text=false&autoplay=true`;
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={facebookEmbedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          title="Live Meeting Stream"
        />
      </div>
    );
  }

  if (preferredPlatform === "rtmp" && streamConfig.rtmpHlsUrl) {
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <video
          className="w-full h-full"
          controls
          autoPlay
          playsInline
          src={streamConfig.rtmpHlsUrl}
        >
          <p className="text-white text-sm p-4">
            Your browser does not support HLS video playback.
          </p>
        </video>
      </div>
    );
  }

  if (preferredPlatform === "custom" && streamConfig.customEmbedUrl) {
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={streamConfig.customEmbedUrl}
          className="w-full h-full"
          allowFullScreen
          title="Live Meeting Stream"
        />
      </div>
    );
  }

  return (
    <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
      <div className="text-center text-gray-400">
        <div className="text-4xl mb-3">📡</div>
        <p className="text-sm font-medium">Stream not configured</p>
        <p className="text-xs mt-1 text-gray-500">Contact the organization for access details</p>
      </div>
    </div>
  );
}
