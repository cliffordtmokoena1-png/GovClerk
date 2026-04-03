/**
 * Public Portal — Trial Page (/portal/[slug]/trial)
 *
 * Shown for authenticated users whose organisation does not have an active
 * subscription.  Provides a read-only preview of the portal with upgrade
 * CTAs.  Paying subscribers and GovClerk admins are redirected to the root
 * portal page.  Unauthenticated visitors are redirected to sign-in.
 */

import { GetServerSideProps } from "next";
import { RESERVED_PORTAL_SLUGS } from "@/pages/api/portal/utils/initializePortalSettings";
import type { PublicPortalResponse } from "@/types/portal";
import type { PortalAnnouncement } from "@/types/publicRecords";
import { PublicPortalLayout, DemoPortalView } from "@/components/portal/public";
import { getPortalSessionFromCookieHeader, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";
import { useState, useEffect } from "react";

interface TrialPortalPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
  announcements: PortalAnnouncement[];
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

export default function TrialPortalPage({
  settings,
  slug,
  announcements,
}: TrialPortalPageProps) {
  return (
    <>
      <AnnouncementsBanner announcements={announcements} />
      <PublicPortalLayout
        settings={settings}
        meetings={[]}
        filter={{ sortBy: "newest" }}
        onFilterChange={() => {}}
      >
        <DemoPortalView slug={slug} accentColor={settings.accentColor} />
      </PublicPortalLayout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<TrialPortalPageProps> = async (context) => {
  const { slug } = context.params as { slug: string };

  if (RESERVED_PORTAL_SLUGS.has(slug)) {
    return { notFound: true };
  }

  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  // Unauthenticated users must sign in first
  const session = await getPortalSessionFromCookieHeader(context.req.headers.cookie).catch(
    () => null
  );

  if (!session) {
    return {
      redirect: {
        destination: `/portal/${slug}/sign-in`,
        permanent: false,
      },
    };
  }

  // Gate access: redirect unverified users to email verification
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

  // GovClerk admins and paying subscribers don't need trial — redirect to full portal
  let isSubscribed = false;
  if (isGovClerkAdmin(session.email)) {
    isSubscribed = true;
  } else {
    try {
      const { getPortalDbConnection } = await import("@/utils/portalDb");
      const conn = getPortalDbConnection();
      const subResult = await conn.execute(
        "SELECT id FROM gc_portal_subscriptions WHERE org_id = ? AND status IN ('active', 'trial') LIMIT 1",
        [session.orgId]
      );
      if (subResult.rows.length > 0) {
        isSubscribed = true;
      }
    } catch {
      // DB error — show trial page as fallback
    }
  }

  if (isSubscribed) {
    return {
      redirect: {
        destination: `/portal/${slug}`,
        permanent: false,
      },
    };
  }

  // Fetch portal settings
  let settingsData: { settings: PublicPortalResponse["settings"] } = {
    settings: makeDefaultPortalSettings(slug),
  };

  try {
    const settingsRes = await fetch(`${baseUrl}/api/public/portal/${slug}`);
    if (settingsRes.ok) {
      settingsData = await settingsRes.json();
    }
  } catch {
    // ignore
  }

  // Fetch announcements
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
    },
  };
};
