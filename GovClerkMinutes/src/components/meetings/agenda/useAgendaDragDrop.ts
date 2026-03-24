import { useState, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import { flattenTree } from "@/hooks/portal/useAgenda";
import { MAX_NESTING_LEVEL } from "@/utils/agendaFormatting";

interface UseAgendaDragDropProps {
  items: MgAgendaItemWithRelations[];
  displayTree: MgAgendaItemWithRelations[];
  tree: MgAgendaItemWithRelations[];
  reorderItems: (
    items: { id: number; parent_id: number | null; ordinal: number }[]
  ) => Promise<unknown>;
  setLocalTree: (tree: MgAgendaItemWithRelations[]) => void;
  setIsReordering: (isReordering: boolean) => void;
}

interface UseAgendaDragDropReturn {
  draggedItemId: number | null;
  dragOverItemId: number | null;
  dropAsChild: boolean;
  handleDragStart: (e: React.DragEvent, itemId: number) => void;
  handleDragEnd: () => void;
  handleDragEnter: (e: React.DragEvent, itemId: number) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent, itemId: number) => void;
  handleDrop: (e: React.DragEvent, targetItemId: number) => Promise<void>;
}

const cloneTree = (treeItems: MgAgendaItemWithRelations[]): MgAgendaItemWithRelations[] => {
  return treeItems.map((item) => ({
    ...item,
    children: item.children ? cloneTree(item.children) : [],
  }));
};

const getItemLevelFromTree = (
  itemId: number,
  treeItems: MgAgendaItemWithRelations[],
  level = 0
): number => {
  for (const item of treeItems) {
    if (item.id === itemId) {
      return level;
    }
    if (item.children && item.children.length > 0) {
      const found = getItemLevelFromTree(itemId, item.children, level + 1);
      if (found !== -1) {
        return found;
      }
    }
  }
  return -1;
};

export const useAgendaDragDrop = ({
  items,
  displayTree,
  tree,
  reorderItems,
  setLocalTree,
  setIsReordering,
}: UseAgendaDragDropProps): UseAgendaDragDropReturn => {
  const toast = useToast();
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<number | null>(null);
  const [dropAsChild, setDropAsChild] = useState(false);
  const dragCounter = useRef(0);
  const draggedElementRef = useRef<HTMLElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, itemId: number) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId.toString());
    const element = e.currentTarget as HTMLElement;
    draggedElementRef.current = element;
    requestAnimationFrame(() => {
      element?.classList?.add("opacity-50");
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedElementRef.current) {
      draggedElementRef.current.classList.remove("opacity-50");
    }
    draggedElementRef.current = null;
    setDraggedItemId(null);
    setDragOverItemId(null);
    setDropAsChild(false);
    dragCounter.current = 0;
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent, itemId: number) => {
      e.preventDefault();
      dragCounter.current++;
      if (itemId !== draggedItemId) {
        setDragOverItemId(itemId);
      }
    },
    [draggedItemId]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverItemId(null);
      setDropAsChild(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, itemId: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const isLowerHalf = y > rect.height * 0.6;

      if (isLowerHalf && draggedItemId) {
        const targetLevel = getItemLevelFromTree(itemId, tree);
        if (targetLevel < MAX_NESTING_LEVEL - 1) {
          setDropAsChild(true);
        } else {
          setDropAsChild(false);
        }
      } else {
        setDropAsChild(false);
      }
    },
    [draggedItemId, tree]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetItemId: number) => {
      e.preventDefault();
      setDragOverItemId(null);
      dragCounter.current = 0;

      if (!draggedItemId || draggedItemId === targetItemId) {
        setDropAsChild(false);
        return;
      }

      const draggedItem = items.find((i) => i.id === draggedItemId);
      const targetItem = items.find((i) => i.id === targetItemId);
      if (!draggedItem || !targetItem) {
        setDropAsChild(false);
        return;
      }

      const previousTree = cloneTree(displayTree);
      const currentTree = cloneTree(displayTree);

      const removeFromTree = (
        treeItems: MgAgendaItemWithRelations[],
        id: number
      ): MgAgendaItemWithRelations | null => {
        for (let i = 0; i < treeItems.length; i++) {
          if (treeItems[i].id === id) {
            const [removed] = treeItems.splice(i, 1);
            return removed;
          }
          if (treeItems[i].children && treeItems[i].children!.length > 0) {
            const found = removeFromTree(treeItems[i].children!, id);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };

      const findInTree = (
        treeItems: MgAgendaItemWithRelations[],
        id: number
      ): MgAgendaItemWithRelations | null => {
        for (const item of treeItems) {
          if (item.id === id) {
            return item;
          }
          if (item.children && item.children.length > 0) {
            const found = findInTree(item.children, id);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };

      const findParentAndIndex = (
        treeItems: MgAgendaItemWithRelations[],
        id: number,
        parent: MgAgendaItemWithRelations | null = null
      ): { parent: MgAgendaItemWithRelations | null; index: number } | null => {
        for (let i = 0; i < treeItems.length; i++) {
          if (treeItems[i].id === id) {
            return { parent, index: i };
          }
          if (treeItems[i].children && treeItems[i].children!.length > 0) {
            const found = findParentAndIndex(treeItems[i].children!, id, treeItems[i]);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };

      const removedItem = removeFromTree(currentTree, draggedItemId);
      if (!removedItem) {
        setDropAsChild(false);
        return;
      }

      removedItem.children = removedItem.children || [];

      if (dropAsChild) {
        const targetNode = findInTree(currentTree, targetItemId);
        if (targetNode) {
          targetNode.children = targetNode.children || [];
          targetNode.children.push(removedItem);
        }
      } else {
        const targetLocation = findParentAndIndex(currentTree, targetItemId);
        if (targetLocation) {
          const siblings = targetLocation.parent ? targetLocation.parent.children! : currentTree;
          siblings.splice(targetLocation.index + 1, 0, removedItem);
        }
      }

      setIsReordering(true);
      setLocalTree(currentTree);

      const flattenedUpdates = flattenTree(currentTree);

      try {
        await reorderItems(flattenedUpdates);
      } catch (error) {
        console.error("Failed to reorder items:", error);
        setLocalTree(previousTree);
        toast({
          title: "Reorder failed",
          description: "Failed to save the new order. Changes have been reverted.",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setIsReordering(false);
      }

      setDraggedItemId(null);
      setDropAsChild(false);
    },
    [
      draggedItemId,
      dropAsChild,
      items,
      displayTree,
      reorderItems,
      setLocalTree,
      setIsReordering,
      toast,
    ]
  );

  return {
    draggedItemId,
    dragOverItemId,
    dropAsChild,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
};
