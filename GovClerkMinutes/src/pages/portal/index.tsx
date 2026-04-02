import GovClerkHead from "@/components/landing/GovClerk/GovClerkHead";
import GovClerkNavBar from "@/components/landing/GovClerk/sections/GovClerkNavBar";
import GovClerkFooter from "@/components/landing/GovClerk/sections/GovClerkFooter";
import GovClerkAnnouncementBar from "@/components/landing/GovClerk/sections/GovClerkAnnouncementBar";
import PortalHeroSection from "@/components/landing/GovClerk/sections/PortalHeroSection";
import PortalStatsSection from "@/components/landing/GovClerk/sections/PortalStatsSection";
import PortalWhySection from "@/components/landing/GovClerk/sections/PortalWhySection";
import PortalFeaturesSection from "@/components/landing/GovClerk/sections/PortalFeaturesSection";
import PortalHowItWorksSection from "@/components/landing/GovClerk/sections/PortalHowItWorksSection";
import PortalComparisonSection from "@/components/landing/GovClerk/sections/PortalComparisonSection";
import PortalRolesSection from "@/components/landing/GovClerk/sections/PortalRolesSection";
import PortalComplianceSection from "@/components/landing/GovClerk/sections/PortalComplianceSection";
import PortalFaqSection from "@/components/landing/GovClerk/sections/PortalFaqSection";
import PortalCtaSection from "@/components/landing/GovClerk/sections/PortalCtaSection";

export default function PortalLandingPage() {
  return (
    <div className="relative min-h-screen pt-10">
      <GovClerkHead
        title="GovClerk Portal — Public Transparency for Government Organizations"
        description="Give your community a branded, secure public portal where citizens can access meeting records, agendas, live broadcasts, and official documents — all from R2,500/month."
      />
      <GovClerkAnnouncementBar />
      <GovClerkNavBar />

      <div className="flex flex-col">
        <PortalHeroSection />
        <PortalStatsSection />
        <PortalWhySection />
        <PortalFeaturesSection />
        <PortalHowItWorksSection />
        <PortalComparisonSection />
        <PortalRolesSection />
        <PortalComplianceSection />
        <PortalFaqSection />
        <PortalCtaSection />
      </div>

      <GovClerkFooter />
    </div>
  );
}
