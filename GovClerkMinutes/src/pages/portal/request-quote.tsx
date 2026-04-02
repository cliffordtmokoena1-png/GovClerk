/**
 * GovClerk Public Portal — Quote Request Page
 *
 * Collects organisation details and feature requirements, then POSTs to
 * /api/portal/quote-request for storage and notification.
 */

import { useState } from "react";
import Head from "next/head";
import Link from "next/link";

type OrgType =
  | "municipality"
  | "school_board"
  | "hoa"
  | "county"
  | "state_agency"
  | "other";

const ORG_TYPE_OPTIONS: { value: OrgType; label: string }[] = [
  { value: "municipality", label: "Municipality" },
  { value: "school_board", label: "School Board" },
  { value: "hoa", label: "Home Owners Association (HOA)" },
  { value: "county", label: "County / District" },
  { value: "state_agency", label: "State / Provincial Agency" },
  { value: "other", label: "Other" },
];

interface FormState {
  org_name: string;
  org_type: OrgType;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  estimated_seats: string;
  estimated_monthly_meetings: string;
  estimated_avg_meeting_duration_hours: string;
  needs_live_streaming: boolean;
  needs_public_records: boolean;
  needs_document_archival: boolean;
  needs_govclerk_minutes: boolean;
  additional_notes: string;
}

const INITIAL_FORM: FormState = {
  org_name: "",
  org_type: "municipality",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  estimated_seats: "",
  estimated_monthly_meetings: "",
  estimated_avg_meeting_duration_hours: "",
  needs_live_streaming: false,
  needs_public_records: false,
  needs_document_archival: false,
  needs_govclerk_minutes: false,
  additional_notes: "",
};

export default function RequestQuotePage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const target = e.target;
    const value =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;
    setForm((prev) => ({ ...prev, [target.name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const body = {
        org_name: form.org_name.trim(),
        org_type: form.org_type,
        contact_name: form.contact_name.trim(),
        contact_email: form.contact_email.trim().toLowerCase(),
        contact_phone: form.contact_phone.trim() || undefined,
        estimated_seats: form.estimated_seats ? parseInt(form.estimated_seats, 10) : undefined,
        estimated_monthly_meetings: form.estimated_monthly_meetings
          ? parseInt(form.estimated_monthly_meetings, 10)
          : undefined,
        estimated_avg_meeting_duration_hours: form.estimated_avg_meeting_duration_hours
          ? parseFloat(form.estimated_avg_meeting_duration_hours)
          : undefined,
        needs_live_streaming: form.needs_live_streaming,
        needs_public_records: form.needs_public_records,
        needs_document_archival: form.needs_document_archival,
        needs_govclerk_minutes: form.needs_govclerk_minutes,
        additional_notes: form.additional_notes.trim() || undefined,
      };

      const res = await fetch("/api/portal/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || "Failed to submit quote request");
      }

      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Request a Quote — GovClerk Public Portal</title>
        <meta
          name="description"
          content="Tell us about your organisation and we'll send you a custom GovClerk Portal quote within 24 hours."
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
              <Link href="/portal/pricing" className="text-gray-600 hover:text-gray-900">
                Pricing
              </Link>
              <Link href="/portal" className="text-gray-600 hover:text-gray-900">
                Portal Home
              </Link>
            </nav>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Request a Quote</h1>
            <p className="text-gray-500">
              Tell us about your organisation and we&apos;ll get back to you within 24 hours with a
              tailored quote.
            </p>
          </div>

          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-3xl" aria-hidden="true">✅</span>
                <span className="sr-only">Success</span>
              </div>
              <h2 className="text-xl font-bold text-green-800 mb-2">Request received!</h2>
              <p className="text-green-700 mb-6">
                Thank you! We&apos;ll review your requirements and get back to you within 24 hours
                with a custom quote.
              </p>
              <Link
                href="/portal/pricing"
                className="text-sm text-green-700 underline underline-offset-2 hover:text-green-900"
              >
                ← Back to pricing
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm space-y-6"
            >
              {/* Organisation details */}
              <section>
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Organisation details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="org_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Organisation name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="org_name"
                      name="org_name"
                      type="text"
                      required
                      value={form.org_name}
                      onChange={handleChange}
                      placeholder="e.g. City of Cape Town"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="org_type" className="block text-sm font-medium text-gray-700 mb-1">
                      Organisation type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="org_type"
                      name="org_type"
                      required
                      value={form.org_type}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {ORG_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* Contact details */}
              <section>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Contact details</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Contact person name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact_name"
                      name="contact_name"
                      type="text"
                      required
                      value={form.contact_name}
                      onChange={handleChange}
                      placeholder="Full name"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700 mb-1">
                      Contact email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact_email"
                      name="contact_email"
                      type="email"
                      required
                      value={form.contact_email}
                      onChange={handleChange}
                      placeholder="you@organisation.gov.za"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Contact phone
                    </label>
                    <input
                      id="contact_phone"
                      name="contact_phone"
                      type="tel"
                      value={form.contact_phone}
                      onChange={handleChange}
                      placeholder="+27 21 000 0000"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </section>

              {/* Usage estimate */}
              <section>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Usage estimate</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="estimated_seats" className="block text-sm font-medium text-gray-700 mb-1">
                      Admin users / seats
                    </label>
                    <input
                      id="estimated_seats"
                      name="estimated_seats"
                      type="number"
                      min="1"
                      value={form.estimated_seats}
                      onChange={handleChange}
                      placeholder="e.g. 10"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="estimated_monthly_meetings" className="block text-sm font-medium text-gray-700 mb-1">
                      Meetings per month
                    </label>
                    <input
                      id="estimated_monthly_meetings"
                      name="estimated_monthly_meetings"
                      type="number"
                      min="1"
                      value={form.estimated_monthly_meetings}
                      onChange={handleChange}
                      placeholder="e.g. 4"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="estimated_avg_meeting_duration_hours" className="block text-sm font-medium text-gray-700 mb-1">
                      Avg meeting length (hrs)
                    </label>
                    <input
                      id="estimated_avg_meeting_duration_hours"
                      name="estimated_avg_meeting_duration_hours"
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={form.estimated_avg_meeting_duration_hours}
                      onChange={handleChange}
                      placeholder="e.g. 2"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </section>

              {/* Features needed */}
              <section>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Features needed</h2>
                <div className="space-y-3">
                  {[
                    { name: "needs_live_streaming" as const, label: "Live Streaming" },
                    { name: "needs_public_records" as const, label: "Public Records Portal" },
                    { name: "needs_document_archival" as const, label: "Document Archival" },
                    {
                      name: "needs_govclerk_minutes" as const,
                      label: "GovClerkMinutes (AI Meeting Minutes)",
                    },
                  ].map((feature) => (
                    <label
                      key={feature.name}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        name={feature.name}
                        checked={form[feature.name]}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        {feature.label}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              {/* Additional notes */}
              <section>
                <label htmlFor="additional_notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Additional notes / requirements
                </label>
                <textarea
                  id="additional_notes"
                  name="additional_notes"
                  rows={4}
                  value={form.additional_notes}
                  onChange={handleChange}
                  placeholder="Any specific requirements, integrations, or questions…"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                />
              </section>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {isSubmitting ? "Submitting…" : "Submit Quote Request"}
              </button>

              <p className="text-xs text-gray-400 text-center">
                We typically respond within 24 hours.{" "}
                <Link href="/portal/pricing" className="underline underline-offset-2 hover:text-gray-700">
                  View pricing →
                </Link>
              </p>
            </form>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} GovClerk. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/portal/pricing" className="hover:text-gray-900">
                Pricing
              </Link>
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
