import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import GovClerkHead from "@/components/landing/GovClerk/GovClerkHead";

export default function PortalHubPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Allow only alphanumeric characters, hyphens, and underscores to prevent open-redirect or XSS
    const sanitized = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    if (sanitized) {
      router.push(`/portal/${sanitized}`);
    }
  }

  return (
    <>
      <GovClerkHead
        title="Public Portal — GovClerk"
        description="Access your organisation's public meeting records, calendars, and documents."
        noindex
      />
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {/* Logo / Brand */}
          <div className="mb-6 text-center">
            <Link href="/" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/govclerk-logo.svg"
                alt="GovClerk"
                className="mx-auto h-auto w-40"
              />
            </Link>
          </div>

          <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
            Public Portal
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500">
            Enter your organisation&apos;s portal name to access public meeting
            records, calendars, and documents.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="portal-slug"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Organisation portal name
              </label>
              <input
                id="portal-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. capetown, springfield"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Go to Portal
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            <Link
              href="/"
              className="underline underline-offset-2 hover:text-gray-600"
            >
              ← Back to GovClerk
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
