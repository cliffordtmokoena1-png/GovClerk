import { useState, useCallback, useMemo } from "react";
import type { PortalArtifact } from "@/types/portal";

export interface UseDocumentSelectionOptions {
  onBuildPacket?: (selectedDocuments: PortalArtifact[]) => void;
}

export function useDocumentSelection(
  documents: PortalArtifact[],
  options: UseDocumentSelectionOptions = {}
) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { onBuildPacket } = options;

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const documentIds = new Set(documents.map((doc) => doc.id));
    setSelectedIds(documentIds);
  }, [documents]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: number) => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  const selectedCount = useMemo(() => {
    return selectedIds.size;
  }, [selectedIds]);

  const allSelected = useMemo(() => {
    return documents.length > 0 && selectedCount === documents.length;
  }, [documents.length, selectedCount]);

  const hasSelection = useMemo(() => {
    return selectedCount > 0;
  }, [selectedCount]);

  const selectedDocuments = useMemo(() => {
    return documents.filter((doc) => selectedIds.has(doc.id));
  }, [documents, selectedIds]);

  const handleBuildPacket = useCallback(() => {
    if (selectedCount === 0) {
      console.warn("No documents selected for packet creation");
      return;
    }

    if (onBuildPacket) {
      onBuildPacket(selectedDocuments);
    } else {
      // Fallback to logging for debugging
      console.info("Build Packet clicked - Selected document IDs:", Array.from(selectedIds));
      console.info("Selected documents:", selectedDocuments);
    }
  }, [selectedDocuments, selectedIds, selectedCount, onBuildPacket]);

  return {
    selectedIds,
    selectedCount,
    selectedDocuments,
    allSelected,
    hasSelection,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    handleBuildPacket,
  } as const;
}
