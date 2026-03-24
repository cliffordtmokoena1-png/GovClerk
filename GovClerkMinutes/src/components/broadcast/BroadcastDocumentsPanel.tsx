import React, { useEffect, useState } from "react";
import { LuFileText, LuExternalLink, LuLoader2 } from "react-icons/lu";
import { formatBytes } from "@/utils/format";

type Document = {
  id: number;
  orgId: string;
  fileName: string;
  artifactType: string;
  fileSize: number;
  createdAt: string;
};

type Props = {
  meetingId: number;
  orgId: string;
};

export function BroadcastDocumentsPanel({ meetingId, orgId }: Readonly<Props>) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocuments() {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/portal/meetings/${meetingId}/artifacts?orgId=${encodeURIComponent(orgId)}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Failed to load documents:", response.status, errorData);
          // Don't throw error, just show empty state
          setDocuments([]);
          setError(null);
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setDocuments(data.artifacts || []);
        setError(null);
      } catch (err) {
        console.error("Failed to load documents:", err);
        setError(err instanceof Error ? err.message : "Failed to load documents");
      } finally {
        setIsLoading(false);
      }
    }

    loadDocuments();
  }, [meetingId, orgId]);

  const handleOpenDocument = (doc: Document) => {
    const downloadUrl = `/api/portal/artifacts/${doc.id}/download?orgId=${encodeURIComponent(doc.orgId)}`;
    globalThis.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <LuLoader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      );
    }

    if (documents.length === 0) {
      return (
        <div className="text-center py-8">
          <LuFileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => handleOpenDocument(doc)}
            className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-accent/50 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 bg-muted group-hover:bg-primary/10 rounded flex items-center justify-center transition-colors">
                <LuFileText className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                  <LuExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {doc.artifactType && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {doc.artifactType}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
        <LuFileText className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-medium text-foreground text-sm">Meeting Documents</h3>
        {documents.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {documents.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">{renderContent()}</div>
    </div>
  );
}
