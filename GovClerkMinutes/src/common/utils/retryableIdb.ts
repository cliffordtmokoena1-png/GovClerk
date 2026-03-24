import { openDB as originalOpenDB } from "idb";

function isRetriableError(error: any): boolean {
  if (!error) {
    return false;
  }

  const errorName = error.name || "";
  const retriableErrors = [
    "QuotaExceededError",
    "InvalidStateError",
    "TransactionInactiveError",
    "AbortError",
    "UnknownError",
  ];

  return (
    retriableErrors.includes(errorName) ||
    error.message?.toLowerCase().includes("database locked") ||
    error.message?.toLowerCase().includes("quota exceeded")
  );
}

export const openDB: typeof originalOpenDB = async (...args) => {
  const maxRetries = 3;
  const delayMs = 200;
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await originalOpenDB(...args);
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isRetriableError(error)) {
        break;
      }

      console.warn(`IndexedDB openDB failed (attempt ${attempt + 1}), retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.error(`IndexedDB openDB failed after ${maxRetries + 1} attempts:`, lastError);
  throw lastError;
};
