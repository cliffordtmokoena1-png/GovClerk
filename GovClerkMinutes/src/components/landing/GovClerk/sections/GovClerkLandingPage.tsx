import GovClerkNavBar from "./GovClerkNavBar";
import GovClerkFooter from "./GovClerkFooter";
import GovClerkAnnouncementBar from "./GovClerkAnnouncementBar";
import GovClerkHeroSection from "./GovClerkHeroSection";
import GovClerkTrustLogosSection from "./GovClerkTrustLogosSection";
import GovClerkStatsSection from "./GovClerkStatsSection";
import GovClerkWhySection from "./GovClerkWhySection";
import GovClerkFeaturesSection from "./GovClerkFeaturesSection";
import GovClerkHowItWorksSection from "./GovClerkHowItWorksSection";
import GovClerkAiSection from "./GovClerkAiSection";
import GovClerkRolesSection from "./GovClerkRolesSection";
import GovClerkIntegrationsSection from "./GovClerkIntegrationsSection";
import GovClerkComplianceSection from "./GovClerkComplianceSection";
import GovClerkTestimonialsSection from "./GovClerkTestimonialsSection";
import GovClerkFaqSection from "./GovClerkFaqSection";
import GovClerkCtaSection from "./GovClerkCtaSection";
import GovClerkHead from "../GovClerkHead";

export default function GovClerkLandingPage() {
  return (
    <div className="relative min-h-screen pt-10">
      <GovClerkHead />
      <GovClerkAnnouncementBar />
      <GovClerkNavBar />

      <div className="flex flex-col">
        <GovClerkHeroSection />
        <GovClerkTrustLogosSection />
        <GovClerkStatsSection />
        <GovClerkWhySection />
        <GovClerkFeaturesSection />
        <GovClerkHowItWorksSection />
        <GovClerkAiSection />
        <GovClerkRolesSection />
        <GovClerkIntegrationsSection />
        <GovClerkComplianceSection />
        <GovClerkTestimonialsSection />
        <GovClerkFaqSection />
        <GovClerkCtaSection />
      </div>

      <GovClerkFooter />
    </div>
  );
}
