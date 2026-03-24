export default class AggregateError extends Error {
  public errors: Error[];

  constructor(errors: Error[], message?: string) {
    super(message || "Multiple errors occurred.");
    this.errors = errors;
    this.name = "AggregateError";
  }

  public toString(): string {
    return this.message + "\n\n" + this.errors.map((err) => err.message).join("\n\n");
  }
}
