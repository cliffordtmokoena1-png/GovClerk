import type { IconType } from "react-icons";
import {
  LuFile,
  LuFileText,
  LuFileSpreadsheet,
  LuFileVideo,
  LuFileAudio,
  LuFileImage,
} from "react-icons/lu";

export const FILE_ICON_MAP: Record<string, IconType> = {
  pdf: LuFileText,
  doc: LuFileText,
  docx: LuFileText,
  txt: LuFileText,
  rtf: LuFileText,
  xls: LuFileSpreadsheet,
  xlsx: LuFileSpreadsheet,
  csv: LuFileSpreadsheet,
  mp4: LuFileVideo,
  webm: LuFileVideo,
  mov: LuFileVideo,
  avi: LuFileVideo,
  mp3: LuFileAudio,
  m4a: LuFileAudio,
  wav: LuFileAudio,
  png: LuFileImage,
  jpg: LuFileImage,
  jpeg: LuFileImage,
  gif: LuFileImage,
  webp: LuFileImage,
  svg: LuFileImage,
};

export function getFileIcon(fileName?: string, contentType?: string): IconType {
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (FILE_ICON_MAP[ext]) {
      return FILE_ICON_MAP[ext];
    }
  }

  if (contentType) {
    if (contentType.startsWith("image/")) {
      return LuFileImage;
    }
    if (contentType.startsWith("video/")) {
      return LuFileVideo;
    }
    if (contentType.startsWith("audio/")) {
      return LuFileAudio;
    }
    if (contentType.includes("spreadsheet") || contentType.includes("excel")) {
      return LuFileSpreadsheet;
    }
    if (
      contentType.includes("pdf") ||
      contentType.includes("document") ||
      contentType.includes("text")
    ) {
      return LuFileText;
    }
  }

  return LuFile;
}

export function getFileIconByName(fileName: string): IconType {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return FILE_ICON_MAP[ext] || LuFile;
}
