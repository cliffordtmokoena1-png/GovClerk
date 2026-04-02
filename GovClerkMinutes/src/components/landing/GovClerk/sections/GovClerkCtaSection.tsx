import Link from "next/link";
import FadeContent from "../../../reactbits/FadeContent";
import DotPattern from "../DotPattern";

export default function GovClerkCtaSection() {
  return (
    <section className="relative bg-gradient-to-r from-cd-navy to-[#0f1f3a] py-16 md:py-24">
      <DotPattern dotColor="rgba(255,255,255,0.15)" fadeFrom="center" />
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <FadeContent direction="up" duration={0.7}>
          <div className="flex flex-col items-center gap-6">
            <h2 className="font-serif text-3xl font-normal leading-[1.1] text-white md:text-5xl">
              Ready to Transform How Your Organization Runs Meetings?
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
              Join government bodies, school boards, and nonprofit organizations that trust GovClerk
              to automate their meeting workflows.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-4">
              <a
                href="#hero-form"
                className="rounded-lg bg-white px-10 py-3 text-base font-semibold text-cd-blue transition-all hover:bg-gray-100 hover:text-cd-blue-dark"
              >
                See GovClerk in Action
              </a>
              <Link
                href="/overview"
                className="rounded-lg border border-white/40 px-10 py-3 text-base font-semibold text-white transition-all hover:border-white/70 hover:bg-white/10"
              >
                Watch a 2-Minute Overview
              </Link>
            </div>
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
