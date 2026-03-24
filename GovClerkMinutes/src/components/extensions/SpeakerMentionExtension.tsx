import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewProps, ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Suggestion } from "@tiptap/suggestion";
import { Editor } from "@tiptap/core";
import {
  Box,
  Text,
  VStack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Portal,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import "tippy.js/dist/tippy.css";
import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import { colorFromString } from "@/utils/color";
import { ReactRenderer } from "@tiptap/react";
import { SpeakerLabelerContent } from "@/components/meetings/SpeakerLabeler";
import { Speaker } from "@/lib/speakerLabeler";
import {
  SpeakerMentionPluginKey,
  globalSpeakerData,
  getFilteredItems,
  updateAllMentionComponents,
  createSuggestionConfig,
} from "./speakerMentionBase";

interface SpeakerMentionProps {
  node: {
    attrs: {
      label: string;
      name: string;
    };
  };
  updateAttributes: (attrs: Record<string, any>) => void;
  onSpeakerUpdate?: (speaker: Speaker, label: string) => void;
}

const SpeakerMention = ({ node, updateAttributes, onSpeakerUpdate }: SpeakerMentionProps) => {
  const label = node.attrs.label as string;
  const name = node.attrs.name as string;
  const displayName = name;
  const isInitialMountRef = React.useRef(true);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [userInputName, setUserInputName] = useState("");

  const labelsToSpeaker = globalSpeakerData?.labelsToSpeaker || {};
  const knownSpeakers = globalSpeakerData?.knownSpeakers || [];

  const sortedSpeakers = useMemo(
    () => Object.entries(labelsToSpeaker).sort((a, b) => a[0].localeCompare(b[0])),
    [labelsToSpeaker]
  );

  const handleSpeakerLabeled = (name: string, _selectedLabel: string, options?: any) => {
    if (!onSpeakerUpdate) {
      return;
    }

    // Optimistically update the global speaker data cache
    if (globalSpeakerData?.labelsToSpeaker?.[label]) {
      globalSpeakerData.labelsToSpeaker[label].name = name;
    }

    const speaker = labelsToSpeaker[label];
    if (speaker) {
      const updatedSpeaker = { ...speaker, name, uses: speaker.uses + 1 };
      onSpeakerUpdate(updatedSpeaker, label);
    }
    onClose();
    setUserInputName("");
  };

  useEffect(() => {
    // Prevents scroll jumps when a mention is first inserted
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (globalSpeakerData?.labelsToSpeaker && label) {
        const speaker = globalSpeakerData.labelsToSpeaker[label];
        if (speaker?.name && speaker.name !== displayName) {
          updateAttributes({ name: speaker.name });
        }
      }
      return;
    }

    if (displayName && globalSpeakerData?.labelsToSpeaker?.[label]) {
      const updatedName = globalSpeakerData.labelsToSpeaker[label].name;
      if (updatedName && updatedName !== displayName) {
        updateAttributes({ name: updatedName });
      }
    }
  }, [label, displayName, updateAttributes]);

  const color = colorFromString(displayName || label);

  return (
    <NodeViewWrapper
      as="span"
      className="speaker-mention"
      data-label={label}
      data-name={displayName}
      style={{
        display: "inline-block",
        borderRadius: "5px",
        userSelect: "none",
        outline: "none",
      }}
    >
      <Popover
        isOpen={isOpen}
        onClose={() => {
          onClose();
          setUserInputName("");
        }}
        closeOnBlur
        returnFocusOnClose={false}
        placement="bottom-start"
      >
        <PopoverTrigger>
          <Box
            as="span"
            onClick={onOpen}
            display="inline-block"
            padding="1px 8px"
            bg={`${color}22`}
            color="black"
            borderRadius="5px"
            fontWeight={500}
            userSelect="none"
            cursor={onSpeakerUpdate ? "pointer" : "default"}
            outline="none"
            boxShadow="none"
            border="none"
            transition="background-color 0.2s ease"
            _hover={
              onSpeakerUpdate
                ? {
                    bg: `${color}44`,
                  }
                : undefined
            }
          >
            {displayName || label}
          </Box>
        </PopoverTrigger>
        <Portal>
          <PopoverContent
            shadow="lg"
            borderRadius="xl"
            border="1px solid"
            borderColor="gray.200"
            minW="320px"
            maxW="400px"
            _focus={{ outline: "none" }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <PopoverBody p={0}>
              <SpeakerLabelerContent
                labelsToSpeaker={labelsToSpeaker}
                knownSpeakers={knownSpeakers}
                selectedLabel={label}
                sortedSpeakers={sortedSpeakers}
                onSpeakerLabeled={handleSpeakerLabeled}
                menuOnClose={onClose}
                userInputName={userInputName}
                setUserInputName={setUserInputName}
                isDesktop
                hideCurrentlyEditing
              />
            </PopoverBody>
          </PopoverContent>
        </Portal>
      </Popover>
    </NodeViewWrapper>
  );
};

interface ComponentWithKeyHandler {
  updateProps: (props: any) => void;
  destroy: () => void;
  element: HTMLElement;
  ref: {
    onKeyDown?: (props: any) => boolean;
  };
}

const MentionSuggestionList = ({
  items,
  command,
  editor,
  clientRect,
  query,
}: {
  items: Array<{
    label: string;
    name: string;
  }>;
  command: (item: any) => void;
  editor: Editor;
  clientRect: () => DOMRect | null;
  query: string;
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    [command, items]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((selectedIndex + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((selectedIndex + items.length - 1) % items.length);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        selectItem(selectedIndex);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIndex, selectItem]);

  const rect = clientRect();
  if (!rect) {
    return null;
  }

  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  const spaceBelow = viewportHeight - rect.bottom;
  const spaceRight = viewportWidth - rect.right;
  const showAbove = spaceBelow < 200;
  const showLeft = spaceRight < 200;

  const positionStyles = {
    [showAbove ? "bottom" : "top"]: `${showAbove ? 20 : 10}px`,
    [showLeft ? "right" : "left"]: `${showLeft ? -30 : 0}px`,
    [showAbove ? "marginBottom" : "marginTop"]: 0,
    ...(showAbove ? { top: "auto" } : { bottom: "auto" }),
  };

  return (
    <Box
      position="absolute"
      bg="white"
      border="1px solid #ccc"
      borderRadius="md"
      boxShadow="0 2px 4px rgba(0, 0, 0, 0.1)"
      zIndex={1000}
      maxH="200px"
      minW="180px"
      w="max-content"
      overflow="auto"
      sx={positionStyles}
    >
      <Box px={4} py={2} fontSize="xs" color="gray.600" minW="max-content">
        Transcript Speakers
      </Box>

      {items.length > 0 ? (
        <VStack align="stretch" spacing={0}>
          {items.map((item, index) => (
            <Box
              key={index}
              px={4}
              py={2}
              cursor="pointer"
              bg={index === selectedIndex ? `${colorFromString(item.label)}22` : "transparent"}
              color={colorFromString(item.label)}
              minW="max-content"
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(index);
              }}
            >
              @{item.label}
            </Box>
          ))}
        </VStack>
      ) : (
        <Box px={4} py={2} color="gray.500">
          No results
        </Box>
      )}
    </Box>
  );
};

