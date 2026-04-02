import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import { EditorContainer } from "./EditorContainer";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "tiptap-markdown";
import BubbleMenuExtension from "@tiptap/extension-bubble-menu";
import { SaveStatus } from "./SaveStatus";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import {
  Box,
  Flex,
  HStack,
  VStack,
  IconButton,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text,
  Button,
  Spinner,
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Skeleton,
} from "@chakra-ui/react";
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
import { FaWandMagicSparkles } from "react-icons/fa6";

import { MinutesState } from "@/types/MinutesState";
import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import SpeakerMentionExtension from "./extensions/SpeakerMentionExtension";
import { useRegenerateMinutes } from "@/hooks/useRegenerateMinutes";
import { useBreakpointValue } from "@chakra-ui/react";
import {
  extractSpeakerNames,
  speakerNamesChanged,
  processInitialContent,
  updateMentionNodes,
  restoreCursorPosition,
} from "@/utils/minutesContent";

const BubbleMenuContent = ({ editor }: { editor: any }) => (
  <HStack spacing={1} p={1} className="bubble-menu-content">
    <IconButton
      aria-label="Bold"
      icon={<FaBold />}
      size="sm"
      onClick={() => editor.chain().focus().toggleBold().run()}
      isActive={editor.isActive("bold")}
    />
    <IconButton
      aria-label="Italic"
      icon={<FaItalic />}
      onClick={() => editor.chain().focus().toggleItalic().run()}
      isActive={editor.isActive("italic")}
      size="sm"
    />
    <IconButton
      aria-label="Underline"
      icon={<FaUnderline />}
      onClick={() => editor.chain().focus().toggleUnderline().run()}
      isActive={editor.isActive("underline")}
      size="sm"
    />
    <IconButton
      aria-label="Strikethrough"
      icon={<FaStrikethrough />}
      onClick={() => editor.chain().focus().toggleStrike().run()}
      isActive={editor.isActive("strike")}
      size="sm"
    />
    <IconButton
      aria-label="Code"
      icon={<FaCode />}
      onClick={() => editor.chain().focus().toggleCode().run()}
      isActive={editor.isActive("code")}
      size="sm"
    />
    <IconButton
      aria-label="Bullet List"
      icon={<FaListUl />}
      onClick={() => editor.chain().focus().toggleBulletList().run()}
      isActive={editor.isActive("bulletList")}
      size="sm"
    />
    <IconButton
      aria-label="Ordered List"
      icon={<FaListOl />}
      onClick={() => editor.chain().focus().toggleOrderedList().run()}
      isActive={editor.isActive("orderedList")}
      size="sm"
    />
  </HStack>
);

type Props = {
  minutes?: string;
  onSave?: (content: string) => void;
  transcriptId: number;
  setMinutesManager: React.Dispatch<React.SetStateAction<MinutesState>>;
  isPreview?: boolean;
  isUpdating: boolean;
  version: number;
  isLatest: boolean;
  canRegenerate: boolean;
  lastSaved: Date | null;
  isSaving: boolean;
  paywallIsShowing?: boolean;
  speakerData?: ApiLabelSpeakerResponseResult1;
  onMinutesChange?: (content: string) => void;
  inMobileTabbedView?: boolean;
  // Optional custom regeneration for non-minutes use cases (e.g., agendas)
  customRegenerateFunction?: (feedback: string) => Promise<void>;
  customIsRegenerating?: boolean;
  contentType?: "Minutes" | "Agenda"; // For customizing labels
  onSpeakerUpdate?: (speaker: any, label: string) => void;
};

const MenuContent = React.memo(function MenuContent({
  editor,
  isMobile = false,
}: {
  editor: any;
  isMobile?: boolean;
}) {
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
      <Tooltip label="Underline">
        <IconButton
          aria-label="Underline"
          icon={<FaUnderline />}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
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
      {!isMobile && (
        <>
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
      )}
    </>
  );
});

