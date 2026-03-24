import {
  LuX,
  LuLoader2,
  LuFile,
  LuFileText,
  LuDownload,
  LuShare2,
  LuSave,
  LuPaperclip,
} from "react-icons/lu";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import { getItemPrefix } from "@/utils/agendaFormatting";
import { formatDateLong } from "@/utils/formatters";
import { getMotionDisplayStatus } from "@/constants/motions";
import type { OutputType } from "@/hooks/useConvertDocument";

interface ExportAgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingTitle: string;
  meetingDate: string;
  meetingLocation?: string;
  displayTree: MgAgendaItemWithRelations[];
  isMobile: boolean;
  exportingFormat: "pdf" | "docx" | "txt" | null;
  isExporting: boolean;
  onExportDownload: (format: "txt" | OutputType) => void;
  onExportToDocuments: () => void;
}

const renderPreviewItem = (
  item: MgAgendaItemWithRelations,
  level: number,
  index: number
): React.ReactNode => {
  const prefix = getItemPrefix(level, index);
  const paddingLeft = level * 24;

  return (
    <div key={item.id} className="mb-3" style={{ paddingLeft }}>
      <div className="flex items-start gap-2">
        <span className="font-semibold text-gray-700 min-w-[40px] text-sm">{prefix}</span>
        <div className="flex-1">
          <span className="font-medium text-gray-900 text-sm">{item.title}</span>
          {item.description && (
            <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">{item.description}</p>
          )}
          {item.motions && item.motions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-700">Motions:</p>
              <ul className="mt-1 space-y-1">
                {item.motions.map((motion) => {
                  const { label: status } = getMotionDisplayStatus(motion);
                  return (
                    <li key={motion.id} className="text-xs text-gray-600">
                      <span className="font-medium">{motion.title}</span>
                      <span className="ml-2 text-gray-500 italic">[{status}]</span>
                      {motion.mover && (
                        <span className="ml-2 text-gray-400">Moved by: {motion.mover}</span>
                      )}
                      {motion.seconder && (
                        <span className="ml-1 text-gray-400">| Seconded by: {motion.seconder}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
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

const ExportAgendaModal = ({
  isOpen,
  onClose,
  meetingTitle,
  meetingDate,
  meetingLocation,
  displayTree,
  isMobile,
  exportingFormat,
  isExporting,
  onExportDownload,
  onExportToDocuments,
}: ExportAgendaModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`bg-white rounded-lg shadow-xl mx-4 max-h-[90vh] flex flex-col ${isMobile ? "w-full max-w-md" : "w-full max-w-4xl"}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Export Agenda</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <LuX className="w-5 h-5" />
          </button>
        </div>

        <div className={`flex-1 overflow-auto ${isMobile ? "" : "flex"}`}>
          {!isMobile && (
            <div className="flex-1 border-r border-gray-200 p-6 overflow-auto max-h-[60vh]">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{meetingTitle}</h3>
                <h4 className="text-base font-semibold text-gray-700 mb-2">AGENDA</h4>
                <p className="text-sm text-gray-600">{formatDateLong(meetingDate)}</p>
                {meetingLocation && (
                  <p className="text-sm text-gray-600">Location: {meetingLocation}</p>
                )}
              </div>

              {displayTree.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No agenda items</p>
              ) : (
                <div className="space-y-1">
                  {displayTree.map((item, index) => renderPreviewItem(item, 0, index))}
                </div>
              )}
            </div>
          )}

          <div className={`${isMobile ? "p-6" : "w-80 p-6"} space-y-6`}>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <LuDownload className="w-4 h-4" />
                Download
              </h4>
              <div className="space-y-2">
                <button
                  onClick={() => onExportDownload("pdf")}
                  disabled={exportingFormat !== null || displayTree.length === 0}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {exportingFormat === "pdf" ? (
                    <LuLoader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LuFile className="w-4 h-4 text-red-500" />
                  )}
                  <span className="flex-1 text-left">PDF</span>
                </button>
                <button
                  onClick={() => onExportDownload("txt")}
                  disabled={exportingFormat !== null || displayTree.length === 0}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {exportingFormat === "txt" ? (
                    <LuLoader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LuFileText className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="flex-1 text-left">TXT</span>
                </button>
                <button
                  onClick={() => onExportDownload("docx")}
                  disabled={exportingFormat !== null || displayTree.length === 0}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {exportingFormat === "docx" ? (
                    <LuLoader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LuFile className="w-4 h-4 text-blue-500" />
                  )}
                  <span className="flex-1 text-left">DOCX</span>
                </button>
              </div>
            </div>

            <div className="h-px bg-gray-200" />

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <LuShare2 className="w-4 h-4" />
                Save to Documents
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Save the agenda as a document in this meeting&apos;s files.
              </p>
              <button
                onClick={onExportToDocuments}
                disabled={isExporting || displayTree.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExporting ? (
                  <>
                    <LuLoader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <LuSave className="w-4 h-4" />
                    Save to Documents
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportAgendaModal;
