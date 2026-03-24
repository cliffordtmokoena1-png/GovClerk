import { Filter } from "./types";

export function upsertFilterRight(list: Filter[], next: Filter): Filter[] {
  const i = list.findIndex((f) => f.type === next.type);
  if (i === -1) {
    return [...list, next];
  }
  const copy = list.slice();
  copy[i] = next;
  return copy;
}

export function removeFilter(list: Filter[], type: Filter["type"]): Filter[] {
  return list.filter((f) => f.type !== type);
}

// Date <-> <input type="date">
export function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
export function fromDateInputValue(v: string): Date {
  const [y, m, d] = v.split("-").map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d);
}
