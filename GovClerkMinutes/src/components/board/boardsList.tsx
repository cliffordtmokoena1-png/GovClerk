import { useState } from "react";
import { useRouter } from "next/router";
import {
  LuUsers,
  LuCalendar,
  LuPlus,
  LuChevronRight,
  LuMoreVertical,
  LuPencil,
  LuTrash2,
  LuFolder,
} from "react-icons/lu";
import { AddBoardDialog } from "./addBoardDialog";
import { EditBoardDialog } from "./editBoardDialog";
import type { Board } from "@/board/types";

interface BoardsListProps {
  boards: Board[];
  onAddBoard: (board: Board) => void;
  onUpdateBoard?: (board: Board) => void;
  onDeleteBoard?: (boardId: string) => void;
}

function getBoardInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function getBoardColor(name: string): string {
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
  const hash = name.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

interface ActionMenuProps {
  board: Board;
  onEdit: () => void;
  onDelete: () => void;
}

function ActionMenu({ board, onEdit, onDelete }: ActionMenuProps) {
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
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ onAddBoard }: { onAddBoard: () => void }) {
  return (
    <div className="text-center py-12 bg-card rounded-lg border border-border">
      <LuFolder className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
      <p className="text-muted-foreground mb-4">No boards yet</p>
      <button
        type="button"
        onClick={onAddBoard}
        className="inline-flex items-center gap-2 px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors"
      >
        <LuPlus className="w-4 h-4" />
        Create your first board
      </button>
    </div>
  );
}

export function BoardsList({ boards, onAddBoard, onUpdateBoard, onDeleteBoard }: BoardsListProps) {
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);

  const handleBoardSelect = (boardId: string) => {
    router.push(`/a/boards/${boardId}`);
  };

  const handleEditBoard = (board: Board) => {
    setEditingBoard(board);
  };

  const handleDeleteBoard = (board: Board) => {
    if (confirm(`Are you sure you want to delete "${board.name}"?`)) {
      onDeleteBoard?.(board.id);
    }
  };

  return (
    <div className="h-full p-6 bg-card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-foreground">Boards ({boards.length})</h2>
        <button
          type="button"
          onClick={() => setIsAddDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <LuPlus className="w-4 h-4" />
          Add Board
        </button>
      </div>

      {boards.length === 0 ? (
        <EmptyState onAddBoard={() => setIsAddDialogOpen(true)} />
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {boards.map((board, index) => {
            const memberCount = board.members?.length || 0;
            const meetingCount = board.meetings?.length || 0;
            const initials = getBoardInitials(board.name);
            const color = getBoardColor(board.name);

            return (
              <button
                key={board.id}
                type="button"
                className={`w-full flex items-center gap-4 px-4 py-4 hover:bg-muted transition-colors cursor-pointer text-left ${
                  index < boards.length - 1 ? "border-b border-border" : ""
                }`}
                onClick={() => handleBoardSelect(board.id)}
              >
                <div
                  className={`shrink-0 w-10 h-10 ${color} rounded-lg flex items-center justify-center`}
                >
                  <span className="text-white font-semibold text-sm">{initials}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors">
                    {board.name}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <LuUsers className="w-3.5 h-3.5" />
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <LuCalendar className="w-3.5 h-3.5" />
                      {meetingCount} meeting{meetingCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  <ActionMenu
                    board={board}
                    onEdit={() => handleEditBoard(board)}
                    onDelete={() => handleDeleteBoard(board)}
                  />
                  <LuChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AddBoardDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddBoard={onAddBoard}
      />

      {editingBoard && (
        <EditBoardDialog
          open
          onOpenChange={(open) => !open && setEditingBoard(null)}
          board={editingBoard}
          onUpdate={(updated) => {
            onUpdateBoard?.(updated);
            setEditingBoard(null);
          }}
        />
      )}
    </div>
  );
}
