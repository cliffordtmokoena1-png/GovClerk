import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { LuPlus, LuLoader2, LuSparkles, LuSave, LuFolderOpen, LuShare2 } from "react-icons/lu";
import { useMediaQuery } from "@chakra-ui/react";
import { toast } from "sonner";
import saveAs from "file-saver";
import { useAgenda, getMaxOrdinal } from "@/hooks/portal/useAgenda";
import { useConvertDocument, type OutputType } from "@/hooks/useConvertDocument";
import { useAgendaTemplates } from "@/hooks/portal/useAgendaTemplates";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import type { PortalArtifact } from "@/types/portal";
import { useOrgContext } from "@/contexts/OrgContext";
import {
  generateTextAgenda,
  generateMarkdownAgenda,
  getItemPrefix,
} from "@/utils/agendaFormatting";
import {
  AgendaItem,
  AgendaItemForm,
  ExportAgendaModal,
  GenerateAgendaModal,
  SaveTemplateModal,
  LoadTemplateModal,
  useAgendaDragDrop,
  initialFormData,
  type AgendaItemFormData,
} from "./agenda";

interface MeetingAgendaTabProps {
  readonly meetingId: number;
  readonly meetingTitle: string;
  readonly meetingDate: string;
  readonly meetingLocation?: string;
  readonly meetingArtifacts?: PortalArtifact[];
}

