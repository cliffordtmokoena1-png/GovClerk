import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuEye,
  LuEyeOff,
  LuMoreVertical,
  LuChevronLeft,
  LuChevronRight,
  LuExternalLink,
} from "react-icons/lu";
import { usePortalMeetings } from "@/hooks/portal";
import { useBoards } from "@/hooks/portal/useBoards";
import type { PortalMeetingWithArtifacts } from "@/types/portal";
import { AddMeetingModal } from "./AddMeetingModal";
import { AddDocumentDropdown } from "./AddDocumentDropdown";
import { StartBroadcastButton } from "@/components/broadcast";

function getMonthAbbrev(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short" });
}

function getDay(dateString: string): number {
  return new Date(dateString).getDate();
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type ActionMenuProps = Readonly<{
  meeting: PortalMeetingWithArtifacts;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}>;

function ActionMenu({ meeting, onEdit, onToggleVisibility, onDelete }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 192,
      });
    }
    setIsOpen(true);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        aria-label="Actions"
      >
        <LuMoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          />
          <div
            className="fixed w-48 bg-card rounded-lg shadow-lg border border-border py-1 z-20"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              type="button"
              onClick={() => {
                onEdit();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              <LuPencil className="w-4 h-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                onToggleVisibility();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              {meeting.isPublic ? (
                <>
                  <LuEyeOff className="w-4 h-4" />
                  Make Private
                </>
              ) : (
                <>
                  <LuEye className="w-4 h-4" />
                  Make Public
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LuTrash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type DeleteDialogProps = Readonly<{
  isOpen: boolean;
  meeting: PortalMeetingWithArtifacts | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}>;

function DeleteDialog({ isOpen, meeting, isDeleting, onClose, onConfirm }: DeleteDialogProps) {
  if (!isOpen || !meeting) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-black/50 z-40 cursor-default"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Delete Meeting</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Are you sure you want to delete &quot;{meeting.title}&quot;? This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-destructive rounded-lg hover:bg-destructive/90 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function MeetingStatusBadge({ meeting }: Readonly<{ meeting: PortalMeetingWithArtifacts }>) {
  if (meeting.isCancelled) {
    return (
      <span className="px-2.5 py-1 text-xs font-medium bg-destructive/10 text-destructive rounded-full">
        Cancelled
      </span>
    );
  }

  if (meeting.isPublic) {
    return (
      <span
        title="This meeting is visible to the public on your portal"
        className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full cursor-help"
      >
        Published
      </span>
    );
  }

  return (
    <span
      title="This meeting is only visible to organization members"
      className="px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full cursor-help"
    >
      Draft
    </span>
  );
}

type MeetingsTabProps = Readonly<{
  hasPortalSettings?: boolean;
}>;

export function MeetingsTab({ hasPortalSettings = false }: MeetingsTabProps) {
  const router = useRouter();
  const {
    meetings,
    total,
    page,
    pageSize,
    isLoading,
    deleteMeeting,
    toggleVisibility,
    setPage,
    setPageSize,
    mutate,
  } = usePortalMeetings();
  const { boards } = useBoards();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingMeeting, setDeletingMeeting] = useState<PortalMeetingWithArtifacts | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const handleCreateNew = () => {
    setIsAddModalOpen(true);
  };

  const handleEdit = (meeting: PortalMeetingWithArtifacts) => {
    router.push(`/a/meetings/${meeting.id}?edit=true#details`);
  };

  const handleDeleteClick = (meeting: PortalMeetingWithArtifacts) => {
    setDeletingMeeting(meeting);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMeeting) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteMeeting(deletingMeeting.id);
      setDeletingMeeting(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleVisibility = async (meeting: PortalMeetingWithArtifacts) => {
    await toggleVisibility(meeting.id, !meeting.isPublic);
  };

  if (isLoading) {
    return (
      <div className="h-full p-6 bg-card">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg mb-3 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!hasPortalSettings) {
    return (
      <div className="h-full p-6 bg-card">
        <div className="text-center py-12 bg-primary/10 rounded-lg border border-primary/30">
          <div className="text-primary mb-3">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Portal Not Published</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            You need to publish your portal first before adding meetings. Go to the{" "}
            <strong>Portal</strong> tab and click <strong>Publish</strong> to get started.
          </p>
          <p className="text-sm text-muted-foreground">
            Enter a portal URL slug and configure your settings, then publish to enable meeting
            management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full p-6 bg-card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-foreground">Meetings ({total})</h2>
          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <LuPlus className="w-4 h-4" />
            Add Meeting
          </button>
        </div>

        {meetings.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground mb-4">No meetings yet</p>
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors"
            >
              <LuPlus className="w-4 h-4" />
              Add your first meeting
            </button>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              {meetings.map((meeting, index) => (
                <button
                  key={meeting.id}
                  type="button"
                  className={`w-full flex items-center gap-4 px-4 py-4 hover:bg-muted transition-colors cursor-pointer text-left ${
                    index < meetings.length - 1 ? "border-b border-border" : ""
                  }`}
                  onClick={() => router.push(`/a/meetings/${meeting.id}`)}
                >
                  <div className="shrink-0 w-14 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase">
                      {getMonthAbbrev(meeting.meetingDate)}
                    </div>
                    <div className="text-2xl font-bold text-muted-foreground">
                      {getDay(meeting.meetingDate)}
                    </div>
                  </div>

                  <div className="w-px h-12 bg-border shrink-0" />

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/a/meetings/${meeting.id}`}
                      className={`text-sm font-semibold truncate block hover:text-primary transition-colors ${
                        meeting.isCancelled
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {meeting.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatFullDate(meeting.meetingDate)}
                    </p>
                    {Boolean(meeting.mgBoardId) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Board:{" "}
                        {boards.find((b) => b.id === String(meeting.mgBoardId))?.name ||
                          "Unknown Board"}
                      </p>
                    )}
                    {meeting.tags && meeting.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {meeting.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="hidden sm:flex shrink-0 items-center gap-2"></div>

                  <div className="shrink-0 flex items-center gap-2">
                    <MeetingStatusBadge meeting={meeting} />
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    <StartBroadcastButton
                      meetingId={meeting.id}
                      meetingTitle={meeting.title}
                      variant="icon"
                      className="hidden sm:block"
                    />
                    <Link
                      href={`/a/meetings/${meeting.id}`}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Open meeting details"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LuExternalLink className="w-4 h-4" />
                    </Link>
                    <AddDocumentDropdown meetingId={meeting.id} onArtifactAdded={() => mutate()} />
                    <ActionMenu
                      meeting={meeting}
                      onEdit={() => handleEdit(meeting)}
                      onToggleVisibility={() => handleToggleVisibility(meeting)}
                      onDelete={() => handleDeleteClick(meeting)}
                    />
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages || 1}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="p-2 text-muted-foreground border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <LuChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="p-2 text-muted-foreground border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <LuChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <AddMeetingModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      <DeleteDialog
        isOpen={!!deletingMeeting}
        meeting={deletingMeeting}
        isDeleting={isDeleting}
        onClose={() => setDeletingMeeting(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
