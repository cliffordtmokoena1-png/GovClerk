import { useEffect, useRef } from "react";
import { LuX, LuLoader2, LuInfo, LuArrowRight } from "react-icons/lu";
import type { PortalSettings } from "@/types/portal";

interface PublishBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PortalSettings | null;
  slug: string;
  isEnabled: boolean;
  onVisibilityChange: (isEnabled: boolean) => void;
  onPublish: () => Promise<boolean>;
  hasChanges: boolean;
  isPublishing: boolean;
}

export function PublishBottomSheet({
  isOpen,
  onClose,
  settings,
  slug,
  isEnabled,
  onVisibilityChange,
  onPublish,
  hasChanges,
  isPublishing,
}: PublishBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const portalUrl = slug ? `/portal/${slug}` : null;

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl z-50 transform transition-transform duration-300 ease-out max-h-[80vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-sheet-title"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4 border-b border-gray-200">
          <h2 id="publish-sheet-title" className="text-lg font-semibold text-gray-900">
            Publish Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <LuX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Visibility Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Portal Visibility</p>
              <p className="text-xs text-gray-500">{isEnabled ? "Public" : "Internal"}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              onClick={() => onVisibilityChange(!isEnabled)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isEnabled ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Slug Display (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Portal URL</label>
            <div className="flex items-center px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-600">/portal/{slug || "your-org-slug"}</span>
            </div>
            {portalUrl && (
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Preview portal <LuArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
            <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <LuInfo className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Your portal URL uses your organization slug. To change it, update your organization
                settings in Clerk.
              </p>
            </div>
          </div>

          {/* Publish Button */}
          <button
            type="button"
            onClick={async () => {
              const success = await onPublish();
              if (success) {
                onClose();
              }
            }}
            disabled={isPublishing || !slug}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isPublishing ? (
              <>
                <LuLoader2 className="w-4 h-4 animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <span>{hasChanges ? "Publish Changes" : "Save Settings"}</span>
            )}
          </button>
        </div>

        {/* Safe area padding for mobile */}
        <div className="h-6" />
      </div>
    </>
  );
}
