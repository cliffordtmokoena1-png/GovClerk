import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LuUsers,
  LuCalendar,
  LuPlus,
  LuPencil,
  LuTrash2,
  LuMoreVertical,
  LuMail,
  LuBriefcase,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { AddMemberDialog } from "./addMemberDialog";
import { EditMemberDialog } from "./editMemberDialog";
import { EditBoardDialog } from "./editBoardDialog";
import type { Board, BoardMember } from "@/board/types";
import { format } from "date-fns";
import {
  OrgAppBarBreadcrumb,
  type BreadcrumbItem,
} from "@/components/org-dashboard/OrgAppBarBreadcrumb";
import { useOrgAppBarTitleWithKey } from "@/components/org-dashboard/context/OrgAppBarContext";

type BoardTab = "members" | "meetings";

interface BoardDetailProps {
  board: Board;
  onBack: () => void;
  onUpdate: (board: Board) => void;
  onDelete: (boardId: string) => void;
}

function BoardBreadcrumbTitle({ items }: { items: BreadcrumbItem[] }) {
  const key = useMemo(() => items.map((i) => `${i.label}:${i.href || ""}`).join("|"), [items]);
  const breadcrumb = useMemo(() => <OrgAppBarBreadcrumb items={items} />, [items]);
  useOrgAppBarTitleWithKey(breadcrumb, key, true);
  return null;
}

interface BoardTabsProps {
  activeTab: BoardTab;
  onTabChange: (tab: BoardTab) => void;
  memberCount: number;
  meetingCount: number;
  rightContent?: React.ReactNode;
}

function BoardTabs({
  activeTab,
  onTabChange,
  memberCount,
  meetingCount,
  rightContent,
}: BoardTabsProps) {
  const tabs: { id: BoardTab; label: string; count: number; icon: React.ReactNode }[] = [
    { id: "members", label: "Members", count: memberCount, icon: <LuUsers className="w-4 h-4" /> },
    {
      id: "meetings",
      label: "Meetings",
      count: meetingCount,
      icon: <LuCalendar className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex items-center justify-between border-b border-border px-4">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
            }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      {rightContent && <div className="flex items-center gap-2">{rightContent}</div>}
    </div>
  );
}

interface MemberActionMenuProps {
  member: BoardMember;
  onEdit: () => void;
  onDelete: () => void;
}

