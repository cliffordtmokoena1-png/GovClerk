import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuX, LuLoader2, LuSparkles, LuAlertTriangle } from "react-icons/lu";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import { getItemPrefix } from "@/utils/agendaFormatting";

interface GenerateAgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: string;
  setContext: (context: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  isRegenerating: boolean;
  currentTree: MgAgendaItemWithRelations[];
}

const serializeAgendaToText = (items: MgAgendaItemWithRelations[], level = 0): string => {
  return items
    .map((item, idx) => {
      const prefix = getItemPrefix(level, idx);
      const desc = item.description
        ? `\n${"  ".repeat(level + 1)}Description: ${item.description}`
        : "";
      const children = item.children?.length
        ? "\n" + serializeAgendaToText(item.children, level + 1)
        : "";
      return `${"  ".repeat(level)}${prefix} ${item.title}${desc}${children}`;
    })
    .join("\n");
};

const GenerateAgendaModal = ({
  isOpen,
  onClose,
  context,
  setContext,
  onGenerate,
  isGenerating,
  isRegenerating,
  currentTree,
}: GenerateAgendaModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] md:max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <LuSparkles className="w-5 h-5 text-blue-600" />
            {isRegenerating ? "Regenerate Agenda with AI" : "Generate Agenda with AI"}
          </h3>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1 text-gray-400 hover:text-gray-600 rounded disabled:opacity-50"
          >
            <LuX className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <LuAlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Warning</p>
            <p>
              This will override the existing agenda. Any current agenda items will be replaced.
            </p>
          </div>
        </div>

        {isRegenerating && currentTree.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs font-medium text-gray-600 mb-2">
              Current Agenda (will be used as reference):
            </p>
            <pre className="text-xs text-gray-500 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {serializeAgendaToText(currentTree)}
            </pre>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isRegenerating ? "Instructions for regeneration" : "Paste meeting context here"}
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g., Previous meeting notes, topics to discuss, reports to review..."
            rows={6}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isGenerating}
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-500">
            {isRegenerating
              ? "Describe what changes or improvements you'd like to make to the current agenda."
              : "Provide context like previous meeting notes, upcoming topics, or any relevant information."}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating || !context.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <>
                <LuLoader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <LuSparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default GenerateAgendaModal;
