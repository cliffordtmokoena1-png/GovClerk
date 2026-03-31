import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewProps, ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Suggestion } from "@tiptap/suggestion";
import { Editor } from "@tiptap/core";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
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
} from "../../extensions/speakerMentionBase";

type SpeakerMentionProps = {
  node: {
    attrs: {
      label: string;
      name: string;
    };
  };
  updateAttributes: (attrs: Record<string, any>) => void;
  onSpeakerUpdate?: (speaker: Speaker, label: string) => void;
};

const SpeakerMention = ({ node, updateAttributes, onSpeakerUpdate }: SpeakerMentionProps) => {
  const label = node.attrs.label as string;
  const name = node.attrs.name as string;
  const displayName = name;
  const isInitialMountRef = React.useRef(true);
  // Tracks when THIS component triggered a speaker update so the useEffect
  // doesn't re-apply the same change and collide with the ongoing ProseMirror
  // transaction.
  const isUpdatingRef = React.useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [userInputName, setUserInputName] = useState("");
  const badgeRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const labelsToSpeaker = globalSpeakerData?.labelsToSpeaker || {};
  const knownSpeakers = globalSpeakerData?.knownSpeakers || [];

  const sortedSpeakers = useMemo(
    () => Object.entries(labelsToSpeaker).sort((a, b) => a[0].localeCompare(b[0])),
    [labelsToSpeaker]
  );

  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => {
    setIsOpen(false);
    setUserInputName("");
  }, []);

  const handleSpeakerLabeled = (name: string, _selectedLabel: string, options?: any) => {
    if (!onSpeakerUpdate) {
      return;
    }

    // Do NOT mutate globalSpeakerData here. The update will flow through
    // onSpeakerUpdate -> updateAllMentionComponents which updates the global
    // state and re-renders all mention nodes safely via ProseMirror transactions.
    // Direct mutation races with the ongoing transaction and causes a
    // "RangeError: Applying a mismatched transaction" crash.
    isUpdatingRef.current = true;

    const speaker = labelsToSpeaker[label];
    if (speaker) {
      const updatedSpeaker = { ...speaker, name, uses: speaker.uses + 1 };
      onSpeakerUpdate(updatedSpeaker, label);
    }
    onClose();
  };

  useEffect(() => {
    if (isOpen && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setPopoverPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as globalThis.Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        badgeRef.current &&
        !badgeRef.current.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

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

    // Skip if this component itself just triggered the update — the
    // ProseMirror transaction from onSpeakerUpdate is still being applied and
    // calling updateAttributes again would cause a transaction collision crash.
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false;
      return;
    }

    if (displayName && globalSpeakerData?.labelsToSpeaker?.[label]) {
      const updatedName = globalSpeakerData.labelsToSpeaker[label].name;
      if (updatedName && updatedName !== displayName) {
        // Defer until after the current ProseMirror transaction completes.
        setTimeout(() => {
          updateAttributes({ name: updatedName });
        }, 0);
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
      <span
        ref={badgeRef}
        onClick={onSpeakerUpdate ? onOpen : undefined}
        className="inline-block rounded px-2 py-px font-medium select-none transition-colors"
        style={{
          backgroundColor: `${color}22`,
          color: "black",
          cursor: onSpeakerUpdate ? "pointer" : "default",
        }}
        onMouseEnter={(event) => {
          if (onSpeakerUpdate) {
            (event.currentTarget as HTMLSpanElement).style.backgroundColor = `${color}44`;
          }
        }}
        onMouseLeave={(event) => {
          (event.currentTarget as HTMLSpanElement).style.backgroundColor = `${color}22`;
        }}
      >
        {displayName || label}
      </span>
      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={popoverRef}
            className="fixed bg-white shadow-lg rounded-xl border border-gray-200 min-w-[320px] max-w-[400px] z-50 outline-none"
            style={{
              top: popoverPosition.top,
              left: popoverPosition.left,
            }}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
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
          </div>,
          document.body
        )}
    </NodeViewWrapper>
  );
};

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((selectedIndex + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((selectedIndex + items.length - 1) % items.length);
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
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

  const positionStyles: React.CSSProperties = {
    [showAbove ? "bottom" : "top"]: `${showAbove ? 20 : 10}px`,
    [showLeft ? "right" : "left"]: `${showLeft ? -30 : 0}px`,
    [showAbove ? "marginBottom" : "marginTop"]: 0,
    ...(showAbove ? { top: "auto" } : { bottom: "auto" }),
  };

  return (
    <div
      className="absolute bg-white border border-gray-300 rounded-md shadow-md z-[1000] max-h-[200px] min-w-[180px] w-max overflow-auto"
      style={positionStyles}
    >
      <div className="px-4 py-2 text-xs text-gray-600 min-w-max">Transcript Speakers</div>

      {items.length > 0 ? (
        <div className="flex flex-col">
          {items.map((item, index) => (
            <div
              key={index}
              className="px-4 py-2 cursor-pointer min-w-max"
              style={{
                backgroundColor:
                  index === selectedIndex ? `${colorFromString(item.label)}22` : "transparent",
                color: colorFromString(item.label),
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                selectItem(index);
              }}
            >
              @{item.label}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-2 text-gray-500">No results</div>
      )}
    </div>
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
