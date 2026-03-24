import { Box, Flex } from "@chakra-ui/react";
import { MenuBar } from "./MarkdownMinutes";

type EditorToolbarProps = {
  editor: any;
  onRegenerateClick: () => void;
  isRegenerating: boolean;
  isPreview: boolean;
  isUpdating: boolean;
  isMobile: boolean;
  lastSaved: Date | null;
  isLatest: boolean;
  isSaving: boolean;
  canRegenerate: boolean;
  inMobileTabbedView?: boolean;
  contentType?: "Minutes" | "Agenda";
};

export const EditorContainer = ({
  editor,
  onRegenerateClick,
  isRegenerating,
  isPreview,
  isUpdating,
  isMobile,
  lastSaved,
  isLatest,
  isSaving,
  canRegenerate,
  inMobileTabbedView,
  contentType,
  children,
}: EditorToolbarProps & { children: React.ReactNode }) => {
  return (
    <Flex direction="column" height="100%" width="100%">
      <MenuBar
        editor={editor}
        onRegenerateClick={onRegenerateClick}
        isRegenerating={isRegenerating}
        isPreview={isPreview}
        isUpdating={isUpdating}
        isMobile={isMobile}
        lastSaved={lastSaved}
        isLatest={isLatest}
        isSaving={isSaving}
        canRegenerate={canRegenerate}
        inMobileTabbedView={inMobileTabbedView}
        contentType={contentType}
      />
      <Box flex={1} width="100%" overflow="hidden">
        {children}
      </Box>
    </Flex>
  );
};
