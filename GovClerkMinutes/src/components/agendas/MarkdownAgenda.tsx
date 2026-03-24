import { useEditor, EditorContent } from "@tiptap/react";
import { EditorContainer } from "../EditorContainer";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { SaveStatus } from "../SaveStatus";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import {
  Box,
  HStack,
  IconButton,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text,
} from "@chakra-ui/react";
import React, { useMemo } from "react";
import {
  FaBold,
  FaItalic,
  FaStrikethrough,
  FaCode,
  FaListUl,
  FaListOl,
  FaQuoteLeft,
  FaHeading,
} from "react-icons/fa";
import { Editor } from "@tiptap/core";

type Props = Readonly<{
  content: string;
  onSave?: (content: string) => void;
  lastSaved: Date | null;
  isSaving: boolean;
}>;

const MenuContent = React.memo(function MenuContent({ editor }: { editor: any }) {
  const headingLevels = useMemo(
    () => [
      { level: 1, fontSize: "2xl", fontWeight: "bold" },
      { level: 2, fontSize: "xl", fontWeight: "bold" },
      { level: 3, fontSize: "lg", fontWeight: "bold" },
      { level: 4, fontSize: "md", fontWeight: "bold" },
      { level: 5, fontSize: "sm", fontWeight: "bold" },
      { level: 6, fontSize: "xs", fontWeight: "bold" },
    ],
    []
  );

  return (
    <>
      <Menu closeOnSelect={false}>
        <Tooltip label="Heading">
          <MenuButton
            as={IconButton}
            aria-label="Heading"
            icon={<FaHeading />}
            size="sm"
            isActive={editor.isActive("heading")}
          />
        </Tooltip>
        <MenuList>
          {headingLevels.map(({ level, fontSize, fontWeight }) => (
            <MenuItem
              key={level}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              closeOnSelect={false}
            >
              <Text fontSize={fontSize} fontWeight={fontWeight}>
                Heading {level}
              </Text>
            </MenuItem>
          ))}
          <MenuItem
            onClick={() => editor.chain().focus().setParagraph().run()}
            closeOnSelect={false}
          >
            <Text>Paragraph</Text>
          </MenuItem>
        </MenuList>
      </Menu>
      <Tooltip label="Bold">
        <IconButton
          aria-label="Bold"
          icon={<FaBold />}
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          size="sm"
        />
      </Tooltip>
      <Tooltip label="Italic">
        <IconButton
          aria-label="Italic"
          icon={<FaItalic />}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          size="sm"
        />
      </Tooltip>
      <Tooltip label="Strikethrough">
        <IconButton
          aria-label="Strikethrough"
          icon={<FaStrikethrough />}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          size="sm"
        />
      </Tooltip>
      <Tooltip label="Bullet List">
        <IconButton
          aria-label="Bullet List"
          icon={<FaListUl />}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          size="sm"
        />
      </Tooltip>
      <Tooltip label="Ordered List">
        <IconButton
          aria-label="Ordered List"
          icon={<FaListOl />}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          size="sm"
        />
      </Tooltip>
      <Tooltip label="Code">
        <IconButton
          aria-label="Code"
          icon={<FaCode />}
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          size="sm"
        />
      </Tooltip>
      <Tooltip label="Blockquote">
        <IconButton
          aria-label="Blockquote"
          icon={<FaQuoteLeft />}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          size="sm"
        />
      </Tooltip>
    </>
  );
});

export const MenuBar = ({
  editor,
  lastSaved,
  isSaving,
}: {
  editor: any;
  lastSaved: Date | null;
  isSaving: boolean;
}) => {
  if (!editor) {
    return null;
  }

  return (
    <Box
      py={2}
      px={4}
      width="100%"
      borderBottom="1px solid"
      borderBottomColor="gray.200"
      position="sticky"
      top={0}
      bgColor="white"
      zIndex={10}
    >
      <HStack spacing={1} justify="space-between">
        <HStack spacing={1}>
          <MenuContent editor={editor} />
        </HStack>
        <SaveStatus lastSaved={lastSaved} isSaving={isSaving} />
      </HStack>
    </Box>
  );
};

export default function MarkdownAgenda({ content, onSave, lastSaved, isSaving }: Props) {
  const debouncedOnSave = useDebouncedSave(onSave);

  const editorConfig = useMemo(
    () => ({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4, 5, 6],
          },
        }),
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
      ],
      content,
      editable: true,
      immediatelyRender: false,
      onUpdate: ({ editor }: { editor: Editor }) => {
        if (!editor.isDestroyed) {
          const markdown = editor.storage.markdown.getMarkdown();
          debouncedOnSave(markdown);
        }
      },
    }),
    [content, debouncedOnSave]
  );

  const editor = useEditor(editorConfig);

  return (
    <Box className="tiptap-editor" width="100%">
      <EditorContainer
        editor={editor}
        onRegenerateClick={() => {}}
        isRegenerating={false}
        isPreview={false}
        isUpdating={false}
        isMobile={false}
        lastSaved={lastSaved}
        isLatest
        isSaving={isSaving}
        canRegenerate={false}
      >
        <Box
          py={4}
          px={8}
          overflowY="auto"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <EditorContent editor={editor} />
        </Box>
      </EditorContainer>
      <style jsx global>{`
        .tiptap-editor .ProseMirror {
          outline: none;
          text-align: justify;
          padding: 0.75rem;
          line-height: 1.6;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu",
            "Cantarell", sans-serif;
          color: #1a202c;
          background-color: transparent;
          min-height: 600px;
        }

        .tiptap-editor h1,
        .tiptap-editor h2,
        .tiptap-editor h3,
        .tiptap-editor h4,
        .tiptap-editor h5,
        .tiptap-editor h6 {
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          line-height: 1.25;
          font-weight: 600;
          color: #2d3748;
        }

        .tiptap-editor h1 {
          font-size: 2rem;
        }
        .tiptap-editor h2 {
          font-size: 1.5rem;
        }
        .tiptap-editor h3 {
          font-size: 1.25rem;
        }
        .tiptap-editor h4 {
          font-size: 1.125rem;
        }
        .tiptap-editor h5 {
          font-size: 1rem;
        }
        .tiptap-editor h6 {
          font-size: 0.875rem;
        }

        .tiptap-editor p {
          margin-bottom: 1em;
          line-height: 1.6;
        }

        .tiptap-editor ul,
        .tiptap-editor ol {
          margin-bottom: 1em;
          padding-left: 1.5em;
        }

        .tiptap-editor li {
          margin-bottom: 0.25em;
          line-height: 1.5;
        }

        .tiptap-editor blockquote {
          border-left: 4px solid #e2e8f0;
          margin: 1em 0;
          padding-left: 1em;
          font-style: italic;
          color: #4a5568;
        }

        .tiptap-editor code {
          background-color: #f7fafc;
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          font-family: "SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", monospace;
          font-size: 0.875em;
        }

        .fa-spin {
          animation: fa-spin 2s infinite linear;
        }

        @keyframes fa-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Box>
  );
}
