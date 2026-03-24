import { Flex, Text, Select } from "@chakra-ui/react";
import { SortOption } from "@/admin/whatsapp/types";

type Props = {
  sortOption: SortOption;
  onSortChange: (sortOption: SortOption) => void;
};

export default function SortControls({ sortOption, onSortChange }: Props) {
  return (
    <Flex gap={4} align="center" direction={{ base: "column", md: "row" }} w="100%">
      <Text fontWeight="bold" fontSize="md" whiteSpace="nowrap">
        Sort by:
      </Text>
      <Select
        value={sortOption}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        maxW={{ base: "100%", md: "300px" }}
        w={{ base: "100%", md: "auto" }}
      >
        <option value="recent-desc">Most Recent Activity</option>
        <option value="recent-asc">Least Recent Activity</option>
        <option value="start-desc">Conversation Start (Newest First)</option>
        <option value="start-asc">Conversation Start (Oldest First)</option>
      </Select>
    </Flex>
  );
}
