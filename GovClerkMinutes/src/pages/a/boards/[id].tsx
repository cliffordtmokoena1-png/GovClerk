import { useRouter } from "next/router";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import MgHead from "@/components/MgHead";
import { OrgDashboardLayout } from "@/components/org-dashboard/OrgDashboardLayout";
import { ContentSpinner } from "@/components/org-dashboard/content/ContentSpinner";
import { BoardDetail } from "@/components/board/boardDetail";
import { useOrgContext } from "@/contexts/OrgContext";
import type { Board } from "@/board/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BoardDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isLoaded } = useAuth();
  const { mode, orgId } = useOrgContext();

  const boardId = router.isReady ? (id as string | undefined) : undefined;

  const {
    data: boards,
    error,
    mutate,
  } = useSWR<Board[]>(boardId ? "/api/org/boards" : null, fetcher);

  const board = boards?.find((b) => b.id === boardId);
  const loading = !boards && !error;

  const handleUpdateBoard = async (updatedBoard: Board) => {
    try {
      await fetch("/api/org/boards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedBoard),
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
      router.push("/a/boards");
    } catch (error) {
      console.error("Failed to delete board", error);
    }
  };

  const handleBack = () => {
    router.push("/a/boards");
  };

  if (!isLoaded || !router.isReady || loading) {
    return (
      <>
        <MgHead title="Board Details" />
        <OrgDashboardLayout title="Board Details">
          <ContentSpinner message="Loading board details..." />
        </OrgDashboardLayout>
      </>
    );
  }

  if (mode !== "org") {
    return (
      <>
        <MgHead title="Board Details" />
        <OrgDashboardLayout title="Board Details">
          <div className="flex items-center justify-center h-full p-8 text-center text-gray-600">
            Board details are only available for organizations.
          </div>
        </OrgDashboardLayout>
      </>
    );
  }

  if (error || !board) {
    return (
      <>
        <MgHead title="Board Not Found" />
        <OrgDashboardLayout title="Board Not Found">
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <p className="text-gray-600 mb-4">
              {error ? "Failed to load board" : "Board not found"}
            </p>
            <button
              onClick={() => router.push("/a/boards")}
              className="text-blue-600 hover:underline"
            >
              Back to Boards
            </button>
          </div>
        </OrgDashboardLayout>
      </>
    );
  }

  return (
    <>
      <MgHead title={board.name} />
      <OrgDashboardLayout fullWidth>
        <BoardDetail
          board={board}
          onBack={handleBack}
          onUpdate={handleUpdateBoard}
          onDelete={handleDeleteBoard}
        />
      </OrgDashboardLayout>
    </>
  );
}
