import { useState } from "react";
import { LuX, LuLoader2, LuThumbsUp, LuThumbsDown, LuMinus } from "react-icons/lu";
import type { MgVote, VoteType } from "@/types/agenda";
import type { BoardMember } from "@/board/types";

interface VotingPanelProps {
  readonly motionId: number;
  readonly votes: MgVote[];
  readonly boardMembers: BoardMember[];
  readonly onUpdateVote: (boardMemberId: string, voteType: VoteType) => Promise<void>;
  readonly onSetAllVotes: (voteType: VoteType) => Promise<void>;
  readonly onResetVotes: () => Promise<void>;
  readonly isLoading?: boolean;
  readonly onClose?: () => void;
  readonly showCloseButton?: boolean;
}

const VOTE_OPTIONS: { type: VoteType; label: string; color: string; icon: React.ReactNode }[] = [
  {
    type: "yes",
    label: "Yes",
    color: "green",
    icon: <LuThumbsUp className="w-4 h-4" />,
  },
  {
    type: "no",
    label: "No",
    color: "red",
    icon: <LuThumbsDown className="w-4 h-4" />,
  },
  {
    type: "abstain",
    label: "Abstain",
    color: "gray",
    icon: <LuMinus className="w-4 h-4" />,
  },
];

export function VotingPanel({
  motionId,
  votes,
  boardMembers,
  onUpdateVote,
  onSetAllVotes,
  onResetVotes,
  isLoading = false,
  onClose,
  showCloseButton = true,
}: Readonly<VotingPanelProps>) {
  const [updatingVotes, setUpdatingVotes] = useState<Set<string>>(new Set());

  const getVoteForMember = (memberId: string): VoteType | null => {
    const vote = votes.find((v) => v.user_id === memberId);
    return vote?.vote_value ?? null;
  };

  const handleVoteChange = async (memberId: string, voteType: VoteType) => {
    setUpdatingVotes((prev) => new Set(prev).add(memberId));
    try {
      await onUpdateVote(memberId, voteType);
    } finally {
      setUpdatingVotes((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  const handleSetAllVotes = async (voteType: VoteType) => {
    setUpdatingVotes(new Set(boardMembers.map((m) => m.userId)));
    try {
      await onSetAllVotes(voteType);
    } finally {
      setUpdatingVotes(new Set());
    }
  };

  const handleResetVotes = async () => {
    setUpdatingVotes(new Set(boardMembers.map((m) => m.userId)));
    try {
      await onResetVotes();
    } finally {
      setUpdatingVotes(new Set());
    }
  };

  const getVoteCounts = () => {
    const counts = {
      yes: votes.filter((v) => v.vote_value === "yes").length,
      no: votes.filter((v) => v.vote_value === "no").length,
      abstain: votes.filter((v) => v.vote_value === "abstain").length,
      total: votes.length,
    };

    const majority = counts.yes > counts.no ? "yes" : counts.no > counts.yes ? "no" : "tie";

    const passed = counts.yes > counts.no;

    return {
      ...counts,
      majority,
      passed,
    };
  };

  const voteCounts = getVoteCounts();
  const isUpdatingBoardMember = (memberId: string) => updatingVotes.has(memberId);
  const isAllUpdating = updatingVotes.size > 0 && updatingVotes.size === boardMembers.length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Voting Panel</h3>
          <p className="text-sm text-gray-600 mt-1">
            Motion ID: {motionId} • {voteCounts.total}/{boardMembers.length} votes cast
          </p>
        </div>
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-600 rounded disabled:opacity-50"
          >
            <LuX className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-4 border-b border-gray-200 bg-blue-50">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{voteCounts.yes}</div>
            <div className="text-sm text-gray-600">Yes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{voteCounts.no}</div>
            <div className="text-sm text-gray-600">No</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{voteCounts.abstain}</div>
            <div className="text-sm text-gray-600">Abstain</div>
          </div>
          <div className="text-center">
            <div
              className={`text-2xl font-bold ${
                voteCounts.passed ? "text-green-600" : "text-red-600"
              }`}
            >
              {voteCounts.passed ? "Passed" : "Failed"}
            </div>
            <div className="text-sm text-gray-600">Result</div>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSetAllVotes("yes")}
            disabled={isLoading || isAllUpdating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAllUpdating ? <LuLoader2 className="w-4 h-4 animate-spin" /> : "All Yes"}
          </button>
          <button
            onClick={() => handleSetAllVotes("no")}
            disabled={isLoading || isAllUpdating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAllUpdating ? <LuLoader2 className="w-4 h-4 animate-spin" /> : "All No"}
          </button>
          <button
            onClick={() => handleSetAllVotes("abstain")}
            disabled={isLoading || isAllUpdating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAllUpdating ? <LuLoader2 className="w-4 h-4 animate-spin" /> : "All Abstain"}
          </button>
          <button
            onClick={handleResetVotes}
            disabled={isLoading || isAllUpdating}
            className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reset All
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {boardMembers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No board members available for voting.
          </div>
        ) : (
          boardMembers.map((member) => {
            const currentVote = getVoteForMember(member.userId);
            const isUpdating = isUpdatingBoardMember(member.userId);

            const displayName =
              [member.firstName, member.lastName].filter(Boolean).join(" ") || member.userId;
            return (
              <div key={member.userId} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{displayName}</div>
                    {member.title && <div className="text-sm text-gray-600">{member.title}</div>}
                    {currentVote && (
                      <div className="text-sm mt-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            currentVote === "yes"
                              ? "bg-green-100 text-green-800"
                              : currentVote === "no"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {currentVote.charAt(0).toUpperCase() + currentVote.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1">
                    {VOTE_OPTIONS.map((option) => (
                      <button
                        key={option.type}
                        onClick={() => handleVoteChange(member.userId, option.type)}
                        disabled={isLoading || isUpdating}
                        title={`Vote ${option.label}`}
                        className={`p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          currentVote === option.type
                            ? option.color === "green"
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : option.color === "red"
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "bg-gray-600 text-white hover:bg-gray-700"
                            : option.color === "green"
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : option.color === "red"
                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {isUpdating ? <LuLoader2 className="w-4 h-4 animate-spin" /> : option.icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600">
          <p>• Click vote buttons to record individual votes</p>
          <p>• Use bulk actions to set all votes at once</p>
          <p>• Changes are saved automatically</p>
        </div>
      </div>
    </div>
  );
}
