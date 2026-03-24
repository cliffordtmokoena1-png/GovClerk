import { useState, useEffect, useMemo } from "react";
import { LuX, LuTrash2, LuLoader2, LuGlobe, LuLock } from "react-icons/lu";
import { toast } from "sonner";
import { usePortalMeetings } from "@/hooks/portal";
import { useBoards } from "@/hooks/portal/useBoards";
import { useOrgContext } from "@/contexts/OrgContext";
import type {
  UpdatePortalMeetingRequest,
  PortalMeetingWithArtifacts,
  PortalArtifact,
} from "@/types/portal";
import { BoardSelector } from "@/components/shared/BoardSelector";
import { TagSelector } from "@/components/shared/TagSelector";
import { AddDocumentDropdown } from "./AddDocumentDropdown";
import { getArtifactIcon, getArtifactTypeLabel } from "@/utils/artifactUtils";

interface EditMeetingModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly meeting: PortalMeetingWithArtifacts | null;
}

interface FormData {
  title: string;
  description: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  tags: string[];
  isPublic: boolean;
  isCancelled: boolean;
  mgBoardId?: number;
}

export function EditMeetingModal({ isOpen, onClose, meeting }: Readonly<EditMeetingModalProps>) {
  const { orgId } = useOrgContext();
  const { meetings, updateMeeting, mutate } = usePortalMeetings();
  const { boards, isLoading: isLoadingBoards } = useBoards();

  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    meetingDate: "",
    meetingTime: "09:00",
    location: "",
    tags: [],
    isPublic: false,
    isCancelled: false,
    mgBoardId: undefined,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingArtifactId, setDeletingArtifactId] = useState<number | null>(null);
  const [confirmDeleteArtifactId, setConfirmDeleteArtifactId] = useState<number | null>(null);
  const [localArtifacts, setLocalArtifacts] = useState<PortalArtifact[]>([]);
  const [togglingVisibilityArtifactId, setTogglingVisibilityArtifactId] = useState<number | null>(
    null
  );
  const [boardError, setBoardError] = useState<string | null>(null);

  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    meetings.forEach((m) => {
      m.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [meetings]);

  useEffect(() => {
    if (isOpen && meeting) {
      const meetingDateTime = new Date(meeting.meetingDate);
      const dateStr = meetingDateTime.toISOString().split("T")[0];
      const timeStr = meetingDateTime.toTimeString().slice(0, 5);

      setFormData({
        title: meeting.title,
        description: meeting.description || "",
        meetingDate: dateStr,
        meetingTime: timeStr,
        location: meeting.location || "",
        tags: meeting.tags || [],
        isPublic: meeting.isPublic,
        isCancelled: meeting.isCancelled || false,
        mgBoardId: meeting.mgBoardId,
      });
      setLocalArtifacts(meeting.artifacts || []);
      setConfirmDeleteArtifactId(null);
    }
  }, [isOpen, meeting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting || !formData.title.trim() || !formData.meetingDate) {
      return;
    }

    if (!formData.mgBoardId) {
      setBoardError("Please select a board");
      return;
    }

    setIsSaving(true);
    try {
      const meetingDateTime = new Date(`${formData.meetingDate}T${formData.meetingTime}`);
      const updateData: UpdatePortalMeetingRequest = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        meetingDate: meetingDateTime.toISOString(),
        location: formData.location.trim() || undefined,
        isPublic: formData.isPublic,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        isCancelled: formData.isCancelled,
        mgBoardId: formData.mgBoardId,
      };
      await updateMeeting(meeting.id, updateData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagsChange = (tags: string[]) => {
    setFormData((prev) => ({ ...prev, tags }));
  };

  const handleDeleteArtifact = async (artifactId: number) => {
    if (!meeting || !orgId) {
      return;
    }

    setDeletingArtifactId(artifactId);
    try {
      const response = await fetch(`/api/portal/meetings/${meeting.id}/artifacts/${artifactId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete document");
      }

      setLocalArtifacts((prev) => prev.filter((a) => a.id !== artifactId));
      setConfirmDeleteArtifactId(null);

      toast.success("Document deleted");

      mutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete document";
      toast.error(message);
    } finally {
      setDeletingArtifactId(null);
    }
  };

  const handleArtifactAdded = (artifact: PortalArtifact) => {
    setLocalArtifacts((prev) => [...prev, artifact]);
    mutate();
  };

  const handleToggleArtifactVisibility = async (artifact: PortalArtifact) => {
    if (!meeting || !orgId) {
      return;
    }

    setTogglingVisibilityArtifactId(artifact.id);
    try {
      const response = await fetch(`/api/portal/meetings/${meeting.id}/artifacts/${artifact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !artifact.isPublic, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update document visibility");
      }

      const { artifact: updatedArtifact } = await response.json();

      setLocalArtifacts((prev) =>
        prev.map((a) => (a.id === artifact.id ? { ...a, isPublic: updatedArtifact.isPublic } : a))
      );

      toast.success(
        updatedArtifact.isPublic ? "Document is now public" : "Document is now internal"
      );

      mutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update visibility";
      toast.error(message);
    } finally {
      setTogglingVisibilityArtifactId(null);
    }
  };

  if (!isOpen || !meeting) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Edit Meeting</h2>
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
                    setBoardError(null);
                  }
                }}
                isLoading={isLoadingBoards}
                required
                label=""
              />
              {boardError && <p className="text-sm text-red-500">{boardError}</p>}
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

            <div className="flex items-center gap-3 py-2">
              <input
                id="isCancelled"
                type="checkbox"
                checked={formData.isCancelled}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isCancelled: e.target.checked }))
                }
                className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <label htmlFor="isCancelled" className="text-sm text-gray-700">
                <span className="font-medium">Cancel this meeting</span>
                <p className="text-xs text-gray-500">
                  Mark as cancelled - meeting will show with strikethrough
                </p>
              </label>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Documents</h3>
                <AddDocumentDropdown meetingId={meeting.id} onArtifactAdded={handleArtifactAdded} />
              </div>

              {localArtifacts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                  No documents attached
                </p>
              ) : (
                <div className="space-y-2">
                  {localArtifacts.map((artifact) => {
                    const Icon = getArtifactIcon(artifact.artifactType);
                    const isDeleting = deletingArtifactId === artifact.id;
                    const isConfirming = confirmDeleteArtifactId === artifact.id;
                    const isTogglingVisibility = togglingVisibilityArtifactId === artifact.id;

                    return (
                      <div
                        key={artifact.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {artifact.fileName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {getArtifactTypeLabel(artifact.artifactType)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleArtifactVisibility(artifact)}
                            disabled={isTogglingVisibility || isConfirming}
                            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                              artifact.isPublic
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            } ${isTogglingVisibility ? "opacity-50 cursor-wait" : ""}`}
                            title={
                              artifact.isPublic ? "Click to make internal" : "Click to make public"
                            }
                          >
                            {isTogglingVisibility ? (
                              <LuLoader2 className="w-3 h-3 animate-spin" />
                            ) : artifact.isPublic ? (
                              <LuGlobe className="w-3 h-3" />
                            ) : (
                              <LuLock className="w-3 h-3" />
                            )}
                            <span>{artifact.isPublic ? "Public" : "Internal"}</span>
                          </button>
                        </div>

                        {isConfirming ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteArtifact(artifact.id)}
                              disabled={isDeleting}
                              className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <LuLoader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Confirm"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteArtifactId(null)}
                              className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteArtifactId(artifact.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete document"
                          >
                            <LuTrash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
