import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import FadeContent from "../../../reactbits/FadeContent";

type StepItem = {
  number: string;
  title: string;
  description: string;
  imageSrc: string;
};

const steps: StepItem[] = [
  {
    number: "01",
    title: "Create Your Agenda",
    description:
      "Build structured agendas with attachments, time allocations, and speaking order. Distribute to members automatically.",
    imageSrc: "/screenshots/desktop-v2.png",
  },
  {
    number: "02",
    title: "Record or Upload",
    description:
      "Record meetings directly in your browser or upload audio and video files. We support all major formats including Zoom and Teams recordings.",
    imageSrc: "/screenshots/desktop-v2.png",
  },
  {
    number: "03",
    title: "AI Generates Minutes",
    description:
      "Our AI transcribes the meeting, identifies speakers, extracts decisions and action items, and formats professional minutes in seconds.",
    imageSrc: "/screenshots/minutes-excerpt.png",
  },
  {
    number: "04",
    title: "Export & Publish",
    description:
      "Download Word or PDF documents, share with stakeholders, and publish to your public portal for community access.",
    imageSrc: "/screenshots/desktop-v2.png",
  },
];

export default function GovClerkHowItWorksSection() {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [autoSwitchKey, setAutoSwitchKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const activeStep = steps[activeTabIndex];

  const handleTabClick = useCallback((tabIndex: number) => {
    setActiveTabIndex(tabIndex);
    setAutoSwitchKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (isPaused) {
      return;
    }
    const interval = setInterval(() => {
      setActiveTabIndex((prev) => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoSwitchKey, isPaused]);

  return (
    <FadeContent direction="up" delay={0.1} duration={0.7}>
      <section className="bg-cd-navy py-20 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center md:mb-20">
            <h2 className="font-serif text-3xl font-normal text-white md:text-5xl leading-[1.1]">
              How GovClerk Works
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base text-blue-200 md:text-lg">
              Four simple steps to transform your meeting workflow.
            </p>
          </div>

          <div
            className="hidden md:block"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
          >
            <div className="relative mb-12">
              <div
                className="flex gap-10 border-b border-white/10"
                role="tablist"
                aria-label="How GovClerk works steps"
              >
                {steps.map((step, tabIndex) => {
                  const isActive = tabIndex === activeTabIndex;
                  return (
                    <button
                      key={step.number}
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`hiw-panel-${step.number}`}
                      id={`hiw-tab-${step.number}`}
                      onClick={() => handleTabClick(tabIndex)}
                      className={`
                        relative flex-1 pb-4 pt-2 text-left transition-colors duration-200
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2
                        ${isActive ? "text-white" : "text-white/40 hover:text-white/70"}
                      `}
                    >
                      <span className="block text-xs font-medium uppercase tracking-wider mb-1">
                        Step {step.number}
                      </span>
                      <span
                        className={`block text-sm font-semibold ${isActive ? "text-cd-blue" : ""}`}
                      >
                        {step.title}
                      </span>
                      <span
                        className={`
                          absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-300
                          ${isActive ? "bg-white scale-x-100" : "bg-transparent scale-x-0"}
                        `}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative rounded-2xl border border-white/10 shadow-xl overflow-hidden bg-white/5">
              {steps.map((step, imageIndex) => (
                <div
                  key={step.number}
                  id={`hiw-panel-${step.number}`}
                  role="tabpanel"
                  aria-labelledby={`hiw-tab-${step.number}`}
                  className={`
                    transition-opacity duration-500 ease-in-out
                    ${imageIndex === activeTabIndex ? "opacity-100 relative" : "opacity-0 absolute inset-0"}
                  `}
                  aria-hidden={imageIndex !== activeTabIndex}
                >
                  <Image
                    src={step.imageSrc}
                    alt={step.title}
                    width={1200}
                    height={700}
                    className="h-auto w-full object-cover"
                    priority={imageIndex === 0}
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <p
                key={activeStep.number}
                className="mx-auto max-w-2xl text-base text-blue-200 leading-relaxed transition-opacity duration-300"
              >
                {activeStep.description}
              </p>
            </div>
          </div>

          <div className="block md:hidden space-y-6">
            {steps.map((step, cardIndex) => {
              const isExpanded = cardIndex === activeTabIndex;
              return (
                <div
                  key={step.number}
                  className="rounded-xl border border-white/10 bg-white/5 shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => handleTabClick(cardIndex)}
                    aria-expanded={isExpanded}
                    className={`
                      w-full flex items-center gap-4 px-5 py-4 text-left transition-colors duration-200
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-inset
                      ${isExpanded ? "bg-white/10" : "bg-transparent"}
                    `}
                  >
                    <span
                      className={`
                        flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold
                        ${isExpanded ? "bg-white text-[#152a4e]" : "bg-white/10 text-white/60"}
                        transition-colors duration-200
                      `}
                    >
                      {step.number}
                    </span>
                    <span
                      className={`
                        text-sm font-semibold transition-colors duration-200
                        ${isExpanded ? "text-white" : "text-white/70"}
                      `}
                    >
                      {step.title}
                    </span>
                    <svg
                      className={`
                        ml-auto h-5 w-5 shrink-0 text-white/40 transition-transform duration-200
                        ${isExpanded ? "rotate-180" : "rotate-0"}
                      `}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div
                    className={`
                      transition-all duration-300 ease-in-out overflow-hidden
                      ${isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}
                    `}
                  >
                    <div className="px-5 pb-5">
                      <p className="mb-4 text-sm text-blue-200 leading-relaxed">
                        {step.description}
                      </p>
                      <div className="rounded-xl border border-white/10 shadow-md overflow-hidden">
                        <Image
                          src={step.imageSrc}
                          alt={step.title}
                          width={1200}
                          height={700}
                          className="h-auto w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </FadeContent>
  );
}
