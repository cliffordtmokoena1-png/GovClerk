import { LuX, LuCheck } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

const frustrations = [
  "Hours spent typing minutes from meeting recordings",
  "Missed action items and inaccurate vote records",
  "Delayed publication of public meeting records",
  "Juggling separate tools for agendas, minutes, and transcripts",
  "Manual formatting that never matches your templates",
];

const advantages = [
  "AI generates draft minutes in under 60 seconds",
  "Every motion, vote, and action item captured automatically",
  "Records published to your public portal within hours",
  "One platform for agendas, transcription, and minutes",
  "Smart templates that match your organization's format",
];

export default function GovClerkWhySection() {
  return (
    <section className="bg-cd-navy py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-300">
              Why GovClerk
            </p>
            <h2 className="font-serif text-3xl font-normal text-white md:text-5xl leading-[1.1]">
              Stop Struggling With Outdated Meeting Workflows
            </h2>
          </div>
        </FadeContent>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          <FadeContent direction="up" duration={0.5} delay={0.1}>
            <div className="rounded-2xl border border-red-400/30 bg-red-950/30 p-8">
              <h3 className="mb-6 text-lg font-semibold text-red-300">Without GovClerk</h3>
              <ul className="space-y-4">
                {frustrations.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <LuX className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    <span className="text-sm leading-relaxed text-red-200">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeContent>

          <FadeContent direction="up" duration={0.5} delay={0.2}>
            <div className="rounded-2xl border border-green-400/30 bg-green-950/30 p-8">
              <h3 className="mb-6 text-lg font-semibold text-green-300">With GovClerk</h3>
              <ul className="space-y-4">
                {advantages.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <LuCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                    <span className="text-sm leading-relaxed text-green-200">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeContent>
        </div>
      </div>
    </section>
  );
}
