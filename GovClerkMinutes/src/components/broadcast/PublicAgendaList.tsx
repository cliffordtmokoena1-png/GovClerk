import React, { useState, useCallback, useMemo } from "react";
import { LuChevronRight, LuChevronDown, LuCheckCircle2, LuGavel, LuCheck } from "react-icons/lu";
import { getAgendaItemBackgroundClass, getAgendaItemTitleClass } from "@/utils/agendaStyles";
import type { MgAgendaItemWithRelations, MgMotion } from "@/types/agenda";

type AgendaItemComponentProps = {
  item: MgAgendaItemWithRelations;
  currentAgendaItemId: number | null;
  completedItemIds: Set<number>;
  expandedItems: Set<number>;
  toggleExpand: (itemId: number) => void;
  level: number;
};

function AgendaItemComponent({
  item,
  currentAgendaItemId,
  completedItemIds,
  expandedItems,
  toggleExpand,
  level,
}: Readonly<AgendaItemComponentProps>) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const isCurrent = currentAgendaItemId === item.id;
  const isCompleted = completedItemIds.has(item.id);

  const bgClass = getAgendaItemBackgroundClass(isCurrent, isCompleted);
  const titleClass = getAgendaItemTitleClass(isCurrent, isCompleted);

  const paddingLeft = level > 0 ? `${level * 16}px` : undefined;

  return (
    <>
      <div
        className={`flex items-start gap-2 py-2.5 px-3 transition-colors ${bgClass}`}
        style={{ paddingLeft }}
      >
        <div className="shrink-0 mt-0.5">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(item.id)}
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <LuChevronDown className="w-4 h-4" />
              ) : (
                <LuChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}
        </div>

        <div className="shrink-0 mt-0.5">
          {isCurrent && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <LuCheck className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
          {!isCurrent && isCompleted && <LuCheckCircle2 className="w-5 h-5 text-green-600" />}
          {!isCurrent && !isCompleted && <div className="w-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <span className={`text-sm ${titleClass} wrap-break-word`}>{item.title}</span>
          {item.description && (isCurrent || isCompleted) && (
            <p className="text-xs text-muted-foreground mt-1 wrap-break-word">{item.description}</p>
          )}

          {item.motions && item.motions.length > 0 && (
            <div className="mt-2 space-y-1">
              {item.motions.map((motion: MgMotion) => (
                <div
                  key={motion.id}
                  className="flex items-start gap-2 py-1.5 px-2 bg-orange-50 rounded border border-orange-200 text-xs"
                >
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <>
          {item.children!.map((child) => (
            <AgendaItemComponent
              key={child.id}
              item={child}
              currentAgendaItemId={currentAgendaItemId}
              completedItemIds={completedItemIds}
              expandedItems={expandedItems}
              toggleExpand={toggleExpand}
              level={level + 1}
            />
          ))}
        </>
      )}
    </>
  );
}

type Props = {
  items: MgAgendaItemWithRelations[];
  currentAgendaItemId: number | null;
  completedItemIds?: Set<number>;
};

export function PublicAgendaList({
  items,
  currentAgendaItemId,
  completedItemIds,
}: Readonly<Props>) {
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

  const completed = useMemo(() => {
    return completedItemIds || new Set<number>();
  }, [completedItemIds]);

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No agenda items</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <AgendaItemComponent
          key={item.id}
          item={item}
          currentAgendaItemId={currentAgendaItemId}
          completedItemIds={completed}
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
          level={0}
        />
      ))}
    </div>
  );
}
