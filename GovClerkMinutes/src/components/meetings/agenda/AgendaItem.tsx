import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuGripVertical,
  LuChevronDown,
  LuChevronRight,
  LuX,
  LuLoader2,
  LuPaperclip,
  LuFile,
  LuUpload,
} from "react-icons/lu";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import type { PortalArtifact } from "@/types/portal";
import { getItemPrefix, MAX_NESTING_LEVEL } from "@/utils/agendaFormatting";
import { getFileIconByName } from "@/utils/fileIcons";
import { MotionItem } from "../MotionItem";
import AgendaItemForm from "./AgendaItemForm";
import type { AgendaItemFormData } from "./types";

interface AgendaItemProps {
  item: MgAgendaItemWithRelations;
  level: number;
  index: number;
  meetingId: number;
  isExpanded: boolean;
  isEditing: boolean;
  isDraggedOver: boolean;
  isDragging: boolean;
  dropAsChild: boolean;
  isAddingNested: boolean;
  isAttachingHere: boolean;
  isAttaching: boolean;
  isDeleting: number | null;
  detachingArtifactId: number | null;
  formData: AgendaItemFormData;
  availableArtifacts: PortalArtifact[];
  isSaving: boolean;
  onToggleExpand: (itemId: number) => void;
  onEdit: (item: MgAgendaItemWithRelations) => void;
  onDelete: (itemId: number) => void;
  onFormChange: (data: AgendaItemFormData) => void;
  onSaveEdit: () => void;
  onSaveNewItem: () => void;
  onCancelEdit: () => void;
  onAddNestedItem: (parentId: number) => void;
  onAttachClick: (itemId: number) => void;
  onCancelAttach: () => void;
  onUploadFile: (itemId: number) => void;
  onAttachExisting: (itemId: number, artifactId: number) => void;
  onDetachArtifact: (itemId: number, artifactId: number) => void;
  onDragStart: (e: React.DragEvent, itemId: number) => void;
  onDragEnd: () => void;
  onDragEnter: (e: React.DragEvent, itemId: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, itemId: number) => void;
  onDrop: (e: React.DragEvent, targetItemId: number) => void;
  renderAgendaItem: (
    item: MgAgendaItemWithRelations,
    level: number,
    index: number
  ) => React.ReactNode;
}

