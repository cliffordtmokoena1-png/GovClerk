"use client";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import useSWR, { mutate as globalMutate } from "swr";

import type {
  MgAgendaItem,
  MgAgendaItemWithRelations,
  MgAgendaWithItems,
  CreateAgendaItemInput,
  UpdateAgendaItemInput,
  ReorderAgendaItemsInput,
  GeneratedAgendaItem,
} from "@/types/agenda";
import type { PortalArtifact } from "@/types/portal";
import { useOrgContext } from "@/contexts/OrgContext";

export function buildTree(items: MgAgendaItem[]): MgAgendaItemWithRelations[] {
  const itemMap = new Map<number, MgAgendaItemWithRelations>();
  const rootItems: MgAgendaItemWithRelations[] = [];

  // First pass: create map of all items with children array
  for (const item of items) {
    itemMap.set(item.id, { ...item, children: [] });
  }

  // Second pass: build tree structure
  for (const item of items) {
    const node = itemMap.get(item.id)!;
    if (item.parent_id === null) {
      rootItems.push(node);
    } else {
      const parent = itemMap.get(item.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        // Orphaned item, treat as root
        rootItems.push(node);
      }
    }
  }

  // Sort by ordinal at each level
  const sortByOrdinal = (items: MgAgendaItemWithRelations[]) => {
    items.sort((a, b) => a.ordinal - b.ordinal);
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        sortByOrdinal(item.children);
      }
    }
  };

  sortByOrdinal(rootItems);
  return rootItems;
}

export function flattenTree(
  tree: MgAgendaItemWithRelations[]
): Array<{ id: number; ordinal: number; parent_id: number | null }> {
  const result: Array<{ id: number; ordinal: number; parent_id: number | null }> = [];

  const traverse = (items: MgAgendaItemWithRelations[], parentId: number | null) => {
    items.forEach((item, index) => {
      result.push({
        id: item.id,
        ordinal: index + 1,
        parent_id: parentId,
      });
      if (item.children && item.children.length > 0) {
        traverse(item.children, item.id);
      }
    });
  };

  traverse(tree, null);
  return result;
}

export function getItemLevel(items: MgAgendaItem[], itemId: number): number {
  const item = items.find((i) => i.id === itemId);
  if (!item || item.parent_id === null) {
    return 0;
  }
  return 1 + getItemLevel(items, item.parent_id);
}

export function getMaxOrdinal(items: MgAgendaItem[], parentId: number | null): number {
  const siblings = items.filter((i) => i.parent_id === parentId);
  if (siblings.length === 0) {
    return 0;
  }
  return Math.max(...siblings.map((i) => i.ordinal));
}

interface AgendaResponse {
  agenda: MgAgendaWithItems;
}

interface AgendaItemResponse {
  item: MgAgendaItem;
}

interface AttachArtifactResponse {
  artifact: PortalArtifact;
  uploadUrl?: string;
}

interface GenerateAgendaResponse {
  items: GeneratedAgendaItem[];
}

interface ExportAgendaResponse {
  artifact: PortalArtifact;
  downloadUrl: string;
}

const fetcher = async (url: string): Promise<AgendaResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch agenda");
  }
  return response.json();
};