export function MeetingAgendaTab({
  meetingId,
  meetingTitle,
  meetingDate,
  meetingLocation,
  meetingArtifacts = [],
}: Readonly<MeetingAgendaTabProps>) {
  const {
    items,
    tree,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    attachArtifact,
    detachArtifact,
    uploadAndAttachArtifact,
    generateAgenda,
    exportAgendaToArtifact,
    hasGeneratedAgenda,
  } = useAgenda(meetingId);

  const [localTree, setLocalTree] = useState<MgAgendaItemWithRelations[]>([]);
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    if (!isReordering) {
      setLocalTree(tree);
    }
  }, [tree, isReordering]);

  const displayTree = localTree.length > 0 ? localTree : tree;

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [addingToParentId, setAddingToParentId] = useState<number | null | "root">(null);
  const [formData, setFormData] = useState<AgendaItemFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const [attachingToItemId, setAttachingToItemId] = useState<number | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [detachingArtifactId, setDetachingArtifactId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateContext, setGenerateContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "docx" | "txt" | null>(null);
  const { convert } = useConvertDocument();
  const [isMobile] = useMediaQuery("(max-width: 768px)");

  const { templates, saveTemplate, loadTemplate, deleteTemplate } = useAgendaTemplates();
  const { orgId } = useOrgContext();
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  const {
    draggedItemId,
    dragOverItemId,
    dropAsChild,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useAgendaDragDrop({
    items,
    displayTree,
    tree,
    reorderItems,
    setLocalTree,
    setIsReordering,
  });

  const toggleExpand = (itemId: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleAddRootItem = () => {
    setAddingToParentId("root");
    setFormData(initialFormData);
    setEditingItemId(null);
  };

  const handleAddNestedItem = (parentId: number) => {
    setAddingToParentId(parentId);
    setFormData(initialFormData);
    setEditingItemId(null);
  };

  const handleEditItem = (item: MgAgendaItemWithRelations) => {
    setEditingItemId(item.id);
    setFormData({ title: item.title, description: item.description || "" });
    setAddingToParentId(null);
    setExpandedItems((prev) => new Set(prev).add(item.id));
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setAddingToParentId(null);
    setFormData(initialFormData);
  };

  const handleSaveNewItem = async () => {
    if (!formData.title.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const parentId = addingToParentId === "root" ? null : addingToParentId;
      const maxOrdinal = getMaxOrdinal(items, parentId);
      await createItem({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        ordinal: maxOrdinal + 1,
        parent_id: parentId,
      });
      setAddingToParentId(null);
      setFormData(initialFormData);
      if (parentId !== null) {
        setExpandedItems((prev) => new Set(prev).add(parentId));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItemId || !formData.title.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await updateItem(editingItemId, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
      });
      setEditingItemId(null);
      setFormData(initialFormData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    setIsDeleting(itemId);
    try {
      await deleteItem(itemId);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleOpenGenerateModal = (regenerate = false) => {
    setShowGenerateModal(true);
    setIsRegenerating(regenerate);
    setGenerateContext("");
  };

  const handleCloseGenerateModal = () => {
    setShowGenerateModal(false);
    setGenerateContext("");
    setIsRegenerating(false);
  };

  const serializeAgendaToText = (items: MgAgendaItemWithRelations[], level = 0): string => {
    return items
      .map((item, idx) => {
        const prefix = getItemPrefix(level, idx);
        const desc = item.description
          ? `\n${"  ".repeat(level + 1)}Description: ${item.description}`
          : "";
        const children = item.children?.length
          ? "\n" + serializeAgendaToText(item.children, level + 1)
          : "";
        return `${"  ".repeat(level)}${prefix} ${item.title}${desc}${children}`;
      })
      .join("\n");
  };

  const handleGenerateAgenda = async () => {
    if (!generateContext.trim()) {
      toast.warning("Please provide context for generating the agenda.");
      return;
    }

    let fullContext = generateContext;
    if (isRegenerating && displayTree.length > 0) {
      const currentAgendaText = serializeAgendaToText(displayTree);
      fullContext = `CURRENT AGENDA (to improve upon):\n${currentAgendaText}\n\nADDITIONAL CONTEXT/INSTRUCTIONS:\n${generateContext}`;
    }

    handleCloseGenerateModal();
    setIsGenerating(true);

    try {
      const generatedItems = await generateAgenda(fullContext);
      if (generatedItems && generatedItems.length > 0) {
        toast.success(`Created ${generatedItems.length} agenda items.`);
      }
    } catch (error) {
      console.error("Failed to generate agenda:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const textContent = useMemo(
    () => generateTextAgenda(meetingTitle, meetingDate, displayTree, { location: meetingLocation }),
    [meetingTitle, meetingDate, displayTree, meetingLocation]
  );

  const markdownContent = useMemo(
    () =>
      generateMarkdownAgenda(meetingTitle, meetingDate, displayTree, { location: meetingLocation }),
    [meetingTitle, meetingDate, displayTree, meetingLocation]
  );

  const handleExportDownload = useCallback(
    async (format: "txt" | OutputType) => {
      setExportingFormat(format as "pdf" | "docx" | "txt");
      try {
        if (format === "txt") {
          const blob = new Blob([textContent], { type: "text/plain" });
          saveAs(blob, `${meetingTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Agenda.txt`);
          toast.success("Agenda exported as TXT");
        } else {
          const blob = await convert({
            input: new Blob([markdownContent], { type: "text/markdown" }),
            outputType: format,
            inputType: "gfm",
          });

          if (blob) {
            const ext = format === "docx" ? "docx" : "pdf";
            saveAs(blob, `${meetingTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Agenda.${ext}`);
            toast.success(`Agenda exported as ${format.toUpperCase()}`);
          }
        }
      } catch (error) {
        console.error("Failed to export agenda:", error);
        toast.error("Failed to export agenda");
      } finally {
        setExportingFormat(null);
      }
    },
    [textContent, markdownContent, meetingTitle, convert]
  );

  const handleExportToDocuments = async () => {
    if (displayTree.length === 0) {
      toast.warning("Please add agenda items before exporting.");
      return;
    }

    setIsExporting(true);
    try {
      await exportAgendaToArtifact(meetingTitle, meetingDate, displayTree);
    } catch (error) {
      console.error("Failed to export agenda:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenSaveTemplateModal = () => {
    setShowSaveTemplateModal(true);
    setTemplateName("");
    setTemplateDescription("");
  };

  const handleCloseSaveTemplateModal = () => {
    setShowSaveTemplateModal(false);
    setTemplateName("");
    setTemplateDescription("");
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.warning("Please provide a name for the template.");
      return;
    }

    if (displayTree.length === 0) {
      toast.warning("Please add agenda items before saving as template.");
      return;
    }

    setIsSavingTemplate(true);
    try {
      if (!orgId) {
        throw new Error("Organization ID is required");
      }
      await saveTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        orgId,
        meetingId,
        agendaItems: displayTree,
      });
      handleCloseSaveTemplateModal();
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleOpenLoadTemplateModal = () => setShowLoadTemplateModal(true);
  const handleCloseLoadTemplateModal = () => setShowLoadTemplateModal(false);

  const handleLoadTemplate = async (templateId: number) => {
    setIsLoadingTemplate(true);
    try {
      await loadTemplate(meetingId, templateId);
      handleCloseLoadTemplateModal();
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    try {
      await deleteTemplate(templateId);
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  const handleAttachClick = (itemId: number) => setAttachingToItemId(itemId);
  const handleCancelAttach = () => setAttachingToItemId(null);

  const handleUploadFile = (itemId: number) => {
    if (fileInputRef.current) {
      fileInputRef.current.dataset.itemId = itemId.toString();
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const itemId = event.target.dataset.itemId;
    if (!file || !itemId) {
      return;
    }

    setIsAttaching(true);
    try {
      await uploadAndAttachArtifact(Number(itemId), file);
      setAttachingToItemId(null);
    } catch (error) {
      console.error("Failed to upload and attach artifact:", error);
    } finally {
      setIsAttaching(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAttachExisting = async (itemId: number, artifactId: number) => {
    setIsAttaching(true);
    try {
      await attachArtifact(itemId, artifactId);
      setAttachingToItemId(null);
    } catch (error) {
      console.error("Failed to attach artifact:", error);
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDetachArtifact = async (itemId: number, artifactId: number) => {
    setDetachingArtifactId(artifactId);
    try {
      await detachArtifact(itemId, artifactId);
    } catch (error) {
      console.error("Failed to detach artifact:", error);
    } finally {
      setDetachingArtifactId(null);
    }
  };

  const getAvailableArtifacts = (item: MgAgendaItemWithRelations): PortalArtifact[] => {
    const attachedIds = new Set((item.artifacts || []).map((a) => a.id));
    return meetingArtifacts.filter((a) => !attachedIds.has(a.id));
  };

  const renderAgendaItem = (
    item: MgAgendaItemWithRelations,
    level: number,
    index: number
  ): React.ReactNode => {
    return (
      <AgendaItem
        key={item.id}
        item={item}
        level={level}
        index={index}
        meetingId={meetingId}
        isExpanded={expandedItems.has(item.id)}
        isEditing={editingItemId === item.id}
        isDraggedOver={dragOverItemId === item.id}
        isDragging={draggedItemId === item.id}
        dropAsChild={dropAsChild}
        isAddingNested={addingToParentId === item.id}
        isAttachingHere={attachingToItemId === item.id}
        isAttaching={isAttaching}
        isDeleting={isDeleting}
        detachingArtifactId={detachingArtifactId}
        formData={formData}
        availableArtifacts={getAvailableArtifacts(item)}
        isSaving={isSaving}
        onToggleExpand={toggleExpand}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
        onFormChange={setFormData}
        onSaveEdit={handleSaveEdit}
        onSaveNewItem={handleSaveNewItem}
        onCancelEdit={handleCancelEdit}
        onAddNestedItem={handleAddNestedItem}
        onAttachClick={handleAttachClick}
        onCancelAttach={handleCancelAttach}
        onUploadFile={handleUploadFile}
        onAttachExisting={handleAttachExisting}
        onDetachArtifact={handleDetachArtifact}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        renderAgendaItem={renderAgendaItem}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LuLoader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading agenda...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="max-w-5xl mx-auto w-full space-y-4">
        <ExportAgendaModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          meetingTitle={meetingTitle}
          meetingDate={meetingDate}
          meetingLocation={meetingLocation}
          displayTree={displayTree}
          isMobile={isMobile}
          exportingFormat={exportingFormat}
          isExporting={isExporting}
          onExportDownload={handleExportDownload}
          onExportToDocuments={handleExportToDocuments}
        />

        <GenerateAgendaModal
          isOpen={showGenerateModal}
          onClose={handleCloseGenerateModal}
          context={generateContext}
          setContext={setGenerateContext}
          onGenerate={handleGenerateAgenda}
          isGenerating={isGenerating}
          isRegenerating={isRegenerating}
          currentTree={displayTree}
        />

        <SaveTemplateModal
          isOpen={showSaveTemplateModal}
          onClose={handleCloseSaveTemplateModal}
          templateName={templateName}
          setTemplateName={setTemplateName}
          templateDescription={templateDescription}
          setTemplateDescription={setTemplateDescription}
          onSave={handleSaveTemplate}
          isSaving={isSavingTemplate}
        />

        <LoadTemplateModal
          isOpen={showLoadTemplateModal}
          onClose={handleCloseLoadTemplateModal}
          templates={templates}
          onLoad={handleLoadTemplate}
          onDelete={handleDeleteTemplate}
          isLoading={isLoadingTemplate}
        />

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.mp4,.webm,.mp3,.m4a"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAddRootItem}
            disabled={addingToParentId === "root"}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <LuPlus className="w-4 h-4" />
            Add Item
          </button>

          {!hasGeneratedAgenda ? (
            <button
              onClick={() => handleOpenGenerateModal(false)}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <LuLoader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <LuSparkles className="w-4 h-4" />
                  Generate Agenda
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => handleOpenGenerateModal(true)}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <LuLoader2 className="w-4 h-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <LuSparkles className="w-4 h-4" />
                  Regenerate Agenda
                </>
              )}
            </button>
          )}

          <button
            onClick={handleOpenSaveTemplateModal}
            disabled={displayTree.length === 0 || isSavingTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LuSave className="w-4 h-4" />
            {isSavingTemplate ? "Saving..." : "Save as Template"}
          </button>

          <button
            onClick={handleOpenLoadTemplateModal}
            disabled={isLoadingTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LuFolderOpen className="w-4 h-4" />
            {isLoadingTemplate ? "Loading..." : "Load Template"}
          </button>

          <div className="flex-1" />

          <button
            onClick={() => setShowExportModal(true)}
            disabled={displayTree.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LuShare2 className="w-4 h-4" />
            Export Agenda
          </button>
        </div>

        {addingToParentId === "root" && (
          <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <AgendaItemForm
              formData={formData}
              onFormChange={setFormData}
              onSave={handleSaveNewItem}
              onCancel={handleCancelEdit}
              isSaving={isSaving}
              title="New Agenda Item"
              variant="root"
            />
          </div>
        )}

        {displayTree.length === 0 && addingToParentId !== "root" && (
          <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-4">No agenda items yet</p>
            <button
              onClick={handleAddRootItem}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <LuPlus className="w-4 h-4" />
              Add your first agenda item
            </button>
          </div>
        )}

        {displayTree.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {displayTree.map((item, index) => renderAgendaItem(item, 0, index))}
          </div>
        )}
      </div>
    </div>
  );
}
