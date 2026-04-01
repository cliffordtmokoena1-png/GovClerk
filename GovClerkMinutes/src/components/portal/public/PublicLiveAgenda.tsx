import { useEffect, useRef } from "react";

type AgendaItem = {
  id: number;
  title: string;
  ordinal: number;
  isSection: boolean;
  parent_id: number | null;
  children?: AgendaItem[];
};

type Props = {
  agenda: AgendaItem[];
  currentAgendaItemId: number | null;
};

function AgendaItemRow({
  item,
  currentAgendaItemId,
  depth,
}: {
  item: AgendaItem;
  currentAgendaItemId: number | null;
  depth: number;
}) {
  const isCurrent = item.id === currentAgendaItemId;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCurrent && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isCurrent]);

  return (
    <>
      <div
        ref={ref}
        className={`flex items-start gap-2 px-3 py-2 rounded-lg transition-colors ${
          isCurrent
            ? "bg-blue-50 border border-blue-200"
            : item.isSection
            ? "bg-gray-50"
            : "hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {isCurrent && (
          <span className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        )}
        <span
          className={`text-sm leading-snug ${
            item.isSection ? "font-semibold text-gray-700" : "text-gray-600"
          } ${isCurrent ? "text-blue-700 font-medium" : ""}`}
        >
          {item.title}
        </span>
        {isCurrent && (
          <span className="ml-auto shrink-0 text-xs text-blue-600 font-medium">Now</span>
        )}
      </div>
      {item.children?.map((child) => (
        <AgendaItemRow
          key={child.id}
          item={child}
          currentAgendaItemId={currentAgendaItemId}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

export function PublicLiveAgenda({ agenda, currentAgendaItemId }: Props) {
  if (agenda.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        No agenda items available
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {agenda.map((item) => (
        <AgendaItemRow
          key={item.id}
          item={item}
          currentAgendaItemId={currentAgendaItemId}
          depth={0}
        />
      ))}
    </div>
  );
}
