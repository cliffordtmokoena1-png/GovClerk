import { LuX, LuCheck, LuLoader2 } from "react-icons/lu";
import type { AgendaItemFormData } from "./types";

interface AgendaItemFormProps {
  formData: AgendaItemFormData;
  onFormChange: (data: AgendaItemFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  title?: string;
  variant?: "inline" | "nested" | "root";
}

const AgendaItemForm = ({
  formData,
  onFormChange,
  onSave,
  onCancel,
  isSaving,
  title,
  variant = "inline",
}: AgendaItemFormProps) => {
  const isInline = variant === "inline";

  if (isInline) {
    return (
      <div className="space-y-3">
        <input
          type="text"
          value={formData.title}
          onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
          placeholder="Item title"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
        <textarea
          value={formData.description}
          onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
          placeholder="Description (optional)"
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[100px]"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Cancel"
          >
            <LuX className="w-4 h-4" />
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !formData.title.trim()}
            className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
            title="Save"
          >
            {isSaving ? (
              <LuLoader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LuCheck className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium text-gray-700">{title}</h4>}
      <input
        type="text"
        value={formData.title}
        onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
        placeholder="Item title"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        autoFocus
      />
      <textarea
        value={formData.description}
        onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
        placeholder="Description (optional)"
        rows={4}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[100px]"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isSaving || !formData.title.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving && <LuLoader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? "Saving..." : "Add Item"}
        </button>
      </div>
    </div>
  );
};

export default AgendaItemForm;
