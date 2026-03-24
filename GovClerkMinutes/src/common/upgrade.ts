import { IDBPDatabase } from "idb";
import { UploadsSchema } from "./indexeddb";

export function upgradeDb(db: IDBPDatabase<UploadsSchema>) {
  if (!db.objectStoreNames.contains("files")) {
    db.createObjectStore("files", { keyPath: "transcriptId" });
  }
  if (!db.objectStoreNames.contains("transcripts")) {
    db.createObjectStore("transcripts", { keyPath: "transcriptId" });
  }
  if (!db.objectStoreNames.contains("uploadParts")) {
    db.createObjectStore("uploadParts");
  }
  if (!db.objectStoreNames.contains("uploadIndex")) {
    db.createObjectStore("uploadIndex");
  }
  if (!db.objectStoreNames.contains("recordingSessionMetadata")) {
    db.createObjectStore("recordingSessionMetadata", { keyPath: "sessionId" });
  }
  if (!db.objectStoreNames.contains("recordingSessionChunks")) {
    db.createObjectStore("recordingSessionChunks");
  }
}
