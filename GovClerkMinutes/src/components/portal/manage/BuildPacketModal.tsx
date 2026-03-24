import React, { useState, useCallback, useRef } from "react";
import { LuX, LuLoader2, LuGripVertical, LuFileText, LuAlertTriangle } from "react-icons/lu";
import { toast } from "sonner";
import { useOrgContext } from "@/contexts/OrgContext";
import type { PortalArtifact } from "@/types/portal";
import { getFileIconByName } from "@/utils/fileIcons";
import { formatFileSize } from "@/utils/formatters";

// Supported file types that can be converted to PDF
const CONVERTIBLE_EXTENSIONS = [".pdf", ".docx", ".md", ".markdown", ".txt"];
const CONVERTIBLE_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/plain",
  "text/x-markdown",
];

interface BuildPacketModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly selectedDocuments: PortalArtifact[];
  readonly onSuccess: () => void;
  readonly meetingId: number;
}

interface PacketItem extends PortalArtifact {
  ordinal: number;
}

// Helper function to check if a document can be converted to PDF
const isConvertible = (doc: PortalArtifact): boolean => {
  const ext = doc.fileName.toLowerCase();
  return (
    (doc.contentType && CONVERTIBLE_MIMES.includes(doc.contentType)) ||
    CONVERTIBLE_EXTENSIONS.some((e) => ext.endsWith(e))
  );
};

