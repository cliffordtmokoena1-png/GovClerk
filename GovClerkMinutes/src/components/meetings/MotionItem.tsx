import { useState } from "react";
import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuChevronDown,
  LuChevronRight,
  LuLoader2,
} from "react-icons/lu";
import { useMotions } from "@/hooks/portal/useMotions";
import { useBoardMembers } from "@/hooks/portal/useBoardMembers";
import type { MgMotion } from "@/types/agenda";
import { getMotionDisplayStatus } from "@/constants/motions";
import { MotionForm } from "./MotionForm";

interface MotionItemProps {
  readonly meetingId: number;
  readonly agendaItemId: number;
}

interface MotionFormData {
  title: string;
  description?: string;
  mover?: string;
  seconder?: string;
}

export function MotionItem({ meetingId, agendaItemId }: Readonly<MotionItemProps>) {
  const { boardMembers } = useBoardMembers({ meetingId });
  const { motions, isLoading, createMotion, updateMotion, deleteMotion } = useMotions(
    meetingId,
    agendaItemId
  );

  const [expandedMotions, setExpandedMotions] = useState<Set<number>>(new Set());
  const [showMotionForm, setShowMotionForm] = useState(false);
  const [editingMotion, setEditingMotion] = useState<MgMotion | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingMotionId, setDeletingMotionId] = useState<number | null>(null);

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
        await updateMotion(editingMotion.id, data);
      } else {
        await createMotion({ ...data, agenda_item_id: agendaItemId });
      }
      setShowMotionForm(false);
      setEditingMotion(null);
    } catch (error) {
      console.error("Failed to save motion:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMotion = async (motionId: number) => {
    setDeletingMotionId(motionId);
    try {
      await deleteMotion(motionId);
    } catch (error) {
      console.error("Failed to delete motion:", error);
    } finally {
      setDeletingMotionId(null);
    }
  };

  const handleCancelMotionForm = () => {
    setShowMotionForm(false);
    setEditingMotion(null);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <LuLoader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading motions...</span>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Motions</h4>
          <p className="text-xs text-gray-600">
            {motions.length} motion{motions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleAddMotion}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
        >
          <LuPlus className="w-3 h-3" />
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

      {motions.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded">
          <p className="text-gray-500 text-sm mb-2">No motions yet</p>
          <button
            onClick={handleAddMotion}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <LuPlus className="w-3 h-3" />
            Add your first motion
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          {motions.map((motion) => {
            const isExpanded = expandedMotions.has(motion.id);
            const hasDescription = !!motion.description;

            return (
              <div key={motion.id} className="border-b border-gray-100 last:border-b-0">
                <div className="flex items-start gap-3 p-3 hover:bg-gray-50">
                  {hasDescription && (
                    <button
                      onClick={() => toggleExpand(motion.id)}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      {isExpanded ? (
                        <LuChevronDown className="w-3 h-3" />
                      ) : (
                        <LuChevronRight className="w-3 h-3" />
                      )}
                    </button>
                  )}
                  {!hasDescription && <div className="w-5" />}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900">{motion.title}</h4>
                      {(() => {
                        const { label, colorClass } = getMotionDisplayStatus(motion);
                        return (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      {motion.mover && <span>Mover: {motion.mover}</span>}
                      {motion.seconder && <span>Seconder: {motion.seconder}</span>}
                      <span>Votes: {getVoteDisplay(motion)}</span>
                    </div>

                    {isExpanded && hasDescription && (
                      <div className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">
                        {motion.description}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEditMotion(motion)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit motion"
                    >
                      <LuPencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteMotion(motion.id)}
                      disabled={deletingMotionId === motion.id}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Delete motion"
                    >
                      {deletingMotionId === motion.id ? (
                        <LuLoader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <LuTrash2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
