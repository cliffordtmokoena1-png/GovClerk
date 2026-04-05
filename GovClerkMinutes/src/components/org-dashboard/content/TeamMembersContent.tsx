import { useState, useCallback, useEffect, useRef } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  useDisclosure,
  Spinner,
  Alert,
  AlertIcon,
  Tooltip,
  Flex,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from "@chakra-ui/react";
import { HiPlus, HiTrash, HiPencil } from "react-icons/hi2";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useOrgAppBarTitle } from "../context/OrgAppBarContext";
import type { TeamMember, TeamMemberRole } from "@/pages/api/team-members/index";

const STATUS_COLORS: Record<string, string> = {
  pending: "yellow",
  active: "green",
  revoked: "red",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "purple",
  member: "blue",
};

interface AddMemberFormData {
  email: string;
  role: TeamMemberRole;
}

interface EditMemberFormData {
  role: TeamMemberRole;
}

function AddMemberModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddMemberFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<AddMemberFormData>({ email: "", role: "member" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.email) return;
    setIsSubmitting(true);
    try {
      await onAdd(form);
      setForm({ email: "", role: "member" });
      onClose();
    } catch {
      // error toast handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Invite Team Member</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack gap={4}>
            <FormControl isRequired>
              <FormLabel>Email address</FormLabel>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                autoFocus
              />
            </FormControl>
            <FormControl>
              <FormLabel>Role</FormLabel>
              <Select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as TeamMemberRole }))}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack gap={3}>
            <Button variant="ghost" onClick={onClose} isDisabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              isDisabled={!form.email}
            >
              Send Invite
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function EditMemberModal({
  member,
  isOpen,
  onClose,
  onUpdate,
}: {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: number, data: EditMemberFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<EditMemberFormData>({ role: member?.role ?? "member" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync form state when the member prop changes (e.g. editing a different member)
  useEffect(() => {
    if (member) {
      setForm({ role: member.role });
    }
  }, [member]);

  const handleSubmit = async () => {
    if (!member) return;
    setIsSubmitting(true);
    try {
      await onUpdate(member.id, form);
      onClose();
    } catch {
      // error toast handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Team Member</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel>Role</FormLabel>
            <Select
              value={form.role}
              onChange={(e) => setForm({ role: e.target.value as TeamMemberRole })}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <HStack gap={3}>
            <Button variant="ghost" onClick={onClose} isDisabled={isSubmitting}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSubmit} isLoading={isSubmitting}>
              Save Changes
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function TeamMembersContent() {
  useOrgAppBarTitle("Team Members", true);

  const { members, isLoading, error, addMember, updateMember, removeMember } = useTeamMembers();

  const addModal = useDisclosure();
  const editModal = useDisclosure();
  const removeDialog = useDisclosure();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleAdd = useCallback(
    async (data: AddMemberFormData) => {
      await addMember({ email: data.email, role: data.role });
    },
    [addMember]
  );

  const handleEdit = useCallback(
    (member: TeamMember) => {
      setSelectedMember(member);
      editModal.onOpen();
    },
    [editModal]
  );

  const handleUpdate = useCallback(
    async (id: number, data: EditMemberFormData) => {
      await updateMember(id, { role: data.role });
    },
    [updateMember]
  );

  const handleRemoveClick = useCallback(
    (member: TeamMember) => {
      setMemberToRemove(member);
      removeDialog.onOpen();
    },
    [removeDialog]
  );

  const handleRemoveConfirm = useCallback(async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);
    try {
      await removeMember(memberToRemove.id);
      removeDialog.onClose();
    } catch {
      // error toast handled in hook
    } finally {
      setIsRemoving(false);
    }
  }, [memberToRemove, removeMember, removeDialog]);

  return (
    <div className="h-full w-full overflow-auto p-6 md:p-10">
      <Box maxW="5xl" mx="auto">
        <HStack justify="space-between" mb={6}>
          <VStack align="start" gap={0}>
            <Text fontSize="2xl" fontWeight="bold" color="gray.900">
              Team Members
            </Text>
            <Text fontSize="sm" color="gray.500">
              Invite and manage members who can access your GovClerk Minutes dashboard.
            </Text>
          </VStack>
          <Button
            leftIcon={<HiPlus />}
            colorScheme="blue"
            size="sm"
            onClick={addModal.onOpen}
          >
            Invite Member
          </Button>
        </HStack>

        {error && (
          <Alert status="error" mb={4} rounded="md">
            <AlertIcon />
            Failed to load team members. Please try again.
          </Alert>
        )}

        {isLoading ? (
          <Flex justify="center" align="center" py={12}>
            <Spinner size="lg" color="blue.500" />
          </Flex>
        ) : members.length === 0 ? (
          <Box
            border="1px dashed"
            borderColor="gray.200"
            rounded="xl"
            p={12}
            textAlign="center"
            bg="white"
          >
            <Text color="gray.500" mb={3}>
              No team members yet.
            </Text>
            <Button
              leftIcon={<HiPlus />}
              colorScheme="blue"
              variant="outline"
              size="sm"
              onClick={addModal.onOpen}
            >
              Invite your first team member
            </Button>
          </Box>
        ) : (
          <Box bg="white" rounded="xl" shadow="sm" borderWidth={1} borderColor="gray.200" overflow="hidden">
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Invited</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {members.map((member) => (
                    <Tr key={member.id} opacity={member.status === "revoked" ? 0.5 : 1}>
                      <Td>
                        <Text fontSize="sm" fontWeight="medium">
                          {member.memberEmail}
                        </Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={ROLE_COLORS[member.role] ?? "gray"} fontSize="xs">
                          {member.role}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge colorScheme={STATUS_COLORS[member.status] ?? "gray"} fontSize="xs">
                          {member.status}
                        </Badge>
                      </Td>
                      <Td>
                        <Text fontSize="xs" color="gray.500">
                          {new Date(member.invitedAt).toLocaleDateString()}
                        </Text>
                      </Td>
                      <Td>
                        <HStack gap={1}>
                          {member.status !== "revoked" && (
                            <>
                              <Tooltip label="Edit role">
                                <IconButton
                                  aria-label="Edit member"
                                  icon={<HiPencil />}
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => handleEdit(member)}
                                />
                              </Tooltip>
                              <Tooltip label="Remove member">
                                <IconButton
                                  aria-label="Remove member"
                                  icon={<HiTrash />}
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="red"
                                  onClick={() => handleRemoveClick(member)}
                                />
                              </Tooltip>
                            </>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Box>
        )}
      </Box>

      <AddMemberModal isOpen={addModal.isOpen} onClose={addModal.onClose} onAdd={handleAdd} />

      <EditMemberModal
        member={selectedMember}
        isOpen={editModal.isOpen}
        onClose={editModal.onClose}
        onUpdate={handleUpdate}
      />

      <AlertDialog
        isOpen={removeDialog.isOpen}
        leastDestructiveRef={cancelRef}
        onClose={removeDialog.onClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Remove Team Member
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to remove{" "}
              <Text as="span" fontWeight="semibold">
                {memberToRemove?.memberEmail}
              </Text>{" "}
              from your team? They will lose access immediately.
            </AlertDialogBody>
            <AlertDialogFooter>
              <HStack gap={3}>
                <Button ref={cancelRef} onClick={removeDialog.onClose} isDisabled={isRemoving}>
                  Cancel
                </Button>
                <Button
                  colorScheme="red"
                  onClick={handleRemoveConfirm}
                  isLoading={isRemoving}
                >
                  Remove
                </Button>
              </HStack>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </div>
  );
}

export default TeamMembersContent;
