import React, { useEffect, useRef, useMemo, useState, useCallback, memo } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "tiptap-markdown";
import BubbleMenuExtension from "@tiptap/extension-bubble-menu";
import { cn } from "@/lib/utils";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import SpeakerMentionExtension from "./extensions/SpeakerMentionExtension";
import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import { Speaker } from "@/lib/speakerLabeler";
import { LuLoader2, LuCheck, LuWand2 } from "react-icons/lu";
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaCode,
  FaListUl,
  FaListOl,
  FaQuoteLeft,
  FaHeading,
} from "react-icons/fa";
import {
  extractSpeakerNames,
  speakerNamesChanged,
  processInitialContent,
  updateMentionNodes,
  restoreCursorPosition,
} from "@/utils/minutesContent";

type MinutesEditorProps = {
  content: string;
  onSave?: (content: string) => void;
  onChange?: (content: string) => void;
  speakerData?: ApiLabelSpeakerResponseResult1;
  onSpeakerUpdate?: (speaker: Speaker, label: string) => void;
  disabled?: boolean;
  className?: string;
  version?: number;
  isUpdating?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  canRegenerate?: boolean;
};

const BubbleMenuContent = memo(function BubbleMenuContent({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg shadow-md">
      <button
        type="button"
        className={cn(
          "p-1.5 rounded transition-colors",
          editor.isActive("bold")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        )}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <FaBold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "p-1.5 rounded transition-colors",
          editor.isActive("italic")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        )}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <FaItalic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "p-1.5 rounded transition-colors",
          editor.isActive("underline")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        )}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <FaUnderline className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "p-1.5 rounded transition-colors",
          editor.isActive("strike")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        )}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <FaStrikethrough className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "p-1.5 rounded transition-colors",
          editor.isActive("code")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        )}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Code"
      >
        <FaCode className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "p-1.5 rounded transition-colors",
          editor.isActive("bulletList")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        )}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <FaListUl className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "p-1.5 rounded transition-colors",
          editor.isActive("orderedList")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        )}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered List"
      >
        <FaListOl className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});

const HeadingDropdown = memo(function HeadingDropdown({ editor }: { editor: Editor }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const headingLevels = [
    { level: 1 as const, label: "Heading 1", textClass: "text-xl font-bold" },
    { level: 2 as const, label: "Heading 2", textClass: "text-lg font-bold" },
    { level: 3 as const, label: "Heading 3", textClass: "text-base font-bold" },
    { level: 4 as const, label: "Heading 4", textClass: "text-sm font-bold" },
    { level: 5 as const, label: "Heading 5", textClass: "text-xs font-bold" },
    { level: 6 as const, label: "Heading 6", textClass: "text-xs font-semibold" },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={cn(
          "p-1.5 rounded transition-colors",
          editor.isActive("heading")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
        )}
        onClick={() => setIsOpen(!isOpen)}
        title="Heading"
      >
        <FaHeading className="w-3.5 h-3.5" />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] py-1">
          {headingLevels.map(({ level, label, textClass }) => (
            <button
              key={level}
              type="button"
              className={cn(
                "w-full text-left px-3 py-1.5 hover:bg-gray-100 transition-colors",
                editor.isActive("heading", { level }) && "bg-gray-50"
              )}
              onClick={() => {
                editor.chain().focus().toggleHeading({ level }).run();
              }}
            >
              <span className={textClass}>{label}</span>
            </button>
          ))}
          <div className="border-t border-gray-100 my-1" />
          <button
            type="button"
            className={cn(
              "w-full text-left px-3 py-1.5 hover:bg-gray-100 transition-colors text-sm",
              !editor.isActive("heading") && "bg-gray-50"
            )}
            onClick={() => {
              editor.chain().focus().setParagraph().run();
            }}
          >
            Paragraph
          </button>
        </div>
      )}
    </div>
  );
});

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
      className={cn(
        "p-1.5 rounded transition-colors",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
});

