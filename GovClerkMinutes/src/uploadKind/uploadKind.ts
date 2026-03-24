export const UPLOAD_KINDS = ["audio", "text", "word", "image", "unknown"] as const;

export type UploadKind = (typeof UPLOAD_KINDS)[number];

export function isUploadKind(value: string): value is UploadKind {
  return UPLOAD_KINDS.includes(value as UploadKind);
}

export function assertUploadKind(value: string): UploadKind {
  if (isUploadKind(value)) {
    return value;
  }
  throw new Error(`Invalid upload kind: ${value}`);
}

export function getUploadKind(filename: string): UploadKind {
  const name = filename.toLowerCase();

  if (
    name.endsWith(".docx") ||
    name.endsWith(".doc") ||
    name.endsWith(".odt") ||
    name.endsWith(".rtf") ||
    name.endsWith(".tex") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".mmd") ||
    name.endsWith(".dj") ||
    name.endsWith(".creole") ||
    name.endsWith(".mediawiki") ||
    name.endsWith(".wiki") ||
    name.endsWith(".twiki") ||
    name.endsWith(".tikiwiki") ||
    name.endsWith(".muse") ||
    name.endsWith(".org") ||
    name.endsWith(".pod") ||
    name.endsWith(".rst") ||
    name.endsWith(".textile") ||
    name.endsWith(".typ") ||
    name.endsWith(".epub") ||
    name.endsWith(".fb2") ||
    name.endsWith(".opml") ||
    name.endsWith(".xml") ||
    name.endsWith(".docbook") ||
    name.endsWith(".jats") ||
    name.endsWith(".endnotexml") ||
    name.endsWith(".bits") ||
    name.endsWith(".csv") ||
    name.endsWith(".tsv") ||
    name.endsWith(".json") ||
    name.endsWith(".csljson") ||
    name.endsWith(".bib") ||
    name.endsWith(".ris") ||
    name.endsWith(".haddock") ||
    name.endsWith(".man") ||
    name.endsWith(".mdoc")
  ) {
    return "word";
  } else if (name.endsWith(".txt") || name.endsWith(".vtt") || name.endsWith(".srt")) {
    // legacy text formats
    return "text";
  } else if (
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".gif") ||
    name.endsWith(".webp") ||
    name.endsWith(".svg") ||
    name.endsWith(".bmp") ||
    name.endsWith(".tiff") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    name.endsWith(".avif")
  ) {
    return "image";
  } else if (
    name.endsWith(".pdf") ||
    name.endsWith(".html") ||
    name.endsWith(".zip") ||
    name.endsWith(".ppt") ||
    name.endsWith(".pptx") ||
    name.endsWith(".thumbnail") ||
    name.endsWith(".cfg") ||
    name.endsWith(".exe") ||
    name.endsWith(".bin") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsm") ||
    name.endsWith(".xlsb") ||
    name.endsWith(".xlsx")
  ) {
    return "unknown";
  } else {
    return "audio";
  }
}
