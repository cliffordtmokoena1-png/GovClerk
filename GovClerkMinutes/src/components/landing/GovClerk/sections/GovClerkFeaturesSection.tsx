import Image from "next/image";
import { LuCalendar, LuFileText, LuMic, LuClipboardCheck, LuGlobe, LuShield } from "react-icons/lu";
import SpotlightCard from "../../../reactbits/SpotlightCard";
import FadeContent from "../../../reactbits/FadeContent";

type TopFeature = {
  title: string;
  description: string;
  imageSrc: string;
};

type BottomFeature = {
  icon: typeof LuCalendar;
  title: string;
  description: string;
};

const topFeatures: TopFeature[] = [
  {
    title: "AI-Powered Minutes Generation",
    description:
      "Transform meeting recordings into structured, professional minutes automatically. Decisions, action items, and key discussions are organized and ready to export.",
    imageSrc: "/screenshots/minutes-excerpt.png",
  },
  {
    title: "Real-Time Transcription",
    description:
      "Get accurate, searchable transcripts with automatic speaker identification. Support for 96+ languages with real-time processing.",
    imageSrc: "/screenshots/transcripts-excerpt.png",
  },
];

const bottomFeatures: BottomFeature[] = [
  {
    icon: LuCalendar,
    title: "Agenda Management",
    description:
      "Build and distribute professional meeting agendas in minutes. Attach documents, set time allocations, and share with stakeholders.",
  },
  {
    icon: LuClipboardCheck,
    title: "Votes & Motions",
    description:
      "Track every motion, second, and vote with precision. Maintain a complete legislative record that is searchable and export-ready.",
  },
  {
    icon: LuGlobe,
    title: "Public Portal",
    description:
      "Publish meeting records, agendas, and minutes to a public-facing portal. Keep your community informed and meet transparency requirements.",
  },
  {
    icon: LuShield,
    title: "Security & Compliance",
    description:
      "Enterprise-grade security with SOC 2 compliance, AES-256 encryption, and role-based access controls built for sensitive data.",
  },
];

export default function GovClerkFeaturesSection() {
  return (
    <section className="bg-cd-navy py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-12 text-center md:mb-16">
            <h2 className="font-serif text-3xl font-normal text-white md:text-5xl leading-[1.1]">
              Everything You Need to Run Better Meetings
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-blue-100 md:text-lg">
              From agenda creation to public records, GovClerk streamlines every step of the meeting
              lifecycle.
            </p>
          </div>
        </FadeContent>

        {/* Bento grid: 2 large image cards */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {topFeatures.map((feature) => (
            <div
              key={feature.title}
              className="group relative flex h-[400px] flex-col justify-end overflow-hidden rounded-2xl border border-white/20 bg-white p-6 transition-all hover:border-white/40 hover:shadow-lg md:h-[450px] md:p-8"
            >
              {/* Screenshot image behind */}
              <div className="absolute left-6 right-6 top-6 h-full overflow-hidden rounded-xl border border-gray-200 bg-white opacity-60 shadow-lg md:left-8 md:right-8 md:top-8">
                <Image
                  src={feature.imageSrc}
                  alt={feature.title}
                  fill
                  className="object-cover object-top"
                />
              </div>

              {/* Content overlay with gradient */}
              <div className="relative z-10 -mx-6 -mb-6 flex min-h-[300px] flex-col justify-end bg-gradient-to-b from-transparent via-white/60 via-[15%] to-white p-6 md:-mx-8 md:-mb-8 md:min-h-[380px] md:p-8">
                <h3 className="text-lg font-semibold text-gray-900 md:text-xl">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-700 md:text-base">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bento grid: 4 smaller cards with glass effect */}
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
          {bottomFeatures.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <SpotlightCard
                key={feature.title}
                className="rounded-xl"
                spotlightColor="rgba(255, 255, 255, 0.15)"
              >
                <div className="group relative h-full overflow-hidden rounded-xl border border-white/20 bg-white p-6 backdrop-blur-sm transition-all hover:border-white/40 hover:shadow-md md:p-8">
                  <IconComponent className="absolute -right-4 -top-4 h-24 w-24 text-blue-100 opacity-30" />

                  <div className="relative z-10 space-y-3">
                    <h3 className="text-base font-bold text-gray-900 md:text-lg">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-gray-600">{feature.description}</p>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
