import { useState, useEffect } from "react";

const SESSION_KEY = "minutesCrossSellDismissed";

export function MinutesCrossSellBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem(SESSION_KEY)) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="flex-shrink-0 bg-gray-100 border-t border-gray-200 py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          ✨ Powered by GovClerk — Generate AI meeting minutes automatically.{" "}
          <a href="/" className="text-blue-600 hover:underline font-medium">
            Learn More →
          </a>
        </p>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
