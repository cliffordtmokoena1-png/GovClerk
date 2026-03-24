import Image from "next/image";
import { LuSparkles, LuFileText, LuMic, LuSearch } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

const aiFeatures = [
  {
    icon: LuMic,
    title: "Real-Time Transcription",
    description:
      "AI-powered speech-to-text with speaker identification, even in multi-person sessions",
  },
  {
    icon: LuFileText,
    title: "Auto-Generated Minutes",
    description:
      "Draft minutes created in seconds from your recordings, matching your template format",
  },
  {
    icon: LuSearch,
    title: "Searchable Archives",
    description:
      "Full-text search across every meeting transcript, minute, and agenda in your history",
  },
];

export default function GovClerkAiSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-cd-navy to-[#0f1f3a] py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
          <FadeContent direction="up" duration={0.6}>
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90">
                <LuSparkles className="h-4 w-4" />
                Powered by AI
              </div>
              <h2 className="font-serif text-3xl font-normal leading-[1.1] text-white md:text-5xl">
                AI That Understands Your Meetings
              </h2>
              <p className="max-w-lg text-base leading-relaxed text-white/75 md:text-lg">
                GovClerk uses purpose-built language models trained on government proceedings,
                parliamentary procedure, and public meeting formats to deliver accurate, compliant
                outputs every time.
              </p>

              <div className="space-y-5 pt-2">
                {aiFeatures.map((feature) => {
                  const IconComponent = feature.icon;
                  return (
                    <div key={feature.title} className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-white/65">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </FadeContent>

          <FadeContent direction="up" duration={0.6} delay={0.2}>
            <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
              <Image
                src="/screenshots/desktop-v2.png"
                alt="GovClerk AI transcription and minutes generation interface"
                width={700}
                height={500}
                className="h-auto w-full"
              />
            </div>
          </FadeContent>
        </div>
      </div>
    </section>
  );
}
