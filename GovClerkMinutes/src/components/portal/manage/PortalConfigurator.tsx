import { useRef, useState, useEffect, useCallback } from "react";
import { LuPlus, LuTrash2, LuImage, LuUpload, LuLoader2, LuChevronRight } from "react-icons/lu";
import type { NavLink } from "@/types/portal";

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
}

interface PortalConfiguratorProps {
  formData: FormData;
  onChange: (updates: Partial<FormData>) => void;
  onLogoUpload?: (file: File) => Promise<void>;
  isUploadingLogo?: boolean;
  defaultLogoUrl?: string;
  settingsId?: number;
  orgId?: string;
}

const ACCEPTED_IMAGE_TYPES = ".png,.jpg,.jpeg,.gif,.webp,.svg";
const S3_BUCKET = "govclerk-bucket";

/** Get logo display URL - uses presigned URL API for S3 logos */
function getLogoDisplayUrl(logoUrl: string | undefined, settingsId?: number): string | null {
  if (!logoUrl) {
    return null;
  }

  // If logo is from our S3 bucket and we have a settingsId, use the API endpoint
  if (logoUrl.includes(S3_BUCKET) && settingsId) {
    return `/api/portal/settings/logo/${settingsId}`;
  }

  // External URLs or newly uploaded logos (before save) can be used directly
  return logoUrl;
}

