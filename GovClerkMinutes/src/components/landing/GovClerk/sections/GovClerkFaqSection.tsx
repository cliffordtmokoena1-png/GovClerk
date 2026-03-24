import { useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";
import { faqData, type FaqItem } from "../faqData";

function AccordionItem({ question, answer }: FaqItem) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `faq-panel-${question.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}`;
  const buttonId = `faq-btn-${question.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}`;

  return (
    <div className="mb-3">
      <button
        type="button"
        id={buttonId}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`flex w-full items-center justify-between rounded-lg bg-white px-6 py-5 text-left transition-colors hover:bg-gray-50 ${isOpen ? "rounded-b-none" : ""}`}
      >
        <span className="text-base font-semibold text-gray-900">{question}</span>
        <LuChevronDown
          className={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`grid transition-all duration-200 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="rounded-b-lg bg-white px-6 pb-5">
            <p className="text-sm leading-relaxed text-gray-600">{answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GovClerkFaqSection() {
  return (
    <section className="bg-cd-navy py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-12 text-center md:mb-16">
            <h2 className="font-serif text-3xl font-normal text-white md:text-5xl leading-[1.1]">
              Frequently Asked Questions
            </h2>
          </div>
        </FadeContent>

        <div>
          {faqData.map((faq) => (
            <AccordionItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}
