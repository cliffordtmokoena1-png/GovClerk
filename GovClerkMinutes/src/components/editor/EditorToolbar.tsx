import React, { memo } from "react";
import { Editor } from "@tiptap/react";
import { FaBold, FaItalic, FaListUl, FaListOl } from "react-icons/fa";
import { LuLoader2, LuCheck } from "react-icons/lu";

type EditorToolbarProps = {
  editor: Editor | null;
  disabled?: boolean;
  showSaveIndicator?: boolean;
  isSaving?: boolean;
  lastSaved?: Date | null;
  className?: string;
};

const ToolbarButton = memo(function ToolbarButton({
  icon: Icon,
  isActive,
  onClick,
  label,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded transition-colors ${
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
});

export function EditorToolbar({
  editor,
  disabled = false,
  showSaveIndicator = false,
  isSaving = false,
  lastSaved,
  className = "",
}: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <ToolbarButton
        icon={FaBold}
        isActive={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
        disabled={disabled}
      />

      <ToolbarButton
        icon={FaItalic}
        isActive={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
        disabled={disabled}
      />

      <ToolbarButton
        icon={FaListUl}
        isActive={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet List"
        disabled={disabled}
      />

      <ToolbarButton
        icon={FaListOl}
        isActive={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Ordered List"
        disabled={disabled}
      />

      {showSaveIndicator && (
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {isSaving ? (
            <>
              <LuLoader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <LuCheck className="w-3 h-3 text-green-500" />
              <span>Saved{lastSaved ? ` ${lastSaved.toLocaleTimeString()}` : ""}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
