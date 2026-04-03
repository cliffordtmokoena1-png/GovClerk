/**
 * GovClerk Public Portal — Request a Quote
 *
 * Shows the full pricing section at the top, then a quote request form below.
 * Clicking "Select [Plan]" scrolls down and pre-fills the selected plan in the form.
 */

import { useRef, useState, useMemo } from "react";
import GovClerkHead from "@/components/landing/GovClerk/GovClerkHead";
import GovClerkNavBar from "@/components/landing/GovClerk/sections/GovClerkNavBar";
import GovClerkFooter from "@/components/landing/GovClerk/sections/GovClerkFooter";
import GovClerkAnnouncementBar from "@/components/landing/GovClerk/sections/GovClerkAnnouncementBar";
import PortalPricingSection, {
  type PlanTier,
} from "@/components/landing/GovClerk/sections/PortalPricingSection";
import {
  ALLOWED_BILLING_DAYS,
  calculateProRata,
  formatZarAmount,
  ordinalSuffix,
} from "@/utils/portalBillingUtils";
import type { BillingDay } from "@/utils/portalBillingUtils";
import { PORTAL_PAYSTACK_PLANS } from "@/utils/portalPaystack";

const PLAN_OPTIONS: PlanTier[] = ["Starter", "Professional", "Enterprise"];

const BILLING_DAY_LABELS: Record<number, string> = {
  1: "1st of the month",
  15: "15th of the month",
  25: "25th of the month",
  26: "26th of the month",
  28: "28th of the month",
};

const PLAN_MONTHLY_PRICES: Record<string, number> = {
  Starter: PORTAL_PAYSTACK_PLANS.starter.monthly_zar,
  Professional: PORTAL_PAYSTACK_PLANS.professional.monthly_zar,
  Enterprise: PORTAL_PAYSTACK_PLANS.enterprise.monthly_zar,
};

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationName: string;
  websiteUrl: string;
  selectedPlan: PlanTier | "";
  estimatedSeats: string;
  estimatedStreamingHours: string;
  comments: string;
  billingDay: string;
}

const INITIAL_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  organizationName: "",
  websiteUrl: "",
  selectedPlan: "",
  estimatedSeats: "",
  estimatedStreamingHours: "",
  comments: "",
  billingDay: "",
};

