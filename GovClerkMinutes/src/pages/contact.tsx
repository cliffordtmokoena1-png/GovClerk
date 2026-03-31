import { useState } from "react";
import Link from "next/link";
import { LuMail, LuPhone, LuCalendar, LuSend } from "react-icons/lu";
import GovClerkPageLayout from "@/components/landing/GovClerk/sections/GovClerkPageLayout";
import GovClerkHead from "@/components/landing/GovClerk/GovClerkHead";
import { safeCapture } from "@/utils/safePosthog";

const BUSINESS_WHATSAPP_NUMBER = "27664259236";
const BOOK_A_DEMO_CALENDAR_URL = "https://calendly.com/cliff-govclerkminutes/30min";

type Department = "Support" | "Sales";

interface FormState {
  name: string;
  email: string;
  department: Department;
  message: string;
}

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    department: "Support",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const tag = form.department === "Support" ? "[Support]" : "[Sales]";
    const whatsappMessage = `${tag} Hi, my name is ${form.name} (${form.email}).\n\n${form.message}`;
    const url = `https://wa.me/+${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

    safeCapture("contact_form_submitted", {
      department: form.department,
    });

    setSubmitted(true);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <GovClerkPageLayout>
      <GovClerkHead
        title="Contact GovClerk | Get in Touch"
        description="Have questions about GovClerk? Contact our sales and support teams for demos, pricing, and technical assistance."
        canonical="https://GovClerk.com/contact"
      />

      {/* Hero */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <span className="mb-4 inline-block rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cd-blue">
            Company
          </span>
          <h1 className="font-serif text-4xl font-normal text-gray-900 md:text-5xl lg:text-6xl">
            Get in Touch with Our Team
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
            Whether you need a demo, have a question about pricing, or want technical support, our
            team is here to help. Reach out and we will get back to you within one business day.
          </p>
        </div>
      </section>

      {/* Contact info cards */}
      <section className="bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Support */}
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <LuMail className="h-5 w-5 text-cd-blue" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Technical Support</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Already a customer? Our support team is available to help with setup, integrations,
                and technical questions.
              </p>
              <a
                href="mailto:support@govclerkminutes.com"
                className="mt-4 inline-block text-sm font-medium text-cd-blue hover:underline"
              >
                support@govclerkminutes.com
              </a>
            </div>

            {/* Sales */}
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <LuPhone className="h-5 w-5 text-cd-blue" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Sales Inquiries</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Interested in GovClerk for your organization? Our sales team can walk you through
                features, pricing, and implementation.
              </p>
              <a
                href="mailto:sales@govclerkminutes.com"
                className="mt-4 inline-block text-sm font-medium text-cd-blue hover:underline"
              >
                sales@govclerkminutes.com
              </a>
            </div>

            {/* Book a Demo */}
            <div className="rounded-2xl border border-cd-blue/20 bg-cd-blue/5 p-8 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cd-blue/10">
                <LuCalendar className="h-5 w-5 text-cd-blue" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Book a Demo</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Schedule a personalized demo and see how GovClerk can transform your meeting
                workflow.
              </p>
              <a
                href={BOOK_A_DEMO_CALENDAR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-cd-blue px-4 py-2 text-sm font-medium text-white transition-all hover:bg-cd-blue-dark hover:shadow-md"
                onClick={() => safeCapture("book_a_demo_clicked", { source: "contact_page_card" })}
              >
                <LuCalendar className="h-4 w-4" />
                Schedule Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact-form" className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: form */}
            <div>
              <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Send us a message</h2>
              <p className="mt-3 text-base leading-relaxed text-gray-500">
                Fill out the form and we&apos;ll connect you via WhatsApp instantly.
              </p>

              {submitted ? (
                <div className="mt-8 rounded-2xl border border-green-100 bg-green-50 p-8 text-center">
                  <p className="text-lg font-semibold text-green-800">WhatsApp opened!</p>
                  <p className="mt-2 text-sm text-green-700">
                    Your message has been pre-filled in WhatsApp. Send it to connect with our{" "}
                    {form.department} team.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-4 text-sm font-medium text-green-700 hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your full name"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-cd-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-cd-blue/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@organization.gov"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-cd-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-cd-blue/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-department"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Department
                    </label>
                    <select
                      id="contact-department"
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value as Department })
                      }
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-colors focus:border-cd-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-cd-blue/20"
                    >
                      <option value="Support">Support</option>
                      <option value="Sales">Sales</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-message"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Describe how we can help you..."
                      className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-cd-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-cd-blue/20"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cd-blue px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-cd-blue-dark hover:shadow-md active:scale-[0.98]"
                  >
                    <LuSend className="h-4 w-4" />
                    Send via WhatsApp
                  </button>

                  <p className="text-center text-xs text-gray-400">
                    Submitting this form will open WhatsApp with your message pre-filled.
                  </p>
                </form>
              )}
            </div>

            {/* Right: Book a Demo embed */}
            <div>
              <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Book a Demo</h2>
              <p className="mt-3 text-base leading-relaxed text-gray-500">
                Schedule a time that works for you and see GovClerk in action with a personalized
                walkthrough.
              </p>

              <div className="mt-8 overflow-hidden rounded-2xl border border-cd-blue/20 bg-cd-blue/5 p-10 text-center shadow-sm">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cd-blue/10">
                  <LuCalendar className="h-8 w-8 text-cd-blue" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Ready to see GovClerk in action?</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-500">
                  Pick a time that works for you and our team will walk you through everything
                  GovClerk has to offer.
                </p>
                <a
                  href={BOOK_A_DEMO_CALENDAR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-cd-blue px-8 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-cd-blue-dark hover:shadow-lg active:scale-[0.98]"
                  onClick={() => safeCapture("book_a_demo_clicked", { source: "contact_page_cta" })}
                >
                  <LuCalendar className="h-5 w-5" />
                  Schedule a Demo
                </a>
                <p className="mt-4 text-xs text-gray-400">Opens Calendly in a new tab</p>
              </div>

              <p className="mt-3 text-center text-xs text-gray-400">
                Prefer to talk first?{" "}
                <Link href="#contact-form" className="text-cd-blue hover:underline">
                  Send us a message
                </Link>{" "}
                and we&apos;ll reach out via WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </section>
    </GovClerkPageLayout>
  );
}
