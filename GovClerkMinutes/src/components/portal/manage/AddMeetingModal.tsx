import { useState, useEffect, useMemo } from "react";
import { LuX } from "react-icons/lu";
import { toast } from "sonner";
import { usePortalMeetings } from "@/hooks/portal";
import { useBoards } from "@/hooks/portal/useBoards";
import type { CreatePortalMeetingRequest } from "@/types/portal";
import { BoardSelector } from "@/components/shared/BoardSelector";
import { TagSelector } from "@/components/shared/TagSelector";

interface AddMeetingModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface FormData {
  title: string;
  description: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  tags: string[];
  isPublic: boolean;
  mgBoardId?: number;
}

const getDefaultFormData = (): FormData => ({
  title: "",
  description: "",
  meetingDate: new Date().toISOString().split("T")[0],
  meetingTime: "09:00",
  location: "",
  tags: [],
  isPublic: false,
  mgBoardId: undefined,
});

export function AddMeetingModal({ isOpen, onClose }: Readonly<AddMeetingModalProps>) {
  const { meetings, createMeeting } = usePortalMeetings();
  const { boards, isLoading: isLoadingBoards } = useBoards();
  const [formData, setFormData] = useState<FormData>(getDefaultFormData());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    meetings.forEach((meeting) => {
      meeting.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [meetings]);

  useEffect(() => {
    if (isOpen) {
      setFormData(getDefaultFormData());
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.meetingDate) {
      return;
    }

    if (!formData.mgBoardId) {
      setError("Please select a board");
      return;
    }

    setIsSaving(true);
    try {
      const meetingDateTime = new Date(`${formData.meetingDate}T${formData.meetingTime}`);

      if (meetingDateTime < new Date()) {
        toast.warning("This meeting is scheduled in the past", {
          description: "The meeting will be created, but the date/time has already passed.",
        });
      }

      const createData: CreatePortalMeetingRequest = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        meetingDate: meetingDateTime.toISOString(),
        location: formData.location.trim() || undefined,
        isPublic: formData.isPublic,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        mgBoardId: formData.mgBoardId,
      };
      await createMeeting(createData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagsChange = (tags: string[]) => {
    setFormData((prev) => ({ ...prev, tags }));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Add Meeting</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <LuX className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Meeting Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="City Council Regular Meeting"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Regular monthly meeting to discuss city matters"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="date"
                  type="date"
                  value={formData.meetingDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, meetingDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  id="time"
                  type="time"
                  value={formData.meetingTime}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, meetingTime: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                id="location"
                type="text"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="City Hall, Room 101"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Board <span className="text-red-500">*</span>
              </label>
              <BoardSelector
                boards={boards}
                selectedBoardId={formData.mgBoardId}
                onSelect={(boardId) => {
                  setFormData((prev) => ({ ...prev, mgBoardId: boardId }));
                  if (boardId) {
                    setError(null);
                  }
                }}
                isLoading={isLoadingBoards}
                label=""
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <TagSelector
              selectedTags={formData.tags}
              onChange={handleTagsChange}
              existingTags={existingTags}
            />

            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm font-medium text-gray-700">Publish</span>
                <p className="text-xs text-gray-500">Make this meeting visible on your portal</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.isPublic}
                onClick={() => setFormData((prev) => ({ ...prev, isPublic: !prev.isPublic }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  formData.isPublic ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.isPublic ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSaving ||
                  !formData.title.trim() ||
                  !formData.mgBoardId ||
                  !formData.meetingDate ||
                  !formData.meetingTime
                }
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Creating..." : "Add Meeting"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
