import { useState, useRef, useMemo } from "react";
import {
  LuUpload,
  LuLoader2,
  LuFileText,
  LuFile,
  LuFileImage,
  LuFileVideo,
  LuCheck,
  LuX,
  LuGlobe,
  LuLock,
  LuClipboardList,
  LuVideo,
  LuFileAudio,
  LuFolder,
  LuImage,
  LuCheckSquare,
  LuLayers,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { toast } from "sonner";
import type {
  PortalMeetingWithArtifacts,
  PortalArtifact,
  PortalArtifactType,
} from "@/types/portal";
import { DOCUMENT_KIND_CONFIG, MEETING_DOCUMENT_KINDS } from "@/types/portal";
import { useDocumentUpload, getArtifactTypeFromFile } from "@/hooks/portal/useDocumentUpload";
import { useDocumentSelection } from "@/hooks/portal/useDocumentSelection";
import { getArtifactCategory, type ArtifactCategory } from "@/utils/portal/artifactCategories";
import { formatFileSize, formatDate } from "@/utils/formatters";
import { BuildPacketModal } from "./BuildPacketModal";

const ICON_MAP: Record<string, IconType> = {
  image: LuImage,
  "file-text": LuFileText,
  "clipboard-list": LuClipboardList,
  video: LuVideo,
  "file-audio": LuFileAudio,
  folder: LuFolder,
};

function getKindIcon(iconName: string): IconType {
  return ICON_MAP[iconName] || LuFile;
}

interface MeetingDocumentsTabProps {
  readonly meeting: PortalMeetingWithArtifacts;
  readonly onUpdate: () => void;
}

const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.mp4,.webm,.mp3,.m4a";

function getFileIcon(contentType?: string, fileName?: string): IconType {
  const ext = fileName?.split(".").pop()?.toLowerCase();

  if (
    contentType?.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "")
  ) {
    return LuFileImage;
  }
  if (
    contentType?.startsWith("video/") ||
    contentType?.startsWith("audio/") ||
    ["mp4", "webm", "mp3", "m4a"].includes(ext || "")
  ) {
    return LuFileVideo;
  }
  if (contentType === "application/pdf" || ext === "pdf") {
    return LuFileText;
  }
  return LuFile;
}

function groupArtifactsByKind(
  artifacts: PortalArtifact[]
): Record<PortalArtifactType, PortalArtifact[]> {
  const groups: Record<PortalArtifactType, PortalArtifact[]> = {
    logo: [],
    minutes_pdf: [],
    minutes_packet: [],
    minutes: [],
    agenda_pdf: [],
    agenda_packet: [],
    agenda: [],
    meeting_recording: [],
    recordings: [],
    transcripts: [],
    other: [],
  };

  for (const artifact of artifacts) {
    let kind = artifact.artifactType || "other";

    if (kind === "meeting_recording") {
      kind = "recordings";
    }
    if (groups[kind]) {
      groups[kind].push(artifact);
    } else {
      groups.other.push(artifact);
    }
  }

  return groups;
}

const KIND_DISPLAY_ORDER: PortalArtifactType[] = [
  "agenda_packet",
  "agenda",
  "agenda_pdf",
  "minutes",
  "minutes_packet",
  "minutes_pdf",
  "recordings",
  "transcripts",
  "other",
];

