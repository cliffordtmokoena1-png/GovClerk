import { useState } from "react";
import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuGripVertical,
  LuVote,
  LuChevronDown,
  LuChevronRight,
  LuLoader2,
} from "react-icons/lu";
import type { MgMotion } from "@/types/agenda";
import type { BoardMember } from "@/board/types";
import { getMotionDisplayStatus } from "@/constants/motions";
import type { VoteType } from "@/types/agenda";
import { MotionForm } from "./MotionForm";
import { VotingPanel } from "./VotingPanel";
import { ConfirmDialog } from "@/components/broadcast/ConfirmDialog";

interface MotionFormData {
  title: string;
  description?: string;
  mover?: string;
  seconder?: string;
  is_withdrawn?: boolean;
  is_tabled?: boolean;
}

interface MotionManagerProps {
  readonly meetingId: number;
  readonly agendaItemId: number;
  readonly motions: MgMotion[];
  readonly boardMembers: BoardMember[];
  readonly onCreateMotion: (data: MotionFormData) => Promise<void>;
  readonly onUpdateMotion: (id: number, data: MotionFormData) => Promise<void>;
  readonly onDeleteMotion: (id: number) => Promise<void>;
  readonly onUpdateVote: (boardMemberId: string, voteType: VoteType) => Promise<void>;
  readonly onSetAllVotes: (voteType: VoteType) => Promise<void>;
  readonly onResetVotes: () => Promise<void>;
  readonly isLoading?: boolean;
}

export function MotionManager({
  meetingId,
  agendaItemId,
  motions,
  boardMembers,
  onCreateMotion,
  onUpdateMotion,
  onDeleteMotion,
  onUpdateVote,
  onSetAllVotes,
  onResetVotes,
  isLoading = false,
}: Readonly<MotionManagerProps>) {
  const [expandedMotions, setExpandedMotions] = useState<Set<number>>(new Set());
  const [showMotionForm, setShowMotionForm] = useState(false);
  const [editingMotion, setEditingMotion] = useState<MgMotion | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingMotionId, setDeletingMotionId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showVotingFor, setShowVotingFor] = useState<number | null>(null);

  const toggleExpand = (motionId: number) => {
    setExpandedMotions((prev) => {
      const next = new Set(prev);
      if (next.has(motionId)) {
        next.delete(motionId);
      } else {
        next.add(motionId);
      }
      return next;
    });
  };

  const handleAddMotion = () => {
    setEditingMotion(null);
    setShowMotionForm(true);
  };

  const handleEditMotion = (motion: MgMotion) => {
    setEditingMotion(motion);
    setShowMotionForm(true);
  };

  const handleSaveMotion = async (data: MotionFormData) => {
    setIsSaving(true);
    try {
      if (editingMotion) {
        await onUpdateMotion(editingMotion.id, data);
      } else {
        await onCreateMotion(data);
      }
      setShowMotionForm(false);
      setEditingMotion(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMotion = async (motionId: number) => {
    setDeletingMotionId(motionId);
    try {
      await onDeleteMotion(motionId);
    } finally {
      setDeletingMotionId(null);
    }
  };

  const handleCancelMotionForm = () => {
    setShowMotionForm(false);
    setEditingMotion(null);
  };

  const handleOpenVoting = (motionId: number) => {
    setShowVotingFor(motionId);
  };

  const handleCloseVoting = () => {
    setShowVotingFor(null);
  };

  const getVoteDisplay = (motion: MgMotion) => {
    if (motion.votes && motion.votes.length > 0) {
      const yes = motion.votes.filter((v) => v.vote_value === "yes").length;
      const no = motion.votes.filter((v) => v.vote_value === "no").length;
      const abstain = motion.votes.filter((v) => v.vote_value === "abstain").length;
      const uncast = motion.votes.filter((v) => v.vote_value === null).length;

      if (uncast > 0) {
        return `${yes}-${no}-${abstain} (${uncast} uncast)`;
      }
      return `${yes}-${no}-${abstain} (Yes-No-Abstain)`;
    }

    const hasVotes =
      motion.votes_for !== null || motion.votes_against !== null || motion.votes_abstain !== null;
    if (!hasVotes) {
      return "No votes";
    }

    const yes = motion.votes_for || 0;
    const no = motion.votes_against || 0;
    const abstain = motion.votes_abstain || 0;

    return `${yes}-${no}-${abstain} (Yes-No-Abstain)`;
  };

  const renderMotion = (motion: MgMotion, index: number) => {
    const isExpanded = expandedMotions.has(motion.id);
    const hasDescription = !!motion.description;
    const hasVotes = motion.votes && motion.votes.length > 0;

    return (
      <div key={motion.id} className="border-b border-gray-200 last:border-b-0">
        <div
          className="flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer"
          onClick={() => hasDescription && toggleExpand(motion.id)}
        >
          <div className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
            <LuGripVertical className="w-4 h-4" />
          </div>

          {hasDescription && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(motion.id);
              }}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              {isExpanded ? (
                <LuChevronDown className="w-4 h-4" />
              ) : (
                <LuChevronRight className="w-4 h-4" />
              )}
            </button>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="text-sm font-medium text-gray-900">{motion.title}</h4>
              {(() => {
                const { label, colorClass } = getMotionDisplayStatus(motion);
                return (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
                  >
                    {label}
                  </span>
                );
              })()}
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              {motion.mover && <span>Mover: {motion.mover}</span>}
              {motion.seconder && <span>Seconder: {motion.seconder}</span>}
              <span>Votes: {getVoteDisplay(motion)}</span>
            </div>

            {isExpanded && hasDescription && (
              <div className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">
                {motion.description}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenVoting(motion.id);
              }}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              title="Manage votes"
            >
              <LuVote className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditMotion(motion);
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit motion"
            >
              <LuPencil className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(motion.id);
              }}
              disabled={deletingMotionId === motion.id}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="Delete motion"
            >
              {deletingMotionId === motion.id ? (
                <LuLoader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LuTrash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LuLoader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading motions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Motions</h3>
          <p className="text-sm text-gray-600">
            {motions.length} motion{motions.length !== 1 ? "s" : ""} for this agenda item
          </p>
        </div>
        <button
          onClick={handleAddMotion}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <LuPlus className="w-4 h-4" />
          Add Motion
        </button>
      </div>

      {showMotionForm && (
        <MotionForm
          motion={editingMotion}
          boardMembers={boardMembers}
          onSave={handleSaveMotion}
          onCancel={handleCancelMotionForm}
          isSaving={isSaving}
          isEditing={!!editingMotion}
        />
      )}

      {showVotingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh]">
            <VotingPanel
              motionId={showVotingFor}
              votes={motions.find((m) => m.id === showVotingFor)?.votes || []}
              boardMembers={boardMembers}
              onUpdateVote={onUpdateVote}
              onSetAllVotes={onSetAllVotes}
              onResetVotes={onResetVotes}
              onClose={handleCloseVoting}
              showCloseButton
            />
          </div>
        </div>
      )}

      {motions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">No motions yet</p>
          <button
            onClick={handleAddMotion}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <LuPlus className="w-4 h-4" />
            Add your first motion
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          {motions.map((motion, index) => renderMotion(motion, index))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="Delete Motion"
        description="Are you sure you want to delete this motion? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={async () => {
          if (confirmDeleteId) {
            await handleDeleteMotion(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        isLoading={deletingMotionId === confirmDeleteId}
      />
    </div>
  );
}
