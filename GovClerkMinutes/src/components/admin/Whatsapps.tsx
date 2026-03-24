import { useEffect, useMemo, useState, useCallback, useTransition, useDeferredValue } from "react";
import useSWRInfinite from "swr/infinite";
import { Box, Text, Spinner, Flex, Button } from "@chakra-ui/react";
import FilterBar from "@/components/admin/whatsapp/FilterBar";
import { serializeFilters, deserializeFilters } from "@/admin/whatsapp/filter/filters";
import { Filter } from "@/admin/whatsapp/filter/types";
import { Conversation, SortOption } from "@/admin/whatsapp/types";
import SortControls from "@/components/admin/whatsapp/SortControls";
import ConversationsList from "@/components/admin/whatsapp/ConversationsList";
import WhatsappsSelectionBar from "@/components/admin/WhatsappsSelectionBar";
import { useUrlState } from "@/hooks/useUrlState";
import { Template } from "@/admin/whatsapp/api/templates";

const PAGE_SIZE = 30;
export const DEFAULT_FILTERS: Filter[] = [];

type Props = {
  whatsappMessageTemplates: Template[];
};

type PageResult = {
  conversations: Conversation[];
  nextCursor: string | null;
  limit: number;
  total: number;
};

const fetcher = async ([url, body]: [string, any]) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export default function Whatsapps({ whatsappMessageTemplates }: Props) {
  const [sortOption, setSortOption] = useState<SortOption>("recent-desc");
  const [filters, setFilters] = useState<Filter[]>(DEFAULT_FILTERS);

  // Bulk selection state
  const [selectAll, setSelectAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // when not selectAll
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set()); // when selectAll

  const serializedFilters = useMemo(() => serializeFilters(filters), [filters]);

  useUrlState<Filter[]>({
    param: "f", // "f" for "filters"
    value: filters,
    encode: (v) => serializeFilters(v),
    decode: (s) => {
      try {
        return deserializeFilters(s);
      } catch {
        return [];
      }
    },
    onRead: (incoming) => {
      if (Array.isArray(incoming) && incoming.length > 0) {
        // Only update if changed to avoid unnecessary rerenders
        const nextSer = serializeFilters(incoming);
        if (nextSer !== serializedFilters) {
          setFilters(incoming);
        }
      } else {
        setFilters(DEFAULT_FILTERS);
      }
    },
    defaultFromUrlInvalid: () => DEFAULT_FILTERS,
  });

  // SWR Infinite key: stop when previous page says nextCursor=null
  const getKey = (pageIndex: number, previousPageData: PageResult | null) => {
    if (previousPageData && previousPageData.nextCursor === null) {
      return null;
    }
    const base = {
      filters: serializedFilters,
      limit: PAGE_SIZE,
      sortOption,
    } as any;
    if (pageIndex > 0 && previousPageData?.nextCursor) {
      base.cursor = previousPageData.nextCursor;
    }
    return ["/api/admin/get-whatsapp-conversations", base] as const;
  };

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<PageResult>(getKey, fetcher, {
      revalidateFirstPage: true,
      keepPreviousData: true,
    });

  // When filters change, reset to first page
  useEffect(() => {
    // Reset to page 1 and revalidate
    setSize(1);
    // Also ensure cache is revalidated with new filters
    mutate();
    // Clear selection when filters or sort change
    setSelectAll(false);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  }, [serializedFilters, setSize, mutate]);

  const pages = data ?? [];

  // Accumulate & de-dupe conversations across pages (by conversationId)
  const map = new Map<string, Conversation>();
  for (const page of pages) {
    for (const c of page.conversations ?? []) {
      if (!map.has(c.conversationId)) {
        map.set(c.conversationId, c);
      }
    }
  }
  const conversations: Conversation[] = Array.from(map.values());

  const lastPage = pages[pages.length - 1];
  const hasMore = !!lastPage?.nextCursor;
  const loadingMore = isValidating && pages.length > 0;

  const total = pages[0]?.total ?? undefined;
  const showing = conversations.length;

  const isSelected = useCallback(
    (id: string) => {
      if (selectAll) {
        return !excludedIds.has(id);
      }
      return selectedIds.has(id);
    },
    [selectAll, excludedIds, selectedIds]
  );

  const onToggleSelected = useCallback(
    (id: string, selected: boolean) => {
      if (selectAll) {
        setExcludedIds((prev) => {
          const next = new Set(prev);
          if (selected) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (selected) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });
      }
    },
    [selectAll]
  );

  const selectedCount = selectAll
    ? Math.max(0, (typeof total === "number" ? total : 0) - excludedIds.size)
    : selectedIds.size;

  const [isTransitioning, startTransition] = useTransition();

  const handleSelectAllResults = () => {
    startTransition(() => {
      setSelectAll(true);
      setSelectedIds(new Set());
      setExcludedIds(new Set());
    });
  };

  const handleClearSelection = () => {
    startTransition(() => {
      setSelectAll(false);
      setSelectedIds(new Set());
      setExcludedIds(new Set());
    });
  };

  const handleExport = useCallback(async () => {
    if (selectedCount === 0) {
      return;
    }

    const body: any = {
      filters: serializedFilters,
      sortOption,
      selectAll,
    };
    if (selectAll) {
      body.excludedConversationIds = Array.from(excludedIds);
    } else {
      body.includedConversationIds = Array.from(selectedIds);
    }

    const res = await fetch("/api/admin/export-whatsapp-conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      alert("Export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-export-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [selectedCount, serializedFilters, sortOption, selectAll, excludedIds, selectedIds]);

  return (
    <Box overflow="visible">
      <Flex flexDir="column" gap={4} mb={4} bg="white">
        <FilterBar
          filters={filters}
          onFiltersChanged={(fs) => {
            setFilters(fs);
          }}
        />
        <SortControls sortOption={sortOption} onSortChange={setSortOption} />
        <WhatsappsSelectionBar
          total={total}
          showing={showing}
          selectAll={selectAll}
          selectedCount={selectedCount}
          onSelectAllResults={handleSelectAllResults}
          onExport={handleExport}
          onClearSelection={handleClearSelection}
          isPending={isTransitioning}
        />
      </Flex>

      {isLoading && <Spinner />}
      {error && <Text color="red.500">Failed to load conversations.</Text>}

      {conversations.length > 0 && (
        <ConversationsList
          conversations={conversations}
          whatsappMessageTemplates={whatsappMessageTemplates}
          isSelected={isSelected}
          onToggleSelected={onToggleSelected}
          revalidateWhatsapps={mutate}
          onStartCall={() => {}}
        />
      )}

      <Flex mt={6} justify="center">
        {hasMore ? (
          <Button
            onClick={() => setSize(size + 1)}
            isLoading={loadingMore}
            loadingText="Loading more…"
            variant="outline"
          >
            Load more
          </Button>
        ) : (
          // Only show "No more" if we have at least one page
          pages.length > 0 && (
            <Text fontSize="sm" color="gray.500">
              No more conversations.
            </Text>
          )
        )}
      </Flex>
    </Box>
  );
}
