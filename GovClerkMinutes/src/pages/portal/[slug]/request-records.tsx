import { GetServerSideProps } from "next";
import { RESERVED_PORTAL_SLUGS } from "@/pages/api/portal/utils/initializePortalSettings";
import Head from "next/head";
import Link from "next/link";
import { useState, useCallback } from "react";
import type { PublicPortalResponse } from "@/types/portal";
import type {
  SubmitRecordsRequestBody,
  SubmitRecordsRequestResponse,
  TrackRequestResponse,
  RecordsRequestStatus,
} from "@/types/publicRecords";
import { PublicPortalHeader } from "@/components/portal/public/PublicPortalHeader";
import { getPortalSessionFromCookieHeader } from "@/portal-auth/portalAuth";

type Props = {
  settings: PublicPortalResponse["settings"];
  slug: string;
};

type ActiveTab = "submit" | "track";

const STATUS_STEPS: { key: RecordsRequestStatus; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "in_review", label: "In Review" },
  { key: "fulfilled", label: "Fulfilled" },
];

const STATUS_LABELS: Record<RecordsRequestStatus, string> = {
  received: "Received",
  acknowledged: "Acknowledged",
  in_review: "In Review",
  fulfilled: "Fulfilled",
  partially_fulfilled: "Partially Fulfilled",
  denied: "Denied",
  withdrawn: "Withdrawn",
};

