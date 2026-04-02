import Link from "next/link";
import FadeContent from "../../../reactbits/FadeContent";

type Step = {
  number: string;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    number: "01",
    title: "Request a Quote",
    description:
      "Tell us about your organization — the number of seats you need, how often you hold meetings, and whether you need live streaming. We'll build a custom quote within 24 hours.",
  },
  {
    number: "02",
    title: "We Set Up Your Portal",
    description:
      "Our team handles configuration, domain setup, logo upload, and import of any existing records. We verify your organization's email domain so only authorized staff can log in.",
  },
  {
    number: "03",
    title: "Go Public",
    description:
      "Flip the switch and your community gets instant access. Citizens can search records, watch live broadcasts, download documents, and subscribe to your RSS feed — all without creating an account.",
  },
];

export default function PortalHowItWorksSection() {
  return (
    <section className="bg-cd-navy py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-300">
              How It Works
            </p>
            <h2 className="font-serif text-3xl font-normal text-white md:text-5xl leading-[1.1]">
              From Sign-Up to Public Portal in Three Steps
            </h2>
          </div>
        </FadeContent>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <FadeContent key={step.number} direction="up" duration={0.5} delay={index * 0.15}>
              <div className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-8">
                <span className="font-serif text-5xl font-bold text-white/20">{step.number}</span>
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-blue-100">{step.description}</p>
              </div>
            </FadeContent>
          ))}
        </div>

        <FadeContent direction="up" duration={0.6} delay={0.4}>
          <div className="mt-12 text-center">
            <Link
              href="/portal/demo"
              className="inline-block rounded-lg bg-white px-10 py-3.5 text-base font-semibold text-cd-blue transition-all hover:bg-gray-100"
            >
              See a Live Demo Portal →
            </Link>
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