export const MenuBar = ({
  editor,
  onRegenerateClick,
  isRegenerating,
  isPreview,
  isUpdating,
  isMobile,
  lastSaved,
  isLatest,
  isSaving,
  canRegenerate,
  inMobileTabbedView,
  contentType = "Minutes",
}: {
  editor: any;
  onRegenerateClick: () => void;
  isRegenerating: boolean;
  isPreview: boolean;
  isUpdating: boolean;
  isMobile: boolean;
  isLatest: boolean;
  lastSaved: Date | null;
  isSaving: boolean;
  canRegenerate: boolean;
  inMobileTabbedView?: boolean;
  contentType?: "Minutes" | "Agenda";
}) => {
  if (!editor) {
    return null;
  }

  return (
    <Box
      py={2}
      px={inMobileTabbedView ? 0 : 4}
      width="100%"
      borderBottom="1px solid"
      borderBottomColor="gray.200"
      position="sticky"
      top={0}
      bgColor="white"
      zIndex={10}
    >
      {isMobile ? (
        <HStack spacing={2} justify="space-between" align="center" px={2}>
          <HStack spacing={1} flex={1} overflowX="auto">
            <MenuContent editor={editor} isMobile={isMobile} />
          </HStack>

          {!isPreview && canRegenerate && (
            <Button
              aria-label={`Regenerate ${contentType}`}
              size="sm"
              onClick={onRegenerateClick}
              bgColor="blue.50"
              color="blue.600"
              leftIcon={
                isRegenerating || isUpdating ? <Spinner size="sm" /> : <FaWandMagicSparkles />
              }
              isDisabled={isRegenerating || isUpdating || isSaving}
              flexShrink={0}
            >
              {isRegenerating || isUpdating ? "Regenerating..." : "Regenerate"}
            </Button>
          )}
        </HStack>
      ) : (
        <VStack spacing={1} align="stretch">
          <HStack spacing={1} justify="space-between">
            <HStack spacing={1}>
              <MenuContent editor={editor} />
            </HStack>
            <HStack spacing={4}>
              {!isPreview && canRegenerate && (
                <Tooltip
                  label={
                    isRegenerating
                      ? "Regenerating..."
                      : isSaving
                        ? "Please wait until your changes have saved"
                        : !isLatest
                          ? "Please switch to the latest version"
                          : `Regenerate ${contentType}`
                  }
                >
                  <Button
                    aria-label={`Regenerate ${contentType}`}
                    size="sm"
                    onClick={onRegenerateClick}
                    bgColor="blue.50"
                    color="blue.600"
                    leftIcon={
                      isRegenerating || isUpdating ? <Spinner size="sm" /> : <FaWandMagicSparkles />
                    }
                    isDisabled={!isLatest || isRegenerating || isUpdating || isSaving}
                  >
                    {isRegenerating || isUpdating ? "Regenerating..." : "Regenerate"}
                  </Button>
                </Tooltip>
              )}
              <SaveStatus lastSaved={lastSaved} isSaving={isSaving} />
            </HStack>
          </HStack>
        </VStack>
      )}
    </Box>
  );
};

