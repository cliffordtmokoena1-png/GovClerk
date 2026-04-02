import { useState, useEffect } from "react";
import type { StreamConfig, StreamPlatform } from "@/types/liveSession";

type Props = {
  orgId?: string;
};

const PLATFORM_OPTIONS: { value: StreamPlatform; label: string }[] = [
  { value: "youtube", label: "YouTube Live" },
  { value: "zoom", label: "Zoom Webinar" },
  { value: "google_meet", label: "Google Meet" },
  { value: "facebook", label: "Facebook Live" },
  { value: "rtmp", label: "RTMP / HLS" },
  { value: "custom", label: "Custom Embed" },
];

export function StreamConfigPanel({ orgId: _orgId }: Props) {
  const [form, setForm] = useState({
    preferredPlatform: "youtube" as StreamPlatform,
    youtubeChannelId: "",
    youtubeLiveUrl: "",
    zoomWebinarId: "",
    zoomJoinUrl: "",
    googleMeetUrl: "",
    facebookPageId: "",
    facebookLiveUrl: "",
    rtmpHlsUrl: "",
    customEmbedUrl: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/admin/stream-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.streamConfig) {
          const sc: StreamConfig = data.streamConfig;
          setForm({
            preferredPlatform: sc.preferredPlatform,
            youtubeChannelId: sc.youtubeChannelId ?? "",
            youtubeLiveUrl: sc.youtubeLiveUrl ?? "",
            zoomWebinarId: sc.zoomWebinarId ?? "",
            zoomJoinUrl: sc.zoomJoinUrl ?? "",
            googleMeetUrl: sc.googleMeetUrl ?? "",
            facebookPageId: sc.facebookPageId ?? "",
            facebookLiveUrl: sc.facebookLiveUrl ?? "",
            rtmpHlsUrl: sc.rtmpHlsUrl ?? "",
            customEmbedUrl: sc.customEmbedUrl ?? "",
          });
        }
      })
      .catch(() => setError("Failed to load stream configuration"))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/portal/admin/stream-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          youtubeChannelId: form.youtubeChannelId || undefined,
          youtubeLiveUrl: form.youtubeLiveUrl || undefined,
          zoomWebinarId: form.zoomWebinarId || undefined,
          zoomJoinUrl: form.zoomJoinUrl || undefined,
          googleMeetUrl: form.googleMeetUrl || undefined,
          facebookPageId: form.facebookPageId || undefined,
          facebookLiveUrl: form.facebookLiveUrl || undefined,
          rtmpHlsUrl: form.rtmpHlsUrl || undefined,
          customEmbedUrl: form.customEmbedUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message ?? "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm">Loading stream configuration...</div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Platform</label>
        <select
          value={form.preferredPlatform}
          onChange={(e) => handleChange("preferredPlatform", e.target.value as StreamPlatform)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PLATFORM_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {form.preferredPlatform === "youtube" && (
        <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <h3 className="text-sm font-semibold text-red-800">YouTube Live</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Channel ID</label>
            <input
              type="text"
              value={form.youtubeChannelId}
              onChange={(e) => handleChange("youtubeChannelId", e.target.value)}
              placeholder="UCxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Live URL</label>
            <input
              type="url"
              value={form.youtubeLiveUrl}
              onChange={(e) => handleChange("youtubeLiveUrl", e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {form.preferredPlatform === "zoom" && (
        <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="text-sm font-semibold text-blue-800">Zoom Webinar</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Webinar ID</label>
            <input
              type="text"
              value={form.zoomWebinarId}
              onChange={(e) => handleChange("zoomWebinarId", e.target.value)}
              placeholder="123 456 7890"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Join URL</label>
            <input
              type="url"
              value={form.zoomJoinUrl}
              onChange={(e) => handleChange("zoomJoinUrl", e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {form.preferredPlatform === "google_meet" && (
        <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <h3 className="text-sm font-semibold text-green-800">Google Meet</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Meet URL</label>
            <input
              type="url"
              value={form.googleMeetUrl}
              onChange={(e) => handleChange("googleMeetUrl", e.target.value)}
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {form.preferredPlatform === "facebook" && (
        <div className="space-y-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <h3 className="text-sm font-semibold text-indigo-800">Facebook Live</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Page ID</label>
            <input
              type="text"
              value={form.facebookPageId}
              onChange={(e) => handleChange("facebookPageId", e.target.value)}
              placeholder="123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Live URL</label>
            <input
              type="url"
              value={form.facebookLiveUrl}
              onChange={(e) => handleChange("facebookLiveUrl", e.target.value)}
              placeholder="https://www.facebook.com/.../videos/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {form.preferredPlatform === "rtmp" && (
        <div className="space-y-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <h3 className="text-sm font-semibold text-orange-800">RTMP / HLS Stream</h3>
          <p className="text-xs text-orange-700">
            Provide the HLS playback URL (what viewers use — NOT the ingest stream key)
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">HLS Playback URL</label>
            <input
              type="url"
              value={form.rtmpHlsUrl}
              onChange={(e) => handleChange("rtmpHlsUrl", e.target.value)}
              placeholder="https://your-server.com/stream/playlist.m3u8"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {form.preferredPlatform === "custom" && (
        <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <h3 className="text-sm font-semibold text-gray-800">Custom Embed</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Embed URL</label>
            <input
              type="url"
              value={form.customEmbedUrl}
              onChange={(e) => handleChange("customEmbedUrl", e.target.value)}
              placeholder="https://your-stream-provider.com/embed/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          ✅ Stream configuration saved!
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {isSaving ? "Saving..." : "Save Stream Configuration"}
      </button>
    </form>
  );
}