export function BuildPacketModal({
  isOpen,
  onClose,
  selectedDocuments,
  onSuccess,
  meetingId,
}: Readonly<BuildPacketModalProps>) {
  const { orgId } = useOrgContext();
  const [isCreating, setIsCreating] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");

  const [orderedItems, setOrderedItems] = useState<PacketItem[]>([]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggedElementRef = useRef<HTMLElement | null>(null);

  const initializeOrderedItems = useCallback(() => {
    if (isOpen && selectedDocuments.length > 0) {
      const items: PacketItem[] = selectedDocuments.map((doc, index) => ({
        ...doc,
        ordinal: index + 1,
      }));
      setOrderedItems(items);
    }
  }, [isOpen, selectedDocuments]);

  React.useEffect(() => {
    initializeOrderedItems();
  }, [initializeOrderedItems]);

  const nonConvertibleDocuments = orderedItems.filter((doc) => !isConvertible(doc));

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    try {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
      const element = e.currentTarget as HTMLElement;
      draggedElementRef.current = element;
      requestAnimationFrame(() => {
        element?.classList?.add("opacity-50");
      });
    } catch (error) {
      console.error("Error in drag start:", error);

      setDraggedIndex(null);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    try {
      if (draggedElementRef.current) {
        draggedElementRef.current.classList.remove("opacity-50");
      }
      draggedElementRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);
    } catch (error) {
      console.error("Error in drag end:", error);

      draggedElementRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      try {
        e.preventDefault();
        setDragOverIndex(null);

        if (draggedIndex === null || draggedIndex === dropIndex) {
          return;
        }

        const draggedItem = orderedItems[draggedIndex];
        if (!draggedItem) {
          console.error("Dragged item not found at index:", draggedIndex);
          setDraggedIndex(null);
          return;
        }

        const newItems = [...orderedItems];

        newItems.splice(draggedIndex, 1);

        const adjustedDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
        newItems.splice(adjustedDropIndex, 0, draggedItem);

        const reorderedItems = newItems.map((item, index) => ({
          ...item,
          ordinal: index + 1,
        }));

        setOrderedItems(reorderedItems);
        setDraggedIndex(null);
      } catch (error) {
        console.error("Error in drop handler:", error);

        setDraggedIndex(null);
        setDragOverIndex(null);
      }
    },
    [draggedIndex, orderedItems]
  );

  const handleCreatePacket = async () => {
    if (orderedItems.length === 0) {
      toast.error("No documents selected for packet creation.");
      return;
    }

    if (nonConvertibleDocuments.length > 0) {
      toast.error(
        `${nonConvertibleDocuments.length} document(s) cannot be converted to PDF. Only PDF, DOCX, Markdown, and text files can be merged into packets.`
      );
      return;
    }

    setIsCreating(true);
    setProgressMessage("Creating packet...");

    try {
      const artifactIds = orderedItems.map((item) => item.id);
      const orderedIds = orderedItems.map((item) => item.id);

      const response = await fetch(`/api/portal/meetings/${meetingId}/packets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactIds,
          orderedIds,
          orgId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create packet");
      }

      const result = await response.json();

      toast.success(
        `Created packet with ${result.documentCount} documents and ${result.mergedPageCount} pages.`
      );

      onSuccess();
      onClose();
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to create packet");
      toast.error(err.message);
    } finally {
      setIsCreating(false);
      setProgressMessage("");
    }
  };

  const handleClose = () => {
    if (isCreating) {
      return;
    }
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Build Packet</h2>
            <span className="text-sm text-gray-500">
              ({orderedItems.length} document{orderedItems.length !== 1 ? "s" : ""})
            </span>
          </div>
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="p-1 text-gray-400 hover:text-gray-600 rounded disabled:opacity-50"
          >
            <LuX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {nonConvertibleDocuments.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex gap-3">
                <LuAlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Unsupported documents detected</p>
                  <p>
                    {nonConvertibleDocuments.length} document(s) cannot be converted to PDF and will
                    be excluded from the packet.
                  </p>
                </div>
              </div>
            </div>
          )}

          {orderedItems.some(
            (doc) => doc.contentType && !doc.contentType.includes("pdf") && isConvertible(doc)
          ) && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex gap-3">
                <LuAlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Files will be converted</p>
                  <p>
                    Some documents are not PDF files and will be automatically converted to PDF
                    during packet creation.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600 mb-4">
            Drag and drop documents to reorder them. The order you set here will determine the page
            sequence in the final packet.
          </p>

          {orderedItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <LuFileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No documents selected</p>
            </div>
          ) : (
            <div
              className="border border-gray-200 rounded-lg overflow-hidden"
              role="list"
              aria-label="Documents to include in packet"
            >
              {orderedItems.map((item, index) => {
                const FileIcon = getFileIconByName(item.fileName);
                const isDraggedOver = dragOverIndex === index;
                const isDragging = draggedIndex === index;

                return (
                  <div
                    key={item.id}
                    role="listitem"
                    aria-grabbed={isDragging}
                    aria-dropeffect={isDraggedOver ? "move" : "none"}
                    draggable={!isCreating}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`
                      ${isDraggedOver ? "border-t-2 border-t-blue-500" : ""}
                      ${isDragging ? "opacity-50" : ""}
                      ${index < orderedItems.length - 1 ? "border-b border-gray-200" : ""}
                      bg-white p-3 cursor-move hover:bg-gray-50 transition-all duration-150
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="touch-manipulation p-1 rounded text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                        aria-label={`Drag handle for ${item.fileName}`}
                      >
                        <LuGripVertical className="w-4 h-4" />
                      </div>

                      <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                        {index + 1}
                      </div>

                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileIcon className="w-4 h-4 text-gray-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.fileName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span>{formatFileSize(item.fileSize)}</span>
                          <span>•</span>
                          <span>
                            {item.contentType?.includes("pdf")
                              ? "PDF"
                              : item.fileName.toLowerCase().endsWith(".docx")
                                ? "DOCX"
                                : item.fileName.toLowerCase().endsWith(".md") ||
                                    item.fileName.toLowerCase().endsWith(".markdown")
                                  ? "Markdown"
                                  : item.fileName.toLowerCase().endsWith(".txt")
                                    ? "Text"
                                    : "Unknown"}
                            {!item.contentType?.includes("pdf") &&
                              isConvertible(item) &&
                              " (will convert)"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isCreating && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <LuLoader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-blue-900">{progressMessage}</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Please wait while we merge your documents...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePacket}
            disabled={isCreating || orderedItems.length === 0 || nonConvertibleDocuments.length > 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <>
                <LuLoader2 className="w-4 h-4 animate-spin inline mr-2" />
                Creating...
              </>
            ) : (
              "Create Packet"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
