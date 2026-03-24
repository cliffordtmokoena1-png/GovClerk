import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@clerk/nextjs";
import MgHead from "@/components/MgHead";
import { OrgDashboardLayout } from "@/components/org-dashboard/OrgDashboardLayout";
import {
  OrgAppBarBreadcrumb,
  type BreadcrumbItem,
} from "@/components/org-dashboard/OrgAppBarBreadcrumb";
import { useOrgAppBarTitleWithKey } from "@/components/org-dashboard/context/OrgAppBarContext";
import { ContentSpinner } from "@/components/org-dashboard/content/ContentSpinner";
import { MeetingTabs, type MeetingTab } from "@/components/meetings/MeetingTabs";
import { MeetingDetailsTab } from "@/components/meetings/MeetingDetailsTab";
import { MeetingAgendaTab } from "@/components/meetings/MeetingAgendaTab";
import { MeetingDocumentsTab } from "@/components/portal/manage/MeetingDocumentsTab";
import MeetingMinutesTab from "@/components/meetings/MeetingMinutesTab";
import { StartBroadcastButton } from "@/components/broadcast";
import { useMeeting } from "@/hooks/portal/useMeeting";
import { useOrgContext } from "@/contexts/OrgContext";
import type { PortalMeetingWithArtifacts } from "@/types/portal";
import ProcessingToast from "@/components/portal/ProcessingToast";

/** Sets the app bar title to breadcrumb - must be rendered inside OrgDashboardLayout */
function MeetingBreadcrumbTitle({ items }: { items: BreadcrumbItem[] }) {
  // Create a stable key from breadcrumb items to prevent unnecessary re-renders
  const key = useMemo(() => items.map((i) => `${i.label}:${i.href || ""}`).join("|"), [items]);
  const breadcrumb = useMemo(() => <OrgAppBarBreadcrumb items={items} />, [items]);
  // Use the key-based hook to prevent infinite loops with ReactNode titles
  useOrgAppBarTitleWithKey(breadcrumb, key, true);
  return null;
}

export default function MeetingDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isLoaded } = useAuth();
  const { mode, orgId } = useOrgContext();

  // Extract meetingId and ensure it's stable - only use when router is ready
  const meetingId = router.isReady ? (id as string | undefined) : undefined;

  const { meeting, isLoading, error, mutate } = useMeeting(meetingId);
  const [activeTab, setActiveTab] = useState<MeetingTab>("details");

  // Check if edit mode is requested via query param
  const initialEditMode = router.query.edit === "true";

  // Parse tab from URL hash on mount and route changes
  useEffect(() => {
    if (!router.isReady) {
      return;
    }
    const hash = globalThis.location.hash.slice(1) as MeetingTab;
    if (hash && ["details", "agenda", "documents", "minutes"].includes(hash)) {
      setActiveTab(hash);
    } else {
      setActiveTab("details"); // Reset to default on route change
    }
  }, [router.isReady, meetingId]);

  // Update URL hash when tab changes
  const handleTabChange = (tab: MeetingTab) => {
    setActiveTab(tab);
    globalThis.history.replaceState(null, "", `#${tab}`);
  };

  // Callback to switch tabs programmatically
  const switchToTab = useCallback((tab: MeetingTab) => {
    setActiveTab(tab);
    globalThis.history.replaceState(null, "", `#${tab}`);
  }, []);

  // Loading state - also wait for router to be ready
  if (!isLoaded || !router.isReady || isLoading) {
    return (
      <>
        <MgHead title="Meeting Details" />
        <OrgDashboardLayout title="Meeting Details">
          <ContentSpinner message="Loading meeting details..." />
        </OrgDashboardLayout>
      </>
    );
  }

  // Non-org mode
  if (mode !== "org") {
    return (
      <>
        <MgHead title="Meeting Details" />
        <OrgDashboardLayout title="Meeting Details">
          <div className="flex items-center justify-center h-full p-8 text-center text-gray-600">
            Meeting details are only available for organizations.
          </div>
        </OrgDashboardLayout>
      </>
    );
  }

  // Error or not found
  if (error || !meeting) {
    return (
      <>
        <MgHead title="Meeting Not Found" />
        <OrgDashboardLayout title="Meeting Not Found">
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <p className="text-gray-600 mb-4">
              {error ? "Failed to load meeting" : "Meeting not found"}
            </p>
            <button
              onClick={() => router.push("/a/meetings")}
              className="text-blue-600 hover:underline"
            >
              Back to Meetings
            </button>
          </div>
        </OrgDashboardLayout>
      </>
    );
  }

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Meetings", href: "/a/meetings" },
    { label: meeting.title },
  ];

  // Cast meeting to PortalMeetingWithArtifacts (the API returns artifacts)
  const meetingWithArtifacts = meeting as PortalMeetingWithArtifacts;

  const renderTabContent = () => {
    switch (activeTab) {
      case "details":
        return (
          <MeetingDetailsTab
            meeting={meetingWithArtifacts}
            onUpdate={mutate}
            onSwitchToTab={switchToTab}
            initialEditMode={initialEditMode}
          />
        );
      case "agenda":
        return (
          <MeetingAgendaTab
            meetingId={meetingWithArtifacts.id}
            meetingTitle={meetingWithArtifacts.title}
            meetingDate={meetingWithArtifacts.meetingDate}
            meetingLocation={meetingWithArtifacts.location}
            meetingArtifacts={meetingWithArtifacts.artifacts}
          />
        );
      case "documents":
        return <MeetingDocumentsTab meeting={meetingWithArtifacts} onUpdate={mutate} />;
      case "minutes":
        return <MeetingMinutesTab meeting={meetingWithArtifacts} onUpdate={mutate} />;
      default:
        return null;
    }
  };

  return (
    <>
      <MgHead title={meeting.title} />
      <OrgDashboardLayout fullWidth>
        <div className="flex flex-col h-full">
          <MeetingBreadcrumbTitle items={breadcrumbItems} />

          <MeetingTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            rightContent={
              <StartBroadcastButton
                meetingId={meetingWithArtifacts.id}
                meetingTitle={meetingWithArtifacts.title}
              />
            }
          />

          <div className="flex-1 min-h-0 overflow-auto">{renderTabContent()}</div>
        </div>

        {meetingWithArtifacts?.id && orgId && (
          <ProcessingToast meetingId={meetingWithArtifacts.id} orgId={orgId} />
        )}
      </OrgDashboardLayout>
    </>
  );
}
