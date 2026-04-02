/**
 * Portal Admin Page — Members & Plan Management
 *
 * Accessible only to portal-authenticated admins.
 * Shows:
 * - Current subscription plan overview (tier, seats, streaming hours)
 * - Member list with add/edit/deactivate actions
 *
 * URL: /portal/[slug]/admin
 */

import { useState, useEffect, useCallback } from "react";
import { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Text,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  Badge,
  Progress,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Spinner,
  Center,
  Divider,
  Tooltip,
  IconButton,
} from "@chakra-ui/react";
import { LuUserPlus, LuPencil, LuUserX, LuArrowLeft, LuRefreshCw } from "react-icons/lu";
import type { PublicPortalResponse } from "@/types/portal";
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";
import { getPortalSessionFromCookieHeader } from "@/portal-auth/portalAuth";
import { getPortalDbConnection } from "@/utils/portalDb";

interface PlanData {
  tier: string;
  seatsIncluded: number;
  seatsUsed: number;
  streamHoursIncluded: number;
  streamHoursUsed: number;
  monthlyPriceZar: number;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

interface MemberData {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AdminPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
}

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
  custom: "Custom",
};

const STATUS_COLORS: Record<string, string> = {
  active: "green",
  trial: "blue",
  suspended: "red",
  cancelled: "gray",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Member",
  readonly: "Read-Only",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) { return "Never"; }
  try {
    return new Date(dateStr).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function PortalAdminPage({ settings, slug }: AdminPageProps) {
  const accentColor = settings.accentColor || "#1e3a5f";
  const headerBg = settings.headerBgColor || "#1e3a5f";
  const headerText = settings.headerTextColor || "#ffffff";

  const [plan, setPlan] = useState<PlanData | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Add member modal
  const addModal = useDisclosure();
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addRole, setAddRole] = useState("member");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Edit member modal
  const editModal = useDisclosure();
  const [editUser, setEditUser] = useState<MemberData | null>(null);
  const [editRole, setEditRole] = useState("member");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  const fetchPlan = useCallback(async () => {
    setIsLoadingPlan(true);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/plan`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      } else {
        const data = await res.json();
        setPageError(data.error || "Failed to load plan details");
      }
    } catch {
      setPageError("Failed to load plan details");
    } finally {
      setIsLoadingPlan(false);
    }
  }, [slug]);

  const fetchMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.users ?? []);
      } else {
        const data = await res.json();
        setPageError(data.error || "Failed to load members");
      }
    } catch {
      setPageError("Failed to load members");
    } finally {
      setIsLoadingMembers(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPlan();
    fetchMembers();
  }, [fetchPlan, fetchMembers]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);
    setIsAdding(true);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addEmail,
          password: addPassword,
          firstName: addFirstName || undefined,
          lastName: addLastName || undefined,
          role: addRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to add member");
        return;
      }
      setAddSuccess("Member added successfully.");
      setAddEmail("");
      setAddPassword("");
      setAddFirstName("");
      setAddLastName("");
      setAddRole("member");
      fetchMembers();
      fetchPlan();
      setTimeout(() => {
        addModal.onClose();
        setAddSuccess(null);
      }, 1500);
    } catch {
      setAddError("An unexpected error occurred.");
    } finally {
      setIsAdding(false);
    }
  }

  function openEditModal(user: MemberData) {
    setEditUser(user);
    setEditRole(user.role);
    setEditFirstName(user.firstName ?? "");
    setEditLastName(user.lastName ?? "");
    setEditError(null);
    editModal.onOpen();
  }

  async function handleEditMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) { return; }
    setEditError(null);
    setIsEditing(true);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/members/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          firstName: editFirstName || undefined,
          lastName: editLastName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to update member");
        return;
      }
      fetchMembers();
      editModal.onClose();
    } catch {
      setEditError("An unexpected error occurred.");
    } finally {
      setIsEditing(false);
    }
  }

  async function handleDeactivate(userId: number) {
    setDeactivatingId(userId);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/members/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchMembers();
        fetchPlan();
      }
    } finally {
      setDeactivatingId(null);
    }
  }

  const atSeatLimit = plan ? plan.seatsUsed >= plan.seatsIncluded : false;

  return (
    <>
      <Head>
        <title>Admin — {settings.pageTitle ?? "Portal"}</title>
      </Head>

      {/* Header */}
      <Box style={{ backgroundColor: headerBg }} py={4} px={6}>
        <HStack gap={4}>
          {settings.logoUrl && (
            <Box
              as="img"
              src={settings.logoUrl}
              alt=""
              style={{ height: 48, width: "auto", objectFit: "contain" }}
            />
          )}
          <Text fontWeight="bold" fontSize="xl" style={{ color: headerText }}>
            {settings.pageTitle ?? "Public Records Portal"}
          </Text>
        </HStack>
      </Box>

      <Box minH="100vh" bg="gray.50" py={8} px={4}>
        <Box maxW="900px" mx="auto">
          {/* Back link */}
          <Box mb={6}>
            <Link href={`/portal/${slug}`}>
              <HStack gap={1} display="inline-flex" color="gray.600" _hover={{ color: "gray.900" }}>
                <LuArrowLeft size={14} />
                <Text fontSize="sm">Back to Portal</Text>
              </HStack>
            </Link>
          </Box>

          <Text fontSize="2xl" fontWeight="bold" color="gray.900" mb={6}>
            Portal Administration
          </Text>

          {pageError && (
            <Alert status="error" rounded="md" mb={6}>
              <AlertIcon />
              {pageError}
            </Alert>
          )}

          {/* ── Plan Overview ───────────────────────────────────────── */}
          <Box bg="white" rounded="xl" shadow="sm" p={6} mb={6} borderWidth={1} borderColor="gray.200">
            <HStack justify="space-between" mb={4}>
              <Text fontSize="lg" fontWeight="semibold" color="gray.800">
                Subscription Plan
              </Text>
              {plan && (
                <Badge colorScheme={STATUS_COLORS[plan.status] ?? "gray"} px={3} py={1} rounded="full" textTransform="capitalize">
                  {plan.status}
                </Badge>
              )}
            </HStack>

            {isLoadingPlan ? (
              <Center py={8}>
                <Spinner size="md" color={accentColor} />
              </Center>
            ) : plan ? (
              <VStack gap={5} align="stretch">
                <HStack gap={6} flexWrap="wrap">
                  <Box>
                    <Text fontSize="sm" color="gray.500">Plan</Text>
                    <Text fontSize="xl" fontWeight="bold" color="gray.900">
                      {TIER_LABELS[plan.tier] ?? plan.tier}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Monthly Price</Text>
                    <Text fontSize="xl" fontWeight="bold" color="gray.900">
                      R{plan.monthlyPriceZar.toLocaleString("en-ZA")}/mo
                    </Text>
                  </Box>
                  {plan.currentPeriodEnd && (
                    <Box>
                      <Text fontSize="sm" color="gray.500">Renews</Text>
                      <Text fontSize="sm" fontWeight="medium" color="gray.700">
                        {formatDate(plan.currentPeriodEnd)}
                      </Text>
                    </Box>
                  )}
                  {plan.status === "trial" && plan.trialEndsAt && (
                    <Box>
                      <Text fontSize="sm" color="gray.500">Trial Ends</Text>
                      <Text fontSize="sm" fontWeight="medium" color="blue.600">
                        {formatDate(plan.trialEndsAt)}
                      </Text>
                    </Box>
                  )}
                </HStack>

                <Divider />

                {/* Seats progress */}
                <Box>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="sm" fontWeight="medium" color="gray.700">
                      Admin Seats
                    </Text>
                    <Text fontSize="sm" color={atSeatLimit ? "red.600" : "gray.600"}>
                      {plan.seatsUsed} / {plan.seatsIncluded} used
                    </Text>
                  </HStack>
                  <Progress
                    value={(plan.seatsUsed / Math.max(plan.seatsIncluded, 1)) * 100}
                    colorScheme={atSeatLimit ? "red" : "blue"}
                    size="sm"
                    rounded="full"
                  />
                  {atSeatLimit && (
                    <Text fontSize="xs" color="red.600" mt={1}>
                      You&apos;ve reached your seat limit.{" "}
                      <Link href="/portal/request-quote">
                        <Text as="span" textDecoration="underline">
                          Upgrade your plan
                        </Text>
                      </Link>{" "}
                      to add more members.
                    </Text>
                  )}
                </Box>

                {/* Streaming hours progress */}
                <Box>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="sm" fontWeight="medium" color="gray.700">
                      Streaming Hours
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {plan.streamHoursUsed} / {plan.streamHoursIncluded} hrs used
                    </Text>
                  </HStack>
                  <Progress
                    value={
                      (plan.streamHoursUsed / Math.max(plan.streamHoursIncluded, 1)) * 100
                    }
                    colorScheme={
                      plan.streamHoursUsed >= plan.streamHoursIncluded ? "red" : "green"
                    }
                    size="sm"
                    rounded="full"
                  />
                </Box>

                <HStack>
                  <Link href="/portal/request-quote">
                    <Button
                      size="sm"
                      style={{ backgroundColor: accentColor, color: "#fff" }}
                    >
                      Upgrade / Request Quote
                    </Button>
                  </Link>
                </HStack>
              </VStack>
            ) : null}
          </Box>

          {/* ── Members Management ───────────────────────────────────── */}
          <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
            <HStack justify="space-between" mb={4}>
              <VStack align="start" gap={0}>
                <Text fontSize="lg" fontWeight="semibold" color="gray.800">
                  Members
                </Text>
                {plan && (
                  <Text fontSize="sm" color="gray.500">
                    {plan.seatsUsed} of {plan.seatsIncluded} seats used
                  </Text>
                )}
              </VStack>

              <HStack gap={2}>
                <IconButton
                  aria-label="Refresh members"
                  icon={<LuRefreshCw size={14} />}
                  size="sm"
                  variant="ghost"
                  onClick={() => { fetchMembers(); fetchPlan(); }}
                />
                <Tooltip
                  label={
                    atSeatLimit
                      ? `Seat limit reached (${plan?.seatsIncluded ?? 0} seats). Upgrade to add more.`
                      : "Add a new member"
                  }
                  isDisabled={!atSeatLimit}
                >
                  <Button
                    size="sm"
                    leftIcon={<LuUserPlus size={14} />}
                    style={
                      atSeatLimit
                        ? { cursor: "not-allowed", opacity: 0.5 }
                        : { backgroundColor: accentColor, color: "#fff" }
                    }
                    onClick={atSeatLimit ? undefined : addModal.onOpen}
                    isDisabled={atSeatLimit}
                  >
                    Add Member
                  </Button>
                </Tooltip>
              </HStack>
            </HStack>

            {isLoadingMembers ? (
              <Center py={8}>
                <Spinner size="md" color={accentColor} />
              </Center>
            ) : members.length === 0 ? (
              <Box py={8} textAlign="center">
                <Text color="gray.500">No members found.</Text>
              </Box>
            ) : (
              <Box overflowX="auto">
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Role</Th>
                      <Th>Status</Th>
                      <Th>Last Login</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {members.map((member) => (
                      <Tr key={member.id} opacity={member.isActive ? 1 : 0.5}>
                        <Td>
                          <Text fontWeight="medium" fontSize="sm">
                            {[member.firstName, member.lastName].filter(Boolean).join(" ") || "—"}
                          </Text>
                        </Td>
                        <Td>
                          <Text fontSize="sm" color="gray.700">
                            {member.email}
                          </Text>
                        </Td>
                        <Td>
                          <Badge
                            colorScheme={
                              member.role === "admin"
                                ? "purple"
                                : member.role === "readonly"
                                ? "gray"
                                : "blue"
                            }
                            fontSize="xs"
                          >
                            {ROLE_LABELS[member.role] ?? member.role}
                          </Badge>
                        </Td>
                        <Td>
                          <Badge colorScheme={member.isActive ? "green" : "red"} fontSize="xs">
                            {member.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </Td>
                        <Td>
                          <Text fontSize="xs" color="gray.500">
                            {formatDate(member.lastLoginAt)}
                          </Text>
                        </Td>
                        <Td>
                          <HStack gap={1}>
                            <Tooltip label="Edit member">
                              <IconButton
                                aria-label="Edit member"
                                icon={<LuPencil size={13} />}
                                size="xs"
                                variant="ghost"
                                onClick={() => openEditModal(member)}
                              />
                            </Tooltip>
                            {member.isActive && (
                              <Tooltip label="Deactivate member">
                                <IconButton
                                  aria-label="Deactivate member"
                                  icon={<LuUserX size={13} />}
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="red"
                                  isLoading={deactivatingId === member.id}
                                  onClick={() => handleDeactivate(member.id)}
                                />
                              </Tooltip>
                            )}
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Add Member Modal ─────────────────────────────────────────── */}
      <Modal isOpen={addModal.isOpen} onClose={addModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Member</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleAddMember}>
            <ModalBody>
              <VStack gap={4}>
                {addError && (
                  <Alert status="error" rounded="md" fontSize="sm">
                    <AlertIcon />
                    {addError}
                  </Alert>
                )}
                {addSuccess && (
                  <Alert status="success" rounded="md" fontSize="sm">
                    <AlertIcon />
                    {addSuccess}
                  </Alert>
                )}
                <HStack gap={3} width="full">
                  <FormControl>
                    <FormLabel fontSize="sm">First Name</FormLabel>
                    <Input
                      size="sm"
                      value={addFirstName}
                      onChange={(e) => setAddFirstName(e.target.value)}
                      placeholder="Jane"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Last Name</FormLabel>
                    <Input
                      size="sm"
                      value={addLastName}
                      onChange={(e) => setAddLastName(e.target.value)}
                      placeholder="Smith"
                    />
                  </FormControl>
                </HStack>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Work Email</FormLabel>
                  <Input
                    size="sm"
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="jane@organisation.gov"
                    autoComplete="off"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Password</FormLabel>
                  <Input
                    size="sm"
                    type="password"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Role</FormLabel>
                  <Select size="sm" value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="readonly">Read-Only</option>
                  </Select>
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter gap={2}>
              <Button size="sm" variant="ghost" onClick={addModal.onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                isLoading={isAdding}
                style={{ backgroundColor: accentColor, color: "#fff" }}
              >
                Add Member
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ── Edit Member Modal ─────────────────────────────────────────── */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Member</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleEditMember}>
            <ModalBody>
              <VStack gap={4}>
                {editError && (
                  <Alert status="error" rounded="md" fontSize="sm">
                    <AlertIcon />
                    {editError}
                  </Alert>
                )}
                {editUser && (
                  <Box width="full" p={3} bg="gray.50" rounded="md">
                    <Text fontSize="sm" color="gray.600">
                      {editUser.email}
                    </Text>
                  </Box>
                )}
                <HStack gap={3} width="full">
                  <FormControl>
                    <FormLabel fontSize="sm">First Name</FormLabel>
                    <Input
                      size="sm"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="Jane"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Last Name</FormLabel>
                    <Input
                      size="sm"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Smith"
                    />
                  </FormControl>
                </HStack>
                <FormControl>
                  <FormLabel fontSize="sm">Role</FormLabel>
                  <Select
                    size="sm"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="readonly">Read-Only</option>
                  </Select>
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter gap={2}>
              <Button size="sm" variant="ghost" onClick={editModal.onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                isLoading={isEditing}
                style={{ backgroundColor: accentColor, color: "#fff" }}
              >
                Save Changes
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async (context) => {
  const { slug } = context.params as { slug: string };
  const cookieHeader = context.req.headers.cookie;

  // Check portal session server-side — redirect to sign-in if not authenticated
  const session = await getPortalSessionFromCookieHeader(cookieHeader);
  if (!session) {
    return {
      redirect: {
        destination: `/portal/${slug}/sign-in?redirect=/portal/${slug}/admin`,
        permanent: false,
      },
    };
  }

  // Check that the user is an admin
  if (session.portalUserId) {
    const conn = getPortalDbConnection();
    const userResult = await conn.execute(
      "SELECT role FROM gc_portal_users WHERE id = ? AND org_id = ?",
      [session.portalUserId, session.orgId]
    );
    if (userResult.rows.length === 0 || (userResult.rows[0] as any).role !== "admin") {
      return {
        redirect: {
          destination: `/portal/${slug}`,
          permanent: false,
        },
      };
    }
  } else {
    // Shared-password sessions don't have admin access
    return {
      redirect: {
        destination: `/portal/${slug}`,
        permanent: false,
      },
    };
  }

  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  let settings = makeDefaultPortalSettings(slug);
  try {
    const res = await fetch(`${baseUrl}/api/public/portal/${slug}`);
    if (res.ok) {
      const data: PublicPortalResponse = await res.json();
      settings = data.settings;
    }
  } catch {
    // Network error — use default settings
  }

  return { props: { settings, slug } };
};
