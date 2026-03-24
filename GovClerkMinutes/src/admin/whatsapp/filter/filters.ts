import type { Filter, FilterType } from "./types";

export const SERVER_FILTERS: Record<
  FilterType,
  {
    toJSON: (value: any) => unknown;
    fromJSON: (raw: unknown) => any;
  }
> = {
  startDate: {
    toJSON: (v: Date) => v.toISOString(),
    fromJSON: (raw: unknown) => new Date(String(raw)),
  },
  endDate: {
    toJSON: (v: Date) => v.toISOString(),
    fromJSON: (raw: unknown) => new Date(String(raw)),
  },
  needsFollowup: {
    toJSON: (v: boolean) => v,
    fromJSON: (raw: unknown) => Boolean(raw),
  },
  minutesDue: {
    toJSON: (v) => v.toISOString(),
    fromJSON: (raw) => new Date(String(raw)),
  },
  recurringDueOn: {
    toJSON: (v: Date) => v.toISOString(),
    fromJSON: (raw: unknown) => new Date(String(raw)),
  },
  phone: {
    toJSON: (v: string) => String(v ?? ""),
    fromJSON: (raw: unknown) => String(raw ?? ""),
  },
  conversationId: {
    toJSON: (v: string) => String(v ?? ""),
    fromJSON: (raw: unknown) => String(raw ?? ""),
  },
  messageText: {
    toJSON: (v: string) => String(v ?? ""),
    fromJSON: (raw: unknown) => String(raw ?? ""),
  },
  messageCount: {
    toJSON: (v: { op: "<" | "<=" | "==" | ">=" | ">"; count: number }) => ({
      op: v.op,
      count: Number(v.count ?? 0),
    }),
    fromJSON: (raw: unknown) => {
      const r = raw as any;
      const allowed = ["<", "<=", "==", ">=", ">"] as const;
      const op = allowed.includes(r?.op) ? r.op : ">=";
      const count = Math.max(0, Number(r?.count ?? 0));
      return { op, count };
    },
  },
  unrepliedTo: {
    toJSON: (v: boolean) => v,
    fromJSON: (raw: unknown) => Boolean(raw),
  },
};

export function serializeFilter(filter: Filter): string {
  const def = SERVER_FILTERS[filter.type];
  return JSON.stringify({ type: filter.type, value: def.toJSON(filter.value) });
}

export function serializeFilters(filters: Filter[]): string {
  const arr = filters.map((f) => {
    const def = SERVER_FILTERS[f.type];
    return { type: f.type, value: def.toJSON(f.value) };
  });
  return JSON.stringify(arr);
}

export function deserializeFilter(serialized: string): Filter {
  const parsed = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid serialized filter");
  }
  const type = (parsed as any).type as FilterType;
  if (!type || !(type in SERVER_FILTERS)) {
    throw new Error(`Unknown filter type: ${type}`);
  }
  const def = SERVER_FILTERS[type];
  return { type, value: def.fromJSON((parsed as any).value) } as Filter;
}

export function deserializeFilters(serialized: string): Filter[] {
  if (!serialized) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const type = (item as any).type as FilterType;
    if (!type || !(type in SERVER_FILTERS)) {
      return [];
    }
    const def = SERVER_FILTERS[type];
    try {
      return [{ type, value: def.fromJSON((item as any).value) } as Filter];
    } catch {
      return [];
    }
  });
}
