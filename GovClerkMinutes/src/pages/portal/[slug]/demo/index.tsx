/**
 * Public Portal — Demo Page (/portal/[slug]/demo)
 *
 * Shown for organisations without an active subscription.
 * Authenticated users see the DemoPortalView (upgrade CTAs + sample data).
 * Unauthenticated users see the sign-in prompt.
 *
 * Auto-redirects to /portal/[slug]/live when a subscription is detected.
 */

import { GetServerSideProps } from "next";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { PublicPortalResponse } from "@/types/portal";
import type { PortalAnnouncement } from "@/types/publicRecords";
import { PublicPortalLayout, DemoPortalView } from "@/components/portal/public";
import { usePortalAuth } from "@/hooks/portal/usePortalAuth";
import { getPortalSessionFromCookieHeader, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";

interface DemoPortalPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
  announcements: PortalAnnouncement[];
  isAuthenticated: boolean;
  portalExists: boolean;
}

function AnnouncementsBanner({
  announcements,
}: Readonly<{ announcements: PortalAnnouncement[] }>) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem("portal_dismissed_announcements");
      const stored = JSON.parse(raw || "[]");
      if (Array.isArray(stored)) {
        setDismissed(new Set(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const handleDismiss = (id: number) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    try {
      localStorage.setItem("portal_dismissed_announcements", JSON.stringify([...next]));
    } catch {
      // ignore
    }
  };

  return (
    <div aria-live="polite" aria-label="Portal announcements">
      {visible.map((a) => {
        const bgClass =
          a.type === "emergency"
            ? "bg-red-50 border-red-400"
            : a.type === "alert"
              ? "bg-yellow-50 border-yellow-400"
              : "bg-blue-50 border-blue-300";
        const textClass =
          a.type === "emergency"
            ? "text-red-900"
            : a.type === "alert"
              ? "text-yellow-900"
              : "text-blue-900";
        return (
          <div
            key={a.id}
            className={`border-b px-4 py-3 ${bgClass}`}
            role="region"
            aria-label={a.title}
          >
            <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
              <div className={`flex-1 text-sm ${textClass}`}>
                <strong>{a.title}</strong>
                {a.body && <span className="ml-2 opacity-80">{a.body}</span>}
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(a.id)}
                aria-label={`Dismiss announcement: ${a.title}`}
                className={`flex-shrink-0 text-lg leading-none ${textClass} hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-current rounded`}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DemoPortalPage({
  settings,
  slug,
  announcements,
  isAuthenticated,
  portalExists,
}: DemoPortalPageProps) {
  const router = useRouter();
  const { portalMode } = usePortalAuth(slug);

  // Auto-redirect to live portal when the org subscribes
  useEffect(() => {
    if (portalMode === "live") {
      router.replace(`/portal/${slug}/live`);
    }
  }, [portalMode, slug, router]);

  return (
    <>
      <AnnouncementsBanner announcements={announcements} />
      <PublicPortalLayout
        settings={settings}
        meetings={[]}
        filter={{ sortBy: "newest" }}
        onFilterChange={() => {}}
      >
        {!isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
              <span className="text-3xl" aria-hidden="true">
                🔒
              </span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Sign in to access this portal
            </h2>
            <p className="text-gray-500 mb-8 max-w-sm">
              Sign in with your organisational email to access meetings, documents, and other portal
              content.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/portal/${slug}/sign-in`}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href={`/portal/${slug}/register`}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        ) : !portalExists ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-3xl" aria-hidden="true">
                🏢
              </span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Organization Not Found</h2>
            <p className="text-gray-500 mb-8 max-w-sm">
              This organization hasn&apos;t been set up on GovClerk yet. Would you like to create
              it?
            </p>
            <Link
              href="/org/signup"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Create Organization
            </Link>
          </div>
        ) : (
          <DemoPortalView slug={slug} accentColor={settings.accentColor} />
        )}
      </PublicPortalLayout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<DemoPortalPageProps> = async (context) => {
  const { slug } = context.params as { slug: string };
  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  // Fetch portal settings
  let settingsData: { settings: PublicPortalResponse["settings"] } = {
    settings: makeDefaultPortalSettings(slug),
  };
  let portalExists = false;

  try {
    const settingsRes = await fetch(`${baseUrl}/api/public/portal/${slug}`);
    if (settingsRes.ok) {
      settingsData = await settingsRes.json();
      portalExists = true;
    } else if (settingsRes.status !== 404) {
      console.error(`Failed to fetch portal settings: ${settingsRes.status}`);
    }
  } catch (error) {
    console.error("Error fetching portal settings:", error);
  }

  // Check if user has a valid portal session
  const session = await getPortalSessionFromCookieHeader(context.req.headers.cookie).catch(
    () => null
  );

  if (!session) {
    return {
      props: {
        settings: settingsData.settings,
        slug,
        announcements: [],
        isAuthenticated: false,
        portalExists,
      },
    };
  }

  // GovClerk admins always bypass subscription checks and go directly to the live portal.
  if (isGovClerkAdmin(session.email)) {
    return {
      redirect: {
        destination: `/portal/${slug}/live`,
        permanent: false,
      },
    };
  }

  // Gate access: if the authenticated user has not verified their email (is_active=0),
  // redirect them to the verification page.
  if (session.portalUserId != null) {
    try {
      const { getPortalDbConnection } = await import("@/utils/portalDb");
      const conn = getPortalDbConnection();
      const userResult = await conn.execute(
        "SELECT is_active FROM gc_portal_users WHERE id = ? AND org_id = ? LIMIT 1",
        [session.portalUserId, session.orgId]
      );
      if (
        userResult.rows.length > 0 &&
        ((userResult.rows[0] as any).is_active === 0 ||
          (userResult.rows[0] as any).is_active === false)
      ) {
        return {
          redirect: {
            destination: `/portal/${slug}/verify`,
            permanent: false,
          },
        };
      }
    } catch {
      // DB error — do not block access
    }
  }

  // Determine portal mode
  let portalMode: "live" | "demo" = "demo";
  if (isGovClerkAdmin(session.email)) {
    portalMode = "live";
  } else {
    try {
      const { getPortalDbConnection } = await import("@/utils/portalDb");
      const conn = getPortalDbConnection();
      const subResult = await conn.execute(
        "SELECT tier, status FROM gc_portal_subscriptions WHERE org_id = ? AND status IN ('active', 'trial') LIMIT 1",
        [session.orgId]
      );
      if (subResult.rows.length > 0) {
        portalMode = "live";
      }
    } catch {
      // DB error — default to demo
    }
  }

  // If the user actually has a live subscription, redirect to the live portal
  if (portalMode === "live") {
    return {
      redirect: {
        destination: `/portal/${slug}/live`,
        permanent: false,
      },
    };
  }

  // Fetch announcements for demo page
  let announcements: PortalAnnouncement[] = [];
  try {
    const announcementsRes = await fetch(`${baseUrl}/api/public/portal/${slug}/announcements`);
    if (announcementsRes.ok) {
      const data = await announcementsRes.json();
      announcements = data.announcements || [];
    }
  } catch {
    // ignore
  }

  return {
    props: {
      settings: settingsData.settings,
      slug,
      announcements,
      isAuthenticated: true,
      portalExists,
    },
  };
};
