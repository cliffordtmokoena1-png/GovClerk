import React, { useState } from "react";
import { openWhatsAppChat } from "@/utils/whatsapp";
import { useOrgContext } from "@/contexts/OrgContext";
import StreamTopUpModal from "./StreamTopUpModal";

type LowHoursAlertProps = {
  isOpen: boolean;
  onClose: () => void;
  remaining: number; // minutes remaining
  orgName: string;
};

export default function LowHoursAlert({ isOpen, onClose, remaining }: LowHoursAlertProps) {
  const { orgName, orgId } = useOrgContext();
  const [showTopUp, setShowTopUp] = useState(false);

  if (!isOpen) {return null;}

  const handleWhatsApp = () => {
    const name = orgName ?? "our org";
    openWhatsAppChat(
      `Hey! I'm from ${name} and I'm running low on streaming hours. I'd like to learn more about GovClerkMinutes for generating meeting minutes from recordings.`,
      "low_hours_alert"
    );
  };

  const remainingHours = Math.floor(remaining / 60);
  const remainingMins = remaining % 60;

  return (
    <>
      {showTopUp && (
        <StreamTopUpModal
          isOpen={showTopUp}
          onClose={() => setShowTopUp(false)}
          planTier={null}
          orgId={orgId ?? ""}
        />
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="relative z-50 bg-card border border-border rounded-2xl shadow-xl max-w-md w-full mx-4 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                ⚠️ Running Low on Streaming Hours
              </h2>
              {remaining > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {remainingHours}h {remainingMins}m remaining this month
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors ml-4 flex-shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            You have less than 30 minutes of streaming left this month. Top up to continue
            streaming, or use{" "}
            <span className="font-semibold text-foreground">GovClerkMinutes</span> to generate
            meeting minutes from uploaded recordings — no streaming required.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowTopUp(true)}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Top Up Hours
            </button>
            <button
              onClick={handleWhatsApp}
              className="w-full py-2.5 px-4 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>💬</span>
              Chat to us to learn more
            </button>
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
