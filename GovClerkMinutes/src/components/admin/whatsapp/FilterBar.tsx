import React, { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  Popover,
  PopoverTrigger,
  Text,
  VStack,
  Wrap,
  useOutsideClick,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { FILTER_REGISTRY, ADD_MENU } from "@/admin/whatsapp/filter/index";
import { removeFilter, upsertFilterRight } from "@/admin/whatsapp/filter/utils";
import { Filter, FilterType } from "@/admin/whatsapp/filter/types";

type Props = {
  filters: Filter[];
  onFiltersChanged: (next: Filter[]) => void;
  placeholder?: string;
};

export default function FilterBar({ filters, onFiltersChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(0);
  const [query, setQuery] = useState("");
  const [openFilterType, setOpenFilterType] = useState<FilterType | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  useOutsideClick({ ref: containerRef as any, handler: () => setOpen(false) });

  const byType = useMemo(() => new Set(filters.map((f) => f.type)), [filters]);
  const visibleOptions = ADD_MENU.filter((o) => !byType.has(o.type)).filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  const openPanelFromButton = () => {
    if (!containerRef.current || !addBtnRef.current) {
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const btnRect = addBtnRef.current.getBoundingClientRect();
    setLeft(btnRect.left - containerRect.left);
    setQuery("");
    setOpen(true);
  };

  const selectOption = (type: FilterType) => {
    const def = FILTER_REGISTRY[type];
    const next = upsertFilterRight(filters, { type, value: def.defaultValue() } as Filter);
    onFiltersChanged(next);
    setOpen(false);
    // Immediately open the editor for the added filter
    setOpenFilterType(type);
  };

  return (
    <Box position="relative" ref={containerRef}>
      <Box
        role="group"
        w="100%"
        px={3}
        py={2}
        borderWidth="1px"
        borderRadius="md"
        bg="white"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest("[data-filter-pill]") ||
            target.closest("[data-chakra-popover]") ||
            target.closest("[data-add-filter-btn]")
          ) {
            return;
          }
          openPanelFromButton();
        }}
      >
        <Flex align="center" gap={2} wrap="wrap">
          <Wrap spacing={2}>
            {filters.map((f, i) => {
              const Def = FILTER_REGISTRY[f.type];
              return (
                <Popover
                  placement="bottom-start"
                  key={`${f.type}-${i}`}
                  isOpen={openFilterType === f.type}
                  onOpen={() => setOpenFilterType(f.type)}
                  onClose={() => setOpenFilterType((prev) => (prev === f.type ? null : prev))}
                >
                  <PopoverTrigger>
                    {Def.Pill({
                      value: f.value,
                      onRemove: () => onFiltersChanged(removeFilter(filters, f.type)),
                    })}
                  </PopoverTrigger>
                  <Def.Editor
                    value={f.value}
                    onChange={(nextVal) =>
                      onFiltersChanged(
                        filters.map((x) => (x.type === f.type ? { ...x, value: nextVal } : x))
                      )
                    }
                  />
                </Popover>
              );
            })}
          </Wrap>

          <HStack flex="1" minH="28px">
            <Button
              data-add-filter-btn
              ref={addBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                openPanelFromButton();
              }}
              size="sm"
              leftIcon={<AddIcon boxSize={3} />}
              variant="outline"
              colorScheme="purple"
            >
              Add filter
            </Button>
          </HStack>
        </Flex>
      </Box>

      {open && (
        <Box
          position="absolute"
          top="100%"
          left={left}
          mt={1}
          zIndex={10000}
          bg="white"
          borderWidth="1px"
          borderRadius="md"
          boxShadow="md"
          minW="200px"
          p={2}
        >
          <VStack align="stretch" spacing={1} maxH="200px" overflowY="auto">
            {visibleOptions.length === 0 && (
              <Text fontSize="xs" color="gray.500" px={1}>
                No matches
              </Text>
            )}
            {visibleOptions.map((opt) => (
              <Button
                key={opt.type}
                size="sm"
                justifyContent="flex-start"
                variant="ghost"
                onClick={() => selectOption(opt.type)}
              >
                {opt.label}
              </Button>
            ))}
          </VStack>
        </Box>
      )}
    </Box>
  );
}
