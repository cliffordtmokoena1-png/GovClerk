import FadeContent from "../../../reactbits/FadeContent";

type Feature = {
  emoji: string;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    emoji: "🏛️",
    title: "Branded Public Portal",
    description:
      "A fully branded public-facing website with your organization's logo, colours, and domain — no GovClerk branding visible to the public.",
  },
  {
    emoji: "📅",
    title: "Meeting Calendar",
    description:
      "Citizens can view upcoming meetings, recurring schedules, and agendas all in one place — with calendar export and reminder subscriptions.",
  },
  {
    emoji: "📄",
    title: "Document Archive",
    description:
      "Store and publish agendas, minutes, supporting documents, resolutions, and bylaws in a searchable, organized archive.",
  },
  {
    emoji: "📡",
    title: "Live Meeting Broadcasts",
    description:
      "Stream live council and committee sessions directly to the public from any device — no third-party streaming platform needed.",
  },
  {
    emoji: "🤖",
    title: "AI-Powered Minutes",
    description:
      "GovClerkMinutes generates structured, professional meeting minutes from recordings — published to your portal automatically.",
  },
  {
    emoji: "✍️",
    title: "Real-Time Transcription",
    description:
      "Live captions and searchable transcripts give citizens access to what's being said the moment it happens.",
  },
  {
    emoji: "🔒",
    title: "Verified Access Control",
    description:
      "Administrators access the portal using organizational email addresses — ensuring only authorized staff can manage your public records.",
  },
  {
    emoji: "🔍",
    title: "Public Records Search",
    description:
      "Full-text search across all published documents, meeting records, and transcripts — reducing records requests to near zero.",
  },
  {
    emoji: "📰",
    title: "RSS Feed",
    description:
      "Citizens and journalists can subscribe to updates via RSS for any new agendas, minutes, or documents published to your portal.",
  },
];

export default function PortalFeaturesSection() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-12 text-center md:mb-16">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-cd-blue">
              Features
            </p>
            <h2 className="font-serif text-3xl font-normal text-gray-800 md:text-5xl leading-[1.1]">
              One Portal for Complete Public Transparency
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
              Everything citizens expect from a modern government portal — all built in, all
              included.
            </p>
          </div>
        </FadeContent>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FadeContent key={feature.title} direction="up" duration={0.5} delay={index * 0.06}>
              <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-7 transition-shadow hover:shadow-md">
                <span className="text-3xl" role="img" aria-label={feature.title}>
                  {feature.emoji}
                </span>
                <h3 className="text-base font-semibold text-gray-900">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{feature.description}</p>
              </div>
            </FadeContent>
          ))}
        </div>
      </div>
    </section>
  );
}
