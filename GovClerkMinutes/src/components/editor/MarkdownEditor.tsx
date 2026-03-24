import React, { useCallback, useEffect, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { cn } from "@/lib/utils";

type MarkdownEditorProps = {
  content: string;
  onChange: (content: string) => void;
  onSave?: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showToolbar?: boolean;
  autosaveDebounceMs?: number;
};

export function MarkdownEditor({
  content,
  onChange,
  onSave,
  disabled = false,
  placeholder = "Start writing...",
  className,
  showToolbar = false,
  autosaveDebounceMs = 1000,
}: MarkdownEditorProps): React.JSX.Element {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Markdown,
    ],
    content: content,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[120px] px-3 py-2",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      onChange(markdown);

      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      if (onSave && markdown !== lastContentRef.current) {
        autosaveTimeoutRef.current = setTimeout(() => {
          handleAutosave(markdown);
        }, autosaveDebounceMs);
      }
    },
  });

  const handleAutosave = useCallback(
    async (markdown: string) => {
      if (!onSave || markdown === lastContentRef.current) {
        return;
      }

      try {
        setIsSaving(true);
        await onSave(markdown);
        setLastSaved(new Date());
        lastContentRef.current = markdown;
      } catch (error) {
        console.error("Autosave failed:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [onSave]
  );

  useEffect(() => {
    if (editor && content !== editor.storage.markdown.getMarkdown()) {
      editor.commands.setContent(content);
      lastContentRef.current = content;
    }
  }, [content, editor]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) {
    return <div className="min-h-[120px] px-3 py-2 animate-pulse bg-gray-50" />;
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {showToolbar && (
        <div className="border-b bg-gray-50 px-3 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
            className={cn(
              "p-1 rounded hover:bg-gray-200 transition-colors",
              editor.isActive("bold") && "bg-gray-300"
            )}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
            className={cn(
              "p-1 rounded hover:bg-gray-200 transition-colors",
              editor.isActive("italic") && "bg-gray-300"
            )}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
            className={cn(
              "p-1 rounded hover:bg-gray-200 transition-colors",
              editor.isActive("bulletList") && "bg-gray-300"
            )}
          >
            •
          </button>
        </div>
      )}

      <div className="relative">
        <EditorContent
          editor={editor}
          className={cn(
            "focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50",
            disabled && "opacity-50"
          )}
        />

        {/* Autosave status indicator */}
        {onSave && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-gray-500">
            {isSaving ? (
              <>
                <div className="animate-spin h-3 w-3 border border-gray-300 rounded-full border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <span>Saved at {lastSaved.toLocaleTimeString()}</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
