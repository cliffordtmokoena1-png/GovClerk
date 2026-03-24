import React, { useCallback, useState } from "react";
import { LuPlay, LuPause, LuSquare, LuExternalLink, LuRadio, LuLoader2 } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import type { BroadcastStatus } from "@/types/broadcast";

type Props = {
  status: BroadcastStatus;
  streamKey: string;
  portalSlug: string | null;
  isOwner: boolean;
  onGoLive: () => Promise<void>;
  onPause: () => Promise<void>;
  onEnd: () => Promise<void>;
  isLoading?: boolean;
  isStreamAvailable?: boolean;
};

export function BroadcastQuickActions({
  status,
  streamKey,
  portalSlug,
  isOwner,
  onGoLive,
  onPause,
  onEnd,
  isLoading,
  isStreamAvailable = true,
}: Readonly<Props>) {
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const publicUrl = portalSlug ? `/portal/${portalSlug}/live` : null;

  const handleOpenPublicView = useCallback(() => {
    if (publicUrl) {
      window.open(publicUrl, "_blank");
    }
  }, [publicUrl]);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <LuRadio className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-medium text-foreground text-sm">Quick Actions</h3>
      </div>

      <div className="p-4 space-y-3">
        {isOwner ? (
          <>
            {status === "setup" && (
              <Button
                onClick={onGoLive}
                disabled={isLoading || !isStreamAvailable}
                className="w-full py-3 px-4 bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <LuLoader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LuPlay className="w-5 h-5" />
                )}
                Go Live
              </Button>
            )}

            {status === "live" && (
              <>
                <Button
                  onClick={() => setShowPauseConfirm(true)}
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-orange-500 text-white font-medium hover:bg-orange-600"
                >
                  {isLoading ? (
                    <LuLoader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <LuPause className="w-5 h-5" />
                  )}
                  Pause Broadcast
                </Button>
                <Button
                  onClick={onEnd}
                  disabled={isLoading}
                  variant="destructive"
                  className="w-full py-3 px-4 font-medium"
                >
                  {isLoading ? (
                    <LuLoader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <LuSquare className="w-5 h-5" />
                  )}
                  End Broadcast
                </Button>
              </>
            )}

            {status === "paused" && (
              <>
                <Button
                  onClick={onGoLive}
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-green-600 text-white font-medium hover:bg-green-700"
                >
                  {isLoading ? (
                    <LuLoader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <LuPlay className="w-5 h-5" />
                  )}
                  Resume Broadcast
                </Button>
                <Button
                  onClick={onEnd}
                  disabled={isLoading}
                  variant="destructive"
                  className="w-full py-3 px-4 font-medium"
                >
                  {isLoading ? (
                    <LuLoader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <LuSquare className="w-5 h-5" />
                  )}
                  End Broadcast
                </Button>
              </>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">
              Only the broadcast owner can control the stream
            </p>
          </div>
        )}

        <div className="pt-3 border-t border-border">
          <span className="block text-xs font-medium text-muted-foreground mb-2">
            Public Live View
          </span>
          {publicUrl ? (
            <Button
              onClick={handleOpenPublicView}
              variant="secondary"
              className="w-full py-2 px-3 text-sm"
            >
              <LuExternalLink className="w-4 h-4" />
              Open Public View
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              No public portal configured
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showPauseConfirm}
        onOpenChange={setShowPauseConfirm}
        title="Pause Broadcast?"
        description="This will temporarily pause the broadcast. You can resume it later."
        confirmLabel="Pause"
        confirmVariant="default"
        onConfirm={onPause}
        isLoading={isLoading}
      />
    </div>
  );
}
