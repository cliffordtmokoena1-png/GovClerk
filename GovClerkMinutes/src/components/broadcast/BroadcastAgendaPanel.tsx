import React, { useState, useCallback, useMemo } from "react";
import {
  LuChevronRight,
  LuChevronDown,
  LuFileText,
  LuCheckCircle2,
  LuGavel,
  LuPlus,
  LuPencil,
  LuTrash2,
  LuCheck,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { getAgendaItemBackgroundClass, getAgendaItemTitleClass } from "@/utils/agendaStyles";
import type { MgAgendaItemWithRelations, MgMotion } from "@/types/agenda";
import type { AgendaTimestamp } from "@/types/broadcast";

function getButtonLabel(isSaving: boolean, isEditing: boolean): string {
  if (isSaving) {
    return "Saving...";
  }
  if (isEditing) {
    return "Update";
  }
  return "Add Motion";
}

type MotionFormData = {
  title: string;
  mover: string;
  seconder: string;
};

type Props = {
  items: MgAgendaItemWithRelations[];
  currentAgendaItemId: number | null;
  agendaTimestamps: AgendaTimestamp[];
  onSetCurrentItem: (itemId: number | null) => void;
  onToggleCompleted: (itemId: number, completed: boolean) => void;
  onCreateMotion: (agendaItemId: number, data: MotionFormData) => Promise<void>;
  onUpdateMotion: (agendaItemId: number, motionId: number, data: MotionFormData) => Promise<void>;
  onDeleteMotion: (agendaItemId: number, motionId: number) => Promise<void>;
  isOwner: boolean;
};

type AgendaItemRowProps = {
  item: MgAgendaItemWithRelations;
  level: number;
  currentAgendaItemId: number | null;
  completedItemIds: Set<number>;
  onSetCurrentItem: (itemId: number | null) => void;
  onToggleCompleted: (itemId: number, completed: boolean) => void;
  onCreateMotion: (agendaItemId: number, data: MotionFormData) => Promise<void>;
  onUpdateMotion: (agendaItemId: number, motionId: number, data: MotionFormData) => Promise<void>;
  onDeleteMotion: (agendaItemId: number, motionId: number) => Promise<void>;
  expandedItems: Set<number>;
  toggleExpand: (id: number) => void;
  isOwner: boolean;
};

function MotionForm({
  motion,
  onSave,
  onCancel,
  isSaving,
}: Readonly<{
  motion?: MgMotion;
  onSave: (data: MotionFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}>) {
  const [title, setTitle] = useState(motion?.title || "");
  const [mover, setMover] = useState(motion?.mover || "");
  const [seconder, setSeconder] = useState(motion?.seconder || "");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    onSave({ title: title.trim(), mover: mover.trim(), seconder: seconder.trim() });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-2 bg-orange-50 rounded border border-orange-200 space-y-2"
    >
      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Motion title *"
        className="w-full px-2 py-1.5 text-xs border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
        autoFocus
        disabled={isSaving}
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={mover}
          onChange={(event) => setMover(event.target.value)}
          placeholder="Moved by"
          className="flex-1 px-2 py-1.5 text-xs border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
          disabled={isSaving}
        />
        <input
          type="text"
          value={seconder}
          onChange={(event) => setSeconder(event.target.value)}
          placeholder="Seconded by"
          className="flex-1 px-2 py-1.5 text-xs border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
          disabled={isSaving}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || isSaving}
          className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {getButtonLabel(isSaving, Boolean(motion))}
        </button>
      </div>
    </form>
  );
}

