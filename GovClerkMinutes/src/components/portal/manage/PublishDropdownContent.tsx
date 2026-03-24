import { LuLoader2, LuInfo } from "react-icons/lu";

interface PublishDropdownContentProps {
  slug: string;
  isEnabled: boolean;
  onVisibilityChange: (isEnabled: boolean) => void;
  onPublish: () => Promise<boolean>;
  hasChanges: boolean;
  isPublishing: boolean;
  onClose?: () => void;
}

export function PublishDropdownContent({
  slug,
  isEnabled,
  onVisibilityChange,
  onPublish,
  hasChanges,
  isPublishing,
  onClose,
}: Readonly<PublishDropdownContentProps>) {
  const portalUrl = slug ? `/portal/${slug}` : null;

  return (
    <div className="p-4 space-y-4">
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
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isEnabled ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Portal URL</label>
        <div className="flex items-center px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
          <span className="text-sm text-gray-600">/portal/{slug || "your-org-slug"}</span>
        </div>
        {portalUrl && (
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline inline-block"
          >
            Preview: {portalUrl}
          </a>
        )}
        <div className="mt-2 flex items-start gap-1.5 p-2 bg-blue-50 border border-blue-200 rounded-md">
          <LuInfo className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Your portal URL uses your organization slug. To change it, update your organization
            settings in Clerk.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          const success = await onPublish();
          if (success && onClose) {
            onClose();
          }
        }}
        disabled={isPublishing || !slug}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
  );
}
