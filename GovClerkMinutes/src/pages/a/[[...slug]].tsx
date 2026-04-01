import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { HiRectangleGroup } from "react-icons/hi2";
import MgHead from "@/components/MgHead";
import AnnouncementBar from "@/components/AnnouncementBar";
import { OrgDashboardLayout } from "@/components/org-dashboard";
import { ContentSpinner } from "@/components/org-dashboard/content/ContentSpinner";
import { PlaceholderContent } from "@/components/org-dashboard/content/PlaceholderContent";
import { getAuth } from "@clerk/nextjs/server";
import { getCountry } from "../api/get-country";
import { ApiGetCustomerDetailsResponse, getCustomerDetails } from "../api/get-customer-details";
import { isDev } from "@/utils/dev";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { getSiteFromHeaders, isGovClerk } from "@/utils/site";
import whatsapp from "@/admin/whatsapp/api";
import { Template } from "@/admin/whatsapp/api/templates";
import BoardContent from "@/components/org-dashboard/content/BoardContent";

const AccountContent = dynamic(() => import("@/components/org-dashboard/content/AccountContent"), {
  loading: () => <ContentSpinner message="Loading account..." />,
  ssr: false,
});

const OrganizationContent = dynamic(
  () => import("@/components/org-dashboard/content/OrganizationContent"),
  {
    loading: () => <ContentSpinner message="Loading organization..." />,
    ssr: false,
  }
);

const PortalContent = dynamic(() => import("@/components/org-dashboard/content/PortalContent"), {
  loading: () => <ContentSpinner message="Loading portal..." />,
  ssr: false,
});

const MeetingsContent = dynamic(
  () => import("@/components/org-dashboard/content/MeetingsContent"),
  {
    loading: () => <ContentSpinner message="Loading meetings..." />,
    ssr: false,
  }
);

const AdminContent = dynamic(() => import("@/components/org-dashboard/content/AdminContent"), {
  loading: () => <ContentSpinner message="Loading admin..." />,
  ssr: false,
});

const DashboardContent = dynamic(
  () => import("@/components/org-dashboard/content/DashboardContent"),
  {
    loading: () => <ContentSpinner message="Loading dashboard..." />,
    ssr: false,
  }
);

type Props = {
  customerDetails: ApiGetCustomerDetailsResponse | null;
  whatsappMessageTemplates: Template[] | null;
  toolIndex: number;
};

function normalizeSlug(slug: string | string[] | undefined): string[] {
  if (Array.isArray(slug)) {
    return slug;
  }
  if (slug) {
    return [slug];
  }
  return [];
}

async function fetchAdminData(toolQueryParam: string | string[] | undefined) {
  const whatsappTemplatesResponse = await whatsapp.getTemplates({
    status: "APPROVED",
    fetchAll: true,
  });
  const whatsappMessageTemplates = whatsappTemplatesResponse.templates;

  let toolIndex = toolQueryParam ? Number(toolQueryParam) : 0;
  if (Number.isNaN(toolIndex) || toolIndex < 0) {
    toolIndex = 0;
  }

  return { whatsappMessageTemplates, toolIndex };
}

export const getServerSideProps = withGsspErrorHandling(async (context) => {
  // treatPendingAsSignedOut: false ensures users with pending session tasks
  // (e.g. choose-organization) still get a userId so we can redirect them
  // to /org/signup instead of /sign-in (which would cause a redirect loop).
  const { userId, orgId } = getAuth(context.req, { treatPendingAsSignedOut: false });
  if (userId == null) {
    return {
      redirect: {
        destination: "/sign-in",
        permanent: false,
      },
    };
  }

  const site = getSiteFromHeaders(context.req.headers);

  if (!orgId) {
    return {
      redirect: {
        destination: isGovClerk(site) ? "/org/signup" : "/dashboard",
        permanent: false,
      },
    };
  }

  const country = isDev() ? "US" : getCountry((h) => context.req.headers[h] as any);

  const { slug } = context.params || {};
  const slugArray = normalizeSlug(slug);
  const firstSlug = slugArray[0] || "";

  if (firstSlug === "") {
    return {
      redirect: {
        destination: "/a/dashboard",
        permanent: false,
      },
    };
  }

  let customerDetails: ApiGetCustomerDetailsResponse | null = null;
  if (firstSlug === "account" || firstSlug === "dashboard") {
    customerDetails = await getCustomerDetails(userId);
    if (customerDetails.country == null) {
      customerDetails.country = country;
    }
  }

  if (firstSlug === "organization" && !orgId) {
    return {
      redirect: {
        destination: "/a/account",
        permanent: false,
      },
    };
  }

  let whatsappMessageTemplates: Template[] | null = null;
  let toolIndex = 0;

  if (firstSlug === "admin") {
    const adminData = await fetchAdminData(context.query.tool);
    whatsappMessageTemplates = adminData.whatsappMessageTemplates;
    toolIndex = adminData.toolIndex;
  }

  return {
    props: {
      customerDetails,
      whatsappMessageTemplates,
      toolIndex,
    },
  };
});

const OrgDashboardPage = ({ customerDetails, whatsappMessageTemplates, toolIndex }: Props) => {
  const router = useRouter();

  const { slug } = router.query;
  const slugArray = useMemo(() => {
    if (Array.isArray(slug)) {
      return slug;
    }
    if (slug) {
      return [slug];
    }
    return [];
  }, [slug]);

  const currentRoute = slugArray[0] || "";

  const title = useMemo(() => {
    switch (currentRoute) {
      case "account":
        return "Account";
      case "organization":
        return "Organization";
      case "meetings":
        return "Meetings";
      case "portal":
        return "Public Portal";
      case "boards":
        return "Boards";
      case "admin":
        return "Admin";
      default:
        return "Dashboard";
    }
  }, [currentRoute]);

  const renderContent = () => {
    switch (currentRoute) {
      case "account":
        if (!customerDetails) {
          return <ContentSpinner message="Loading account..." />;
        }
        return <AccountContent initialSubscriptionData={customerDetails} />;

      case "organization":
        return <OrganizationContent />;

      case "meetings":
        return <MeetingsContent />;

      case "portal":
        return <PortalContent />;

      case "boards":
        return <BoardContent />;

      case "admin":
        if (!whatsappMessageTemplates) {
          return <ContentSpinner message="Loading admin..." />;
        }
        return (
          <AdminContent
            whatsappMessageTemplates={whatsappMessageTemplates}
            initialToolIndex={toolIndex}
          />
        );

      case "dashboard":
        return <DashboardContent />;

      default:
        return <DashboardContent />;
    }
  };

  const fullWidthRoutes = ["portal"];
  const isFullWidth = fullWidthRoutes.includes(currentRoute);

  return (
    <>
      <MgHead noindex />
      <AnnouncementBar />
      <OrgDashboardLayout title={title} fullWidth={isFullWidth}>
        {renderContent()}
      </OrgDashboardLayout>
    </>
  );
};

export default OrgDashboardPage;