function MotionItem({
  motion,
  onEdit,
  onDelete,
  isOwner,
}: Readonly<{
  motion: MgMotion;
  onEdit: () => void;
  onDelete: () => void;
  isOwner: boolean;
}>) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 bg-orange-50 rounded border border-orange-200 text-xs group">
      <LuGavel className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-orange-900 break-all">{motion.title}</span>
        {motion.mover && (
          <span className="text-orange-700 ml-2 break-all">
            Moved by: {motion.mover}
            {motion.seconder && `, Seconded by: ${motion.seconder}`}
          </span>
        )}
      </div>
      {isOwner && (
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            className="p-1 text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded"
            title="Edit motion"
          >
            <LuPencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded"
            title="Delete motion"
          >
            <LuTrash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function AgendaItemRow({
  item,
  level,
  currentAgendaItemId,
  completedItemIds,
  onSetCurrentItem,
  onToggleCompleted,
  onCreateMotion,
  onUpdateMotion,
  onDeleteMotion,
  expandedItems,
  toggleExpand,
  isOwner,
}: Readonly<AgendaItemRowProps>) {
  const [showMotionForm, setShowMotionForm] = useState(false);
  const [editingMotion, setEditingMotion] = useState<MgMotion | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasChildren = item.children && item.children.length > 0;
  const hasMotions = item.motions && item.motions.length > 0;
  const numericId = Number(item.id);
  const isExpanded = expandedItems.has(numericId);
  const isCurrent = currentAgendaItemId !== null && Number(currentAgendaItemId) === numericId;
  const isCompleted = completedItemIds.has(numericId);

  const handleItemClick = () => {
    if (isOwner) {
      onSetCurrentItem(isCurrent ? null : numericId);
    }
  };

  const handleCompletedToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isOwner && !isCurrent) {
      onToggleCompleted(numericId, !isCompleted);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleItemClick();
    }
  };

  const handleSaveMotion = async (data: MotionFormData) => {
    setIsSaving(true);
    try {
      if (editingMotion) {
        await onUpdateMotion(numericId, editingMotion.id, data);
      } else {
        await onCreateMotion(numericId, data);
      }
      setShowMotionForm(false);
      setEditingMotion(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMotion = async (motionId: number) => {
    if (!globalThis.confirm("Delete this motion?")) {
      return;
    }
    await onDeleteMotion(numericId, motionId);
  };

  const backgroundClass = getAgendaItemBackgroundClass(isCurrent, isCompleted);
  const titleTextClass = getAgendaItemTitleClass(isCurrent, isCompleted);
  const descriptionClass = "text-muted-foreground";

  return (
    <>
      <div
        className={`
          flex items-start gap-2 py-2 px-2 rounded-lg transition-colors
          ${backgroundClass}
          ${level > 0 ? "ml-4" : ""}
        `}
      >
        <div className="shrink-0 mt-0.5 w-5">
          {hasChildren && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpand(numericId);
              }}
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <LuChevronDown className="w-4 h-4" />
              ) : (
                <LuChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={!isOwner}
          className={`flex-1 min-w-0 text-left ${isOwner ? "cursor-pointer" : "cursor-default"}`}
          onClick={handleItemClick}
          onKeyDown={handleKeyDown}
        >
          <span className={`text-sm break-all ${titleTextClass}`}>{item.title}</span>
          {item.description && (
            <p className={`text-xs mt-1 line-clamp-2 break-all ${descriptionClass}`}>
              {item.description}
            </p>
          )}
        </button>

        {isOwner && !isCurrent && (
          <button
            type="button"
            onClick={handleCompletedToggle}
            className={`shrink-0 mt-0.5 p-0.5 rounded transition-colors ${
              isCompleted
                ? "text-green-600 hover:text-green-700"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
            title={isCompleted ? "Mark as not completed" : "Mark as completed"}
          >
            {isCompleted ? <LuCheckCircle2 className="w-4 h-4" /> : <LuCheck className="w-4 h-4" />}
          </button>
        )}
      </div>

      {(hasMotions || showMotionForm || editingMotion) && (
        <div className={`space-y-1 mt-1 ${level > 0 ? "ml-4" : ""} ml-7`}>
          {item.motions?.map((motion) =>
            editingMotion?.id === motion.id ? (
              <MotionForm
                key={motion.id}
                motion={motion}
                onSave={handleSaveMotion}
                onCancel={() => setEditingMotion(null)}
                isSaving={isSaving}
              />
            ) : (
              <MotionItem
                key={motion.id}
                motion={motion}
                onEdit={() => setEditingMotion(motion)}
                onDelete={() => handleDeleteMotion(motion.id)}
                isOwner={isOwner}
              />
            )
          )}
          {showMotionForm && !editingMotion && (
            <MotionForm
              onSave={handleSaveMotion}
              onCancel={() => setShowMotionForm(false)}
              isSaving={isSaving}
            />
          )}
        </div>
      )}

      {isOwner && !showMotionForm && !editingMotion && (
        <div className={`mt-1 ${level > 0 ? "ml-4" : ""} ml-7`}>
          <button
            type="button"
            onClick={() => setShowMotionForm(true)}
            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 py-1"
          >
            <LuPlus className="w-3 h-3" />
            <span>Add Motion</span>
          </button>
        </div>
      )}

      {hasChildren && isExpanded && (
        <div className="mt-1">
          {item.children!.map((child) => (
            <AgendaItemRow
              key={child.id}
              item={child}
              level={level + 1}
              currentAgendaItemId={currentAgendaItemId}
              completedItemIds={completedItemIds}
              onSetCurrentItem={onSetCurrentItem}
              onToggleCompleted={onToggleCompleted}
              onCreateMotion={onCreateMotion}
              onUpdateMotion={onUpdateMotion}
              onDeleteMotion={onDeleteMotion}
              expandedItems={expandedItems}
              toggleExpand={toggleExpand}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function BroadcastAgendaPanel({
  items,
  currentAgendaItemId,
  agendaTimestamps,
  onSetCurrentItem,
  onToggleCompleted,
  onCreateMotion,
  onUpdateMotion,
  onDeleteMotion,
  isOwner,
}: Readonly<Props>) {
  const completedItemIds = useMemo(() => {
    const completed = new Set<number>();
    for (const ts of agendaTimestamps) {
      if (Number(ts.agendaItemId) !== Number(currentAgendaItemId)) {
        completed.add(Number(ts.agendaItemId));
      }
    }
    return completed;
  }, [agendaTimestamps, currentAgendaItemId]);

  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    items.forEach((item) => initial.add(Number(item.id)));
    return initial;
  });

  const toggleExpand = useCallback((itemId: number) => {
    const numericId = Number(itemId);
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(numericId)) {
        next.delete(numericId);
      } else {
        next.add(numericId);
      }
      return next;
    });
  }, []);

  const flatItems = useMemo(() => {
    const result: MgAgendaItemWithRelations[] = [];
    const flatten = (itemList: MgAgendaItemWithRelations[]) => {
      for (const item of itemList) {
        result.push(item);
        if (item.children && item.children.length > 0) {
          flatten(item.children);
        }
      }
    };
    flatten(items);
    return result;
  }, [items]);

  const currentIndex = useMemo(() => {
    if (!currentAgendaItemId) {
      return -1;
    }
    return flatItems.findIndex((item) => Number(item.id) === Number(currentAgendaItemId));
  }, [flatItems, currentAgendaItemId]);

  const handlePrevious = useCallback(() => {
    if (currentIndex <= 0) {
      return;
    }
    const prevItem = flatItems[currentIndex - 1];
    if (prevItem) {
      onSetCurrentItem(Number(prevItem.id));
    }
  }, [currentIndex, flatItems, onSetCurrentItem]);

  const handleNext = useCallback(() => {
    if (currentIndex === -1) {
      const firstItem = flatItems[0];
      if (firstItem) {
        onSetCurrentItem(Number(firstItem.id));
      }
      return;
    }
    if (currentIndex >= flatItems.length - 1) {
      return;
    }
    const nextItem = flatItems[currentIndex + 1];
    if (nextItem) {
      onSetCurrentItem(Number(nextItem.id));
    }
  }, [currentIndex, flatItems, onSetCurrentItem]);

  const completedCount = completedItemIds.size;
  const totalCount = flatItems.length;

  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <LuFileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-foreground text-sm">Agenda</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
              <LuFileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-1">No agenda items yet</p>
            <p className="text-muted-foreground/70 text-xs">
              Add agenda items to track meeting topics
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LuFileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-foreground text-sm">Agenda</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {completedCount > 0 && (
            <span className="text-green-600 font-medium">{completedCount} done</span>
          )}
          {currentAgendaItemId && (
            <span className="text-primary font-medium">
              {currentIndex + 1} / {totalCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <div className="space-y-1">
          {items.map((item) => (
            <AgendaItemRow
              key={item.id}
              item={item}
              level={0}
              currentAgendaItemId={currentAgendaItemId}
              completedItemIds={completedItemIds}
              onSetCurrentItem={onSetCurrentItem}
              onToggleCompleted={onToggleCompleted}
              onCreateMotion={onCreateMotion}
              onUpdateMotion={onUpdateMotion}
              onDeleteMotion={onDeleteMotion}
              expandedItems={expandedItems}
              toggleExpand={toggleExpand}
              isOwner={isOwner}
            />
          ))}
        </div>
      </div>

      {isOwner && (
        <div className="p-3 border-t border-border flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePrevious}
            disabled={currentIndex <= 0}
            className="flex-1"
          >
            Previous
          </Button>
          <Button
            type="button"
            onClick={handleNext}
            disabled={currentIndex >= flatItems.length - 1}
            className="flex-1"
          >
            Next Item
          </Button>
        </div>
      )}
    </div>
  );
}