export default function MarkdownMinutes({
  minutes,
  onSave,
  transcriptId,
  setMinutesManager,
  isUpdating = false,
  isPreview = false,
  version,
  canRegenerate,
  isLatest,
  lastSaved,
  isSaving,
  speakerData,
  onMinutesChange,
  inMobileTabbedView = false,
  customRegenerateFunction,
  customIsRegenerating,
  contentType = "Minutes",
  onSpeakerUpdate,
}: Props) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const initialRenderRef = useRef(true);
  const prevVersionRef = useRef<number | null>(null);
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const userEditingRef = useRef(false);
  const lastContentRef = useRef<string | null>(null);
  const prevSpeakerNamesRef = useRef<{ [label: string]: string } | null>(null);
  const speakerDataAppliedRef = useRef(false);

  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  const { regenerateMinutes: regenerateMinutesDefault, isRegenerating: isRegeneratingDefault } =
    useRegenerateMinutes({
      transcriptId,
      setMinutesManager,
      onSuccess: () => {
        setFeedback("");
      },
    });

  const regenerateMinutes = customRegenerateFunction || regenerateMinutesDefault;
  const isRegenerating =
    customIsRegenerating !== undefined ? customIsRegenerating : isRegeneratingDefault;
  const debouncedOnSave = useDebouncedSave(onSave);
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
              ? (document.querySelector(".bubble-menu") as HTMLElement)
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
      content: processInitialContent(minutes || "", speakerData),
      editable: true,
      immediatelyRender: false,
      onUpdate: ({ editor }: { editor: Editor }) => {
        if (!editor.isDestroyed) {
          lastSelectionRef.current = {
            from: editor.state.selection.from,
            to: editor.state.selection.to,
          };

          userEditingRef.current = true;

          const content = editor.storage.markdown.getMarkdown();
          lastContentRef.current = content;

          onMinutesChange?.(content);
          debouncedOnSave(content);

          setTimeout(() => {
            userEditingRef.current = false;
          }, 300);
        }
      },
    }),
    [speakerData, minutes, onMinutesChange, debouncedOnSave, onSpeakerUpdate]
  );

  const editor = useEditor(editorConfig);

  useEffect(() => {
    if (!editor || minutes === undefined) {
      return;
    }

    const shouldSkipUpdate = userEditingRef.current && !isLatest;
    if (shouldSkipUpdate) {
      return;
    }

    const hasVersionChanged = prevVersionRef.current !== version && prevVersionRef.current !== null;
    const isFirstRender = initialRenderRef.current;
    const needsContentUpdate = isFirstRender || isUpdating || hasVersionChanged;

    const currentSpeakerNames = extractSpeakerNames(speakerData);
    const hasSpeakerNamesChanged = speakerNamesChanged(
      currentSpeakerNames,
      prevSpeakerNamesRef.current
    );

    if (needsContentUpdate) {
      const processedContent = processInitialContent(minutes, speakerData);

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
          editor.commands.setContent(processInitialContent(minutes, speakerData), false, {
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
  }, [editor, minutes, speakerData, isUpdating, version, isLatest]);

  useEffect(() => {
    if (speakerData) {
      SpeakerMentionExtension.updateSpeakerData(speakerData);
    }
  }, [speakerData]);

  const handleRegenerateClick = () => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setShowFeedback(true);
  };

  const handleRegenerate = async () => {
    setShowFeedback(false);
    await regenerateMinutes(feedback);
  };

  const handleUpdate = useCallback(() => {
    if (!editor) {
      return;
    }
    const markdown = editor.storage.markdown.getMarkdown();
    onMinutesChange?.(markdown);
  }, [editor, onMinutesChange]);

  useEffect(() => {
    if (editor) {
      editor.on("update", handleUpdate);
      return () => {
        editor.off("update", handleUpdate);
      };
    }
  }, [editor, handleUpdate]);

  return (
    <>
      <Box className="tiptap-editor" width="100%" ref={containerRef}>
        <EditorContainer
          editor={editor}
          onRegenerateClick={handleRegenerateClick}
          isRegenerating={isRegenerating}
          isPreview={!!isPreview}
          isUpdating={isUpdating}
          isMobile={isMobile}
          lastSaved={lastSaved}
          isLatest={isLatest}
          isSaving={isSaving}
          canRegenerate={canRegenerate}
          inMobileTabbedView={inMobileTabbedView}
          contentType={contentType}
        >
          <Box height="100%" overflowY="auto">
            <Box
              py={4}
              px={8}
              display="flex"
              alignItems="center"
              justifyContent="center"
              minHeight="100%"
            >
              {isUpdating && isLatest ? (
                <VStack align="stretch" spacing={6} width="100%" maxW="800px">
                  <Flex
                    display="flex"
                    alignItems="center"
                    gap={2}
                    borderRadius="md"
                    px={4}
                    py={3}
                    bg="blue.50"
                    borderColor="blue.200"
                    borderWidth="1px"
                  >
                    <Spinner color="blue.500" size="sm" thickness="2px" flexShrink={0} />
                    <Text
                      as="span"
                      fontSize="sm"
                      fontWeight="medium"
                      color="blue.700"
                      lineHeight="normal"
                    >
                      Regenerating your {contentType.toLowerCase()}...
                    </Text>
                  </Flex>

                  {/* Section 1 - Title/Heading */}
                  <VStack align="stretch" spacing={3}>
                    <Skeleton height="32px" width="70%" borderRadius="md" />
                    <Skeleton height="18px" width="95%" borderRadius="md" />
                    <Skeleton height="18px" width="92%" borderRadius="md" />
                    <Skeleton height="18px" width="88%" borderRadius="md" />
                  </VStack>

                  {/* Section 2 */}
                  <VStack align="stretch" spacing={3}>
                    <Skeleton height="28px" width="55%" borderRadius="md" />
                    <Skeleton height="18px" width="90%" borderRadius="md" />
                    <Skeleton height="18px" width="94%" borderRadius="md" />
                    <Skeleton height="18px" width="85%" borderRadius="md" />
                    <Skeleton height="18px" width="91%" borderRadius="md" />
                  </VStack>

                  {/* Section 3 */}
                  <VStack align="stretch" spacing={3}>
                    <Skeleton height="28px" width="60%" borderRadius="md" />
                    <Skeleton height="18px" width="88%" borderRadius="md" />
                    <Skeleton height="18px" width="93%" borderRadius="md" />
                    <Skeleton height="18px" width="89%" borderRadius="md" />
                  </VStack>
                </VStack>
              ) : (
                <EditorContent editor={editor} />
              )}
            </Box>
          </Box>
        </EditorContainer>
        {editor && (
          <BubbleMenu
            className="bubble-menu"
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
        <Modal
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          returnFocusOnClose={false}
        >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Regenerate {contentType}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Textarea
                placeholder={`How can we make this ${contentType.toLowerCase()} better?`}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                resize="vertical"
              />
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={handleRegenerate} isDisabled={!feedback}>
                Regenerate
              </Button>
              <Button variant="ghost" onClick={() => setShowFeedback(false)}>
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
        <style jsx global>{`
          .tiptap-editor .ProseMirror {
            outline: none;
            text-align: justify;
            padding: 0.75rem;
            line-height: 1.6;
            font-family:
              -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu",
              "Cantarell", sans-serif;
            color: #1a202c;
            background-color: transparent;
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

          .tiptap-editor .mention {
            background-color: #ebf8ff;
            border: 1px solid #bee3f8;
            border-radius: 0.25rem;
            padding: 0.125rem 0.375rem;
            font-weight: 500;
            color: #2b6cb0;
            text-decoration: none;
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

          .tippy-box {
            background-color: transparent !important;
            box-shadow: none !important;
          }

          .tippy-box[data-theme~="light"] {
            background-color: white !important;
            color: inherit !important;
            box-shadow:
              0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
            border-radius: 0.375rem !important;
            border: 1px solid #e2e8f0 !important;
          }

          .tippy-box[data-theme~="light"] .tippy-content {
            padding: 0 !important;
          }

          .tippy-arrow {
            display: none !important;
          }

          .bubble-menu {
            background-color: white !important;
            box-shadow:
              0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
            border-radius: 0.375rem !important;
            border: 1px solid #e2e8f0 !important;
            overflow: hidden !important;
          }
        `}</style>
      </Box>
    </>
  );
}
