import { type RefObject } from "react";
import { LuCheck } from "react-icons/lu";
import FadeContent from "../../../reactbits/FadeContent";

export type PlanTier = "Starter" | "Professional" | "Enterprise";

type PlanFeature = string;

type Plan = {
  tier: PlanTier;
  price: string;
  priceNote?: string;
  tagline: string;
  popular?: boolean;
  features: PlanFeature[];
  cta: string;
};

const plans: Plan[] = [
  {
    tier: "Starter",
    price: "R2,500",
    tagline:
      "Perfect for small town councils, community boards, and local government bodies getting started with digital transparency.",
    features: [
      "Up to 5 admin seats",
      "10 hours live streaming/month",
      "Branded public meeting portal",
      "Document uploads & archives",
      "Meeting calendar",
      "Public records search",
      "RSS feed",
      "Organizational email verification",
    ],
    cta: "Select Starter",
  },
  {
    tier: "Professional",
    price: "R8,000",
    tagline:
      "Built for mid-size municipalities, school districts, and district councils that need live meeting broadcasting and AI-powered minutes.",
    popular: true,
    features: [
      "Everything in Starter, plus:",
      "Up to 15 admin seats",
      "20 hours live streaming/month",
      "Live meeting broadcasting",
      "Real-time transcription",
      "Agenda tracking during broadcasts",
      "GovClerkMinutes access (2,000 tokens/month)",
    ],
    cta: "Select Professional",
  },
  {
    tier: "Enterprise",
    price: "R20,000",
    priceNote: "Starting at",
    tagline:
      "Designed for large metropolitan municipalities, provincial departments, and government agencies with advanced compliance and branding needs.",
    features: [
      "Everything in Professional, plus:",
      "50+ admin seats",
      "20+ hours live streaming/month",
      "Full custom branding",
      "API access",
      "Priority support with dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact Us",
  },
];

type Props = {
  onSelectPlan?: (tier: PlanTier) => void;
  formRef?: RefObject<HTMLElement | null>;
};

export default function PortalPricingSection({ onSelectPlan, formRef }: Props) {
  function handleSelect(tier: PlanTier) {
    if (onSelectPlan) {
      onSelectPlan(tier);
    }
    if (formRef?.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeContent direction="up" duration={0.6}>
          <div className="mb-12 text-center md:mb-16">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-cd-blue">
              Pricing
            </p>
            <h2 className="font-serif text-3xl font-normal text-gray-800 md:text-5xl leading-[1.1]">
              Transparent, Predictable Pricing
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
              Choose the plan that fits your organization. All plans billed monthly in ZAR. No
              foreign currency, no hidden fees.
            </p>
          </div>
        </FadeContent>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan, index) => (
            <FadeContent key={plan.tier} direction="up" duration={0.5} delay={index * 0.1}>
              <div
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  plan.popular
                    ? "border-cd-blue shadow-lg shadow-cd-blue/10"
                    : "border-gray-200 shadow-sm"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-cd-blue px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900">{plan.tier}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    {plan.priceNote && (
                      <span className="text-sm text-gray-500">{plan.priceNote}</span>
                    )}
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{plan.tagline}</p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <LuCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleSelect(plan.tier)}
                  className={`w-full rounded-lg px-6 py-3 text-sm font-semibold transition-all ${
                    plan.popular
                      ? "bg-cd-blue text-white hover:bg-cd-blue-dark hover:shadow-md"
                      : "border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            </FadeContent>
          ))}
        </div>

        <FadeContent direction="up" duration={0.6} delay={0.4}>
          <div className="mt-10 rounded-xl border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-600">
            <strong className="text-gray-800">Add-ons:</strong> Additional seats: R250/seat/month
            &nbsp;·&nbsp; Additional live streaming: R800/hour &nbsp;·&nbsp; Additional
            GovClerkMinutes tokens: available at standard pricing
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
