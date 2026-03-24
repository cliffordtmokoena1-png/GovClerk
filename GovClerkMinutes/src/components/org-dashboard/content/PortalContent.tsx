import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { LuGlobe } from "react-icons/lu";
import { useOrgContext } from "@/contexts/OrgContext";
import { usePortalSettings } from "@/hooks/portal";
import { Flex, Spinner, Text } from "@chakra-ui/react";
import { useOrgAppBar, useOrgAppBarTitle, type OrgAppBarAction } from "../context/OrgAppBarContext";
import { ContentSpinner } from "./ContentSpinner";

import type {
  NavLink,
  UpdatePortalSettingsRequest,
  CreatePortalSettingsRequest,
} from "@/types/portal";
import { ManagePortalTab } from "@/components/portal/manage";
import { PublishDropdownContent } from "@/components/portal/manage/PublishDropdownContent";

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

const defaultFormData: FormData = {
  slug: "",
  pageTitle: "",
  pageDescription: "",
  logoUrl: "",
  headerBgColor: "#1a365d",
  headerTextColor: "#ffffff",
  accentColor: "#3182ce",
  navLinks: [],
  isEnabled: false,
  mainWebsiteUrl: "",
  mainWebsiteName: "",
};

export function PortalContent() {
  const { isLoaded } = useAuth();
  const { mode, orgId, orgSlug, orgImageUrl } = useOrgContext();
  const {
    settings,
    isLoading: isLoadingSettings,
    createSettings,
    updateSettings,
  } = usePortalSettings();
  const { registerAction } = useOrgAppBar();

  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const initialFormDataRef = useRef<FormData | null>(null);

  // Set the app bar title
  useOrgAppBarTitle("Public Records Portal", true);

  // Auto-populate slug from organization
  useEffect(() => {
    if (orgSlug && !settings) {
      setFormData((prev) => ({ ...prev, slug: orgSlug }));
    }
  }, [orgSlug, settings]);

  useEffect(() => {
    if (settings) {
      const loadedData: FormData = {
        slug: orgSlug || settings.slug,
        pageTitle: settings.pageTitle || "",
        pageDescription: settings.pageDescription || "",
        logoUrl: settings.logoUrl || "",
        headerBgColor: settings.headerBgColor,
        headerTextColor: settings.headerTextColor,
        accentColor: settings.accentColor,
        navLinks: settings.navLinks || [],
        isEnabled: settings.isEnabled,
        mainWebsiteUrl: "",
        mainWebsiteName: "",
      };
      setFormData(loadedData);
      initialFormDataRef.current = loadedData;
    }
  }, [settings, orgSlug]);

  useEffect(() => {
    if (initialFormDataRef.current) {
      const currentWithoutSlug = { ...formData, slug: "" };
      const initialWithoutSlug = { ...initialFormDataRef.current, slug: "" };
      const hasFormChanges =
        JSON.stringify(currentWithoutSlug) !== JSON.stringify(initialWithoutSlug);
      setHasChanges(hasFormChanges);
    }
  }, [formData]);

  const handleFormChange = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleLogoUpload = useCallback(
    async (file: File) => {
      if (!orgId) {
        return;
      }
      setIsUploadingLogo(true);
      try {
        // TODO: Implement logo upload
      } catch (error) {
        console.error("Logo upload failed:", error);
      } finally {
        setIsUploadingLogo(false);
      }
    },
    [orgId]
  );

  const handlePublish = useCallback(async (): Promise<boolean> => {
    const slug = orgSlug;
    if (!slug) {
      return false;
    }

    setIsPublishing(true);
    try {
      const validNavLinks = formData.navLinks.filter((link) => link.label && link.url);
      const effectiveLogoUrl = formData.logoUrl || orgImageUrl || undefined;

      if (settings) {
        const updateData: UpdatePortalSettingsRequest = {
          pageTitle: formData.pageTitle || undefined,
          pageDescription: formData.pageDescription || undefined,
          logoUrl: effectiveLogoUrl,
          headerBgColor: formData.headerBgColor,
          headerTextColor: formData.headerTextColor,
          accentColor: formData.accentColor,
          navLinks: validNavLinks.length > 0 ? validNavLinks : undefined,
          isEnabled: formData.isEnabled,
        };
        await updateSettings(settings.id, updateData);
      } else {
        const createData: CreatePortalSettingsRequest = {
          slug,
          pageTitle: formData.pageTitle || undefined,
          pageDescription: formData.pageDescription || undefined,
          logoUrl: effectiveLogoUrl,
          headerBgColor: formData.headerBgColor,
          headerTextColor: formData.headerTextColor,
          accentColor: formData.accentColor,
          navLinks: validNavLinks.length > 0 ? validNavLinks : undefined,
          isEnabled: formData.isEnabled,
        };
        await createSettings(createData);
      }
      initialFormDataRef.current = formData;
      setHasChanges(false);
      return true;
    } catch {
      return false;
    } finally {
      setIsPublishing(false);
    }
  }, [formData, settings, orgSlug, orgImageUrl, createSettings, updateSettings]);

  useEffect(() => {
    const action: OrgAppBarAction = {
      id: "portal-publish",
      icon: LuGlobe,
      label: "Publish",
      expanded: true,
      bgColor: "bg-blue-600",
      textColor: "white",
      dropdownComponent: PublishDropdownContent,
      dropdownProps: {
        settings,
        slug: orgSlug || "",
        isEnabled: formData.isEnabled,
        onVisibilityChange: (isEnabled: boolean) => handleFormChange({ isEnabled }),
        onPublish: handlePublish,
        hasChanges,
        isPublishing,
      },
      order: 0,
    };

    return registerAction(action);
  }, [
    registerAction,
    settings,
    orgSlug,
    formData.isEnabled,
    handleFormChange,
    handlePublish,
    hasChanges,
    isPublishing,
  ]);

  if (!isLoaded) {
    return (
      <Flex alignItems="center" justifyContent="center" h="full" w="full">
        <Spinner size="lg" color="blue.500" />
      </Flex>
    );
  }

  if (mode !== "org" || !orgId) {
    return (
      <Flex alignItems="center" justifyContent="center" h="full" w="full" p={8}>
        <Text color="gray.600" textAlign="center">
          Portal management is only available for organizations. Please switch to an organization to
          access this feature.
        </Text>
      </Flex>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {settings?.slug && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <a
            href={`/portal/${settings.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
          >
            /portal/{settings.slug}
          </a>
          {hasChanges && <span className="ml-3 text-sm text-yellow-600">• Unsaved changes</span>}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {isLoadingSettings ? (
          <ContentSpinner message="Loading portal..." />
        ) : (
          <ManagePortalTab
            formData={formData}
            onChange={handleFormChange}
            onLogoUpload={handleLogoUpload}
            isUploadingLogo={isUploadingLogo}
            defaultLogoUrl={orgImageUrl || undefined}
            settingsId={settings?.id}
            orgId={orgId}
          />
        )}
      </div>
    </div>
  );
}

export default PortalContent;
