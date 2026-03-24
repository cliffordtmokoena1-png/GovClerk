import stc from "string-to-color";
export function colorFromString(s: string): string {
  return stc(s);
}
