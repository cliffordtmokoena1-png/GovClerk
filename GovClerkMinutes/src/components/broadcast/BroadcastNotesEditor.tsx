import React, { useEffect, useState } from "react";
import { LuStickyNote } from "react-icons/lu";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import styles from "./BroadcastNotesEditor.module.css";

type Props = {
  broadcastId: number;
  initialNotes: string | null;
  onSave: (notes: string) => Promise<void>;
  disabled?: boolean;
  embedded?: boolean;
};

export function BroadcastNotesEditor({
  broadcastId,
  initialNotes,
  onSave,
  disabled,
  embedded,
}: Readonly<Props>) {
  // Use broadcastId to track which broadcast we're editing
  const [currentBroadcastId, setCurrentBroadcastId] = useState(broadcastId);

  useEffect(() => {
    if (broadcastId !== currentBroadcastId) {
      setCurrentBroadcastId(broadcastId);
    }
  }, [broadcastId, currentBroadcastId]);

  if (embedded) {
    return (
      <div className={`h-full flex flex-col overflow-hidden ${styles.notesEditor}`}>
        <div className="flex-1 overflow-y-auto">
          {disabled ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                  <LuStickyNote className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Notes will be available when your stream goes live
                </p>
              </div>
            </div>
          ) : (
            <MarkdownEditor
              content={initialNotes || ""}
              onChange={() => {}} // We only care about onSave for broadcasts
              onSave={onSave}
              disabled={disabled}
              autosaveDebounceMs={1500}
              showToolbar
              className="h-full border-0 rounded-none"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden ${styles.notesEditor}`}
    >
      <div className="p-2 border-b border-border flex items-center gap-2">
        <LuStickyNote className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-foreground text-sm">Notes</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {disabled ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <LuStickyNote className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                Notes will be available when your stream goes live
              </p>
            </div>
          </div>
        ) : (
          <MarkdownEditor
            content={initialNotes || ""}
            onChange={() => {}} // We only care about onSave for broadcasts
            onSave={onSave}
            disabled={disabled}
            autosaveDebounceMs={1500}
            showToolbar
            className="h-full border-0 rounded-none"
          />
        )}
      </div>
    </div>
  );
}
