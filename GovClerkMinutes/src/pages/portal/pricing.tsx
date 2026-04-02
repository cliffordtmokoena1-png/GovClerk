/**
 * GovClerk Public Portal — Pricing Page
 *
 * Public page (no auth required) showing the three portal subscription tiers
 * and an overage pricing section. All tiers require a quote request to get
 * started (handled via /portal/request-quote).
 *
 * Prices in South African Rand (ZAR).
 */

import Head from "next/head";
import Link from "next/link";
import { PORTAL_PAYSTACK_PLANS, PORTAL_OVERAGE_RATES } from "@/utils/portalPaystack";

const tiers = [
  {
    key: "starter" as const,
    name: "Starter",
    price: PORTAL_PAYSTACK_PLANS.starter.monthly_zar,
    seats: PORTAL_PAYSTACK_PLANS.starter.seats,
    stream_hours: PORTAL_PAYSTACK_PLANS.starter.stream_hours,
    badge: null,
    cta: "Get Started",
    features: [
      `Up to ${PORTAL_PAYSTACK_PLANS.starter.seats} admin seats`,
      `${PORTAL_PAYSTACK_PLANS.starter.stream_hours} hours live streaming / month`,
      "Public meeting portal (branded)",
      "Document uploads & archives",
      "Meeting calendar",
      "Public records search",
      "RSS feed",
      "Org email verification",
    ],
  },
  {
    key: "professional" as const,
    name: "Professional",
    price: PORTAL_PAYSTACK_PLANS.professional.monthly_zar,
    seats: PORTAL_PAYSTACK_PLANS.professional.seats,
    stream_hours: PORTAL_PAYSTACK_PLANS.professional.stream_hours,
    badge: "Most Popular",
    cta: "Request a Quote",
    features: [
      `Up to ${PORTAL_PAYSTACK_PLANS.professional.seats} admin seats`,
      `${PORTAL_PAYSTACK_PLANS.professional.stream_hours} hours live streaming / month`,
      "Everything in Starter, plus:",
      "Live meeting streaming",
      "Real-time transcript (live)",
      "Agenda tracking during live meetings",
      "GovClerkMinutes access (50 tokens / month)",
    ],
  },
  {
    key: "enterprise" as const,
    name: "Enterprise",
    price: PORTAL_PAYSTACK_PLANS.enterprise.monthly_zar,
    seats: PORTAL_PAYSTACK_PLANS.enterprise.seats,
    stream_hours: PORTAL_PAYSTACK_PLANS.enterprise.stream_hours,
    badge: "Contact Us",
    cta: "Request a Quote",
    features: [
      `Up to ${PORTAL_PAYSTACK_PLANS.enterprise.seats}+ admin seats`,
      `${PORTAL_PAYSTACK_PLANS.enterprise.stream_hours}+ hours live streaming / month`,
      "Everything in Professional, plus:",
      "Custom branding (full)",
      "API access",
      "Priority support",
      "SLA guarantee",
      "Dedicated account manager",
    ],
  },
];

function formatZar(amount: number): string {
  return `R${amount.toLocaleString("en-ZA")}`;
}

export default function PortalPricingPage() {
  return (
    <>
      <Head>
        <title>Pricing — GovClerk Public Portal</title>
        <meta
          name="description"
          content="Simple, transparent pricing for the GovClerk Public Portal. Monthly subscriptions priced by seats and live-stream hours."
        />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/govclerk-logo.svg" alt="GovClerk" className="h-8 w-auto" />
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/portal" className="text-gray-600 hover:text-gray-900">
                Portal Home
              </Link>
              <Link
                href="/portal/request-quote"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Request a Quote
              </Link>
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
              GovClerk Public Portal is priced as a fixed monthly subscription based on the number
              of admin seats and live-stream hours your organisation needs. No tokens, no per-minute
              charges.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {tiers.map((tier) => {
              const isPopular = tier.badge === "Most Popular";
              const isEnterprise = tier.key === "enterprise";

              return (
                <div
                  key={tier.key}
                  className={`relative rounded-2xl border bg-white shadow-sm flex flex-col ${
                    isPopular ? "border-blue-500 ring-2 ring-blue-500" : "border-gray-200"
                  }`}
                >
                  {tier.badge && (
                    <div
                      className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold ${
                        isPopular ? "bg-blue-600 text-white" : "bg-gray-900 text-white"
                      }`}
                    >
                      {tier.badge}
                    </div>
                  )}

                  <div className="p-8 flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h2>

                    <div className="mb-6">
                      <p className="text-3xl font-bold text-gray-900">
                        {formatZar(tier.price)}
                        <span className="text-base font-normal text-gray-500"> / month</span>
                      </p>
                      {isEnterprise && (
                        <p className="text-sm text-gray-500 mt-1">
                          Starting price — custom quote available
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-8">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                          <span className="mt-0.5 flex-shrink-0 text-green-500" aria-hidden="true">
                            ✓
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-8 pt-0">
                    <Link
                      href="/portal/request-quote"
                      className={`block w-full text-center px-6 py-3 rounded-lg font-semibold text-sm transition-colors ${
                        isPopular
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-900 text-white hover:bg-gray-800"
                      }`}
                    >
                      {tier.cta}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overage pricing */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-16">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Overage pricing</h2>
            <p className="text-gray-500 text-sm mb-6">
              Usage beyond your plan&apos;s included allowances is billed monthly at the following
              rates.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold text-sm">👤</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Extra admin seats</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatZar(PORTAL_OVERAGE_RATES.seat_zar)}
                    <span className="text-sm font-normal text-gray-500"> / seat / month</span>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold text-sm">📡</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Extra live-stream hours</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatZar(PORTAL_OVERAGE_RATES.stream_hour_zar)}
                    <span className="text-sm font-normal text-gray-500"> / hour / month</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ / CTA */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Not sure which plan is right for you?
            </h2>
            <p className="text-gray-500 mb-8 max-w-lg mx-auto">
              Tell us about your organisation and we&apos;ll recommend the best plan and send you a
              custom quote within 24 hours.
            </p>
            <Link
              href="/portal/request-quote"
              className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Request a Custom Quote →
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} GovClerk. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/portal" className="hover:text-gray-900">
                Portal Home
              </Link>
              <Link href="/" className="hover:text-gray-900">
                GovClerk
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