const MinutesEditorToolbar = memo(function MinutesEditorToolbar({
  editor,
  disabled = false,
  isSaving = false,
  lastSaved,
  onRegenerate,
  isRegenerating = false,
  canRegenerate = false,
}: {
  editor: Editor;
  disabled?: boolean;
  isSaving?: boolean;
  lastSaved?: Date | null;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  canRegenerate?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b bg-gray-50/80 sticky top-0 z-10">
      <HeadingDropdown editor={editor} />

      <div className="w-px h-4 bg-gray-300 mx-1" />

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
        icon={FaUnderline}
        isActive={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Underline"
        disabled={disabled}
      />
      <ToolbarButton
        icon={FaStrikethrough}
        isActive={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Strikethrough"
        disabled={disabled}
      />

      <div className="w-px h-4 bg-gray-300 mx-1" />

      <ToolbarButton
        icon={FaCode}
        isActive={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Code"
        disabled={disabled}
      />
      <ToolbarButton
        icon={FaQuoteLeft}
        isActive={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Blockquote"
        disabled={disabled}
      />

      <div className="w-px h-4 bg-gray-300 mx-1" />

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

      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        {isSaving ? (
          <LuLoader2 className="w-3 h-3 animate-spin" title="Saving..." />
        ) : lastSaved ? (
          <LuCheck
            className="w-3 h-3 text-green-500"
            title={`Saved ${lastSaved.toLocaleTimeString()}`}
          />
        ) : null}
        {canRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating || disabled}
            title="Regenerate minutes"
            className={cn(
              "flex items-center gap-1 p-1.5 rounded transition-colors text-xs",
              "text-muted-foreground hover:bg-muted",
              (isRegenerating || disabled) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isRegenerating ? (
              <LuLoader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LuWand2 className="w-3.5 h-3.5" />
            )}
            <span>Regenerate</span>
          </button>
        )}
      </div>
    </div>
  );
});

export default function MinutesEditor({
  content,
  onSave,
  onChange,
  speakerData,
  onSpeakerUpdate,
  disabled = false,
  className,
  version,
  isUpdating = false,
  onRegenerate,
  isRegenerating = false,
  canRegenerate = false,
}: MinutesEditorProps) {
  const initialRenderRef = useRef(true);
  const prevVersionRef = useRef<number | undefined>(undefined);
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const userEditingRef = useRef(false);
  const lastContentRef = useRef<string | null>(null);
  const prevSpeakerNamesRef = useRef<{ [label: string]: string } | null>(null);
  const speakerDataAppliedRef = useRef(false);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const handleSave = useCallback(
    (markdown: string) => {
      if (!onSave) {
        return;
      }
      setIsSaving(true);
      try {
        onSave(markdown);
        setLastSaved(new Date());
      } finally {
        setTimeout(() => setIsSaving(false), 300);
      }
    },
    [onSave]
  );

  const debouncedOnSave = useDebouncedSave(handleSave);

  const editorConfig = useMemo(
    () => ({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4, 5, 6],
          },
        }),
        Underline,
        Markdown.configure({
          html: true,
          tightLists: true,
          tightListClass: "tight",
          bulletListMarker: "-",
          linkify: false,
          breaks: true,
          transformPastedText: false,
          transformCopiedText: false,
        }),
        BubbleMenuExtension.configure({
          element:
            typeof document !== "undefined"
              ? (document.querySelector(".minutes-bubble-menu") as HTMLElement)
              : null,
        }),
        SpeakerMentionExtension.configure({
          HTMLAttributes: {
            class: "mention",
          },
          speakerData: speakerData,
          onSpeakerUpdate: onSpeakerUpdate,
        }),
      ],
      content: processInitialContent(content || "", speakerData),
      editable: !disabled,
      immediatelyRender: false,
      onUpdate: ({ editor }: { editor: Editor }) => {
        if (!editor.isDestroyed) {
          lastSelectionRef.current = {
            from: editor.state.selection.from,
            to: editor.state.selection.to,
          };

          userEditingRef.current = true;

          const markdown = editor.storage.markdown.getMarkdown();
          lastContentRef.current = markdown;

          onChange?.(markdown);
          debouncedOnSave(markdown);

          setTimeout(() => {
            userEditingRef.current = false;
          }, 300);
        }
      },
    }),
    [speakerData, content, onChange, debouncedOnSave, onSpeakerUpdate, disabled]
  );

  const editor = useEditor(editorConfig);

  useEffect(() => {
    if (!editor || content === undefined) {
      return;
    }

    if (userEditingRef.current) {
      return;
    }

    const hasVersionChanged =
      prevVersionRef.current !== version && prevVersionRef.current !== undefined;
    const isFirstRender = initialRenderRef.current;
    const needsContentUpdate = isFirstRender || isUpdating || hasVersionChanged;

    const currentSpeakerNames = extractSpeakerNames(speakerData);
    const hasSpeakerNamesChanged = speakerNamesChanged(
      currentSpeakerNames,
      prevSpeakerNamesRef.current
    );

    if (needsContentUpdate) {
      const processedContent = processInitialContent(content, speakerData);

      const currentSelection = lastSelectionRef.current || {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };

      editor.commands.setContent(processedContent, false, {
        preserveWhitespace: true,
      });

      if (!isFirstRender && !hasVersionChanged) {
        requestAnimationFrame(() => {
          restoreCursorPosition(editor, currentSelection);
        });
      }

      // Reset so speakerData can be re-applied if it arrives after new content
      speakerDataAppliedRef.current = false;
      prevSpeakerNamesRef.current = currentSpeakerNames;
    } else if (hasSpeakerNamesChanged) {
      // Check if this is the FIRST time speakerData arrives
      const hadNoSpeakerDataBefore =
        prevSpeakerNamesRef.current === null ||
        Object.keys(prevSpeakerNamesRef.current).length === 0;

      if (hadNoSpeakerDataBefore && !speakerDataAppliedRef.current) {
        let hasMentionNodes = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === "speakerMention") {
            hasMentionNodes = true;
            return false;
          }
        });

        if (!hasMentionNodes) {
          // Full re-process: convert {{A}} placeholders to mention nodes
          const currentSelection = {
            from: editor.state.selection.from,
            to: editor.state.selection.to,
          };
          editor.commands.setContent(processInitialContent(content, speakerData), false, {
            preserveWhitespace: true,
          });
          requestAnimationFrame(() => {
            restoreCursorPosition(editor, currentSelection);
          });
          speakerDataAppliedRef.current = true;
        } else {
          updateMentionNodes(editor, currentSpeakerNames);
        }
      } else {
        updateMentionNodes(editor, currentSpeakerNames);
      }
      prevSpeakerNamesRef.current = currentSpeakerNames;
    }

    initialRenderRef.current = false;
    prevVersionRef.current = version;
  }, [editor, content, speakerData, isUpdating, version]);

  useEffect(() => {
    if (speakerData) {
      SpeakerMentionExtension.updateSpeakerData(speakerData);
    }
  }, [speakerData]);

  if (!editor) {
    return <div className="min-h-[200px] animate-pulse bg-gray-50 rounded-lg" />;
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden bg-white flex flex-col", className)}>
      <MinutesEditorToolbar
        editor={editor}
        disabled={disabled}
        isSaving={isSaving}
        lastSaved={lastSaved}
        onRegenerate={onRegenerate}
        isRegenerating={isRegenerating}
        canRegenerate={canRegenerate}
      />

      <div className="relative flex-1 min-h-0 overflow-y-auto">
        <EditorContent
          editor={editor}
          className={cn(
            "prose prose-sm max-w-none px-6 py-4",
            disabled && "opacity-50 pointer-events-none"
          )}
        />

        {onSave && (
          <div className="absolute bottom-2 right-3 flex items-center gap-1 text-xs text-muted-foreground">
            {isSaving ? (
              <>
                <LuLoader2 className="w-3 h-3 animate-spin" />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <span className="text-gray-400">Saved at {lastSaved.toLocaleTimeString()}</span>
            ) : null}
          </div>
        )}
      </div>

      {editor && (
        <BubbleMenu
          className="minutes-bubble-menu"
          editor={editor}
          tippyOptions={{
            duration: 100,
            theme: "light",
            arrow: false,
            hideOnClick: false,
            offset: [0, 0],
            zIndex: 30,
          }}
        >
          <BubbleMenuContent editor={editor} />
        </BubbleMenu>
      )}

      <style jsx global>{`
        .prose .ProseMirror {
          outline: none;
          min-height: 200px;
        }

        .prose .ProseMirror p {
          margin-bottom: 0.75em;
          line-height: 1.6;
        }

        .prose .ProseMirror h1,
        .prose .ProseMirror h2,
        .prose .ProseMirror h3,
        .prose .ProseMirror h4,
        .prose .ProseMirror h5,
        .prose .ProseMirror h6 {
          margin-top: 1.25em;
          margin-bottom: 0.5em;
          line-height: 1.25;
          font-weight: 600;
        }

        .prose .ProseMirror h1 {
          font-size: 1.875rem;
        }
        .prose .ProseMirror h2 {
          font-size: 1.5rem;
        }
        .prose .ProseMirror h3 {
          font-size: 1.25rem;
        }
        .prose .ProseMirror h4 {
          font-size: 1.125rem;
        }
        .prose .ProseMirror h5 {
          font-size: 1rem;
        }
        .prose .ProseMirror h6 {
          font-size: 0.875rem;
        }

        .prose .ProseMirror ul,
        .prose .ProseMirror ol {
          margin-bottom: 0.75em;
          padding-left: 1.5em;
        }

        .prose .ProseMirror ul {
          list-style-type: disc;
        }

        .prose .ProseMirror ol {
          list-style-type: decimal;
        }

        .prose .ProseMirror li {
          margin-bottom: 0.25em;
          line-height: 1.5;
        }

        .prose .ProseMirror blockquote {
          border-left: 3px solid #d1d5db;
          margin: 0.75em 0;
          padding-left: 1em;
          font-style: italic;
          color: #6b7280;
        }

        .prose .ProseMirror code {
          background-color: #f3f4f6;
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.875em;
        }

        .prose .ProseMirror .mention {
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 0.25rem;
          padding: 0.125rem 0.375rem;
          font-weight: 500;
          color: #2563eb;
          text-decoration: none;
        }

        .minutes-bubble-menu {
          background-color: transparent !important;
        }

        .tippy-box[data-theme~="light"] {
          background-color: transparent !important;
          box-shadow: none !important;
          border: none !important;
        }

        .tippy-box[data-theme~="light"] .tippy-content {
          padding: 0 !important;
        }

        .tippy-arrow {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
