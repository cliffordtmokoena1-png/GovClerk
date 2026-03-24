import { LuX, LuLoader2, LuFolderOpen, LuTrash2, LuAlertTriangle } from "react-icons/lu";
import type { AgendaTemplate } from "@/types/agenda";

interface LoadTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: AgendaTemplate[];
  onLoad: (templateId: number) => void;
  onDelete: (templateId: number) => void;
  isLoading: boolean;
}

const LoadTemplateModal = ({
  isOpen,
  onClose,
  templates,
  onLoad,
  onDelete,
  isLoading,
}: LoadTemplateModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <LuFolderOpen className="w-5 h-5 text-gray-600" />
            Load Agenda Template
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
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
              This will replace the current agenda. Any existing agenda items will be replaced with
              the template items.
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {templates.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No templates found. Create your first template by saving an agenda.
            </p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                onClick={() => onLoad(template.id)}
                className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    {template.description && (
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Created {new Date(template.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1 ml-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onLoad(template.id)}
                      disabled={isLoading}
                      className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                      title="Load template"
                    >
                      {isLoading ? (
                        <LuLoader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LuFolderOpen className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => onDelete(template.id)}
                      className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      title="Delete template"
                    >
                      <LuTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadTemplateModal;
