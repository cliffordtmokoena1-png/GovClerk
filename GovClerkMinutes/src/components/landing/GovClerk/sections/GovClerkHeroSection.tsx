import Image from "next/image";
import QuoteRequestForm from "../../QuoteRequestForm";
import { GovClerk_ANNOUNCEMENT_BAR_HEIGHT } from "./GovClerkAnnouncementBar";
import DotPattern from "../DotPattern";

export default function GovClerkHeroSection() {
  return (
    <section
      id="hero-form"
      className="relative flex min-h-screen items-center bg-white"
      style={{
        paddingTop: "80px",
        paddingBottom: "4rem",
      }}
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-white" />
      <DotPattern dotColor="rgba(0,0,0,0.12)" fadeFrom="center" className="!bottom-auto h-[60%]" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
        {/* Mobile layout */}
        <div className="flex flex-col gap-8 md:hidden">
          <div className="w-full space-y-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-cd-blue">
              AI-Powered Meeting Management Platform
            </p>
            <h1 className="font-serif text-3xl font-normal leading-[1.1] text-gray-700 sm:text-4xl">
              Automate Agendas, Minutes &amp; Transcription for Your Organization
            </h1>
            <p className="text-base leading-relaxed text-gray-600">
              GovClerk transforms how government bodies, boards, and committees manage meetings,
              from agenda creation and real-time transcription to AI-generated minutes and public
              record portals.
            </p>
          </div>

          <QuoteRequestForm
            country="US"
            heading="Book a Demo"
            subtext="See how GovClerk can save your organization hours on every meeting. Fill out the form and our team will schedule a personalized walkthrough."
            buttonText="REQUEST DEMO"
            successTitle="Demo request received!"
            successMessage="Our team will reach out within one business day to schedule your demo."
            formType="demo"
          />

          <div className="w-full overflow-hidden rounded-xl border border-gray-200 shadow-lg">
            <Image
              src="/screenshots/desktop-v2.png"
              alt="GovClerk meeting management platform dashboard showing agenda builder and AI-generated minutes"
              width={800}
              height={500}
              className="h-auto w-full"
            />
          </div>
        </div>

        {/* Desktop layout: 58/42 split */}
        <div
          className="hidden items-start gap-12 md:grid"
          style={{ gridTemplateColumns: "58% 42%" }}
        >
          <div className="space-y-6 pr-4 text-left">
            <p className="text-sm font-semibold uppercase tracking-wider text-cd-blue">
              AI-Powered Meeting Management Platform
            </p>
            <h1 className="font-serif font-normal text-[clamp(1.9rem,4.75vw,3.8rem)] leading-[1.1] text-gray-700">
              Automate Agendas, Minutes &amp; Transcription for Your Organization
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-gray-600 lg:text-xl">
              GovClerk transforms how government bodies, boards, and committees manage meetings,
              from agenda creation and real-time transcription to AI-generated minutes and public
              record portals.
            </p>

            <div className="mt-4 w-full overflow-hidden rounded-xl border border-gray-200 shadow-xl">
              <Image
                src="/screenshots/desktop-v2.png"
                alt="GovClerk meeting management platform dashboard showing agenda builder and AI-generated minutes"
                width={900}
                height={550}
                className="h-auto w-full"
              />
            </div>
          </div>

          <div className="sticky" style={{ top: `${GovClerk_ANNOUNCEMENT_BAR_HEIGHT + 80}px` }}>
            <QuoteRequestForm
              country="US"
              heading="Book a Demo"
              subtext="See how GovClerk can save your organization hours on every meeting. Fill out the form and our team will schedule a personalized walkthrough."
              buttonText="REQUEST DEMO"
              successTitle="Demo request received!"
              successMessage="Our team will reach out within one business day to schedule your demo."
              formType="demo"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
