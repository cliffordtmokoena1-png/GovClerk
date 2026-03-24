import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stack,
  Text,
  Textarea,
  Input,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { MdEdit, MdFlashOn, MdDelete, MdAdd } from "react-icons/md";
import TemplateVariablesEditor from "./TemplateVariablesEditor";
import {
  QuickReply,
  createQuickReply,
  deleteQuickReply,
  listQuickReplies,
  updateQuickReply,
} from "@/admin/whatsapp/api/quickReplies";
import { extractVariables } from "@/admin/whatsapp/utils";
import type { Conversation } from "@/admin/whatsapp/types";

type Props = {
  onInsert: (text: string) => void;
  conversation?: Conversation;
};

// Replace {{var}} tokens in body with values provided. If a value is missing, leave the token intact.
function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g, (_m, name: string) => {
    const v = variables[name];
    return typeof v === "string" && v.length > 0 ? v : _m;
  });
}

export default function QuickReplyPicker({ onInsert, conversation }: Props) {
  const [items, setItems] = useState<QuickReply[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedForUse, setSelectedForUse] = useState<QuickReply | null>(null);
  const [selectedForEdit, setSelectedForEdit] = useState<QuickReply | null>(null);
  const { isOpen: isUseOpen, onOpen: onUseOpen, onClose: onUseClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listQuickReplies();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load quick replies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Lazy-load on first menu open via onOpen handler, but also load initially to speed UX
    load();
  }, [load]);

  const handleOpenUse = useCallback(
    (item: QuickReply) => {
      setSelectedForUse(item);
      onUseOpen();
    },
    [onUseOpen]
  );

  const handleOpenCreate = useCallback(() => {
    setSelectedForEdit({
      id: "",
      name: "",
      body: "",
      createdAt: new Date().toISOString(),
    });
    onEditOpen();
  }, [onEditOpen]);

  const handleOpenEdit = useCallback(
    (item: QuickReply) => {
      setSelectedForEdit(item);
      onEditOpen();
    },
    [onEditOpen]
  );

  // Use Modal state
  const [useVariables, setUseVariables] = useState<Record<string, string>>({});
  useEffect(() => {
    // Reset variables when switching selected item; seed with conversation context
    const defaults: Record<string, string> = {};
    const prospectName = conversation?.leadName || "";
    if (prospectName) {
      defaults.name = prospectName;
    }
    setUseVariables(defaults);
  }, [selectedForUse, conversation]);

  const onUseVariableChange = useCallback((key: string, value: string) => {
    setUseVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onInsertFromUse = useCallback(() => {
    if (!selectedForUse) {
      return;
    }
    const rendered = renderTemplate(selectedForUse.body, useVariables);
    onInsert(rendered);
    onUseClose();
  }, [onInsert, onUseClose, selectedForUse, useVariables]);

  // Edit/Create Modal state
  const isCreate = selectedForEdit != null && selectedForEdit.id === "";
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  useEffect(() => {
    if (selectedForEdit) {
      setEditName(selectedForEdit.name);
      setEditBody(selectedForEdit.body);
    } else {
      setEditName("");
      setEditBody("");
    }
  }, [selectedForEdit]);

  const editTemplate: any = useMemo(() => ({ bodyOriginal: editBody }), [editBody]);
  const [editVariables, setEditVariables] = useState<Record<string, string>>({});
  useEffect(() => {
    // Reset when body changes to new set of variables; seed with conversation context
    setEditVariables((prev) => {
      const allowed = new Set(extractVariables(editBody));
      const next: Record<string, string> = {};
      for (const k of allowed) {
        if (prev[k] !== undefined) {
          next[k] = prev[k] ?? "";
        } else if (k === "name" && conversation?.leadName) {
          next[k] = conversation.leadName;
        } else {
          next[k] = "";
        }
      }
      return next;
    });
  }, [editBody, conversation]);

  const onEditVariableChange = useCallback((key: string, value: string) => {
    setEditVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onSaveEdit = useCallback(async () => {
    const name = editName.trim();
    const body = editBody.trim();
    if (!name || !body) {
      toast({ title: "Name and body are required", status: "warning" });
      return;
    }
    try {
      if (isCreate) {
        await createQuickReply({ name, body });
      } else if (selectedForEdit) {
        await updateQuickReply(selectedForEdit.id, { name, body });
      }
      onEditClose();
      await load();
      toast({ title: isCreate ? "Quick reply created" : "Quick reply updated", status: "success" });
    } catch (e: any) {
      toast({
        title: "Failed to save quick reply",
        description: e?.message || "",
        status: "error",
      });
    }
  }, [editBody, editName, isCreate, load, onEditClose, selectedForEdit, toast]);

  const onDelete = useCallback(async () => {
    if (!selectedForEdit || isCreate) {
      return;
    }
    try {
      await deleteQuickReply(selectedForEdit.id);
      onEditClose();
      await load();
      toast({ title: "Quick reply deleted", status: "success" });
    } catch (e: any) {
      toast({
        title: "Failed to delete quick reply",
        description: e?.message || "",
        status: "error",
      });
    }
  }, [isCreate, load, onEditClose, selectedForEdit, toast]);

  return (
    <>
      <Menu>
        <MenuButton
          as={IconButton}
          aria-label="Quick replies"
          icon={<MdFlashOn />}
          colorScheme="yellow"
          variant="solid"
          onClick={() => {
            if (items == null && !loading) {
              load();
            }
          }}
        />
        <MenuList minW="360px">
          <Box px={3} pt={2} pb={1}>
            <HStack justify="space-between">
              <Text fontWeight="bold">Quick replies</Text>
              <Button
                size="xs"
                leftIcon={<MdAdd />}
                onClick={handleOpenCreate}
                colorScheme="yellow"
              >
                Add new
              </Button>
            </HStack>
          </Box>
          {loading && (
            <Box px={3} py={3}>
              <HStack>
                <Spinner size="sm" />
                <Text fontSize="sm">Loading…</Text>
              </HStack>
            </Box>
          )}
          {error && (
            <Box px={3} py={3}>
              <Text fontSize="sm" color="red.500">
                {error}
              </Text>
            </Box>
          )}
          {!loading && !error && (items?.length ?? 0) === 0 && (
            <Box px={3} py={3}>
              <Text fontSize="sm" color="gray.600">
                No quick replies yet. Click &quot;Add new&quot; to create one.
              </Text>
            </Box>
          )}
          {!loading && !error && items && items.length > 0 && (
            <Box maxH="300px" overflowY="auto">
              {items.map((item) => (
                <HStack key={item.id} px={2} py={1} _hover={{ bg: "gray.50" }}>
                  <MenuItem
                    onClick={() => handleOpenUse(item)}
                    flex="1"
                    minH="auto"
                    py={2}
                    _hover={{ bg: "transparent" }}
                  >
                    <Stack spacing={0} align="start">
                      <Text fontWeight="medium">{item.name}</Text>
                      <Text fontSize="xs" color="gray.600" noOfLines={1}>
                        {item.body}
                      </Text>
                    </Stack>
                  </MenuItem>
                  <IconButton
                    aria-label="Edit quick reply"
                    icon={<MdEdit />}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenEdit(item)}
                  />
                </HStack>
              ))}
            </Box>
          )}
        </MenuList>
      </Menu>

      {/* Use/Insert modal */}
      <Modal isOpen={isUseOpen} onClose={onUseClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedForUse?.name || "Quick reply"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedForUse && (
              <Stack spacing={3}>
                <Text fontSize="sm" color="gray.600">
                  Example quick reply based on this conversation. Available variables: name.
                </Text>
                <TemplateVariablesEditor
                  template={{ bodyOriginal: selectedForUse.body } as any}
                  variables={useVariables}
                  onVariableChange={onUseVariableChange}
                />
                <Box p={3} bg="white" border="1px solid" borderColor="gray.200" borderRadius="md">
                  <Text fontSize="sm" whiteSpace="pre-wrap">
                    {renderTemplate(selectedForUse.body, useVariables)}
                  </Text>
                </Box>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onUseClose} variant="ghost">
              Close
            </Button>
            <Button colorScheme="yellow" onClick={onInsertFromUse}>
              Insert
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Create/Edit modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isCreate ? "Add quick reply" : "Edit quick reply"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Input
                placeholder="Name"
                bg="white"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <Textarea
                placeholder="Type message body. Use {{name}} style variables."
                bg="white"
                rows={6}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
              <TemplateVariablesEditor
                template={editTemplate}
                variables={editVariables}
                onVariableChange={onEditVariableChange}
              />
            </Stack>
          </ModalBody>
          <ModalFooter>
            {!isCreate && (
              <Button
                leftIcon={<MdDelete />}
                colorScheme="red"
                variant="ghost"
                mr="auto"
                onClick={onDelete}
              >
                Delete
              </Button>
            )}
            <Button mr={3} onClick={onEditClose} variant="ghost">
              Cancel
            </Button>
            <Button colorScheme="yellow" onClick={onSaveEdit}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
