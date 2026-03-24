import { Box } from "@chakra-ui/react";
import ConversationInbox from "@/components/admin/whatsapp/ConversationInbox";
import type { Conversation, SortOption } from "@/admin/whatsapp/types";
import type { Filter } from "@/admin/whatsapp/filter/types";

type Props = {
  conversations: Conversation[];
  filters: Filter[];
  onFiltersChanged: (next: Filter[]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  isLoading?: boolean;
  errorText?: string | null;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
};

export default function MobileInboxView({
  conversations,
  filters,
  onFiltersChanged,
  selectedId,
  onSelect,
  hasMore,
  onLoadMore,
  loadingMore,
  isLoading,
  errorText,
  sortOption,
  onSortChange,
}: Props) {
  return (
    <Box h="100%" display="flex" flexDirection="column">
      <ConversationInbox
        conversations={conversations}
        filters={filters}
        onFiltersChanged={onFiltersChanged}
        selectedId={selectedId}
        onSelect={onSelect}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        loadingMore={loadingMore}
        isLoading={isLoading}
        errorText={errorText}
        sortOption={sortOption}
        onSortChange={onSortChange}
      />
    </Box>
  );
}
