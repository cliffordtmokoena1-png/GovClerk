import { useState, useMemo, useCallback } from "react";
import {
  LuX,
  LuDownload,
  LuChevronDown,
  LuLoader2,
  LuPrinter,
  LuFileText,
  LuFile,
} from "react-icons/lu";
import { useToast } from "@chakra-ui/react";
import saveAs from "file-saver";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import { useConvertDocument, type OutputType } from "@/hooks/useConvertDocument";
import {
  getItemPrefix,
  generateTextAgenda,
  generateMarkdownAgenda,
} from "@/utils/agendaFormatting";
import { formatDateLong } from "@/utils/formatters";

interface AgendaPreviewProps {
  readonly meetingTitle: string;
  readonly meetingDate: string;
  readonly tree: MgAgendaItemWithRelations[];
  readonly onClose: () => void;
}

export function AgendaPreview({
  meetingTitle,
  meetingDate,
  tree,
  onClose,
}: Readonly<AgendaPreviewProps>) {
  const toast = useToast();
  const { convert, isLoading: isConverting } = useConvertDocument();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const textContent = useMemo(
    () => generateTextAgenda(meetingTitle, meetingDate, tree, { includeSeparator: true }),
    [meetingTitle, meetingDate, tree]
  );

  const markdownContent = useMemo(
    () => generateMarkdownAgenda(meetingTitle, meetingDate, tree, { includeSeparator: true }),
    [meetingTitle, meetingDate, tree]
  );

  const handleExport = useCallback(
    async (format: "txt" | OutputType) => {
      setShowExportMenu(false);

      try {
        if (format === "txt") {
          const blob = new Blob([textContent], { type: "text/plain" });
          saveAs(blob, `${meetingTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Agenda.txt`);
          toast({
            title: "Exported",
            description: "Agenda exported as TXT",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        } else {
          const blob = await convert({
            input: new Blob([markdownContent], { type: "text/markdown" }),
            outputType: format,
            inputType: "gfm",
          });

          if (blob) {
            const ext = format === "docx" ? "docx" : "pdf";
            saveAs(blob, `${meetingTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Agenda.${ext}`);
            toast({
              title: "Exported",
              description: `Agenda exported as ${format.toUpperCase()}`,
              status: "success",
              duration: 3000,
              isClosable: true,
            });
          }
        }
      } catch (error) {
        console.error("Failed to export agenda:", error);
        toast({
          title: "Export failed",
          description: "Failed to export agenda",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      }
    },
    [textContent, markdownContent, meetingTitle, convert, toast]
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const renderPreviewItem = (
    item: MgAgendaItemWithRelations,
    level: number,
    index: number
  ): React.ReactNode => {
    const prefix = getItemPrefix(level, index);
    const paddingLeft = level * 24;

    return (
      <div key={item.id} className="mb-4" style={{ paddingLeft }}>
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-700 min-w-[40px]">{prefix}</span>
          <div className="flex-1">
            <span className="font-medium text-gray-900">{item.title}</span>
            {item.description && (
              <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{item.description}</p>
            )}
          </div>
        </div>
        {item.children && item.children.length > 0 && (
          <div className="mt-2">
            {item.children.map((child, childIndex) =>
              renderPreviewItem(child, level + 1, childIndex)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:bg-white print:static">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:m-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Agenda Preview</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isConverting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {isConverting ? (
                  <LuLoader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LuDownload className="w-4 h-4" />
                )}
                Export
                <LuChevronDown className="w-3 h-3" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => handleExport("txt")}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <LuFileText className="w-4 h-4" />
                    Export as TXT
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <LuFile className="w-4 h-4" />
                    Export as PDF
                  </button>
                  <button
                    onClick={() => handleExport("docx")}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <LuFile className="w-4 h-4" />
                    Export as Word
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <LuPrinter className="w-4 h-4" />
              Print
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <LuX className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 print:overflow-visible print:p-0">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{meetingTitle}</h1>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">AGENDA</h2>
            <p className="text-gray-600">{formatDateLong(meetingDate)}</p>
            <div className="mt-4 h-px bg-gray-300" />
          </div>

          {tree.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No agenda items</p>
          ) : (
            <div className="space-y-2">
              {tree.map((item, index) => renderPreviewItem(item, 0, index))}
            </div>
          )}
        </div>
      </div>

      {showExportMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setShowExportMenu(false)} />
      )}
    </div>
  );
}
