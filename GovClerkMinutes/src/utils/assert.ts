export function assert(value: unknown, msg: string = "potato"): void {
  if (!value) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function assertString(value: unknown, msg: string = "bofadeez"): string {
  if (typeof value !== "string") {
    throw new Error(`String Assertion failed: ${value} - ${msg}`);
  }
  return value;
}

export function assertNumber(value: unknown, msg: string = "yeet"): number {
  if (typeof value !== "number") {
    throw new Error(`Number Assertion failed: ${msg}`);
  }
  return value;
}
