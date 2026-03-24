/**
 * Standardized toast message patterns for consistent UI messaging.
 * Use these constants throughout the application to ensure consistent
 * toast titles and descriptions.
 */

/** Toast message configuration */
export interface ToastMessage {
  readonly title: string;
  readonly description?: string;
}

/**
 * Error toast messages
 */
export const TOAST_ERROR = {
  /** Generic error */
  GENERIC: { title: "Error", description: "An error occurred" } as ToastMessage,
  /** Authentication errors */
  UNAUTHORIZED: {
    title: "Unauthorized",
    description: "Please sign in to continue",
  } as ToastMessage,
  /** Network/fetch errors */
  NETWORK: {
    title: "Connection Error",
    description: "Failed to connect to the server",
  } as ToastMessage,
  /** Validation errors */
  VALIDATION: { title: "Validation Error", description: "Please check your input" } as ToastMessage,
  /** File operation errors */
  FILE_UPLOAD: { title: "Upload Failed", description: "Failed to upload file" } as ToastMessage,
  FILE_DELETE: { title: "Delete Failed", description: "Failed to delete file" } as ToastMessage,
  /** Document errors */
  DOCUMENT_LOAD: { title: "Error", description: "Failed to load document" } as ToastMessage,
  DOCUMENT_SAVE: { title: "Error", description: "Failed to save document" } as ToastMessage,
  DOCUMENT_DELETE: { title: "Error", description: "Failed to delete document" } as ToastMessage,
  /** Meeting errors */
  MEETING_CREATE: { title: "Error", description: "Failed to create meeting" } as ToastMessage,
  MEETING_UPDATE: { title: "Error", description: "Failed to update meeting" } as ToastMessage,
  MEETING_DELETE: { title: "Error", description: "Failed to delete meeting" } as ToastMessage,
  /** Packet errors */
  PACKET_CREATE: { title: "Failed to create packet" } as ToastMessage,
} as const;

/**
 * Success toast messages
 */
export const TOAST_SUCCESS = {
  /** Generic success */
  GENERIC: { title: "Success", description: "Operation completed successfully" } as ToastMessage,
  /** Save operations */
  SAVED: { title: "Saved", description: "Changes saved successfully" } as ToastMessage,
  /** Create operations */
  CREATED: { title: "Created", description: "Successfully created" } as ToastMessage,
  /** Update operations */
  UPDATED: { title: "Updated", description: "Successfully updated" } as ToastMessage,
  /** Delete operations */
  DELETED: { title: "Deleted", description: "Successfully deleted" } as ToastMessage,
  /** Document operations */
  DOCUMENT_UPLOADED: {
    title: "Document uploaded",
    description: "Document has been uploaded",
  } as ToastMessage,
  DOCUMENT_DELETED: { title: "Document deleted" } as ToastMessage,
  /** Meeting operations */
  MEETING_CREATED: {
    title: "Meeting created",
    description: "Meeting has been created",
  } as ToastMessage,
  MEETING_UPDATED: {
    title: "Meeting updated",
    description: "Meeting has been updated",
  } as ToastMessage,
  /** Packet operations */
  PACKET_CREATED: { title: "Packet created successfully" } as ToastMessage,
  /** Visibility toggle */
  VISIBILITY_PUBLIC: { title: "Document is now public" } as ToastMessage,
  VISIBILITY_INTERNAL: { title: "Document is now internal" } as ToastMessage,
} as const;

/**
 * Warning toast messages
 */
export const TOAST_WARNING = {
  /** Generic warning */
  GENERIC: { title: "Warning" } as ToastMessage,
  /** Unsaved changes */
  UNSAVED_CHANGES: {
    title: "Unsaved Changes",
    description: "You have unsaved changes",
  } as ToastMessage,
  /** Non-PDF documents */
  NON_PDF_DOCUMENTS: { title: "Non-PDF documents detected" } as ToastMessage,
} as const;

/**
 * Info toast messages
 */
export const TOAST_INFO = {
  /** Generic info */
  GENERIC: { title: "Info" } as ToastMessage,
  /** Loading states */
  LOADING: { title: "Loading", description: "Please wait..." } as ToastMessage,
  /** Processing states */
  PROCESSING: {
    title: "Processing",
    description: "Please wait while we process your request",
  } as ToastMessage,
} as const;

/**
 * Helper to create a custom error toast with a dynamic description
 */
export function createErrorToast(description: string): ToastMessage {
  return { title: "Error", description };
}

/**
 * Helper to create a custom success toast with a dynamic description
 */
export function createSuccessToast(title: string, description?: string): ToastMessage {
  return { title, description };
}
