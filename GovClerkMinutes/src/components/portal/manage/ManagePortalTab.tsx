import type { NavLink } from "@/types/portal";
import { PortalConfigurator } from "./PortalConfigurator";
import { PortalPreview } from "./PortalPreview";

interface FormData {
  slug: string;
  pageTitle: string;
  pageDescription: string;
  logoUrl: string;
  headerBgColor: string;
  headerTextColor: string;
  accentColor: string;
  navLinks: NavLink[];
  isEnabled: boolean;
  mainWebsiteUrl: string;
  mainWebsiteName: string;
}

interface ManagePortalTabProps {
  formData: FormData;
  onChange: (updates: Partial<FormData>) => void;
  onLogoUpload?: (file: File) => Promise<void>;
  isUploadingLogo?: boolean;
  defaultLogoUrl?: string;
  settingsId?: number;
  orgId?: string;
}

export function ManagePortalTab({
  formData,
  onChange,
  onLogoUpload,
  isUploadingLogo,
  defaultLogoUrl,
  settingsId,
  orgId,
}: ManagePortalTabProps) {
  return (
    <div className="flex h-full">
      <div className="w-full lg:w-[30%] h-full overflow-y-auto border-r border-gray-200 p-6 bg-white">
        <PortalConfigurator
          formData={formData}
          onChange={onChange}
          onLogoUpload={onLogoUpload}
          isUploadingLogo={isUploadingLogo}
          defaultLogoUrl={defaultLogoUrl}
          settingsId={settingsId}
          orgId={orgId}
        />
      </div>

      <div className="hidden lg:block w-[70%] h-full overflow-hidden bg-gray-100">
        <PortalPreview formData={formData} defaultLogoUrl={defaultLogoUrl} />
      </div>
    </div>
  );
}
