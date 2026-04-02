import { useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

type FaqItem = {
  question: string;
  answer: string;
};

const portalFaqs: FaqItem[] = [
  {
    question: "What is GovClerk Portal?",
    answer:
      "GovClerk Portal is a branded, public-facing website for your organization where citizens can access meeting records, agendas, live broadcasts, documents, and search through your entire public archive — 24 hours a day, 7 days a week, without creating an account.",
  },
  {
    question: "What's the difference between GovClerk Portal and GovClerkMinutes?",
    answer:
      "GovClerkMinutes is the AI transcription and meeting minutes engine — it helps your staff record meetings and auto-generate professional minutes. GovClerk Portal is the public-facing website where citizens access those records. Professional and Enterprise Portal plans include GovClerkMinutes access at no extra cost.",
  },
  {
    question: "Do citizens need to create an account to access the portal?",
    answer:
      "No. The public portal is fully open — anyone can browse meeting records, download documents, search the archive, and watch live or recorded broadcasts without signing up. Only your internal staff (admin users) need verified organizational email addresses to manage the portal.",
  },
  {
    question: "Can we pay in South African Rand (ZAR)?",
    answer:
      "Yes — all GovClerk Portal plans are priced in ZAR and billed through Paystack, which supports South African bank accounts and cards. We do not require foreign currency payment.",
  },
  {
    question: "How long does setup take?",
    answer:
      "We typically have organizations live within one business day. After your quote is approved, our team handles portal configuration, domain setup, logo upload, and email domain verification. We'll notify you the moment your portal is ready to go public.",
  },
  {
    question: "Can we import existing meeting records and documents?",
    answer:
      "Yes. As part of onboarding, our team can assist with bulk import of existing minutes, agendas, and documents so your archive is complete from day one. Contact us during the quote process to discuss your import requirements.",
  },
  {
    question: "What happens if we exceed our live streaming hours?",
    answer:
      "Overage is billed at R800 per additional hour of live streaming. You'll always be notified when you're approaching your monthly limit, and you can upgrade your plan at any time to increase your included hours.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "We offer a personalized demo of GovClerk Portal tailored to your organization. Request a quote and our team will set up a demo environment using your organization's details so you can see exactly what citizens will experience.",
  },
];

function AccordionItem({ question, answer }: FaqItem) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `portal-faq-panel-${question.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}`;
  const buttonId = `portal-faq-btn-${question.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}`;

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

export default function PortalFaqSection() {
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
          {portalFaqs.map((faq) => (
            <AccordionItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}
