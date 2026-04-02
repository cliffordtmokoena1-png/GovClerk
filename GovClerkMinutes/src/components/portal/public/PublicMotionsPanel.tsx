import type { Motion } from "@/types/liveSession";

type Props = {
  motions: Motion[];
};

const MOTION_TYPE_LABELS: Record<string, string> = {
  motion: "Motion",
  resolution: "Resolution",
  ordinance: "Ordinance",
  bylaw: "By-law",
  amendment: "Amendment",
  procedural: "Procedural",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; emoji: string }> = {
  pending: { label: "Pending", className: "bg-gray-100 text-gray-600", emoji: "⏳" },
  open: { label: "Open", className: "bg-blue-100 text-blue-700", emoji: "🗳️" },
  passed: { label: "Passed", className: "bg-green-100 text-green-700", emoji: "✅" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700", emoji: "❌" },
  tabled: { label: "Tabled", className: "bg-yellow-100 text-yellow-700", emoji: "📋" },
  withdrawn: { label: "Withdrawn", className: "bg-gray-100 text-gray-500", emoji: "↩️" },
  amended: { label: "Amended", className: "bg-purple-100 text-purple-700", emoji: "📝" },
};

const VOTE_ICON: Record<string, string> = {
  aye: "✅",
  nay: "❌",
  abstain: "⬜",
  absent: "⭕",
};

function VoteTallyBar({ motion }: { motion: Motion }) {
  const votes = motion.votes ?? [];
  const aye = votes.filter((vote) => vote.vote === "aye").length;
  const nay = votes.filter((vote) => vote.vote === "nay").length;
  const abstain = votes.filter((vote) => vote.vote === "abstain").length;
  const total = votes.length;

  if (total === 0) return null;

  const ayePct = Math.round((aye / total) * 100);
  const nayPct = Math.round((nay / total) * 100);
  const abstainPct = 100 - ayePct - nayPct;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-4 text-xs text-gray-600 mb-1.5">
        <span className="font-medium text-green-700">Aye: {aye}</span>
        <span className="font-medium text-red-700">Nay: {nay}</span>
        {abstain > 0 && <span className="font-medium text-gray-500">Abstain: {abstain}</span>}
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        {ayePct > 0 && <div className="bg-green-500" style={{ width: `${ayePct}%` }} />}
        {nayPct > 0 && <div className="bg-red-500" style={{ width: `${nayPct}%` }} />}
        {abstainPct > 0 && <div className="bg-gray-300" style={{ width: `${abstainPct}%` }} />}
      </div>
    </div>
  );
}

function MotionCard({ motion }: { motion: Motion }) {
  const statusConfig = STATUS_CONFIG[motion.status] ?? STATUS_CONFIG.pending;
  const typeLabel = MOTION_TYPE_LABELS[motion.motionType] ?? motion.motionType;
  const borderClass =
    motion.status === "passed"
      ? "border-green-300"
      : motion.status === "failed"
        ? "border-red-300"
        : "border-gray-200";

  const votes = motion.votes ?? [];

  return (
    <div className={`bg-white border rounded-xl p-4 ${borderClass}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
            {typeLabel}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusConfig.className}`}>
            {statusConfig.emoji} {statusConfig.label}
          </span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">#{motion.ordinal}</span>
      </div>

      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1">{motion.title}</h3>

      {motion.description && <p className="text-xs text-gray-500 mb-2">{motion.description}</p>}

      {(motion.movedBy || motion.secondedBy) && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
          {motion.movedBy && (
            <span>
              Moved by: <span className="font-medium text-gray-700">{motion.movedBy}</span>
            </span>
          )}
          {motion.secondedBy && (
            <span>
              Seconded by: <span className="font-medium text-gray-700">{motion.secondedBy}</span>
            </span>
          )}
        </div>
      )}

      {motion.voteResultSummary && (
        <p className="text-xs font-medium text-gray-700 mb-2">{motion.voteResultSummary}</p>
      )}

      <VoteTallyBar motion={motion} />

      {votes.length > 0 && motion.status !== "pending" && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Individual votes</p>
          <div className="flex flex-wrap gap-2">
            {votes.map((vote) => (
              <span key={vote.id} className="text-xs text-gray-600 flex items-center gap-1">
                <span>{VOTE_ICON[vote.vote] ?? "?"}</span>
                <span>{vote.memberName}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PublicMotionsPanel({ motions }: Props) {
  if (motions.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">No motions have been tabled yet</div>
    );
  }

  return (
    <div className="space-y-3">
      {motions.map((motion) => (
        <MotionCard key={motion.id} motion={motion} />
      ))}
    </div>
  );
}
