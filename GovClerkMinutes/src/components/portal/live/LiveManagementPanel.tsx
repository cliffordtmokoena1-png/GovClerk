import { useState } from "react";
import type { AttendanceRecord, Motion, SpeakerQueueEntry, PublicComment } from "@/types/liveSession";

type Props = {
  broadcastId: number;
  attendance: AttendanceRecord[];
  motions: Motion[];
  speakerQueue: SpeakerQueueEntry[];
  publicComments: PublicComment[];
  onRefresh?: () => void;
};

type ActiveTab = "rollcall" | "motions" | "speakers" | "comments";

const ATTENDANCE_STATUS_OPTIONS = ["present", "absent", "late", "excused"] as const;
const ATTENDANCE_LABELS: Record<string, { label: string; className: string }> = {
  present: { label: "Present", className: "bg-green-100 text-green-700" },
  absent: { label: "Absent", className: "bg-red-100 text-red-700" },
  late: { label: "Late", className: "bg-yellow-100 text-yellow-700" },
  excused: { label: "Excused", className: "bg-gray-100 text-gray-600" },
};

function RollCallTab({ broadcastId, attendance, onRefresh }: {
  broadcastId: number;
  attendance: AttendanceRecord[];
  onRefresh?: () => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  const presentCount = attendance.filter((rec) => rec.status === "present" || rec.status === "late").length;
  const total = attendance.length;
  const hasQuorum = total > 0 && presentCount > total / 2;

  async function updateStatus(memberName: string, status: string) {
    setUpdating(memberName);
    try {
      await fetch(`/api/portal/live/${broadcastId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberName, status }),
      });
      onRefresh?.();
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className={`p-3 rounded-lg border text-sm font-medium ${hasQuorum ? "bg-green-50 border-green-200 text-green-800" : "bg-yellow-50 border-yellow-200 text-yellow-800"}`}>
        {presentCount}/{total} present — {hasQuorum ? "Quorum reached ✅" : "No quorum yet ⚠️"}
      </div>
      {attendance.map((rec) => (
        <div key={rec.memberName} className="flex items-center justify-between gap-3 p-3 bg-white border border-gray-200 rounded-lg">
          <span className="text-sm font-medium text-gray-900">{rec.memberName}</span>
          <div className="flex gap-1">
            {ATTENDANCE_STATUS_OPTIONS.map((status) => {
              const statusConfig = ATTENDANCE_LABELS[status];
              return (
                <button
                  key={status}
                  onClick={() => updateStatus(rec.memberName, status)}
                  disabled={updating === rec.memberName}
                  className={`px-2 py-1 text-xs rounded font-medium border transition-colors ${
                    rec.status === status
                      ? `${statusConfig.className} border-transparent`
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {statusConfig.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {attendance.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-4">No attendance records yet</p>
      )}
    </div>
  );
}

function MotionsTab({ broadcastId, motions, onRefresh }: {
  broadcastId: number;
  motions: Motion[];
  onRefresh?: () => void;
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("motion");
  const [newMovedBy, setNewMovedBy] = useState("");
  const [newSecondedBy, setNewSecondedBy] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function createMotion() {
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      await fetch(`/api/portal/live/${broadcastId}/motions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), motionType: newType, movedBy: newMovedBy || undefined, secondedBy: newSecondedBy || undefined }),
      });
      setShowNewForm(false);
      setNewTitle("");
      setNewMovedBy("");
      setNewSecondedBy("");
      onRefresh?.();
    } finally {
      setIsCreating(false);
    }
  }

  async function updateMotionStatus(motionId: number, status: string) {
    await fetch(`/api/portal/live/${broadcastId}/motions/${motionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onRefresh?.();
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowNewForm(true)}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + New Motion
      </button>

      {showNewForm && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {["motion","resolution","ordinance","bylaw","amendment","procedural"].map((motionType) => (
              <option key={motionType} value={motionType}>{motionType.charAt(0).toUpperCase() + motionType.slice(1)}</option>
            ))}
          </select>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Motion title" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" value={newMovedBy} onChange={(e) => setNewMovedBy(e.target.value)} placeholder="Moved by" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" value={newSecondedBy} onChange={(e) => setNewSecondedBy(e.target.value)} placeholder="Seconded by" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <div className="flex gap-2">
            <button onClick={createMotion} disabled={isCreating || !newTitle.trim()} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {isCreating ? "Creating..." : "Create Motion"}
            </button>
            <button onClick={() => setShowNewForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {motions.map((motion) => (
        <div key={motion.id} className="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{motion.title}</p>
            <span className="text-xs text-gray-400">#{motion.ordinal}</span>
          </div>
          {motion.voteResultSummary && (
            <p className="text-xs text-gray-600">{motion.voteResultSummary}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {motion.status === "pending" && (
              <button onClick={() => updateMotionStatus(motion.id, "open")} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Open for Vote</button>
            )}
            {motion.status === "open" && (
              <>
                <button onClick={() => updateMotionStatus(motion.id, "passed")} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Mark Passed</button>
                <button onClick={() => updateMotionStatus(motion.id, "failed")} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Mark Failed</button>
                <button onClick={() => updateMotionStatus(motion.id, "tabled")} className="px-3 py-1.5 text-xs bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">Table</button>
              </>
            )}
            <button onClick={() => updateMotionStatus(motion.id, "withdrawn")} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">Withdraw</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SpeakersTab({ broadcastId, speakerQueue, onRefresh }: {
  broadcastId: number;
  speakerQueue: SpeakerQueueEntry[];
  onRefresh?: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("council_member");
  const [isAdding, setIsAdding] = useState(false);

  async function addSpeaker() {
    if (!newName.trim()) return;
    setIsAdding(true);
    try {
      await fetch(`/api/portal/live/${broadcastId}/speaker-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speakerName: newName.trim(), speakerType: newType }),
      });
      setNewName("");
      onRefresh?.();
    } finally {
      setIsAdding(false);
    }
  }

  async function updateStatus(entryId: number, status: string) {
    await fetch(`/api/portal/live/${broadcastId}/speaker-queue/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onRefresh?.();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Speaker name" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <select value={newType} onChange={(e) => setNewType(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="council_member">Council</option>
          <option value="public">Public</option>
          <option value="staff">Staff</option>
          <option value="guest">Guest</option>
        </select>
        <button onClick={addSpeaker} disabled={isAdding || !newName.trim()} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Add
        </button>
      </div>
      {speakerQueue.map((entry) => (
        <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-xl border ${entry.status === "speaking" ? "bg-green-50 border-green-300" : "bg-white border-gray-200"}`}>
          <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${entry.status === "speaking" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500"}`}>
            {entry.position}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{entry.speakerName}</p>
          </div>
          <div className="flex gap-1">
            {entry.status === "waiting" && (
              <button onClick={() => updateStatus(entry.id, "speaking")} className="px-2 py-1 text-xs bg-green-600 text-white rounded">Now Speaking</button>
            )}
            {entry.status === "speaking" && (
              <button onClick={() => updateStatus(entry.id, "done")} className="px-2 py-1 text-xs bg-gray-600 text-white rounded">Done</button>
            )}
            <button onClick={() => updateStatus(entry.id, "removed")} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded">Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentsTab({ broadcastId, publicComments, onRefresh }: {
  broadcastId: number;
  publicComments: PublicComment[];
  onRefresh?: () => void;
}) {
  async function updateComment(id: number, status: string, positionInQueue?: number) {
    await fetch(`/api/portal/live/${broadcastId}/public-comments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, positionInQueue }),
    });
    onRefresh?.();
  }

  const pending = publicComments.filter((comment) => comment.status === "pending");
  const approved = publicComments.filter((comment) => comment.status === "approved");

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pending Review ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map((comment) => (
              <div key={comment.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{comment.speakerName}</p>
                <p className="text-xs text-gray-600 mb-2">{comment.topic}</p>
                <div className="flex gap-2">
                  <button onClick={() => updateComment(comment.id, "approved", approved.length + 1)} className="px-3 py-1 text-xs bg-green-600 text-white rounded">Approve</button>
                  <button onClick={() => updateComment(comment.id, "rejected")} className="px-3 py-1 text-xs bg-red-600 text-white rounded">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {approved.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Approved Queue ({approved.length})</h3>
          <div className="space-y-2">
            {approved.map((comment, index) => (
              <div key={comment.id} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs flex items-center justify-center font-bold">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{comment.speakerName}</p>
                  <p className="text-xs text-gray-500">{comment.topic}</p>
                </div>
                <button onClick={() => updateComment(comment.id, "spoken")} className="px-2 py-1 text-xs bg-gray-600 text-white rounded">Spoken</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {pending.length === 0 && approved.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-4">No public comments submitted yet</p>
      )}
    </div>
  );
}

export function LiveManagementPanel({ broadcastId, attendance, motions, speakerQueue, publicComments, onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("rollcall");

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "rollcall", label: "Roll Call" },
    { id: "motions", label: "Motions" },
    { id: "speakers", label: "Speakers" },
    { id: "comments", label: "Comments" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {activeTab === "rollcall" && <RollCallTab broadcastId={broadcastId} attendance={attendance} onRefresh={onRefresh} />}
        {activeTab === "motions" && <MotionsTab broadcastId={broadcastId} motions={motions} onRefresh={onRefresh} />}
        {activeTab === "speakers" && <SpeakersTab broadcastId={broadcastId} speakerQueue={speakerQueue} onRefresh={onRefresh} />}
        {activeTab === "comments" && <CommentsTab broadcastId={broadcastId} publicComments={publicComments} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}
