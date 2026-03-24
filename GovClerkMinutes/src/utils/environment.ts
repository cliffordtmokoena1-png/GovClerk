export type Environment = "dev" | "prod";

export function isEnvironment(value: string): value is Environment {
  return value === "dev" || value === "prod";
}

export function assertEnvironment(value: string): Environment {
  if (!isEnvironment(value)) {
    throw new Error(`Invalid environment: ${value}`);
  }
  return value;
}
