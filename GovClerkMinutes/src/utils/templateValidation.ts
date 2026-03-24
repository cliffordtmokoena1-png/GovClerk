/**
 * Shared validation logic for template file uploads
 */

export const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
} as const;

export const MAX_FILES = 10;
export const MIN_FILES = 1;
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per file

export interface ValidationResult {
  validFiles: File[];
  rejectedFiles: File[];
  rejectedNames: string[];
  error?: string;
}

/**
 * Validates uploaded template files
 * @param files - Array of files to validate
 * @returns Validation result with valid and rejected files
 */
export function validateTemplateFiles(files: File[]): ValidationResult {
  const validFiles: File[] = [];
  const rejectedFiles: File[] = [];
  const invalidTypeNames: string[] = [];
  const oversizedNames: string[] = [];

  // Check file count
  if (files.length < MIN_FILES) {
    return {
      validFiles: [],
      rejectedFiles: files,
      rejectedNames: files.map((file) => file.name),
      error: `Please upload at least ${MIN_FILES} file`,
    };
  }

  if (files.length > MAX_FILES) {
    return {
      validFiles: [],
      rejectedFiles: files,
      rejectedNames: files.map((file) => file.name),
      error: `Maximum ${MAX_FILES} files allowed`,
    };
  }

  // Validate file types
  const acceptedTypes = Object.keys(ACCEPTED_FILE_TYPES);

  for (const file of files) {
    const isAcceptedType = acceptedTypes.includes(file.type);
    const isWithinSizeLimit = file.size <= MAX_FILE_SIZE_BYTES;

    if (isAcceptedType && isWithinSizeLimit) {
      validFiles.push(file);
    } else {
      rejectedFiles.push(file);
      if (!isAcceptedType) {
        invalidTypeNames.push(file.name);
      }
      if (!isWithinSizeLimit) {
        oversizedNames.push(file.name);
      }
    }
  }

  return {
    validFiles,
    rejectedFiles,
    rejectedNames: rejectedFiles.map((file) => file.name),
    error:
      rejectedFiles.length > 0 ? buildErrorMessage(invalidTypeNames, oversizedNames) : undefined,
  };
}

function buildErrorMessage(invalidTypeNames: string[], oversizedNames: string[]): string {
  const messages: string[] = [];

  if (invalidTypeNames.length > 0) {
    messages.push(
      "Unsupported file types: " + invalidTypeNames.map((name) => `"${name}"`).join(", ")
    );
  }

  if (oversizedNames.length > 0) {
    messages.push(
      "Files exceed 20 MB limit: " + oversizedNames.map((name) => `"${name}"`).join(", ")
    );
  }

  return messages.join("; ");
}

/**
 * Formats file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
