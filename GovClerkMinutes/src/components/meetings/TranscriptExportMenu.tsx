import { useState } from "react";
import { LuDownload, LuChevronDown, LuLoader2 } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PortalMeetingWithArtifacts } from "@/types/portal";

type Props = {
  meeting: PortalMeetingWithArtifacts;
  orgId: string;
};

type ExportFormat = "docx" | "pdf" | "txt";

const FORMAT_CONFIG: Record<
  ExportFormat,
  { label: string; artifactType: string; contentType: string }
> = {
  docx: {
    label: "Download DOCX",
    artifactType: "transcripts",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  pdf: {
    label: "Download PDF",
    artifactType: "transcripts_pdf",
    contentType: "application/pdf",
  },
  txt: {
    label: "Download TXT",
    artifactType: "transcripts_txt",
    contentType: "text/plain",
  },
};

export function TranscriptExportMenu({ meeting, orgId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);

  const handleDownload = async (format: ExportFormat) => {
    setIsOpen(false);
    const config = FORMAT_CONFIG[format];

    // Find the artifact in the meeting's artifacts array
    const artifact = meeting.artifacts?.find((a) => a.artifactType === config.artifactType);

    if (!artifact) {
      toast.error(
        "This format is not available yet. Please save the minutes to documents first to generate all formats."
      );
      return;
    }

    setDownloading(format);
    try {
      // Use the artifact's S3 URL or fetch a fresh download URL
      const url = artifact.s3Url;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = artifact.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download transcript. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const formats: ExportFormat[] = ["docx", "pdf", "txt"];

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 gap-1"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Download transcript"
      >
        {downloading ? (
          <LuLoader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <LuDownload className="w-3.5 h-3.5" />
        )}
        <LuChevronDown className="w-3 h-3 opacity-60" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-md shadow-md min-w-40 py-1">
            {formats.map((format) => {
              const config = FORMAT_CONFIG[format];
              const artifact = meeting.artifacts?.find(
                (a) => a.artifactType === config.artifactType
              );
              const isAvailable = Boolean(artifact);
              return (
                <button
                  key={format}
                  type="button"
                  disabled={downloading !== null || !isAvailable}
                  onClick={() => handleDownload(format)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                >
                  <span>{config.label}</span>
                  {!isAvailable && (
                    <span className="text-xs text-muted-foreground">Generating...</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
