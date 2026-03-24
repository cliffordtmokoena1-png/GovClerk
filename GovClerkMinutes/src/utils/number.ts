export function strictParseInt(value: unknown, msg: string = "sugondeez"): number {
  if (typeof value === "number") {
    return value;
  }
  try {
    const maybeNumber = parseInt(value as string);
    if (isNaN(maybeNumber)) {
      throw new Error("not a number");
    }
    if (maybeNumber.toString() !== (value as string)) {
      throw new Error("not an integer");
    }
    return maybeNumber;
  } catch (e) {
    throw new Error(`Number Assertion failed: ${msg} ${e}`);
  }
}