export default function RequestQuotePage() {
  const formRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSelectPlan(tier: PlanTier) {
    setForm((prev) => ({ ...prev, selectedPlan: tier }));
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const billingPreview = useMemo(() => {
    if (!form.selectedPlan || !form.billingDay) return null;
    const monthlyPrice = PLAN_MONTHLY_PRICES[form.selectedPlan];
    if (!monthlyPrice) return null;
    const billingDay = parseInt(form.billingDay, 10) as BillingDay;
    if (!(ALLOWED_BILLING_DAYS as readonly number[]).includes(billingDay)) return null;

    const { proRataAmountZar, firstBillingDate, daysRemaining, daysInMonth } = calculateProRata(
      new Date(),
      billingDay,
      monthlyPrice
    );

    const fullFormatted = formatZarAmount(monthlyPrice);
    const proRataFormatted = formatZarAmount(proRataAmountZar);

    if (daysRemaining === daysInMonth) {
      return `Your first charge will be ${fullFormatted} today, then ${fullFormatted}/month from the ${billingDay}${ordinalSuffix(billingDay)}.`;
    }

    const billingDateStr = firstBillingDate.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return `Your first charge will be ${proRataFormatted} today, then ${fullFormatted}/month from ${billingDateStr}.`;
  }, [form.selectedPlan, form.billingDay]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        organizationName: form.organizationName.trim(),
        websiteUrl: form.websiteUrl.trim() || undefined,
        selectedPlan: form.selectedPlan || undefined,
        estimatedSeats: form.estimatedSeats ? parseInt(form.estimatedSeats, 10) : undefined,
        estimatedStreamingHours: form.estimatedStreamingHours
          ? parseFloat(form.estimatedStreamingHours)
          : undefined,
        comments: form.comments.trim() || undefined,
        billingDay: form.billingDay ? parseInt(form.billingDay, 10) : undefined,
        formType: "portal-quote",
      };

      const res = await fetch("/api/portal/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to submit quote request");
      }

      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen pt-10">
      <GovClerkHead
        title="Request a Quote — GovClerk Portal"
        description="Choose a plan and request a custom quote for GovClerk Portal. We'll get back to you within 24 hours."
      />
      <GovClerkAnnouncementBar />
      <GovClerkNavBar />

      {/* Pricing section at the top — clicking a plan scrolls to form */}
      <PortalPricingSection onSelectPlan={handleSelectPlan} formRef={formRef} />

      {/* Quote Request Form */}
      <section ref={formRef} className="bg-gray-50 py-16 md:py-24" id="quote-form">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-10 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-cd-blue">
              Get Your Custom Quote
            </p>
            <h2 className="font-serif text-3xl font-normal text-gray-800 md:text-4xl leading-[1.1]">
              Tell Us About Your Organization
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-gray-600">
              Fill out the form below and our team will get back to you within 24 hours with a
              tailored quote.
            </p>
          </div>

          {success ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <span className="text-3xl" aria-hidden="true">
                  ✅
                </span>
              </div>
              <h3 className="mb-2 text-xl font-bold text-green-800">Request received!</h3>
              <p className="text-green-700">
                Thank you! Our team will review your requirements and send you a custom quote within
                24 hours.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
            >
              {/* Name */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="firstName"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Jane"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                  />
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Smith"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="jane@capetown.gov.za"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+27 21 000 0000"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                  />
                </div>
              </div>

              {/* Organization */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="organizationName"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="organizationName"
                    name="organizationName"
                    type="text"
                    required
                    value={form.organizationName}
                    onChange={handleChange}
                    placeholder="City of Cape Town"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                  />
                </div>
                <div>
                  <label
                    htmlFor="websiteUrl"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Organization Website <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="websiteUrl"
                    name="websiteUrl"
                    type="url"
                    value={form.websiteUrl}
                    onChange={handleChange}
                    placeholder="https://capetown.gov.za"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                  />
                </div>
              </div>

              {/* Plan selection */}
              <div className="mb-6">
                <label
                  htmlFor="selectedPlan"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Selected Plan
                </label>
                <select
                  id="selectedPlan"
                  name="selectedPlan"
                  value={form.selectedPlan}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                >
                  <option value="">I&apos;m not sure yet</option>
                  {PLAN_OPTIONS.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preferred Billing Day */}
              <div className="mb-6">
                <label
                  htmlFor="billingDay"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Preferred Billing Day <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  id="billingDay"
                  name="billingDay"
                  value={form.billingDay}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                >
                  <option value="">Select a billing day</option>
                  {ALLOWED_BILLING_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {BILLING_DAY_LABELS[day]}
                    </option>
                  ))}
                </select>
                {billingPreview && (
                  <p className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                    💳 {billingPreview}
                  </p>
                )}
              </div>

              {/* Usage estimates */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="estimatedSeats"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Number of Admin Seats <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="estimatedSeats"
                    name="estimatedSeats"
                    type="number"
                    min="1"
                    value={form.estimatedSeats}
                    onChange={handleChange}
                    placeholder="e.g. 10"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                  />
                </div>
                <div>
                  <label
                    htmlFor="estimatedStreamingHours"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Est. Monthly Streaming Hours <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="estimatedStreamingHours"
                    name="estimatedStreamingHours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.estimatedStreamingHours}
                    onChange={handleChange}
                    placeholder="e.g. 8"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                  />
                </div>
              </div>

              {/* Comments */}
              <div className="mb-8">
                <label
                  htmlFor="comments"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Comments / Additional Requirements{" "}
                  <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="comments"
                  name="comments"
                  rows={4}
                  value={form.comments}
                  onChange={handleChange}
                  placeholder="Any specific requirements, integrations, or questions…"
                  className="w-full resize-y rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-cd-blue focus:outline-none focus:ring-1 focus:ring-cd-blue"
                />
              </div>

              {error && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-cd-blue px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-cd-blue-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cd-blue focus:ring-offset-2"
              >
                {isSubmitting ? "Submitting…" : "Request Your Quote"}
              </button>

              <p className="mt-4 text-center text-xs text-gray-400">
                We typically respond within 24 hours. View our{" "}
                <a
                  href="/privacy-policy.html"
                  className="underline underline-offset-2 hover:text-gray-700"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          )}
        </div>
      </section>

      <GovClerkFooter />
    </div>
  );
}
