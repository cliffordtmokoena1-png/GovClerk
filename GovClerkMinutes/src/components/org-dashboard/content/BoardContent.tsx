import useSWR from "swr";
import { BoardsList } from "@/components/board/boardsList";
import { ContentSpinner } from "./ContentSpinner";
import type { Board } from "@/board/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BoardContent() {
  const { data: boards, error, mutate } = useSWR<Board[]>("/api/org/boards", fetcher);

  const loading = !boards && !error;

  const handleAddBoard = async (board: Board) => {
    try {
      await fetch("/api/org/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(board),
      });
      mutate();
    } catch (error) {
      console.error("Failed to add board", error);
    }
  };

  const handleUpdateBoard = async (board: Board) => {
    try {
      await fetch("/api/org/boards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(board),
      });
      mutate();
    } catch (error) {
      console.error("Failed to update board", error);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await fetch(`/api/org/boards?id=${boardId}`, {
        method: "DELETE",
      });
      mutate();
    } catch (error) {
      console.error("Failed to delete board", error);
    }
  };

  if (loading) {
    return <ContentSpinner message="Loading boards..." />;
  }

  if (error) {
    return <div className="p-8">Error loading boards</div>;
  }

  return (
    <BoardsList
      boards={boards || []}
      onAddBoard={handleAddBoard}
      onUpdateBoard={handleUpdateBoard}
      onDeleteBoard={handleDeleteBoard}
    />
  );
}
