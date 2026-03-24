import { Editor } from "@tiptap/core";
import type { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";

export const extractSpeakerNames = (
  speakerData?: ApiLabelSpeakerResponseResult1
): { [label: string]: string } => {
  if (!speakerData?.labelsToSpeaker) {
    return {};
  }

  const speakerNames: { [label: string]: string } = {};
  Object.entries(speakerData.labelsToSpeaker).forEach(([label, speaker]) => {
    speakerNames[label] = speaker.name || "";
  });

  return speakerNames;
};

export const speakerNamesChanged = (
  current: { [label: string]: string },
  previous: { [label: string]: string } | null
): boolean => {
  if (!previous) {
    return true;
  }

  const currentKeys = Object.keys(current);
  const previousKeys = Object.keys(previous);

  if (currentKeys.length !== previousKeys.length) {
    return true;
  }

  return currentKeys.some((label) => current[label] !== previous[label]);
};

export const processInitialContent = (
  content: string,
  speakerData?: ApiLabelSpeakerResponseResult1
): string => {
  if (!content) {
    return "";
  }

  let processedContent = removeMarkdownDelimiters(content);
  processedContent = transformSpeakerLabels(processedContent, speakerData);
  processedContent = cleanTemplateArtifacts(processedContent);

  return processedContent;
};

export const removeMarkdownDelimiters = (content: string): string => {
  const lines = content.split("\n");
  if (lines.length >= 2) {
    const firstLine = lines[0].trim();
    const lastLine = lines[lines.length - 1].trim();
    if (firstLine === "```markdown" || firstLine === "```md" || lastLine === "```") {
      return lines.slice(1, -1).join("\n");
    }
  }
  return content;
};

export const cleanTemplateArtifacts = (content: string): string => {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
    if (/^[A-Z0-9]+$/.test(p1) && p1.length > 3) {
      return p1;
    }
    return match;
  });
};

export const transformSpeakerLabels = (
  content: string,
  speakerData?: ApiLabelSpeakerResponseResult1
): string => {
  if (!content || !speakerData?.labelsToSpeaker) {
    return content;
  }

  let result = content;
  const labels = Object.keys(speakerData.labelsToSpeaker);

  result = result.replace(/`(\{\{[A-Z0-9]+\}\})`/g, "$1");

  labels.forEach((label) => {
    const placeholder = `{{${label}}}`;
    const speaker = speakerData.labelsToSpeaker?.[label];
    if (speaker?.name) {
      const replacement = `<span data-speaker-mention data-label="${label}" data-name="${speaker.name}"></span>`;
      result = result.split(placeholder).join(replacement);
    }
  });

  return result;
};

export const updateMentionNodes = (editor: Editor, speakerNames: { [label: string]: string }) => {
  if (!editor || editor.isDestroyed) {
    return;
  }

  const { state } = editor.view;
  const tr = state.tr;
  let hasChanges = false;

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "speakerMention") {
      return true;
    }

    const currentLabel = node.attrs.label as string | undefined;
    if (!currentLabel) {
      return true;
    }

    const expectedName = speakerNames[currentLabel] ?? currentLabel;
    if (expectedName === node.attrs.name) {
      return true;
    }

    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      name: expectedName,
    });
    hasChanges = true;

    return true;
  });

  if (hasChanges) {
    editor.view.dispatch(tr);
  }
};

export const restoreCursorPosition = (editor: Editor, selection: { from: number; to: number }) => {
  if (!editor || editor.isDestroyed) {
    return;
  }

  try {
    const docSize = editor.state.doc.content.size;
    const validFrom = Math.min(selection.from, docSize);
    const validTo = Math.min(selection.to, docSize);

    editor.commands.setTextSelection({ from: validFrom, to: validTo });
    editor.commands.focus();
  } catch (error) {
    console.error("[MinutesContent] Error restoring cursor position:", error);
  }
};