export function useAgenda(meetingId: number | null) {
  const { orgId } = useOrgContext();

  const url = meetingId && orgId ? `/api/portal/meetings/${meetingId}/agenda?orgId=${orgId}` : null;

  const { data, error, isLoading, mutate } = useSWR<AgendaResponse>(url, fetcher, {
    revalidateOnFocus: false,
  });

  // Track if agenda has been successfully generated (has items)
  const hasGeneratedAgenda =
    data && data.agenda && data.agenda.items && data.agenda.items.length > 0;

  const createItem = useCallback(
    async (
      input: Omit<CreateAgendaItemInput, "org_id" | "agenda_id"> & { parent_id?: number | null }
    ): Promise<MgAgendaItem> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }

      const response = await fetch(`/api/portal/meetings/${meetingId}/agenda-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to create agenda item";
        toast.error(message);
        throw new Error(message);
      }

      const result: AgendaItemResponse = await response.json();
      await mutate();
      toast.success("Agenda item created");
      return result.item;
    },
    [meetingId, orgId, mutate]
  );

  const updateItem = useCallback(
    async (itemId: number, input: UpdateAgendaItemInput): Promise<MgAgendaItem> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }

      const response = await fetch(`/api/portal/meetings/${meetingId}/agenda-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, itemId, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to update agenda item";
        toast.error(message);
        throw new Error(message);
      }

      const result: AgendaItemResponse = await response.json();
      await mutate();
      toast.success("Agenda item updated");
      return result.item;
    },
    [meetingId, orgId, mutate]
  );

  const deleteItem = useCallback(
    async (itemId: number): Promise<void> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }

      const response = await fetch(`/api/portal/meetings/${meetingId}/agenda-items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to delete agenda item";
        toast.error(message);
        throw new Error(message);
      }

      await mutate();
      toast.success("Agenda item deleted");
    },
    [meetingId, orgId, mutate]
  );

  const reorderItems = useCallback(
    async (items: ReorderAgendaItemsInput["items"]): Promise<MgAgendaWithItems> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }

      const response = await fetch(`/api/portal/meetings/${meetingId}/agenda`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to reorder agenda items";
        toast.error(message);
        throw new Error(message);
      }

      const result: AgendaResponse = await response.json();
      await mutate();
      toast.success("Agenda items reordered");
      return result.agenda;
    },
    [meetingId, orgId, mutate]
  );

  const attachArtifact = useCallback(
    async (itemId: number, artifactId: number): Promise<PortalArtifact> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }

      const response = await fetch(
        `/api/portal/meetings/${meetingId}/agenda-items/${itemId}/artifacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifactId, orgId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to attach artifact";
        toast.error(message);
        throw new Error(message);
      }

      const result: AttachArtifactResponse = await response.json();
      await mutate();
      toast.success("Document attached");
      return result.artifact;
    },
    [meetingId, orgId, mutate]
  );

  const detachArtifact = useCallback(
    async (itemId: number, artifactId: number): Promise<void> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }

      const response = await fetch(
        `/api/portal/meetings/${meetingId}/agenda-items/${itemId}/artifacts`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifactId, orgId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to detach artifact";
        toast.error(message);
        throw new Error(message);
      }

      await mutate();
      toast.success("Document detached");
    },
    [meetingId, orgId, mutate]
  );

  const uploadAndAttachArtifact = useCallback(
    async (itemId: number, file: File): Promise<PortalArtifact> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }

      // Step 1: Get presigned URL via the presign endpoint (Node.js runtime)
      const presignResponse = await fetch("/api/portal/artifacts/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meetingId.toString(),
          artifactType: "agenda_packet",
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || undefined,
          orgId,
        }),
      });

      if (!presignResponse.ok) {
        const errorData = await presignResponse.json().catch(() => ({}));
        const message = errorData.error || "Failed to get upload URL";
        toast.error(message);
        throw new Error(message);
      }

      const { artifact, uploadUrl } = (await presignResponse.json()) as AttachArtifactResponse;

      if (!uploadUrl) {
        throw new Error("No upload URL returned");
      }

      // Step 2: Upload file to S3 using XHR for consistency with other upload flows
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.onabort = () => reject(new Error("Upload aborted"));

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      // Step 3: Link the uploaded artifact to the agenda item
      const linkResponse = await fetch(
        `/api/portal/meetings/${meetingId}/agenda-items/${itemId}/artifacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifactId: artifact.id, orgId }),
        }
      );

      if (!linkResponse.ok) {
        const errorData = await linkResponse.json().catch(() => ({}));
        const message = errorData.error || "Failed to attach artifact to agenda item";
        toast.error(message);
        throw new Error(message);
      }

      await mutate();

      // Also mutate the meeting documents cache so Documents tab shows the new document
      if (orgId) {
        await globalMutate(`/api/portal/meetings/${meetingId}?orgId=${orgId}`);
      }

      toast.success(`${file.name} has been uploaded and attached.`);

      return artifact;
    },
    [meetingId, orgId, mutate]
  );

  const generateAgenda = useCallback(
    async (context: string): Promise<GeneratedAgendaItem[]> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }

      const response = await fetch(`/api/portal/meetings/${meetingId}/generate-agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, orgId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to generate agenda";
        toast.error(message);
        throw new Error(message);
      }

      const result: GenerateAgendaResponse = await response.json();
      // Refresh agenda data since backend already inserted the items
      await mutate();
      return result.items;
    },
    [meetingId, orgId, mutate]
  );

  const exportAgendaToArtifact = useCallback(
    async (
      meetingTitle: string,
      meetingDate: string,
      tree: MgAgendaItemWithRelations[]
    ): Promise<ExportAgendaResponse> => {
      if (!meetingId) {
        throw new Error("Meeting ID is required");
      }

      const response = await fetch(`/api/portal/meetings/${meetingId}/export-agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingTitle,
          meetingDate,
          tree,
          orgId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || "Failed to export agenda";
        toast.error(message);
        throw new Error(message);
      }

      const result: ExportAgendaResponse = await response.json();

      // Also mutate the meeting documents cache so Documents tab shows the new document
      if (orgId) {
        await globalMutate(`/api/portal/meetings/${meetingId}?orgId=${orgId}`);
      }

      toast.success("Agenda has been saved to Documents.");

      return result;
    },
    [meetingId, orgId]
  );

  const items = useMemo(() => data?.agenda?.items ?? [], [data?.agenda?.items]);
  const tree = useMemo(() => buildTree(items), [items]);

  return {
    agenda: data?.agenda ?? null,
    items,
    tree,
    isLoading,
    error,
    mutate,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    attachArtifact,
    detachArtifact,
    uploadAndAttachArtifact,
    generateAgenda,
    exportAgendaToArtifact,
    hasGeneratedAgenda,
  } as const;
}