const SpeakerMentionExtension = Node.create({
  name: "speakerMention",
  group: "inline",
  inline: true,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      label: {
        default: null,
        parseHTML: (element) => {
          const label = element.getAttribute("data-label");

          return label;
        },
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {};
          }
          return {
            "data-label": attributes.label,
          };
        },
      },
      name: {
        default: null,
        parseHTML: (element) => {
          const name = element.getAttribute("data-name");

          return name;
        },
        renderHTML: (attributes) => {
          if (!attributes.name) {
            return {};
          }
          return {
            "data-name": attributes.name,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-speaker-mention]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          return {
            label: element.getAttribute("data-label"),
            name: element.getAttribute("data-name"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({ "data-speaker-mention": "", class: "mention" }, HTMLAttributes),
    ];
  },

  addNodeView() {
    const SpeakerMentionWrapper = (props: NodeViewProps) => {
      const adaptedProps: SpeakerMentionProps = {
        node: {
          attrs: {
            label: props.node.attrs.label as string,
            name: props.node.attrs.name as string,
          },
        },
        updateAttributes: props.updateAttributes,
        onSpeakerUpdate: this.options.onSpeakerUpdate,
      };

      return SpeakerMention(adaptedProps);
    };

    return ReactNodeViewRenderer(SpeakerMentionWrapper);
  },

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: "@",
        pluginKey: SpeakerMentionPluginKey,
        command: undefined,
        allow: undefined,
      },
      speakerData: null,
      onSpeakerUpdate: null,
    };
  },

  addProseMirrorPlugins() {
    const speakerData = this.options.speakerData;
    return [
      Suggestion({
        editor: this.editor,
        ...createSuggestionConfig(speakerData, MentionSuggestionList),
      }),
    ];
  },

  extendMarkRange(name: string) {
    return this;
  },
});

// Extend the Node type to add the updateSpeakerData method
declare module "@tiptap/core" {
  interface NodeConfig {
    updateSpeakerData?: (newSpeakerData: ApiLabelSpeakerResponseResult1 | undefined) => void;
  }

  interface Node {
    updateSpeakerData?: (newSpeakerData: ApiLabelSpeakerResponseResult1 | undefined) => void;
  }
}

SpeakerMentionExtension.updateSpeakerData = (
  newSpeakerData: ApiLabelSpeakerResponseResult1 | undefined
) => {
  updateAllMentionComponents(newSpeakerData);
};

type SpeakerMentionExtensionType = typeof SpeakerMentionExtension & {
  updateSpeakerData: (newSpeakerData: ApiLabelSpeakerResponseResult1 | undefined) => void;
};

export default SpeakerMentionExtension as SpeakerMentionExtensionType;
