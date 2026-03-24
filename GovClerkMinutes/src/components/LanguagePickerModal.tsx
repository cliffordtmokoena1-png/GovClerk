import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Input,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useToast,
  VStack,
  Spinner,
  Divider,
} from "@chakra-ui/react";
import bcp47Map from "@/language/bcp47";
import { revalidateTranscriptStatus } from "@/revalidations/revalidateTranscriptStatus";
import { safeCapture } from "@/utils/safePosthog";

type LanguagePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  country: string; // e.g. "ZA"
  transcriptId: number;
};

export default function LanguagePickerModal({
  isOpen,
  onClose,
  country,
  transcriptId,
}: LanguagePickerModalProps) {
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const entries = useMemo(() => Object.entries(bcp47Map) as [string, string][], []);

  const quickPicks = useMemo(() => {
    const codeUpper = country.toUpperCase();
    return entries
      .filter(([_, code]) => code.toUpperCase().includes(codeUpper))
      .map(([name, code]) => ({ name, code }));
  }, [entries, country]);

  const normalizedQuery = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!normalizedQuery) {
      return entries.slice(0, 30).map(([name, code]) => ({ name, code }));
    }
    return entries
      .filter(([name]) => name.toLowerCase().includes(normalizedQuery))
      .slice(0, 30)
      .map(([name, code]) => ({ name, code }));
  }, [entries, normalizedQuery]);

  const handleContinue = async () => {
    if (!selected) {
      return;
    }
    setSaving(true);
    try {
      safeCapture("set_language", { language: selected, transcript_id: transcriptId, country });
      const res = await fetch("/api/set-language", {
        method: "POST",
        body: JSON.stringify({ language: selected, transcriptId }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed with ${res.status}`);
      }
      await revalidateTranscriptStatus(transcriptId);
      toast({ status: "success", title: "Language saved", duration: 2500 });
      onClose();
    } catch (err: any) {
      toast({
        status: "error",
        title: "Failed to save language",
        description: err?.message ?? "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!suggestions.length) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        setSelected(suggestions[activeIndex].code);
      } else if (suggestions.length === 1) {
        setSelected(suggestions[0].code);
      }
    }
  };

  const formatName = (pretty: string) => {
    const match = pretty.match(/^(.*?)\s*\((.*?)\)$/);
    if (!match) {
      return <Text>{pretty}</Text>;
    }
    return (
      <Text>
        {match[1]}{" "}
        <Text as="span" color="gray.500">
          ({match[2]})
        </Text>
      </Text>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg" motionPreset="scale">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>What language is this?</ModalHeader>
        <ModalCloseButton />
        <ModalBody minH="400px">
          <VStack align="stretch" spacing={4}>
            <Text color="gray.700" fontSize="md">
              Select the{" "}
              <Text as="span" fontWeight="bold">
                primary
              </Text>{" "}
              language in the recording.
            </Text>
            <Box>
              <HStack wrap="wrap" gap={2}>
                {quickPicks.map(({ name, code }) => (
                  <Button
                    key={code}
                    size="sm"
                    variant={selected === code ? "solid" : "outline"}
                    onClick={() => setSelected(code)}
                  >
                    {formatName(name)}
                  </Button>
                ))}
              </HStack>
            </Box>

            <Divider />
            <Text color="gray.700" fontSize="md">
              Or search for a language:
            </Text>

            {/* Typeahead below quick picks */}
            <Box position="relative">
              {entries.length ? (
                <>
                  <Input
                    placeholder="Type a language name…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(-1);
                      // Clear selection when typing
                      setSelected("");
                    }}
                    onKeyDown={(e) => {
                      if (!normalizedQuery) {
                        return;
                      }
                      onKeyDown(e);
                      // Hide dropdown on enter if a suggestion is selected
                      if (
                        e.key === "Enter" &&
                        ((activeIndex >= 0 && suggestions[activeIndex]) || suggestions.length === 1)
                      ) {
                        setActiveIndex(-1);
                      }
                    }}
                  />
                  {/* Show dropdown only if input is non-empty */}
                  {normalizedQuery && (
                    <Box
                      position="absolute"
                      left={0}
                      right={0}
                      zIndex={10}
                      mt={1}
                      borderWidth="1px"
                      rounded="md"
                      // Use auto height for 0 or 1 result, scrollable for >1
                      minH={
                        suggestions.length === 0
                          ? "48px"
                          : suggestions.length === 1
                            ? "auto"
                            : "120px"
                      }
                      maxH={
                        suggestions.length === 0
                          ? "48px"
                          : suggestions.length === 1
                            ? "auto"
                            : "240px"
                      }
                      overflowY={suggestions.length > 1 ? "scroll" : "hidden"}
                      bg="white"
                      boxShadow="md"
                      sx={{
                        scrollbarWidth: "auto",
                        "&::-webkit-scrollbar": {
                          width: "8px",
                          background: "#f1f1f1",
                        },
                        "&::-webkit-scrollbar-thumb": {
                          background: "#c1c1c1",
                          borderRadius: "4px",
                        },
                      }}
                    >
                      {suggestions.length === 0 ? (
                        <Box
                          p={3}
                          minH="48px"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Text color="gray.500" fontSize="sm">
                            No matches found.
                          </Text>
                        </Box>
                      ) : (
                        <List>
                          {suggestions.map(({ name, code }, idx) => {
                            const isActive = idx === activeIndex;
                            // Don't highlight as selected in dropdown, just on pick
                            return (
                              <ListItem
                                key={code}
                                px={3}
                                py={2}
                                cursor="pointer"
                                bg={isActive ? "gray.100" : "transparent"}
                                _hover={{ bg: "gray.50" }}
                                onMouseEnter={() => setActiveIndex(idx)}
                                onMouseLeave={() => setActiveIndex(-1)}
                                onClick={() => {
                                  setSelected(code);
                                  setQuery(""); // Hide dropdown
                                  setActiveIndex(-1);
                                }}
                              >
                                <HStack justify="space-between" gap={4}>
                                  <Box>
                                    {formatName(name)}
                                    <Text fontSize="xs" color="gray.500">
                                      {code}
                                    </Text>
                                  </Box>
                                  {/* Optionally show selected tag if you want */}
                                </HStack>
                              </ListItem>
                            );
                          })}
                        </List>
                      )}
                    </Box>
                  )}
                </>
              ) : (
                // Reserve space for loading spinner to prevent layout shift
                <Box minH="180px" display="flex" alignItems="center" justifyContent="center">
                  <HStack>
                    <Spinner />
                    <Text color="gray.600">Loading languages…</Text>
                  </HStack>
                </Box>
              )}
            </Box>

            {/* Selected info */}
            {selected && (
              <Box
                minH="24px"
                transition="opacity 0.2s"
                opacity={selected ? 1 : 0}
                height={selected ? "auto" : "24px"}
                pointerEvents={selected ? "auto" : "none"}
              >
                <Text fontSize="sm" color="gray.600">
                  Selected:{" "}
                  <b>
                    {formatName(
                      Object.keys(bcp47Map).find((n) => bcp47Map[n] === selected) ?? selected
                    )}
                  </b>{" "}
                  <Text as="span" color="gray.500">
                    ({selected})
                  </Text>
                </Text>
              </Box>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="blue"
            onClick={handleContinue}
            isDisabled={!selected || saving}
            isLoading={saving}
            loadingText="Saving"
          >
            Continue
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