const AgendaItem = ({
  item,
  level,
  index,
  meetingId,
  isExpanded,
  isEditing,
  isDraggedOver,
  isDragging,
  dropAsChild,
  isAddingNested,
  isAttachingHere,
  isAttaching,
  isDeleting,
  detachingArtifactId,
  formData,
  availableArtifacts,
  isSaving,
  onToggleExpand,
  onEdit,
  onDelete,
  onFormChange,
  onSaveEdit,
  onSaveNewItem,
  onCancelEdit,
  onAddNestedItem,
  onAttachClick,
  onCancelAttach,
  onUploadFile,
  onAttachExisting,
  onDetachArtifact,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  renderAgendaItem,
}: AgendaItemProps) => {
  const hasChildren = item.children && item.children.length > 0;
  const hasDescription = !!item.description;
  const hasArtifacts = item.artifacts && item.artifacts.length > 0;
  const canAddNested = level < MAX_NESTING_LEVEL - 1;
  const prefix = getItemPrefix(level, index);

  return (
    <div key={item.id}>
      <div
        draggable={!isEditing}
        onDragStart={(e) => onDragStart(e, item.id)}
        onDragEnd={onDragEnd}
        onDragEnter={(e) => onDragEnter(e, item.id)}
        onDragLeave={onDragLeave}
        onDragOver={(e) => onDragOver(e, item.id)}
        onDrop={(e) => onDrop(e, item.id)}
        className={`
          bg-white border-b border-gray-100
          ${isDraggedOver && !dropAsChild ? "border-t-2 border-t-blue-500" : ""}
          ${isDraggedOver && dropAsChild ? "bg-blue-50" : ""}
          ${isDragging ? "opacity-50" : ""}
          transition-all duration-150
        `}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        <div className="flex items-start gap-2 py-3 pr-4">
          <div
            className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-manipulation"
            title="Drag to reorder"
          >
            <LuGripVertical className="w-4 h-4" />
          </div>

          <button
            onClick={() => onToggleExpand(item.id)}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
            disabled={!hasDescription && !hasArtifacts}
          >
            {isExpanded ? (
              <LuChevronDown className="w-4 h-4" />
            ) : (
              <LuChevronRight className="w-4 h-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <AgendaItemForm
                formData={formData}
                onFormChange={onFormChange}
                onSave={onSaveEdit}
                onCancel={onCancelEdit}
                isSaving={isSaving}
                variant="inline"
              />
            ) : (
              <>
                <div
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => onToggleExpand(item.id)}
                >
                  <span className="text-gray-500 font-medium text-sm w-8 flex-shrink-0">
                    {prefix}
                  </span>
                  <span className="text-gray-800">{item.title}</span>
                  {hasArtifacts && (
                    <span className="text-gray-400 text-xs flex items-center gap-1">
                      <LuPaperclip className="w-3 h-3" />
                      {item.artifacts!.length}
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-2 ml-10">
                    {hasDescription && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap mb-3">
                        {item.description}
                      </p>
                    )}

                    {hasArtifacts && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                          <LuPaperclip className="w-3 h-3" />
                          Attached Documents:
                        </p>
                        <div className="space-y-1">
                          {item.artifacts!.map((artifact) => (
                            <div
                              key={artifact.id}
                              className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded px-2 py-1.5"
                            >
                              {(() => {
                                const FileIcon = getFileIconByName(artifact.fileName);
                                return <FileIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />;
                              })()}
                              <span className="flex-1 truncate">{artifact.fileName}</span>
                              <button
                                onClick={() => onDetachArtifact(item.id, artifact.id)}
                                disabled={detachingArtifactId === artifact.id}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Remove attachment"
                              >
                                {detachingArtifactId === artifact.id ? (
                                  <LuLoader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <LuX className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <MotionItem agendaItemId={item.id} meetingId={meetingId} />

                    {!isAttachingHere ? (
                      <button
                        onClick={() => onAttachClick(item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <LuPaperclip className="w-3 h-3" />
                        Attach Document
                      </button>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-gray-600">Attach Document</p>

                        <button
                          onClick={() => onUploadFile(item.id)}
                          disabled={isAttaching}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {isAttaching ? (
                            <LuLoader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LuUpload className="w-4 h-4" />
                          )}
                          Upload new file
                        </button>

                        {availableArtifacts.length > 0 && (
                          <>
                            <p className="text-xs text-gray-500 mt-2">Or select existing:</p>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {availableArtifacts.map((artifact) => (
                                <button
                                  key={artifact.id}
                                  onClick={() => onAttachExisting(item.id, artifact.id)}
                                  disabled={isAttaching}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-50 text-left"
                                >
                                  <LuFile className="w-4 h-4 text-gray-400" />
                                  <span className="flex-1 truncate">{artifact.fileName}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        <button
                          onClick={onCancelAttach}
                          className="w-full px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onEdit(item)}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Edit"
              >
                <LuPencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(item.id)}
                disabled={isDeleting === item.id}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Delete"
              >
                {isDeleting === item.id ? (
                  <LuLoader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LuTrash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>

        {isDraggedOver && dropAsChild && (
          <div className="mx-4 mb-2 py-1 px-3 bg-blue-100 text-blue-700 text-xs rounded text-center">
            Drop as nested item
          </div>
        )}
      </div>

      {hasChildren && (
        <div>
          {item.children!.map((child, childIndex) =>
            renderAgendaItem(child, level + 1, childIndex)
          )}
        </div>
      )}

      {canAddNested && !isAddingNested && (
        <div style={{ paddingLeft: `${(level + 1) * 24 + 12}px` }} className="py-2">
          <button
            onClick={() => onAddNestedItem(item.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            <LuPlus className="w-3 h-3" />
            Add nested item
          </button>
        </div>
      )}

      {isAddingNested && (
        <div
          style={{ paddingLeft: `${(level + 1) * 24 + 12}px` }}
          className="py-3 pr-4 bg-blue-50 border-b border-blue-100"
        >
          <AgendaItemForm
            formData={formData}
            onFormChange={onFormChange}
            onSave={onSaveNewItem}
            onCancel={onCancelEdit}
            isSaving={isSaving}
            title="New Nested Item"
            variant="nested"
          />
        </div>
      )}
    </div>
  );
};

export default AgendaItem;