export function MeetingDocumentsTab({ meeting, onUpdate }: Readonly<MeetingDocumentsTabProps>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile: doUpload, uploadState } = useDocumentUpload();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [togglingPublicId, setTogglingPublicId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ArtifactCategory>("documents");
  const [showBuildPacketModal, setShowBuildPacketModal] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);

  const artifacts = useMemo(() => meeting.artifacts || [], [meeting.artifacts]);

  const { documents, media } = useMemo(() => {
    const docs: PortalArtifact[] = [];
    const med: PortalArtifact[] = [];

    for (const artifact of artifacts) {
      const category = getArtifactCategory(artifact.artifactType);
      if (category === "media") {
        med.push(artifact);
      } else {
        docs.push(artifact);
      }
    }

    return { documents: docs, media: med };
  }, [artifacts]);

  const documentSelection = useDocumentSelection(documents, {
    onBuildPacket: (selectedDocuments) => {
      setShowBuildPacketModal(true);
    },
  });

  const filteredArtifacts = activeTab === "documents" ? documents : media;

  const groupedArtifacts = useMemo(
    () => groupArtifactsByKind(filteredArtifacts),
    [filteredArtifacts]
  );

  const nonEmptyGroups = useMemo(
    () => KIND_DISPLAY_ORDER.filter((kind) => groupedArtifacts[kind].length > 0),
    [groupedArtifacts]
  );

  const uploadFile = async (file: File, customName?: string) => {
    const artifactType = getArtifactTypeFromFile(file.name);
    await doUpload(file, {
      meetingId: meeting.id,
      artifactType,
      customFileName: customName,
      onComplete: () => {
        // Small delay to ensure database transaction is committed
        setTimeout(() => {
          onUpdate();
        }, 100);
      },
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const artifactType = getArtifactTypeFromFile(file.name);
      if (artifactType === "other") {
        setPendingFile(file);
        setCustomFileName(file.name);
        setShowNameModal(true);
      } else {
        uploadFile(file);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleNameModalConfirm = () => {
    if (pendingFile && customFileName.trim()) {
      uploadFile(pendingFile, customFileName.trim());
    }
    setShowNameModal(false);
    setPendingFile(null);
    setCustomFileName("");
  };

  const handleNameModalCancel = () => {
    setShowNameModal(false);
    setPendingFile(null);
    setCustomFileName("");
  };

  const handleDownload = (artifact: PortalArtifact) => {
    window.open(
      `/api/portal/artifacts/${artifact.id}/download?orgId=${encodeURIComponent(artifact.orgId)}`,
      "_blank"
    );
  };

  const startRename = (artifact: PortalArtifact) => {
    setEditingId(artifact.id);
    setEditingName(artifact.fileName);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveRename = async (artifactId: number) => {
    if (!editingName.trim()) {
      cancelRename();
      return;
    }

    setLoadingAction(artifactId);
    try {
      const response = await fetch(`/api/portal/artifacts/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: editingName.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename");
      }

      toast.success("Document renamed");

      // Small delay to ensure database transaction is committed
      setTimeout(() => {
        onUpdate();
      }, 100);
    } catch (error) {
      console.error("Failed to rename document:", error);
      toast.error("Failed to rename");
    } finally {
      setLoadingAction(null);
      cancelRename();
    }
  };

  const confirmDelete = (artifactId: number) => {
    setDeletingId(artifactId);
  };

  const cancelDelete = () => {
    setDeletingId(null);
  };

  const executeDelete = async (artifactId: number) => {
    setLoadingAction(artifactId);
    try {
      const response = await fetch(`/api/portal/artifacts/${artifactId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      toast.success("Document deleted");

      // Small delay to ensure database transaction is committed
      setTimeout(() => {
        onUpdate();
      }, 100);
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast.error("Failed to delete");
    } finally {
      setLoadingAction(null);
      setDeletingId(null);
    }
  };

  const togglePublic = async (artifact: PortalArtifact) => {
    setTogglingPublicId(artifact.id);
    try {
      const response = await fetch(`/api/portal/artifacts/${artifact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !artifact.isPublic }),
      });

      if (!response.ok) {
        throw new Error("Failed to update visibility");
      }

      toast.success(
        artifact.isPublic
          ? "This document is now private."
          : meeting.isPublic
            ? "This document is now visible on the public portal."
            : "This document is now marked as public (meeting is still private)."
      );

      // Small delay to ensure database transaction is committed
      setTimeout(() => {
        onUpdate();
      }, 100);
    } catch (error) {
      console.error("Failed to update document visibility:", error);
      toast.error("Failed to update visibility");
    } finally {
      setTogglingPublicId(null);
    }
  };

  const handleBuildPacketSuccess = () => {
    documentSelection.clearSelection();

    // Small delay to ensure database transaction is committed
    setTimeout(() => {
      onUpdate();
    }, 100);
  };

  const handleBuildPacketModalClose = () => {
    setShowBuildPacketModal(false);
  };

  const renderDocumentItem = (artifact: PortalArtifact) => {
    const FileIcon = getFileIcon(artifact.contentType, artifact.fileName);
    const isEditing = editingId === artifact.id;
    const isDeleting = deletingId === artifact.id;
    const isLoading = loadingAction === artifact.id;
    const isTogglingPublic = togglingPublicId === artifact.id;
    const isSelected = documentSelection.isSelected(artifact.id);

    return (
      <div
        key={artifact.id}
        onClick={() => {
          if (!isEditing && !isDeleting) {
            handleDownload(artifact);
          }
        }}
        className={`bg-white border rounded-lg p-3 transition-colors cursor-pointer ${
          isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {activeTab === "documents" && (
              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => documentSelection.toggleSelection(artifact.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
              </div>
            )}

            <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileIcon className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveRename(artifact.id);
                      }
                      if (e.key === "Escape") {
                        cancelRename();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => saveRename(artifact.id)}
                    disabled={isLoading}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                  >
                    <LuCheck className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                  >
                    <LuX className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p
                  className="font-medium text-gray-900 text-sm truncate cursor-pointer hover:text-blue-600"
                  onDoubleClick={() => startRename(artifact)}
                  title="Double-click to rename"
                >
                  {artifact.fileName}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                <span>{formatFileSize(artifact.fileSize)}</span>
                <span className="hidden xs:inline">•</span>
                <span className="hidden xs:inline">{formatDate(artifact.createdAt)}</span>
                {artifact.linkedAgendaItem && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span
                      className="text-blue-600 truncate max-w-[200px] sm:max-w-none"
                      title={`Linked to agenda item: ${artifact.linkedAgendaItem.title}`}
                    >
                      Linked to: {artifact.linkedAgendaItem.title}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-1 sm:gap-0.5 flex-shrink-0 ml-12 sm:ml-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePublic(artifact);
              }}
              disabled={isTogglingPublic || isLoading}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                artifact.isPublic
                  ? "text-green-600 hover:bg-green-50"
                  : "text-gray-400 hover:bg-gray-100"
              } disabled:opacity-50`}
              title={artifact.isPublic ? "Public - Click to hide" : "Hidden - Click to publish"}
            >
              {isTogglingPublic ? (
                <LuLoader2 className="w-4 h-4 animate-spin" />
              ) : artifact.isPublic ? (
                <>
                  <LuGlobe className="w-4 h-4" />
                  <span className="text-xs hidden sm:inline">Public</span>
                </>
              ) : (
                <>
                  <LuLock className="w-4 h-4" />
                  <span className="text-xs hidden sm:inline">Private</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="max-w-5xl mx-auto w-full space-y-4">
        {showNameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Name Your Document</h3>
              <p className="text-sm text-gray-600 mb-4">
                Enter a name for this document. This will be displayed in the documents list.
              </p>
              <input
                type="text"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                placeholder="Document name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleNameModalConfirm();
                  }
                  if (e.key === "Escape") {
                    handleNameModalCancel();
                  }
                }}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleNameModalCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNameModalConfirm}
                  disabled={!customFileName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          {activeTab === "documents" && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={
                  documentSelection.allSelected
                    ? documentSelection.clearSelection
                    : documentSelection.selectAll
                }
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <LuCheckSquare className="w-4 h-4" />
                {documentSelection.allSelected ? "Clear All" : "Select All"}
              </button>

              <button
                type="button"
                onClick={documentSelection.handleBuildPacket}
                disabled={!documentSelection.hasSelection}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <LuLayers className="w-4 h-4" />
                Build Packet
              </button>

              {documentSelection.selectedCount > 0 && (
                <span className="text-sm text-gray-600">
                  {documentSelection.selectedCount} selected
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState.isUploading}
            className="ml-0 sm:ml-auto inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploadState.isUploading ? (
              <>
                <LuLoader2 className="w-4 h-4 animate-spin" />
                Uploading... {uploadState.progress}%
              </>
            ) : (
              <>
                <LuUpload className="w-4 h-4" />
                Upload Document
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
          />
        </div>

        {uploadState.isUploading && (
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <LuLoader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-sm font-medium text-blue-900">Uploading...</span>
            </div>
            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        )}

        {artifacts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <LuFileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">No documents yet</p>
            <p className="text-gray-500 text-sm mt-1">Upload a document to get started.</p>
          </div>
        ) : (
          <div>
            <div className="mb-6 border-b border-gray-200">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "documents"
                    ? "text-blue-600 border-blue-600"
                    : "text-gray-700 border-transparent hover:text-gray-900 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab("documents")}
              >
                Documents ({documents.length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ml-8 ${
                  activeTab === "media"
                    ? "text-blue-600 border-blue-600"
                    : "text-gray-700 border-transparent hover:text-gray-900 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab("media")}
              >
                Media ({media.length})
              </button>
            </div>

            <div>
              {activeTab === "documents" && (
                <div>
                  {filteredArtifacts.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <LuFileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600 font-medium">No documents yet</p>
                      <p className="text-gray-500 text-sm mt-1">
                        Upload a document to get started.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {nonEmptyGroups.map((kind) => {
                        const config = DOCUMENT_KIND_CONFIG[kind];
                        const kindArtifacts = groupedArtifacts[kind];
                        const KindIcon = getKindIcon(config.iconName);

                        return (
                          <div
                            key={kind}
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                          >
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <KindIcon className="w-4 h-4 text-gray-500" />
                                <span>{config.label}</span>
                                <span className="text-gray-400 font-normal">
                                  ({kindArtifacts.length})
                                </span>
                              </h3>
                            </div>

                            <div className="p-3 space-y-2">
                              {kindArtifacts.map((artifact) => renderDocumentItem(artifact))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "media" && (
                <div>
                  {filteredArtifacts.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <LuVideo className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600 font-medium">No media files yet</p>
                      <p className="text-gray-500 text-sm mt-1">
                        Upload a video or audio file to get started.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {nonEmptyGroups.map((kind) => {
                        const config = DOCUMENT_KIND_CONFIG[kind];
                        const kindArtifacts = groupedArtifacts[kind];
                        const KindIcon = getKindIcon(config.iconName);

                        return (
                          <div
                            key={kind}
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                          >
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <KindIcon className="w-4 h-4 text-gray-500" />
                                <span>{config.label}</span>
                                <span className="text-gray-400 font-normal">
                                  ({kindArtifacts.length})
                                </span>
                              </h3>
                            </div>

                            <div className="p-3 space-y-2">
                              {kindArtifacts.map((artifact) => renderDocumentItem(artifact))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <BuildPacketModal
          isOpen={showBuildPacketModal}
          onClose={handleBuildPacketModalClose}
          selectedDocuments={documentSelection.selectedDocuments}
          onSuccess={handleBuildPacketSuccess}
          meetingId={meeting.id}
        />
      </div>
    </div>
  );
}