function MemberActionMenu({ member, onEdit, onDelete }: MemberActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
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
          <div className="absolute right-0 top-full mt-1 w-40 bg-card rounded-lg shadow-lg border border-border py-1 z-20">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
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
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LuTrash2 className="w-4 h-4" />
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function getMemberInitials(member: BoardMember): string {
  if (member.firstName && member.lastName) {
    return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  }
  return member.email.substring(0, 2).toUpperCase();
}

function getMemberColor(email: string): string {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-green-500",
    "bg-orange-500",
    "bg-red-500",
    "bg-teal-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];
  const hash = email.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

interface MembersTabProps {
  members: BoardMember[];
  onAddMember: () => void;
  onEditMember: (member: BoardMember) => void;
  onDeleteMember: (memberId: string) => void;
}

function MembersTab({ members, onAddMember, onEditMember, onDeleteMember }: MembersTabProps) {
  if (members.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <LuUsers className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No members yet</p>
          <button
            type="button"
            onClick={onAddMember}
            className="inline-flex items-center gap-2 px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors"
          >
            <LuPlus className="w-4 h-4" />
            Add your first member
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="bg-card rounded-lg border border-border divide-y divide-border">
        {members.map((member) => {
          const initials = getMemberInitials(member);
          const color = getMemberColor(member.email);
          const displayName =
            member.firstName && member.lastName
              ? `${member.firstName} ${member.lastName}`
              : member.email;

          return (
            <div
              key={member.userId}
              className="flex items-center gap-4 px-4 py-4 hover:bg-muted/50 transition-colors"
            >
              <div
                className={`shrink-0 w-10 h-10 ${color} rounded-full flex items-center justify-center`}
              >
                <span className="text-white font-semibold text-sm">{initials}</span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  {member.title && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <LuBriefcase className="w-3.5 h-3.5" />
                      {member.title}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <LuMail className="w-3.5 h-3.5" />
                    {member.email}
                  </span>
                </div>
                {(member.startDate || member.endDate) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {member.startDate ? format(new Date(member.startDate), "MMM d, yyyy") : ""}
                    {member.startDate && member.endDate && " - "}
                    {member.endDate ? format(new Date(member.endDate), "MMM d, yyyy") : ""}
                  </p>
                )}
              </div>

              <div className="shrink-0">
                <MemberActionMenu
                  member={member}
                  onEdit={() => onEditMember(member)}
                  onDelete={() => {
                    if (confirm(`Remove ${displayName} from this board?`)) {
                      onDeleteMember(member.userId);
                    }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MeetingsTabProps {
  meetings: Board["meetings"];
}

function MeetingsTab({ meetings }: MeetingsTabProps) {
  if (!meetings || meetings.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <LuCalendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No meetings linked to this board</p>
          <p className="text-sm text-muted-foreground">
            Meetings will appear here when they are associated with this board.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="bg-card rounded-lg border border-border divide-y divide-border">
        {meetings.map((meeting) => {
          const meetingDate = new Date(meeting.date);
          const monthAbbrev = meetingDate.toLocaleDateString("en-US", { month: "short" });
          const day = meetingDate.getDate();

          return (
            <Link
              key={meeting.id}
              href={`/a/meetings/${meeting.id}`}
              className="flex items-center gap-4 px-4 py-4 hover:bg-muted transition-colors"
            >
              <div className="shrink-0 w-14 text-center">
                <div className="text-xs font-medium text-muted-foreground uppercase">
                  {monthAbbrev}
                </div>
                <div className="text-2xl font-bold text-muted-foreground">{day}</div>
              </div>

              <div className="w-px h-10 bg-border shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors">
                  {meeting.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {meetingDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function BoardDetail({ board, onBack, onUpdate, onDelete }: BoardDetailProps) {
  const [activeTab, setActiveTab] = useState<BoardTab>("members");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isEditBoardOpen, setIsEditBoardOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Boards", href: "/a/boards" },
    { label: board.name },
  ];

  const handleAddMember = (member: BoardMember) => {
    const updatedBoard = {
      ...board,
      members: [...board.members, member],
    };
    onUpdate(updatedBoard);
    setIsAddMemberOpen(false);
  };

  const handleUpdateMember = (updatedMember: BoardMember) => {
    const updatedBoard = {
      ...board,
      members: board.members.map((m) => (m.userId === updatedMember.userId ? updatedMember : m)),
    };
    onUpdate(updatedBoard);
    setEditingMember(null);
  };

  const handleDeleteMember = (memberId: string) => {
    const updatedBoard = {
      ...board,
      members: board.members.filter((m) => m.userId !== memberId),
    };
    onUpdate(updatedBoard);
  };

  const handleDeleteBoard = () => {
    if (confirm(`Are you sure you want to delete "${board.name}"? This action cannot be undone.`)) {
      onDelete(board.id);
      onBack();
    }
  };

  const memberCount = board.members?.length || 0;
  const meetingCount = board.meetings?.length || 0;

  const rightContent = (
    <div className="flex items-center gap-2">
      {activeTab === "members" && (
        <Button size="sm" onClick={() => setIsAddMemberOpen(true)}>
          <LuPlus className="w-4 h-4 mr-1" />
          Add Member
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setIsEditBoardOpen(true)}>
        <LuPencil className="w-4 h-4 mr-1" />
        Edit Board
      </Button>
      <Button size="sm" variant="outline" className="text-destructive" onClick={handleDeleteBoard}>
        <LuTrash2 className="w-4 h-4 mr-1" />
        Delete
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <BoardBreadcrumbTitle items={breadcrumbItems} />

      <BoardTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        memberCount={memberCount}
        meetingCount={meetingCount}
        rightContent={rightContent}
      />

      <div className="flex-1 min-h-0 overflow-auto bg-card">
        {activeTab === "members" && (
          <MembersTab
            members={board.members}
            onAddMember={() => setIsAddMemberOpen(true)}
            onEditMember={setEditingMember}
            onDeleteMember={handleDeleteMember}
          />
        )}
        {activeTab === "meetings" && <MeetingsTab meetings={board.meetings} />}
      </div>

      <AddMemberDialog
        open={isAddMemberOpen}
        onOpenChange={setIsAddMemberOpen}
        onAddMember={handleAddMember}
      />

      {editingMember && (
        <EditMemberDialog
          open
          onOpenChange={(open) => !open && setEditingMember(null)}
          member={editingMember}
          onUpdateMember={handleUpdateMember}
        />
      )}

      <EditBoardDialog
        open={isEditBoardOpen}
        onOpenChange={setIsEditBoardOpen}
        board={board}
        onUpdate={onUpdate}
      />
    </div>
  );
}