function StatusTimeline({ status }: { status: RecordsRequestStatus }) {
  const terminalStatuses: RecordsRequestStatus[] = ["denied", "withdrawn", "partially_fulfilled"];
  if (terminalStatuses.includes(status)) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          {status === "denied" ? "❌" : "🔴"} {STATUS_LABELS[status]}
        </span>
      </div>
    );
  }

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === status);

  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Request status timeline">
      {STATUS_STEPS.map((step, i) => {
        const isDone = i < currentIndex || (status === "fulfilled" && step.key === "fulfilled");
        const isCurrent = step.key === status;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                isDone
                  ? "bg-green-100 text-green-800"
                  : isCurrent
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-500"
              }`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {isDone ? "✅" : isCurrent ? "🔄" : "⏳"} {step.label}
            </span>
            {i < STATUS_STEPS.length - 1 && (
              <span aria-hidden="true" className="text-gray-400">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function RequestRecordsPage({ settings, slug }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("submit");

  // Submit form state
  const [form, setForm] = useState<SubmitRecordsRequestBody>({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    requestType: "foia",
    description: "",
    dateRangeFrom: "",
    dateRangeTo: "",
  });
  const [submitError, setSubmitError] = useState("");
  const [submitResult, setSubmitResult] = useState<SubmitRecordsRequestResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitLiveMsg, setSubmitLiveMsg] = useState("");

  // Track tab state
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackResult, setTrackResult] = useState<TrackRequestResponse | null>(null);
  const [trackError, setTrackError] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError("");
      setSubmitResult(null);
      setIsSubmitting(true);
      setSubmitLiveMsg("Submitting your request...");

      try {
        const body: SubmitRecordsRequestBody = {
          requesterName: form.requesterName,
          requesterEmail: form.requesterEmail,
          requestType: form.requestType,
          description: form.description,
        };
        if (form.requesterPhone) body.requesterPhone = form.requesterPhone;
        if (form.dateRangeFrom) body.dateRangeFrom = form.dateRangeFrom;
        if (form.dateRangeTo) body.dateRangeTo = form.dateRangeTo;

        const res = await fetch(`/api/public/portal/${slug}/records/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json();
          setSubmitError(err.error || "Failed to submit request. Please try again.");
          setSubmitLiveMsg("Submission failed.");
        } else {
          const data: SubmitRecordsRequestResponse = await res.json();
          setSubmitResult(data);
          setSubmitLiveMsg(`Request submitted. Your tracking number is ${data.trackingNumber}`);
        }
      } catch {
        setSubmitError("Network error. Please check your connection and try again.");
        setSubmitLiveMsg("Submission failed due to a network error.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, slug]
  );

  const handleTrack = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTrackError("");
      setTrackResult(null);
      setIsTracking(true);

      try {
        const res = await fetch(
          `/api/public/portal/${slug}/records/track/${encodeURIComponent(trackingNumber)}`
        );
        if (!res.ok) {
          const err = await res.json();
          setTrackError(err.error || "Request not found. Please check your tracking number.");
        } else {
          const data: TrackRequestResponse = await res.json();
          setTrackResult(data);
        }
      } catch {
        setTrackError("Network error. Please check your connection and try again.");
      } finally {
        setIsTracking(false);
      }
    },
    [trackingNumber, slug]
  );

  return (
    <>
      <Head>
        <title>Request Records — {settings.pageTitle || "Public Portal"}</title>
        <meta
          name="description"
          content="Submit a FOIA / public records request or track an existing request."
        />
      </Head>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-blue-700 focus:rounded focus:shadow"
      >
        Skip to main content
      </a>

      <PublicPortalHeader settings={settings} />

      <main id="main-content" className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <ol className="flex items-center gap-2">
            <li>
              <Link
                href={`/portal/${slug}`}
                className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                Portal Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-gray-800 font-medium">
              Request Records
            </li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Request Records</h1>
        <p className="text-gray-600 mb-6">
          Submit a public records request or track an existing one.
        </p>

        {/* Tabs */}
        <div
          className="flex gap-1 mb-6 border-b border-gray-200"
          role="tablist"
          aria-label="Request records tabs"
        >
          {(["submit", "track"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={activeTab === tab}
              aria-controls={`tabpanel-${tab}`}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              {tab === "submit" ? "📤 Submit a Request" : "🔍 Track My Request"}
            </button>
          ))}
        </div>

        {/* Submit tab */}
        <div
          role="tabpanel"
          id="tabpanel-submit"
          aria-labelledby="tab-submit"
          hidden={activeTab !== "submit"}
        >
          {/* Live region for submission feedback */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {submitLiveMsg}
          </div>

          {submitResult ? (
            <div className="bg-green-50 border border-green-300 rounded-lg p-6 text-center">
              <p className="text-2xl mb-2">✅</p>
              <h2 className="text-xl font-bold text-green-800 mb-2">Request Submitted!</h2>
              <p className="text-green-700 mb-4">Save your tracking number:</p>
              <div className="inline-block bg-white border border-green-400 rounded-lg px-6 py-3 mb-4">
                <span className="text-2xl font-mono font-bold text-green-900">
                  {submitResult.trackingNumber}
                </span>
              </div>
              <p className="text-sm text-green-700">{submitResult.message}</p>
              <button
                type="button"
                onClick={() => {
                  setSubmitResult(null);
                  setForm({
                    requesterName: "",
                    requesterEmail: "",
                    requesterPhone: "",
                    requestType: "foia",
                    description: "",
                  });
                }}
                className="mt-4 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Submit Another Request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate aria-label="Submit a records request">
              {submitError && (
                <div
                  role="alert"
                  className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700"
                >
                  {submitError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="requesterName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Full Name{" "}
                    <span aria-hidden="true" className="text-red-500">
                      *
                    </span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <input
                    id="requesterName"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.requesterName}
                    onChange={(e) => setForm((f) => ({ ...f, requesterName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="requesterEmail"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email Address{" "}
                    <span aria-hidden="true" className="text-red-500">
                      *
                    </span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <input
                    id="requesterEmail"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.requesterEmail}
                    onChange={(e) => setForm((f) => ({ ...f, requesterEmail: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="requesterPhone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Phone Number <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="requesterPhone"
                    type="tel"
                    autoComplete="tel"
                    value={form.requesterPhone || ""}
                    onChange={(e) => setForm((f) => ({ ...f, requesterPhone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="requestType"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Request Type{" "}
                    <span aria-hidden="true" className="text-red-500">
                      *
                    </span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <select
                    id="requestType"
                    required
                    value={form.requestType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        requestType: e.target.value as SubmitRecordsRequestBody["requestType"],
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 text-sm"
                  >
                    <option value="foia">FOIA Request</option>
                    <option value="open_records">Open Records Request</option>
                    <option value="inspection">Document Inspection</option>
                    <option value="certification">Certified Copy</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Description of Records Requested{" "}
                    <span aria-hidden="true" className="text-red-500">
                      *
                    </span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <textarea
                    id="description"
                    required
                    rows={5}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Please describe the records you are requesting in as much detail as possible..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 text-sm resize-y"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="dateRangeFrom"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Date Range From <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      id="dateRangeFrom"
                      type="date"
                      value={form.dateRangeFrom || ""}
                      onChange={(e) => setForm((f) => ({ ...f, dateRangeFrom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dateRangeTo"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Date Range To <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      id="dateRangeTo"
                      type="date"
                      value={form.dateRangeTo || ""}
                      onChange={(e) => setForm((f) => ({ ...f, dateRangeTo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-disabled={isSubmitting}
                  className="w-full px-6 py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Track tab */}
        <div
          role="tabpanel"
          id="tabpanel-track"
          aria-labelledby="tab-track"
          hidden={activeTab !== "track"}
        >
          <form onSubmit={handleTrack} aria-label="Track a records request">
            <div className="mb-4">
              <label
                htmlFor="trackingNumber"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Tracking Number
              </label>
              <div className="flex gap-2">
                <input
                  id="trackingNumber"
                  type="text"
                  placeholder="e.g. GC-2026-047821"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 text-sm font-mono"
                />
                <button
                  type="submit"
                  disabled={isTracking || !trackingNumber}
                  aria-disabled={isTracking || !trackingNumber}
                  className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isTracking ? "Looking up..." : "Look Up"}
                </button>
              </div>
            </div>
          </form>

          {trackError && (
            <div
              role="alert"
              className="mt-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700"
            >
              {trackError}
            </div>
          )}

          {trackResult && (
            <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Request {trackResult.trackingNumber}
              </h2>

              <dl className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <dt className="text-gray-500">Submitted</dt>
                  <dd className="font-medium text-gray-800">
                    {new Date(trackResult.submittedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </dd>
                </div>
                {trackResult.responseDueDate && (
                  <div>
                    <dt className="text-gray-500">Response Due</dt>
                    <dd className="font-medium text-gray-800">
                      {new Date(trackResult.responseDueDate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </dd>
                  </div>
                )}
                {trackResult.fulfilledAt && (
                  <div>
                    <dt className="text-gray-500">Fulfilled</dt>
                    <dd className="font-medium text-gray-800">
                      {new Date(trackResult.fulfilledAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
                <StatusTimeline status={trackResult.status} />
              </div>

              {trackResult.denialReason && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Denial Reason</p>
                  <p className="text-sm text-red-700">{trackResult.denialReason}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const { slug } = context.params as { slug: string };

  if (RESERVED_PORTAL_SLUGS.has(slug)) {
    return { notFound: true };
  }

  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  try {
    const settingsRes = await fetch(`${baseUrl}/api/public/portal/${slug}`);
    if (!settingsRes.ok) return { notFound: true };
    const settingsData: PublicPortalResponse = await settingsRes.json();

    // Require authentication to submit records requests
    const session = await getPortalSessionFromCookieHeader(context.req.headers.cookie).catch(
      () => null
    );
    if (!session) {
      return {
        redirect: {
          destination: `/portal/${slug}/sign-in?redirect=/portal/${slug}/request-records`,
          permanent: false,
        },
      };
    }

    return {
      props: {
        settings: settingsData.settings,
        slug,
      },
    };
  } catch {
    return { notFound: true };
  }
};
