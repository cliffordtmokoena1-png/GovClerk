/**
 * Demo Portal View — shown to authenticated users whose org
 * does not have an active subscription.
 *
 * Shows a preview of what the live portal offers with upgrade CTAs.
 */

import Link from "next/link";

interface DemoFeature {
  icon: string;
  title: string;
  description: string;
}

const DEMO_FEATURES: DemoFeature[] = [
  {
    icon: "📹",
    title: "Live Streaming",
    description: "Stream council meetings live to YouTube, Zoom, TikTok & more",
  },
  {
    icon: "🗂️",
    title: "Public Records",
    description: "Publish meeting minutes, agendas, and documents for public access",
  },
  {
    icon: "📅",
    title: "Meeting Calendar",
    description: "Share upcoming meetings and events with your community",
  },
  {
    icon: "👥",
    title: "Member Management",
    description: "Add council members, assign roles, manage access",
  },
  {
    icon: "📡",
    title: "Live Transcription",
    description: "Real-time AI transcription during live meetings",
  },
  {
    icon: "🏛️",
    title: "Parliamentary Tools",
    description: "Motions, votes, attendance tracking, speaker queue",
  },
];

interface DemoPortalViewProps {
  slug: string;
  accentColor?: string;
}

export function DemoPortalView({ slug, accentColor = "#2563eb" }: DemoPortalViewProps) {
  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      <div
        className="rounded-xl p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${accentColor} 0%, #1e3a8a 100%)`,
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 text-3xl" aria-hidden="true">
            🔍
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-blue-100 text-sm leading-relaxed">
              You&apos;re viewing a preview of the GovClerk Portal. Subscribe to unlock the full
              portal experience and give your community live access to government proceedings.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <Link
            href="/portal/pricing"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-white text-blue-700 font-semibold text-sm rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
          >
            Subscribe Now
          </Link>
          <Link
            href="/portal/pricing"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-800 bg-opacity-60 text-white font-medium text-sm rounded-lg hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
          >
            View Pricing →
          </Link>
        </div>
      </div>

      {/* Sample / placeholder meetings */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-800 mb-3">📅 Upcoming Meetings (Sample)</h3>
        <ul className="space-y-2 list-none">
          {[
            { title: "Sample Council Meeting", date: "Jan 15, 2026" },
            { title: "Budget Review Session", date: "Jan 22, 2026" },
            { title: "Community Outreach Forum", date: "Feb 3, 2026" },
          ].map((m) => (
            <li key={m.title} className="flex items-center justify-between gap-2 opacity-60">
              <span className="text-sm text-blue-700 font-medium truncate">{m.title}</span>
              <span className="text-xs text-blue-600 flex-shrink-0">{m.date}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-blue-600 italic">
          Subscribe to see your real meeting calendar.
        </p>
      </div>

      {/* Feature preview cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          🔒 Features included in the Live Portal
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DEMO_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg opacity-70"
              aria-label={`${feature.title} — locked feature`}
            >
              <span className="text-2xl flex-shrink-0" aria-hidden="true">
                {feature.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm font-semibold text-gray-800">{feature.title}</span>
                  <span
                    className="text-gray-400"
                    title="Requires active subscription"
                    aria-label="Locked"
                  >
                    🔒
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-snug">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
        <p className="text-gray-600 text-sm mb-4">
          Ready to unlock the full portal for your organization?
        </p>
        <Link
          href="/portal/pricing"
          className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          View Plans &amp; Subscribe
        </Link>
      </div>
    </div>
  );
}
