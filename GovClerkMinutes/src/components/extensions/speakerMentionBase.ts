import { PluginKey } from "prosemirror-state";
import { Editor } from "@tiptap/core";
import tippy from "tippy.js";
import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import { ReactRenderer } from "@tiptap/react";

export const SpeakerMentionPluginKey = new PluginKey("speakerMention");

export let globalSpeakerData: ApiLabelSpeakerResponseResult1 | undefined = undefined;
let activeRenderers: ReactRenderer[] = [];

export interface RendererProps {
  query: string;
  items: Array<{
    label: string;
    name: string;
  }>;
  [key: string]: any;
}

export interface ComponentWithKeyHandler {
  updateProps: (props: any) => void;
  destroy: () => void;
  element: HTMLElement;
  ref: {
    onKeyDown?: (props: any) => boolean;
  };
}

export const updateAllMentionComponents = (
  newSpeakerData: ApiLabelSpeakerResponseResult1 | undefined
) => {
  globalSpeakerData = newSpeakerData;

  activeRenderers.forEach((renderer) => {
    if (renderer && renderer.updateProps) {
      const props = renderer.props as RendererProps;
      renderer.updateProps({
        ...props,
        items: getFilteredItems(props.query || ""),
      });
    }
  });
};

export const getFilteredItems = (query: string) => {
  if (!globalSpeakerData?.labelsToSpeaker) {
    return [];
  }

  return Object.entries(globalSpeakerData.labelsToSpeaker)
    .filter(
      ([label, speaker]) =>
        speaker.name &&
        (query === "" ||
          label.toLowerCase().includes(query.toLowerCase()) ||
          speaker.name.toLowerCase().includes(query.toLowerCase()))
    )
    .map(([label, speaker]) => ({
      label: speaker.name,
      name: label,
    }));
};

export function setGlobalSpeakerData(data: ApiLabelSpeakerResponseResult1 | undefined) {
  globalSpeakerData = data;
}

export const createSuggestionConfig = (
  speakerData: ApiLabelSpeakerResponseResult1 | undefined,
  SuggestionListComponent: React.ComponentType<any>
) => {
  if (speakerData) {
    globalSpeakerData = speakerData;
  }

  return {
    char: "@",
    allowSpaces: true,
    items: ({ query }: { query: string }) => {
      return getFilteredItems(query);
    },
    render: () => {
      let component: ComponentWithKeyHandler | null = null;
      let popup: any = null;
      let renderer: ReactRenderer | null = null;
      let currentItems: any[] = [];

      return {
        onStart: (props: any) => {
          currentItems = props.items;
          renderer = new ReactRenderer(SuggestionListComponent, {
            props: {
              ...props,
              query: props.query,
            },
            editor: props.editor,
          });

          activeRenderers.push(renderer);

          component = renderer as unknown as ComponentWithKeyHandler;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            theme: "light",
            arrow: false,
            hideOnClick: false,
            offset: [0, 0],
            maxWidth: "none",
            animation: false,
          });
        },
        onUpdate: (props: any) => {
          currentItems = props.items;
          component?.updateProps({
            ...props,
            query: props.query,
          });

          if (!props.clientRect) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },
        onKeyDown: (props: any) => {
          if (props.event.key === "Escape") {
            popup?.[0].hide();
            return true;
          }

          if (props.event.key === "Enter" && currentItems.length > 0) {
            const arrowRightEvent = new KeyboardEvent("keydown", {
              key: "ArrowRight",
              bubbles: true,
            });
            document.dispatchEvent(arrowRightEvent);
            return true;
          }

          return false;
        },
        onExit: () => {
          popup?.[0].destroy();

          if (renderer) {
            const index = activeRenderers.indexOf(renderer);
            if (index !== -1) {
              activeRenderers.splice(index, 1);
            }
          }

          component?.destroy();
        },
      };
    },
    command: ({
      editor,
      range,
      props,
    }: {
      editor: Editor;
      range: { from: number; to: number };
      props: any;
    }) => {
      const dom = editor.view.dom;
      let scrollContainer: HTMLElement | null = null;
      let parent = dom.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          scrollContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }

      const getScrollTop = () => (scrollContainer ? scrollContainer.scrollTop : window.scrollY);
      const setScrollTop = (pos: number) => {
        if (scrollContainer) {
          scrollContainer.scrollTop = pos;
        } else {
          window.scrollTo(window.scrollX, pos);
        }
      };

      const originalScrollTop = getScrollTop();

      const nodeAfter = editor.view.state.selection.$to.nodeAfter;
      const overrideSpace = nodeAfter?.text?.startsWith(" ");

      if (overrideSpace) {
        range.to += 1;
      }

      const nodeAttributes = {
        label: props.name,
        name: props.label,
      };

      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: "speakerMention",
            attrs: nodeAttributes,
          },
          {
            type: "text",
            text: " ",
          },
        ])
        .run();

      setScrollTop(originalScrollTop);
      requestAnimationFrame(() => {
        setScrollTop(originalScrollTop);
      });
    },
    allow: ({ state, range }: { state: any; range: { from: number; to: number } }) => {
      const $from = state.doc.resolve(range.from);
      const type = state.schema.nodes.speakerMention;
      const allow = !!$from.parent.type.contentMatch.matchType(type);

      return allow;
    },
  };
};
