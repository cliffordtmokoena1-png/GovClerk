import { useState } from "react";
import { LuX, LuSave, LuLoader2 } from "react-icons/lu";
import type { MgMotion } from "@/types/agenda";
import type { BoardMember } from "@/board/types";

interface MotionFormProps {
  readonly motion?: MgMotion | null;
  readonly boardMembers?: BoardMember[];
  readonly onSave: (data: {
    title: string;
    description?: string;
    mover?: string;
    seconder?: string;
    is_withdrawn?: boolean;
    is_tabled?: boolean;
  }) => void;
  readonly onCancel: () => void;
  readonly isSaving?: boolean;
  readonly isEditing?: boolean;
}

export function MotionForm({
  motion,
  boardMembers = [],
  onSave,
  onCancel,
  isSaving = false,
  isEditing = false,
}: Readonly<MotionFormProps>) {
  const [formData, setFormData] = useState({
    title: motion?.title || "",
    description: motion?.description || "",
    mover: motion?.mover || "",
    seconder: motion?.seconder || "",
    is_withdrawn: motion?.is_withdrawn || false,
    is_tabled: motion?.is_tabled || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      return;
    }

    const data = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      mover: formData.mover.trim() || undefined,
      seconder: formData.seconder.trim() || undefined,
      is_withdrawn: formData.is_withdrawn,
      is_tabled: formData.is_tabled,
    };

    onSave(data);
  };

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field: "is_withdrawn" | "is_tabled", checked: boolean) => {
    if (field === "is_withdrawn" && checked) {
      setFormData((prev) => ({ ...prev, is_withdrawn: true, is_tabled: false }));
    } else if (field === "is_tabled" && checked) {
      setFormData((prev) => ({ ...prev, is_tabled: true, is_withdrawn: false }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: checked }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Motion" : "Add New Motion"}
          </h3>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="p-2 text-gray-400 hover:text-gray-600 rounded disabled:opacity-50"
          >
            <LuX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motion Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter motion title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSaving}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter motion description (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mover</label>
            {boardMembers.length > 0 ? (
              <select
                value={formData.mover}
                onChange={(e) => handleInputChange("mover", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSaving}
              >
                <option value="">Select mover (optional)</option>
                {boardMembers.map((member) => {
                  const displayName =
                    [member.firstName, member.lastName].filter(Boolean).join(" ") || member.userId;
                  return (
                    <option key={member.userId} value={member.userId}>
                      {displayName} {member.title && `(${member.title})`}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                value={formData.mover}
                onChange={(e) => handleInputChange("mover", e.target.value)}
                placeholder="Enter mover name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSaving}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seconder</label>
            {boardMembers.length > 0 ? (
              <select
                value={formData.seconder}
                onChange={(e) => handleInputChange("seconder", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSaving}
              >
                <option value="">Select seconder (optional)</option>
                {boardMembers.map((member) => {
                  const displayName =
                    [member.firstName, member.lastName].filter(Boolean).join(" ") || member.userId;
                  return (
                    <option key={member.userId} value={member.userId}>
                      {displayName} {member.title && `(${member.title})`}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                value={formData.seconder}
                onChange={(e) => handleInputChange("seconder", e.target.value)}
                placeholder="Enter seconder name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSaving}
              />
            )}
          </div>

          {isEditing && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Motion State</label>
              <p className="text-xs text-gray-500 mb-2">
                Status (pending/passed/failed) is computed from votes. Use these flags for special
                states.
              </p>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_withdrawn}
                    onChange={(e) => handleCheckboxChange("is_withdrawn", e.target.checked)}
                    disabled={isSaving}
                    className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                  />
                  <span className="text-sm text-gray-700">Withdrawn</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_tabled}
                    onChange={(e) => handleCheckboxChange("is_tabled", e.target.checked)}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Tabled</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !formData.title.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <LuLoader2 className="w-4 h-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <LuSave className="w-4 h-4" />
                  {isEditing ? "Update Motion" : "Create Motion"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