export function PortalConfigurator({
  formData,
  onChange,
  defaultLogoUrl,
  settingsId,
  orgId,
}: PortalConfiguratorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Local state for color inputs to enable debouncing
  const [localColors, setLocalColors] = useState({
    headerBgColor: formData.headerBgColor,
    headerTextColor: formData.headerTextColor,
    accentColor: formData.accentColor,
  });

  // Local state for logo URL to enable debouncing
  const [localLogoUrl, setLocalLogoUrl] = useState(formData.logoUrl);
  const [logoLoadError, setLogoLoadError] = useState(false);

  // Sync local state when formData changes externally
  useEffect(() => {
    setLocalColors({
      headerBgColor: formData.headerBgColor,
      headerTextColor: formData.headerTextColor,
      accentColor: formData.accentColor,
    });
  }, [formData.headerBgColor, formData.headerTextColor, formData.accentColor]);

  // Sync local logo URL when formData changes externally
  useEffect(() => {
    setLocalLogoUrl(formData.logoUrl);
    setLogoLoadError(false);
  }, [formData.logoUrl]);

  // Debounced logo URL change effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localLogoUrl !== formData.logoUrl) {
        onChange({ logoUrl: localLogoUrl });
        setLogoLoadError(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localLogoUrl, formData.logoUrl, onChange]);

  // Handle logo load error
  const handleLogoError = useCallback(() => {
    setLogoLoadError(true);
  }, []);

  // Handle logo load success
  const handleLogoLoad = useCallback(() => {
    setLogoLoadError(false);
  }, []);

  // Handle logo click to open file picker
  const handleLogoClick = useCallback(() => {
    if (!settingsId || isUploadingLogo) {
      return;
    }
    fileInputRef.current?.click();
  }, [settingsId, isUploadingLogo]);

  // Handle file selection and upload
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !settingsId) {
        return;
      }

      // Reset input so same file can be selected again
      event.target.value = "";

      // Validate file type
      const validTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      if (!validTypes.includes(file.type)) {
        setUploadError("Invalid file type. Please use PNG, JPG, GIF, WebP, or SVG.");
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("File size exceeds 5MB limit.");
        return;
      }

      setIsUploadingLogo(true);
      setUploadProgress(0);
      setUploadError(null);

      try {
        // Get presigned URL from API
        const presignResponse = await fetch("/api/portal/settings/logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type,
            settingsId,
            orgId,
          }),
        });

        if (!presignResponse.ok) {
          const error = await presignResponse.json();
          throw new Error(error.error || "Failed to get upload URL");
        }

        const { uploadUrl, logoUrl } = await presignResponse.json();

        // Upload file to S3
        setUploadProgress(10);
        const uploadResponse = await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = 10 + (event.loaded / event.total) * 80;
              setUploadProgress(Math.round(progress));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(file);
        });

        setUploadProgress(100);

        // Update local state with new logo URL
        onChange({ logoUrl });
        setLocalLogoUrl(logoUrl);
      } catch (error) {
        console.error("Logo upload error:", error);
        setUploadError(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setIsUploadingLogo(false);
        setUploadProgress(0);
      }
    },
    [settingsId, orgId, onChange]
  );

  // Determine which logo URL to display
  // For preview, use the API endpoint if it's an S3 URL
  const rawLogoUrl = localLogoUrl || formData.logoUrl || defaultLogoUrl;
  const displayLogoUrl = getLogoDisplayUrl(rawLogoUrl, settingsId) || rawLogoUrl;
  const shouldShowLogo = displayLogoUrl && !logoLoadError;

  // Debounced color change effect
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasChanges =
        localColors.headerBgColor !== formData.headerBgColor ||
        localColors.headerTextColor !== formData.headerTextColor ||
        localColors.accentColor !== formData.accentColor;
      if (hasChanges) {
        onChange(localColors);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [
    localColors,
    formData.headerBgColor,
    formData.headerTextColor,
    formData.accentColor,
    onChange,
  ]);

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    onChange({ [field]: value });
  };

  const handleColorChange = (field: keyof typeof localColors, value: string) => {
    setLocalColors((prev) => ({ ...prev, [field]: value }));
  };

  const handleNavLinkChange = (index: number, field: "label" | "url", value: string) => {
    const newNavLinks = [...formData.navLinks];
    newNavLinks[index] = { ...newNavLinks[index], [field]: value };
    onChange({ navLinks: newNavLinks });
  };

  const handleAddNavLink = () => {
    onChange({ navLinks: [...formData.navLinks, { label: "", url: "" }] });
  };

  const handleRemoveNavLink = (index: number) => {
    onChange({ navLinks: formData.navLinks.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Portal Configuration</h2>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload logo"
        />
        <div className="flex items-center gap-4 mb-3">
          <button
            type="button"
            onClick={handleLogoClick}
            disabled={!settingsId || isUploadingLogo}
            className={`relative group ${
              settingsId && !isUploadingLogo
                ? "cursor-pointer hover:opacity-80"
                : "cursor-not-allowed opacity-60"
            } transition-opacity`}
            title={settingsId ? "Click to upload logo" : "Save settings first to upload logo"}
          >
            {shouldShowLogo ? (
              <img
                src={displayLogoUrl}
                alt="Portal logo"
                className="h-16 w-auto max-w-[200px] object-contain rounded-lg border border-gray-200"
                onError={handleLogoError}
                onLoad={handleLogoLoad}
              />
            ) : (
              <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400 transition-colors">
                <LuImage className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
            )}
            {/* Upload overlay */}
            {settingsId && !isUploadingLogo && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <LuUpload className="w-5 h-5 text-white" />
              </div>
            )}
            {/* Upload progress overlay */}
            {isUploadingLogo && (
              <div className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center">
                <LuLoader2 className="w-5 h-5 text-white animate-spin" />
                <span className="text-xs text-white mt-1">{uploadProgress}%</span>
              </div>
            )}
          </button>
          {settingsId && <p className="text-xs text-gray-500">Click logo to upload</p>}
        </div>
        {/* Upload error message */}
        {uploadError && <p className="text-xs text-red-500 mb-2">{uploadError}</p>}
        <div>
          <label htmlFor="logo-url" className="block text-xs text-gray-500 mb-1">
            Logo URL (optional)
          </label>
          <input
            id="logo-url"
            type="url"
            value={localLogoUrl}
            onChange={(e) => setLocalLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              logoLoadError && localLogoUrl ? "border-red-300" : "border-gray-300"
            }`}
          />
          {logoLoadError && localLogoUrl && (
            <p className="text-xs text-red-500 mt-1">Invalid image URL</p>
          )}
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            GovClerkMinutes uses your Organization&apos;s Logo by default.
          </p>
          <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
            Organization <LuChevronRight className="w-3.5 h-3.5" /> General{" "}
            <LuChevronRight className="w-3.5 h-3.5" /> Organization Profile
          </p>
        </div>
      </div>

      {/* Page Title */}
      <div>
        <label htmlFor="page-title" className="block text-sm font-medium text-gray-700 mb-1">
          Page Title
        </label>
        <input
          id="page-title"
          type="text"
          value={formData.pageTitle}
          onChange={(e) => handleInputChange("pageTitle", e.target.value)}
          placeholder="City Council Meeting Minutes"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Page Description */}
      <div>
        <label htmlFor="page-description" className="block text-sm font-medium text-gray-700 mb-1">
          Page Description
        </label>
        <textarea
          id="page-description"
          value={formData.pageDescription}
          onChange={(e) => handleInputChange("pageDescription", e.target.value)}
          placeholder="Public meeting minutes and agendas for our organization"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      {/* Colors */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Header Colors</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="header-bg-color" className="block text-xs text-gray-500 mb-1">
              Background
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localColors.headerBgColor}
                onChange={(e) => handleColorChange("headerBgColor", e.target.value)}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <input
                id="header-bg-color"
                type="text"
                value={localColors.headerBgColor}
                onChange={(e) => handleColorChange("headerBgColor", e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="header-text-color" className="block text-xs text-gray-500 mb-1">
              Text
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localColors.headerTextColor}
                onChange={(e) => handleColorChange("headerTextColor", e.target.value)}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <input
                id="header-text-color"
                type="text"
                value={localColors.headerTextColor}
                onChange={(e) => handleColorChange("headerTextColor", e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="accent-color" className="block text-xs text-gray-500 mb-1">
              Accent
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localColors.accentColor}
                onChange={(e) => handleColorChange("accentColor", e.target.value)}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <input
                id="accent-color"
                type="text"
                value={localColors.accentColor}
                onChange={(e) => handleColorChange("accentColor", e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">Navigation Links</h3>
          <button
            type="button"
            onClick={handleAddNavLink}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <LuPlus className="w-4 h-4" />
            Add Link
          </button>
        </div>
        <div className="space-y-3 overflow-hidden">
          {formData.navLinks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
              No navigation links added yet
            </p>
          ) : (
            formData.navLinks.map((link, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => handleNavLinkChange(index, "label", e.target.value)}
                  placeholder="Label"
                  className="w-full sm:flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => handleNavLinkChange(index, "url", e.target.value)}
                  placeholder="URL"
                  className="w-full sm:flex-[2] min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveNavLink(index)}
                  className="self-start sm:self-auto p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  aria-label="Remove link"
                >
                  <LuTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
