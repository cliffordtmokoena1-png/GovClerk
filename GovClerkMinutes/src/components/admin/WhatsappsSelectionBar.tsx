import { Flex, Text, HStack, Button } from "@chakra-ui/react";
import React from "react";

type Props = {
  total?: number; // total matching conversations (may be undefined while loading)
  showing: number; // number currently loaded/displayed
  selectAll: boolean;
  selectedCount: number;
  onSelectAllResults: () => void;
  onExport: () => void;
  onClearSelection: () => void;
  isPending: boolean;
};

/**
 * Displays counts and bulk action controls for WhatsApp conversation selection.
 * Responsible purely for UI; all selection state is managed by the parent.
 */
export default function WhatsappsSelectionBar({
  total,
  showing,
  selectAll,
  selectedCount,
  onSelectAllResults,
  onExport,
  onClearSelection,
  isPending,
}: Props) {
  return (
    <Flex align="center" justify="space-between" w="100%" flexWrap="wrap" gap={3}>
      <HStack spacing={3} align="center">
        {!selectAll && total != null && total > 0 && (
          <Button size="sm" variant="outline" onClick={onSelectAllResults} isLoading={isPending}>
            Select all {total} results
          </Button>
        )}
        {selectedCount > 0 && (
          <>
            <Text fontSize="sm" color="gray.700">
              Selected: {selectedCount}
            </Text>
            <Button size="sm" onClick={onExport}>
              Export
            </Button>
            <Button size="sm" variant="ghost" onClick={onClearSelection} isLoading={isPending}>
              Clear selection
            </Button>
          </>
        )}
      </HStack>
      <Text fontSize="sm" color="gray.600">
        {typeof total === "number"
          ? `Showing ${showing} of ${total} conversations`
          : `Showing ${showing} conversations`}
      </Text>
    </Flex>
  );
}
