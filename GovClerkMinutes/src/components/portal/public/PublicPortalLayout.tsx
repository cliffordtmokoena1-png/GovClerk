import { useState } from "react";
import Head from "next/head";
import type { PublicPortalResponse, PublicMeetingsListResponse } from "@/types/portal";
import { PublicPortalHeader } from "./PublicPortalHeader";
import { PublicPortalSidebar, type MeetingsFilter } from "./PublicPortalSidebar";

type Meeting = PublicMeetingsListResponse["meetings"][number];

interface PublicPortalLayoutProps {
  settings: PublicPortalResponse["settings"];
  meetings: Meeting[];
  filter: MeetingsFilter;
  onFilterChange: (filter: MeetingsFilter) => void;
  children: React.ReactNode;
}

export function PublicPortalLayout({
  settings,
  meetings,
  filter,
  onFilterChange,
  children,
}: PublicPortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageTitle =
    settings.pageTitle && settings.pageTitle !== "Demo Portal"
      ? settings.pageTitle
      : "Public Records Portal";
  const pageDescription =
    settings.pageDescription ?? "Access public meeting records, agendas, and minutes.";

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        {settings.logoUrl && <meta property="og:image" content={settings.logoUrl} />}
        {settings.logoUrl && <link rel="icon" href={settings.logoUrl} type="image/png" />}
        <link rel="canonical" href={`/portal/${settings.slug}`} />
      </Head>

      <div className="h-dvh bg-gray-50 flex flex-col overflow-hidden">
        <PublicPortalHeader
          settings={settings}
          onMenuToggle={() => setSidebarOpen(true)}
          onFilterToggle={() => setSidebarOpen(true)}
        />

        {/* Description section - only if pageDescription exists */}
        {settings.pageDescription && (
          <div className="bg-gray-50 flex-shrink-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
              <p className="text-gray-700 max-w-3xl text-left">{settings.pageDescription}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex gap-8">
              {/* Sidebar */}
              <PublicPortalSidebar
                meetings={meetings}
                filter={filter}
                onFilterChange={onFilterChange}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                accentColor={settings.accentColor}
              />

              {/* Main Content */}
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex-shrink-0 border-t border-gray-200 bg-white py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              Powered by{" "}
              <a
                href="https://GovClerkMinutes.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700"
              >
                GovClerkMinutes
              </a>{" "}
              · Public Records Portal
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
