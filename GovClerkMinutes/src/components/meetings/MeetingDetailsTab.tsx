import { useState, useEffect, useRef, useMemo } from "react";
import {
  LuPencil,
  LuX,
  LuPlus,
  LuCheck,
  LuChevronDown,
  LuCalendar,
  LuMapPin,
  LuGlobe,
  LuLock,
  LuTag,
  LuLoader2,
  LuClipboardList,
  LuFileText,
  LuUsers,
  LuFile,
  LuArrowRight,
} from "react-icons/lu";
import { usePortalMeetings } from "@/hooks/portal";
import { useBoards } from "@/hooks/portal/useBoards";
import { useAgenda } from "@/hooks/portal/useAgenda";
import { getItemPrefix } from "@/utils/agendaFormatting";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import { BoardSelector } from "@/components/shared/BoardSelector";
import type { UpdatePortalMeetingRequest, PortalMeetingWithArtifacts } from "@/types/portal";
import type { MeetingTab } from "@/components/meetings/MeetingTabs";

interface MeetingDetailsTabProps {
  readonly meeting: PortalMeetingWithArtifacts;
  readonly onUpdate: () => void;
  readonly onSwitchToTab?: (tab: MeetingTab) => void;
  readonly initialEditMode?: boolean;
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

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) {
    return "—";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export function MeetingDetailsTab({
  meeting,
  onUpdate,
  onSwitchToTab,
  initialEditMode = false,
}: Readonly<MeetingDetailsTabProps>) {
  const { meetings, updateMeeting } = usePortalMeetings();
  const { boards, isLoading: isLoadingBoards } = useBoards();
  const { items: agendaItems, tree: agendaTree } = useAgenda(meeting.id);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [hasInitializedEditMode, setHasInitializedEditMode] = useState(false);
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
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    meetings.forEach((m) => {
      m.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [meetings]);

  useEffect(() => {
    if (meeting) {
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
    }
  }, [meeting]);

  useEffect(() => {
    if (initialEditMode && !hasInitializedEditMode) {
      setIsEditing(true);
      setHasInitializedEditMode(true);
    }
  }, [initialEditMode, hasInitializedEditMode]);

  useEffect(() => {
    if (isCreatingTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [isCreatingTag]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
        setIsCreatingTag(false);
      }
    };

    if (isTagDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTagDropdownOpen]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
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
    setIsEditing(false);
    setIsTagDropdownOpen(false);
    setIsCreatingTag(false);
    setNewTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.meetingDate) {
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
      setIsEditing(false);
      onUpdate();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const handleCreateNewTag = () => {
    const trimmedTag = newTagInput.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmedTag],
      }));
    }
    setNewTagInput("");
    setIsCreatingTag(false);
  };

  const handleNewTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateNewTag();
    } else if (e.key === "Escape") {
      setIsCreatingTag(false);
      setNewTagInput("");
    }
  };

  const documentCount = meeting.artifacts?.length || 0;
  const agendaCount = agendaItems.length;

  const renderAgendaPreviewItem = (
    item: MgAgendaItemWithRelations,
    level: number,
    index: number
  ): React.ReactNode => {
    const prefix = getItemPrefix(level, index);
    const paddingLeft = level * 16;

    return (
      <div key={item.id} style={{ paddingLeft }}>
        <div className="flex items-center gap-2 py-1">
          <span className="text-sm font-medium text-gray-600 min-w-[32px]">{prefix}</span>
          <span className="text-sm text-gray-800 truncate">{item.title}</span>
        </div>
      </div>
    );
  };

  const getPreviewItems = (
    tree: MgAgendaItemWithRelations[],
    maxItems: number
  ): Array<{ item: MgAgendaItemWithRelations; level: number; index: number }> => {
    const result: Array<{ item: MgAgendaItemWithRelations; level: number; index: number }> = [];

    const traverse = (items: MgAgendaItemWithRelations[], level: number) => {
      items.forEach((item, index) => {
        if (result.length < maxItems) {
          result.push({ item, level, index });
          if (item.children && item.children.length > 0) {
            traverse(item.children, level + 1);
          }
        }
      });
    };

    traverse(tree, 0);
    return result;
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const previewLimit = isMobile ? 3 : 5;
  const agendaPreviewItems = getPreviewItems(agendaTree, previewLimit);
  const recentDocuments = (meeting.artifacts ?? []).slice(0, previewLimit);

  if (!isEditing) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="max-w-5xl mx-auto w-full space-y-6">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 md:p-4">
            <div className="flex items-start justify-between gap-4 mb-3 md:mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">Meeting Details</h3>
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0 min-h-[44px] md:min-h-0"
              >
                <LuPencil className="w-4 h-4" />
                Edit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="md:col-span-2 bg-white rounded-lg border border-gray-100 p-3 md:p-4">
                <div className="mb-2 md:mb-3">
                  <p className="text-xs text-gray-500 mb-1">Title</p>
                  <p
                    className={`text-sm md:text-base font-medium text-gray-900 ${meeting.isCancelled ? "line-through" : ""}`}
                  >
                    {meeting.title}
                  </p>
                  {meeting.isCancelled && (
                    <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
                      Cancelled
                    </span>
                  )}
                </div>
                {meeting.description && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-700">{meeting.description}</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-gray-100 p-3 md:p-4">
                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-start gap-2">
                    <LuCalendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Date & Time</p>
                      <p className="text-sm text-gray-800">{formatDateTime(meeting.meetingDate)}</p>
                    </div>
                  </div>
                  {meeting.location && (
                    <div className="flex items-start gap-2">
                      <LuMapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="text-sm text-gray-800">{meeting.location}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-100 p-3 md:p-4">
                <div className="space-y-3 md:space-y-4">
                  {meeting.mgBoardId && (
                    <div className="flex items-start gap-2">
                      <LuUsers className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Board</p>
                        <p className="text-sm text-gray-800">
                          {boards.find((b) => b.id === String(meeting.mgBoardId))?.name ||
                            "Unknown Board"}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    {meeting.isPublic ? (
                      <LuGlobe className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                    ) : (
                      <LuLock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Visibility</p>
                      <p className="text-sm text-gray-800">
                        {meeting.isPublic ? "Public" : "Private"}
                      </p>
                    </div>
                  </div>
                  {meeting.tags && meeting.tags.length > 0 && (
                    <div className="flex items-start gap-2">
                      <LuTag className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Tags</p>
                        <div className="flex flex-wrap gap-1">
                          {meeting.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 md:gap-3">
                  <LuClipboardList className="w-5 h-5 text-gray-600" />
                  <div>
                    <h4 className="text-sm md:text-base font-medium text-gray-900">Agenda</h4>
                    <p className="text-xs text-gray-500">
                      {agendaCount === 0
                        ? "No items yet"
                        : `${agendaCount} item${agendaCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
              </div>

              {agendaPreviewItems.length > 0 && (
                <div className="border-t border-gray-100 pt-3 mb-3">
                  {agendaPreviewItems.map(({ item, level, index }) =>
                    renderAgendaPreviewItem(item, level, index)
                  )}
                  {agendaCount > previewLimit && (
                    <p className="text-xs text-gray-400 mt-2 pl-1">
                      +{agendaCount - previewLimit} more item
                      {agendaCount - previewLimit !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => onSwitchToTab?.("agenda")}
                className="text-sm text-gray-600 hover:text-gray-900 hover:underline transition-colors min-h-[44px] flex items-center gap-1"
              >
                View Full Agenda <LuArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 md:gap-3">
                  <LuFileText className="w-5 h-5 text-gray-600" />
                  <div>
                    <h4 className="text-sm md:text-base font-medium text-gray-900">Documents</h4>
                    <p className="text-xs text-gray-500">
                      {documentCount === 0
                        ? "No files yet"
                        : `${documentCount} file${documentCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
              </div>

              {recentDocuments.length > 0 && (
                <div className="border-t border-gray-100 pt-3 mb-3 space-y-2">
                  {recentDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 py-1 min-h-[44px]">
                      <LuFile className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-800 truncate flex-1">{doc.fileName}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </div>
                  ))}
                  {documentCount > previewLimit && (
                    <p className="text-xs text-gray-400 mt-1">
                      +{documentCount - previewLimit} more file
                      {documentCount - previewLimit !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => onSwitchToTab?.("documents")}
                className="text-sm text-gray-600 hover:text-gray-900 hover:underline transition-colors min-h-[44px] flex items-center gap-1"
              >
                {documentCount > previewLimit
                  ? `View all ${documentCount} documents`
                  : "View Documents"}{" "}
                <LuArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto w-full bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                type="date"
                value={formData.meetingDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, meetingDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                onChange={(e) => setFormData((prev) => ({ ...prev, meetingTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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

          <div ref={tagDropdownRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <button
              type="button"
              onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-left flex items-center justify-between"
            >
              <span className="text-gray-500">
                {formData.tags.length > 0
                  ? `${formData.tags.length} tag${formData.tags.length > 1 ? "s" : ""} selected`
                  : "Select tags..."}
              </span>
              <LuChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${isTagDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-accent text-accent-foreground rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="hover:text-primary"
                    >
                      <LuX className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {isTagDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {isCreatingTag ? (
                  <div className="p-2">
                    <div className="flex items-center gap-2">
                      <input
                        ref={newTagInputRef}
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={handleNewTagKeyDown}
                        placeholder="Enter new tag name"
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleCreateNewTag}
                        disabled={!newTagInput.trim()}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <LuCheck className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreatingTag(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10"
                  >
                    <LuPlus className="w-4 h-4" />
                    Create new tag...
                  </button>
                )}

                {existingTags.length > 0 && (
                  <>
                    <div className="border-t border-gray-100" />
                    {existingTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span>{tag}</span>
                        {formData.tags.includes(tag) && (
                          <LuCheck className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </>
                )}

                {existingTags.length === 0 && !isCreatingTag && (
                  <div className="px-3 py-2 text-sm text-gray-500">No existing tags</div>
                )}
              </div>
            )}
          </div>

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
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                formData.isPublic ? "bg-primary" : "bg-gray-200"
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
              onChange={(e) => setFormData((prev) => ({ ...prev, isCancelled: e.target.checked }))}
              className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <label htmlFor="isCancelled" className="text-sm text-gray-700">
              <span className="font-medium">Cancel this meeting</span>
              <p className="text-xs text-gray-500">
                Mark as cancelled - meeting will show with strikethrough
              </p>
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !formData.title.trim() || !formData.mgBoardId}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving && <LuLoader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
