/**
 * Portal Admin Page — Tabbed Admin Hub
 *
 * Accessible only to portal-authenticated admins.
 * Tabs:
 *   - Overview: Subscription plan card (tier, seats, streaming hours, price, status)
 *   - Streaming: Platform connections, preferred platform selector, streaming hours
 *   - Live Broadcast: Start, manage, and end live broadcasts from the portal
 *   - Members: Member list with add/edit/deactivate actions
 *   - Appearance: Portal branding (title, description, logo, colors, nav links)
 *   - Settings: Allowed email domains, portal visibility, portal URL
 *
 * URL: /portal/[slug]/admin?tab=overview|streaming|broadcast|members|appearance|settings
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { GetServerSideProps } from "next";
import { RESERVED_PORTAL_SLUGS } from "@/pages/api/portal/utils/initializePortalSettings";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Textarea,
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
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Switch,
  SimpleGrid,
  Tag,
  TagLabel,
  TagCloseButton,
} from "@chakra-ui/react";
import {
  LuUserPlus,
  LuPencil,
  LuUserX,
  LuArrowLeft,
  LuRefreshCw,
  LuBarChart2,
  LuRadio,
  LuVideo,
  LuUsers,
  LuPalette,
  LuSettings,
  LuPlus,
  LuTrash2,
  LuCopy,
  LuEye,
  LuEyeOff,
  LuExternalLink,
} from "react-icons/lu";
import type { PublicPortalResponse } from "@/types/portal";
import type { StreamPlatform } from "@/types/liveSession";
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";
import { getPortalSessionFromCookieHeader, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { getPortalDbConnection } from "@/utils/portalDb";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface StreamForm {
  preferredPlatform: StreamPlatform;
  youtubeChannelId: string;
  youtubeLiveUrl: string;
  zoomWebinarId: string;
  zoomJoinUrl: string;
  googleMeetUrl: string;
  facebookPageId: string;
  facebookLiveUrl: string;
  tiktokLiveUrl: string;
  rtmpHlsUrl: string;
  customEmbedUrl: string;
  isActive: boolean;
}

interface AppearanceForm {
  pageTitle: string;
  pageDescription: string;
  logoUrl: string;
  headerBgColor: string;
  headerTextColor: string;
  accentColor: string;
  navLinks: Array<{ label: string; url: string }>;
  isEnabled: boolean;
}

interface OrgDomain {
  id: number;
  domain: string;
  isActive: boolean;
}

interface SharedPassword {
  id: number;
  label: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface BroadcastData {
  id: number;
  orgId: string;
  meetingId: number | null;
  title: string | null;
  status: "setup" | "live" | "paused" | "ended";
  streamKey: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

interface BroadcastMeeting {
  id: number;
  title: string;
}

interface AdminPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_KEYS = ["overview", "streaming", "broadcast", "members", "appearance", "settings"] as const;
type TabKey = (typeof TAB_KEYS)[number];

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

const PLATFORM_OPTIONS: { value: StreamPlatform; label: string; description: string }[] = [
  { value: "youtube", label: "YouTube Live", description: "Embed a YouTube Live stream" },
  { value: "zoom", label: "Zoom Webinar", description: "Link to a Zoom meeting or webinar" },
  { value: "google_meet", label: "Google Meet", description: "Link to a Google Meet session" },
  { value: "facebook", label: "Facebook Live", description: "Embed a Facebook Live video" },
  { value: "tiktok", label: "TikTok Live", description: "Link to a TikTok Live stream" },
  { value: "rtmp", label: "RTMP / HLS", description: "Self-hosted stream via HLS playback URL" },
  { value: "custom", label: "Custom Embed", description: "Any iframe-embeddable URL" },
];

const DEFAULT_STREAM_FORM: StreamForm = {
  preferredPlatform: "youtube",
  youtubeChannelId: "",
  youtubeLiveUrl: "",
  zoomWebinarId: "",
  zoomJoinUrl: "",
  googleMeetUrl: "",
  facebookPageId: "",
  facebookLiveUrl: "",
  tiktokLiveUrl: "",
  rtmpHlsUrl: "",
  customEmbedUrl: "",
  isActive: true,
};

const DEFAULT_APPEARANCE_FORM: AppearanceForm = {
  pageTitle: "",
  pageDescription: "",
  logoUrl: "",
  headerBgColor: "#1e3a5f",
  headerTextColor: "#ffffff",
  accentColor: "#1e3a5f",
  navLinks: [],
  isEnabled: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Page Component ───────────────────────────────────────────────────────────

export default function PortalAdminPage({ settings, slug }: AdminPageProps) {
  const accentColor = settings.accentColor || "#1e3a5f";
  const headerBg = settings.headerBgColor || "#1e3a5f";
  const headerText = settings.headerTextColor || "#ffffff";

  const router = useRouter();
  const [tabIndex, setTabIndex] = useState(0);

  // Sync tab index from URL query on mount/change
  useEffect(() => {
    const tabKey = router.query.tab as string;
    const idx = TAB_KEYS.indexOf(tabKey as TabKey);
    setTabIndex(idx >= 0 ? idx : 0);
  }, [router.query.tab]);

  function handleTabChange(index: number) {
    setTabIndex(index);
    void router.push(
      { query: { ...router.query, tab: TAB_KEYS[index] } },
      undefined,
      { shallow: true }
    );
  }

  // ── Overview / Plan State ────────────────────────────────────────────────
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    setIsLoadingPlan(true);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/plan`);
      if (res.ok) {
        setPlan(await res.json());
      } else {
        const data = await res.json();
        setPlanError(data.error || "Failed to load plan details");
      }
    } catch {
      setPlanError("Failed to load plan details");
    } finally {
      setIsLoadingPlan(false);
    }
  }, [slug]);

  // ── Members State ────────────────────────────────────────────────────────
  const [members, setMembers] = useState<MemberData[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const addModal = useDisclosure();
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addRole, setAddRole] = useState("member");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const editModal = useDisclosure();
  const [editUser, setEditUser] = useState<MemberData | null>(null);
  const [editRole, setEditRole] = useState("member");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  const fetchMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.users ?? []);
      } else {
        const data = await res.json();
        setMembersError(data.error || "Failed to load members");
      }
    } catch {
      setMembersError("Failed to load members");
    } finally {
      setIsLoadingMembers(false);
    }
  }, [slug]);

  // ── Streaming State ──────────────────────────────────────────────────────
  const [streamForm, setStreamForm] = useState<StreamForm>(DEFAULT_STREAM_FORM);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [isSavingStream, setIsSavingStream] = useState(false);
  const [streamSaved, setStreamSaved] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const hasLoadedStream = useRef(false);

  const fetchStreamConfig = useCallback(async () => {
    setIsLoadingStream(true);
    setStreamError(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/stream-config`);
      if (res.ok) {
        const data = await res.json();
        if (data.streamConfig) {
          const sc = data.streamConfig;
          setStreamForm({
            preferredPlatform: sc.preferredPlatform ?? "youtube",
            youtubeChannelId: sc.youtubeChannelId ?? "",
            youtubeLiveUrl: sc.youtubeLiveUrl ?? "",
            zoomWebinarId: sc.zoomWebinarId ?? "",
            zoomJoinUrl: sc.zoomJoinUrl ?? "",
            googleMeetUrl: sc.googleMeetUrl ?? "",
            facebookPageId: sc.facebookPageId ?? "",
            facebookLiveUrl: sc.facebookLiveUrl ?? "",
            tiktokLiveUrl: sc.tiktokLiveUrl ?? "",
            rtmpHlsUrl: sc.rtmpHlsUrl ?? "",
            customEmbedUrl: sc.customEmbedUrl ?? "",
            isActive: sc.isActive ?? true,
          });
        }
      } else {
        const data = await res.json();
        setStreamError(data.error || "Failed to load stream configuration");
      }
    } catch {
      setStreamError("Failed to load stream configuration");
    } finally {
      setIsLoadingStream(false);
    }
  }, [slug]);

  // ── Appearance State ─────────────────────────────────────────────────────
  const [appearanceForm, setAppearanceForm] = useState<AppearanceForm>(DEFAULT_APPEARANCE_FORM);
  const [isLoadingAppearance, setIsLoadingAppearance] = useState(false);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);
  const [appearanceSaved, setAppearanceSaved] = useState(false);
  const [appearanceError, setAppearanceError] = useState<string | null>(null);
  const hasLoadedAppearance = useRef(false);
  const [newNavLabel, setNewNavLabel] = useState("");
  const [newNavUrl, setNewNavUrl] = useState("");

  const fetchAppearance = useCallback(async () => {
    setIsLoadingAppearance(true);
    setAppearanceError(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/appearance`);
      if (res.ok) {
        const data = await res.json();
        if (data.appearance) {
          const a = data.appearance;
          setAppearanceForm({
            pageTitle: a.pageTitle ?? "",
            pageDescription: a.pageDescription ?? "",
            logoUrl: a.logoUrl ?? "",
            headerBgColor: a.headerBgColor ?? "#1e3a5f",
            headerTextColor: a.headerTextColor ?? "#ffffff",
            accentColor: a.accentColor ?? "#1e3a5f",
            navLinks: a.navLinks ?? [],
            isEnabled: a.isEnabled ?? true,
          });
        }
      } else {
        const data = await res.json();
        setAppearanceError(data.error || "Failed to load appearance settings");
      }
    } catch {
      setAppearanceError("Failed to load appearance settings");
    } finally {
      setIsLoadingAppearance(false);
    }
  }, [slug]);

  // ── Settings State ───────────────────────────────────────────────────────
  const [domains, setDomains] = useState<OrgDomain[]>([]);
  const [sharedPasswords, setSharedPasswords] = useState<SharedPassword[]>([]);
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const hasLoadedSettings = useRef(false);
  const [newDomain, setNewDomain] = useState("");

  // ── Broadcast State ──────────────────────────────────────────────────────
  const [broadcast, setBroadcast] = useState<BroadcastData | null>(null);
  const [broadcastMeetings, setBroadcastMeetings] = useState<BroadcastMeeting[]>([]);
  const [isLoadingBroadcast, setIsLoadingBroadcast] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [newBroadcastTitle, setNewBroadcastTitle] = useState("");
  const [newBroadcastMeetingId, setNewBroadcastMeetingId] = useState<number | null>(null);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [isSavingBroadcast, setIsSavingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const hasLoadedBroadcast = useRef(false);

  const fetchSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setSettingsError(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/settings`);
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains ?? []);
        setSharedPasswords(data.sharedPasswords ?? []);
        setPortalEnabled(data.isEnabled ?? true);
      } else {
        const data = await res.json();
        setSettingsError(data.error || "Failed to load settings");
      }
    } catch {
      setSettingsError("Failed to load settings");
    } finally {
      setIsLoadingSettings(false);
    }
  }, [slug]);

  const fetchBroadcast = useCallback(async () => {
    setIsLoadingBroadcast(true);
    setBroadcastError(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/broadcast`);
      if (res.ok) {
        const data = await res.json();
        setBroadcast(data.broadcast ?? null);
        setBroadcastMeetings(data.meetings ?? []);
      } else {
        const data = await res.json();
        setBroadcastError(data.error || "Failed to load broadcast data");
      }
    } catch {
      setBroadcastError("Failed to load broadcast data");
    } finally {
      setIsLoadingBroadcast(false);
    }
  }, [slug]);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchPlan();
    fetchMembers();
  }, [fetchPlan, fetchMembers]);

  // Lazy-load tab-specific data on first visit
  useEffect(() => {
    const key = TAB_KEYS[tabIndex];
    if (key === "streaming" && !hasLoadedStream.current) {
      hasLoadedStream.current = true;
      fetchStreamConfig();
    } else if (key === "broadcast" && !hasLoadedBroadcast.current) {
      hasLoadedBroadcast.current = true;
      fetchBroadcast();
    } else if (key === "appearance" && !hasLoadedAppearance.current) {
      hasLoadedAppearance.current = true;
      fetchAppearance();
    } else if (key === "settings" && !hasLoadedSettings.current) {
      hasLoadedSettings.current = true;
      fetchSettings();
    }
  }, [tabIndex, fetchStreamConfig, fetchBroadcast, fetchAppearance, fetchSettings]);

  // ── Members Handlers ─────────────────────────────────────────────────────

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

  // ── Streaming Handlers ───────────────────────────────────────────────────

  async function handleSaveStream(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingStream(true);
    setStreamError(null);
    setStreamSaved(false);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/stream-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...streamForm,
          youtubeChannelId: streamForm.youtubeChannelId || undefined,
          youtubeLiveUrl: streamForm.youtubeLiveUrl || undefined,
          zoomWebinarId: streamForm.zoomWebinarId || undefined,
          zoomJoinUrl: streamForm.zoomJoinUrl || undefined,
          googleMeetUrl: streamForm.googleMeetUrl || undefined,
          facebookPageId: streamForm.facebookPageId || undefined,
          facebookLiveUrl: streamForm.facebookLiveUrl || undefined,
          tiktokLiveUrl: streamForm.tiktokLiveUrl || undefined,
          rtmpHlsUrl: streamForm.rtmpHlsUrl || undefined,
          customEmbedUrl: streamForm.customEmbedUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setStreamSaved(true);
      setTimeout(() => setStreamSaved(false), 3000);
    } catch (err: any) {
      setStreamError(err.message ?? "Save failed");
    } finally {
      setIsSavingStream(false);
    }
  }

  function handleStreamFieldChange(field: keyof StreamForm, value: string | boolean) {
    setStreamForm((prev) => ({ ...prev, [field]: value }));
    setStreamSaved(false);
  }

  // ── Appearance Handlers ──────────────────────────────────────────────────

  async function handleSaveAppearance(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingAppearance(true);
    setAppearanceError(null);
    setAppearanceSaved(false);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/appearance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageTitle: appearanceForm.pageTitle || undefined,
          pageDescription: appearanceForm.pageDescription || undefined,
          logoUrl: appearanceForm.logoUrl || undefined,
          headerBgColor: appearanceForm.headerBgColor,
          headerTextColor: appearanceForm.headerTextColor,
          accentColor: appearanceForm.accentColor,
          navLinks: appearanceForm.navLinks,
          isEnabled: appearanceForm.isEnabled,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setAppearanceSaved(true);
      setTimeout(() => setAppearanceSaved(false), 3000);
    } catch (err: any) {
      setAppearanceError(err.message ?? "Save failed");
    } finally {
      setIsSavingAppearance(false);
    }
  }

  function addNavLink() {
    if (!newNavLabel.trim() || !newNavUrl.trim()) { return; }
    setAppearanceForm((prev) => ({
      ...prev,
      navLinks: [...prev.navLinks, { label: newNavLabel.trim(), url: newNavUrl.trim() }],
    }));
    setNewNavLabel("");
    setNewNavUrl("");
  }

  function removeNavLink(index: number) {
    setAppearanceForm((prev) => ({
      ...prev,
      navLinks: prev.navLinks.filter((_, i) => i !== index),
    }));
  }

  // ── Settings Handlers ────────────────────────────────────────────────────

  async function handleTogglePortalVisibility(enabled: boolean) {
    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setPortalEnabled(data.isEnabled);
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      }
    } catch {
      setSettingsError("Failed to update portal visibility");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleAddDomain() {
    if (!newDomain.trim()) { return; }
    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addDomain: newDomain.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsError(data.error || "Failed to add domain");
        return;
      }
      setDomains(data.domains ?? []);
      setNewDomain("");
    } catch {
      setSettingsError("Failed to add domain");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleRemoveDomain(domainId: number) {
    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeDomainId: domainId }),
      });
      const data = await res.json();
      if (res.ok) {
        setDomains(data.domains ?? []);
      }
    } catch {
      setSettingsError("Failed to remove domain");
    } finally {
      setIsSavingSettings(false);
    }
  }

  // ── Broadcast Handlers ────────────────────────────────────────────────────

  async function handleSetupBroadcast() {
    setIsSavingBroadcast(true);
    setBroadcastError(null);
    setBroadcastSuccess(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: newBroadcastMeetingId ?? undefined,
          title: newBroadcastTitle.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBroadcastError(data.error || "Failed to create broadcast");
        return;
      }
      setBroadcast(data.broadcast ?? null);
      setNewBroadcastTitle("");
      setNewBroadcastMeetingId(null);
      setBroadcastSuccess("Broadcast created. Share your stream key with your streaming software.");
    } catch {
      setBroadcastError("Failed to create broadcast");
    } finally {
      setIsSavingBroadcast(false);
    }
  }

  async function handleUpdateBroadcastStatus(status: "live" | "paused" | "ended" | "setup") {
    if (!broadcast) { return; }
    setIsSavingBroadcast(true);
    setBroadcastError(null);
    setBroadcastSuccess(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/broadcast`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcastId: broadcast.id, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBroadcastError(data.error || "Failed to update broadcast");
        return;
      }
      setBroadcast(data.broadcast ?? null);
      if (status === "ended") {
        setBroadcastSuccess("Broadcast ended.");
      } else if (status === "live") {
        setBroadcastSuccess("You are now live!");
      }
    } catch {
      setBroadcastError("Failed to update broadcast");
    } finally {
      setIsSavingBroadcast(false);
    }
  }

  async function handleDeleteBroadcast() {
    if (!broadcast) { return; }
    setIsSavingBroadcast(true);
    setBroadcastError(null);
    setBroadcastSuccess(null);
    try {
      const res = await fetch(`/api/public/portal/${slug}/admin/broadcast`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcastId: broadcast.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBroadcastError(data.error || "Failed to cancel broadcast");
        return;
      }
      setBroadcast(null);
      setBroadcastSuccess("Broadcast cancelled.");
    } catch {
      setBroadcastError("Failed to cancel broadcast");
    } finally {
      setIsSavingBroadcast(false);
    }
  }

  async function handleCopyStreamKey() {
    if (!broadcast?.streamKey) { return; }
    try {
      await navigator.clipboard.writeText(broadcast.streamKey);
      setBroadcastSuccess("Stream key copied to clipboard!");
      setTimeout(() => setBroadcastSuccess(null), 2000);
    } catch {
      setBroadcastError("Failed to copy stream key");
    }
  }

  // ── Derived State ────────────────────────────────────────────────────────

  const atSeatLimit = plan ? plan.seatsUsed >= plan.seatsIncluded : false;
  const streamHoursExhausted = plan ? plan.streamHoursUsed >= plan.streamHoursIncluded : false;

  // ── Render ───────────────────────────────────────────────────────────────

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
        <Box maxW="1000px" mx="auto">
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

          <Tabs
            index={tabIndex}
            onChange={handleTabChange}
            isLazy
            colorScheme="blue"
            variant="enclosed"
          >
            <TabList mb={4} flexWrap="wrap" gap={1}>
              <Tab fontSize="sm" fontWeight="medium" gap={2}>
                <LuBarChart2 size={15} />
                Overview
              </Tab>
              <Tab fontSize="sm" fontWeight="medium" gap={2}>
                <LuRadio size={15} />
                Streaming
              </Tab>
              <Tab fontSize="sm" fontWeight="medium" gap={2}>
                <LuVideo size={15} />
                Live Broadcast
              </Tab>
              <Tab fontSize="sm" fontWeight="medium" gap={2}>
                <LuUsers size={15} />
                Members
              </Tab>
              <Tab fontSize="sm" fontWeight="medium" gap={2}>
                <LuPalette size={15} />
                Appearance
              </Tab>
              <Tab fontSize="sm" fontWeight="medium" gap={2}>
                <LuSettings size={15} />
                Settings
              </Tab>
            </TabList>

            <TabPanels>
              {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
              <TabPanel p={0}>
                <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
                  <HStack justify="space-between" mb={4}>
                    <Text fontSize="lg" fontWeight="semibold" color="gray.800">
                      Subscription Plan
                    </Text>
                    {plan && (
                      <Badge
                        colorScheme={STATUS_COLORS[plan.status] ?? "gray"}
                        px={3}
                        py={1}
                        rounded="full"
                        textTransform="capitalize"
                      >
                        {plan.status}
                      </Badge>
                    )}
                  </HStack>

                  {isLoadingPlan ? (
                    <Center py={8}><Spinner size="md" color={accentColor} /></Center>
                  ) : planError ? (
                    <Alert status="error" rounded="md"><AlertIcon />{planError}</Alert>
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

                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">Admin Seats</Text>
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
                              <Text as="span" textDecoration="underline">Upgrade your plan</Text>
                            </Link>{" "}
                            to add more members.
                          </Text>
                        )}
                      </Box>

                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">Streaming Hours</Text>
                          <Text fontSize="sm" color={streamHoursExhausted ? "red.600" : "gray.600"}>
                            {plan.streamHoursUsed} / {plan.streamHoursIncluded} hrs used
                          </Text>
                        </HStack>
                        <Progress
                          value={(plan.streamHoursUsed / Math.max(plan.streamHoursIncluded, 1)) * 100}
                          colorScheme={streamHoursExhausted ? "red" : "green"}
                          size="sm"
                          rounded="full"
                        />
                        {streamHoursExhausted && (
                          <Text fontSize="xs" color="red.600" mt={1}>
                            Streaming hours exhausted.{" "}
                            <Link href="/portal/request-quote">
                              <Text as="span" textDecoration="underline">Upgrade your plan</Text>
                            </Link>{" "}
                            to continue streaming.
                          </Text>
                        )}
                      </Box>

                      <HStack>
                        <Link href="/portal/request-quote">
                          <Button size="sm" style={{ backgroundColor: accentColor, color: "#fff" }}>
                            Upgrade / Request Quote
                          </Button>
                        </Link>
                      </HStack>
                    </VStack>
                  ) : null}
                </Box>
              </TabPanel>

              {/* ── STREAMING TAB ─────────────────────────────────────────────── */}
              <TabPanel p={0}>
                <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
                  <HStack justify="space-between" mb={2}>
                    <Text fontSize="lg" fontWeight="semibold" color="gray.800">
                      Live Streaming Configuration
                    </Text>
                    <IconButton
                      aria-label="Refresh stream config"
                      icon={<LuRefreshCw size={14} />}
                      size="sm"
                      variant="ghost"
                      onClick={() => { hasLoadedStream.current = false; fetchStreamConfig(); }}
                    />
                  </HStack>
                  <Text fontSize="sm" color="gray.500" mb={5}>
                    Configure how your live council meetings are streamed to the public.
                  </Text>

                  {isLoadingStream ? (
                    <Center py={8}><Spinner size="md" color={accentColor} /></Center>
                  ) : (
                    <form onSubmit={handleSaveStream}>
                      <VStack gap={5} align="stretch">
                        <FormControl>
                          <FormLabel fontSize="sm" fontWeight="medium">Streaming Platform</FormLabel>
                          <Select
                            size="sm"
                            value={streamForm.preferredPlatform}
                            onChange={(e) =>
                              handleStreamFieldChange("preferredPlatform", e.target.value as StreamPlatform)
                            }
                          >
                            {PLATFORM_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </Select>
                          <FormHelperText fontSize="xs">
                            {PLATFORM_OPTIONS.find((o) => o.value === streamForm.preferredPlatform)?.description}
                          </FormHelperText>
                        </FormControl>

                        {streamForm.preferredPlatform === "youtube" && (
                          <Box p={4} bg="red.50" borderWidth={1} borderColor="red.200" rounded="lg">
                            <Text fontSize="sm" fontWeight="semibold" color="red.800" mb={3}>YouTube Live</Text>
                            <VStack gap={3}>
                              <FormControl>
                                <FormLabel fontSize="xs" fontWeight="medium">Channel ID</FormLabel>
                                <Input size="sm" value={streamForm.youtubeChannelId}
                                  onChange={(e) => handleStreamFieldChange("youtubeChannelId", e.target.value)}
                                  placeholder="UCxxxxxxxxxxxxxx" />
                              </FormControl>
                              <FormControl>
                                <FormLabel fontSize="xs" fontWeight="medium">Live URL</FormLabel>
                                <Input size="sm" type="url" value={streamForm.youtubeLiveUrl}
                                  onChange={(e) => handleStreamFieldChange("youtubeLiveUrl", e.target.value)}
                                  placeholder="https://www.youtube.com/watch?v=..." />
                              </FormControl>
                            </VStack>
                          </Box>
                        )}

                        {streamForm.preferredPlatform === "zoom" && (
                          <Box p={4} bg="blue.50" borderWidth={1} borderColor="blue.200" rounded="lg">
                            <Text fontSize="sm" fontWeight="semibold" color="blue.800" mb={3}>Zoom Webinar</Text>
                            <VStack gap={3}>
                              <FormControl>
                                <FormLabel fontSize="xs" fontWeight="medium">Webinar ID</FormLabel>
                                <Input size="sm" value={streamForm.zoomWebinarId}
                                  onChange={(e) => handleStreamFieldChange("zoomWebinarId", e.target.value)}
                                  placeholder="123 456 7890" />
                              </FormControl>
                              <FormControl>
                                <FormLabel fontSize="xs" fontWeight="medium">Join URL</FormLabel>
                                <Input size="sm" type="url" value={streamForm.zoomJoinUrl}
                                  onChange={(e) => handleStreamFieldChange("zoomJoinUrl", e.target.value)}
                                  placeholder="https://zoom.us/j/..." />
                              </FormControl>
                            </VStack>
                          </Box>
                        )}

                        {streamForm.preferredPlatform === "google_meet" && (
                          <Box p={4} bg="green.50" borderWidth={1} borderColor="green.200" rounded="lg">
                            <Text fontSize="sm" fontWeight="semibold" color="green.800" mb={3}>Google Meet</Text>
                            <FormControl>
                              <FormLabel fontSize="xs" fontWeight="medium">Meet URL</FormLabel>
                              <Input size="sm" type="url" value={streamForm.googleMeetUrl}
                                onChange={(e) => handleStreamFieldChange("googleMeetUrl", e.target.value)}
                                placeholder="https://meet.google.com/xxx-xxxx-xxx" />
                            </FormControl>
                          </Box>
                        )}

                        {streamForm.preferredPlatform === "facebook" && (
                          <Box p={4} bg="blue.50" borderWidth={1} borderColor="blue.200" rounded="lg">
                            <Text fontSize="sm" fontWeight="semibold" color="blue.800" mb={3}>Facebook Live</Text>
                            <VStack gap={3}>
                              <FormControl>
                                <FormLabel fontSize="xs" fontWeight="medium">Page ID</FormLabel>
                                <Input size="sm" value={streamForm.facebookPageId}
                                  onChange={(e) => handleStreamFieldChange("facebookPageId", e.target.value)}
                                  placeholder="123456789" />
                              </FormControl>
                              <FormControl>
                                <FormLabel fontSize="xs" fontWeight="medium">Live URL</FormLabel>
                                <Input size="sm" type="url" value={streamForm.facebookLiveUrl}
                                  onChange={(e) => handleStreamFieldChange("facebookLiveUrl", e.target.value)}
                                  placeholder="https://www.facebook.com/.../videos/..." />
                              </FormControl>
                            </VStack>
                          </Box>
                        )}

                        {streamForm.preferredPlatform === "tiktok" && (
                          <Box p={4} bg="pink.50" borderWidth={1} borderColor="pink.200" rounded="lg">
                            <Text fontSize="sm" fontWeight="semibold" color="pink.800" mb={3}>TikTok Live</Text>
                            <FormControl>
                              <FormLabel fontSize="xs" fontWeight="medium">TikTok Live URL</FormLabel>
                              <Input size="sm" type="url" value={streamForm.tiktokLiveUrl}
                                onChange={(e) => handleStreamFieldChange("tiktokLiveUrl", e.target.value)}
                                placeholder="https://www.tiktok.com/@username/live" />
                            </FormControl>
                          </Box>
                        )}

                        {streamForm.preferredPlatform === "rtmp" && (
                          <Box p={4} bg="orange.50" borderWidth={1} borderColor="orange.200" rounded="lg">
                            <Text fontSize="sm" fontWeight="semibold" color="orange.800" mb={1}>RTMP / HLS Stream</Text>
                            <Text fontSize="xs" color="orange.700" mb={3}>
                              Provide the HLS playback URL (what viewers use — NOT the ingest stream key).
                            </Text>
                            <FormControl>
                              <FormLabel fontSize="xs" fontWeight="medium">HLS Playback URL</FormLabel>
                              <Input size="sm" type="url" value={streamForm.rtmpHlsUrl}
                                onChange={(e) => handleStreamFieldChange("rtmpHlsUrl", e.target.value)}
                                placeholder="https://your-server.com/stream/playlist.m3u8" />
                            </FormControl>
                          </Box>
                        )}

                        {streamForm.preferredPlatform === "custom" && (
                          <Box p={4} bg="gray.50" borderWidth={1} borderColor="gray.200" rounded="lg">
                            <Text fontSize="sm" fontWeight="semibold" color="gray.800" mb={3}>Custom Embed</Text>
                            <FormControl>
                              <FormLabel fontSize="xs" fontWeight="medium">Embed URL</FormLabel>
                              <Input size="sm" type="url" value={streamForm.customEmbedUrl}
                                onChange={(e) => handleStreamFieldChange("customEmbedUrl", e.target.value)}
                                placeholder="https://your-stream-provider.com/embed/..." />
                            </FormControl>
                          </Box>
                        )}

                        {plan && (
                          <Box p={4} bg="gray.50" borderWidth={1} borderColor="gray.200" rounded="lg">
                            <HStack justify="space-between" mb={2}>
                              <Text fontSize="sm" fontWeight="medium" color="gray.700">Streaming Hours Usage</Text>
                              <Text fontSize="sm" color={streamHoursExhausted ? "red.600" : "gray.600"}>
                                {plan.streamHoursUsed} / {plan.streamHoursIncluded} hrs
                              </Text>
                            </HStack>
                            <Progress
                              value={(plan.streamHoursUsed / Math.max(plan.streamHoursIncluded, 1)) * 100}
                              colorScheme={streamHoursExhausted ? "red" : "green"}
                              size="sm"
                              rounded="full"
                            />
                            {streamHoursExhausted && (
                              <Alert status="warning" mt={2} rounded="md" py={2}>
                                <AlertIcon />
                                <Text fontSize="xs">
                                  Streaming hours exhausted. Going live will be blocked until you upgrade your plan.
                                </Text>
                              </Alert>
                            )}
                          </Box>
                        )}

                        {streamError && (
                          <Alert status="error" rounded="md" fontSize="sm">
                            <AlertIcon />{streamError}
                          </Alert>
                        )}
                        {streamSaved && (
                          <Alert status="success" rounded="md" fontSize="sm">
                            <AlertIcon />Stream configuration saved!
                          </Alert>
                        )}

                        <Button
                          type="submit"
                          isLoading={isSavingStream}
                          style={{ backgroundColor: accentColor, color: "#fff" }}
                          size="sm"
                          alignSelf="flex-start"
                        >
                          Save Stream Configuration
                        </Button>
                      </VStack>
                    </form>
                  )}
                </Box>
              </TabPanel>

              {/* ── LIVE BROADCAST TAB ───────────────────────────────────────── */}
              <TabPanel p={0}>
                <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
                  <HStack justify="space-between" mb={2}>
                    <VStack align="start" gap={0}>
                      <Text fontSize="lg" fontWeight="semibold" color="gray.800">
                        Live Broadcast Control
                      </Text>
                      <Text fontSize="sm" color="gray.500">Manage your live council meetings</Text>
                    </VStack>
                    <IconButton
                      aria-label="Refresh broadcast"
                      icon={<LuRefreshCw size={14} />}
                      size="sm"
                      variant="ghost"
                      onClick={() => { hasLoadedBroadcast.current = false; fetchBroadcast(); }}
                    />
                  </HStack>

                  {isLoadingBroadcast ? (
                    <Center py={8}><Spinner size="md" color={accentColor} /></Center>
                  ) : plan && plan.status !== "active" && plan.status !== "trial" ? (
                    /* ── Demo / No subscription CTA ── */
                    <Box p={6} bg="blue.50" rounded="xl" borderWidth={1} borderColor="blue.200" textAlign="center">
                      <Text fontSize="2xl" mb={2}>🎥</Text>
                      <Text fontSize="md" fontWeight="semibold" color="blue.800" mb={1}>
                        Live Broadcast is a Live Plan feature
                      </Text>
                      <Text fontSize="sm" color="blue.700" mb={4}>
                        Subscribe to go live with your council meetings.
                      </Text>
                      <HStack justify="center" gap={3}>
                        <Link href="/portal/request-quote">
                          <Button size="sm" style={{ backgroundColor: accentColor, color: "#fff" }}>
                            Subscribe Now
                          </Button>
                        </Link>
                        <Link href="/portal/request-quote">
                          <Button size="sm" variant="outline" colorScheme="blue">
                            View Pricing
                          </Button>
                        </Link>
                      </HStack>
                    </Box>
                  ) : (
                    <VStack gap={5} align="stretch">
                      {broadcastError && (
                        <Alert status="error" rounded="md" fontSize="sm">
                          <AlertIcon />{broadcastError}
                        </Alert>
                      )}
                      {broadcastSuccess && (
                        <Alert status="success" rounded="md" fontSize="sm">
                          <AlertIcon />{broadcastSuccess}
                        </Alert>
                      )}

                      {/* ── Current Broadcast Status ── */}
                      {broadcast ? (
                        <Box p={4} bg="gray.50" rounded="lg" borderWidth={1} borderColor="gray.200">
                          <HStack justify="space-between" mb={3} flexWrap="wrap" gap={2}>
                            <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                              Current Broadcast
                            </Text>
                            {broadcast.status === "live" ? (
                              <Badge colorScheme="red" px={3} py={1} rounded="full" fontSize="sm" display="flex" alignItems="center" gap={1}>
                                🔴 LIVE
                              </Badge>
                            ) : broadcast.status === "setup" ? (
                              <Badge colorScheme="yellow" px={3} py={1} rounded="full" fontSize="sm">SETUP</Badge>
                            ) : broadcast.status === "paused" ? (
                              <Badge colorScheme="orange" px={3} py={1} rounded="full" fontSize="sm">PAUSED</Badge>
                            ) : null}
                          </HStack>

                          {broadcast.title && (
                            <Text fontSize="sm" color="gray.600" mb={2}>{broadcast.title}</Text>
                          )}

                          {/* Stream key */}
                          {broadcast.streamKey && (
                            <Box mb={3}>
                              <Text fontSize="xs" fontWeight="medium" color="gray.600" mb={1}>Stream Key</Text>
                              <HStack gap={2}>
                                <Input
                                  size="sm"
                                  value={showStreamKey ? broadcast.streamKey : "•".repeat(32)}
                                  readOnly
                                  fontFamily="mono"
                                  fontSize="xs"
                                  bg="white"
                                />
                                <Tooltip label={showStreamKey ? "Hide stream key" : "Show stream key"}>
                                  <IconButton
                                    aria-label="Toggle stream key visibility"
                                    icon={showStreamKey ? <LuEyeOff size={14} /> : <LuEye size={14} />}
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setShowStreamKey((v) => !v)}
                                  />
                                </Tooltip>
                                <Tooltip label="Copy stream key">
                                  <IconButton
                                    aria-label="Copy stream key"
                                    icon={<LuCopy size={14} />}
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void handleCopyStreamKey()}
                                  />
                                </Tooltip>
                              </HStack>
                            </Box>
                          )}

                          {/* Action buttons */}
                          <HStack gap={2} flexWrap="wrap">
                            {(broadcast.status === "setup" || broadcast.status === "paused") && (
                              <Button
                                size="sm"
                                colorScheme="red"
                                isLoading={isSavingBroadcast}
                                onClick={() => void handleUpdateBroadcastStatus("live")}
                              >
                                🔴 Go Live
                              </Button>
                            )}
                            {broadcast.status === "live" && (
                              <Button
                                size="sm"
                                colorScheme="orange"
                                variant="outline"
                                isLoading={isSavingBroadcast}
                                onClick={() => void handleUpdateBroadcastStatus("paused")}
                              >
                                Pause
                              </Button>
                            )}
                            {(broadcast.status === "setup" || broadcast.status === "live" || broadcast.status === "paused") && (
                              <Button
                                size="sm"
                                colorScheme="gray"
                                variant="outline"
                                isLoading={isSavingBroadcast}
                                onClick={() => {
                                  if (window.confirm("Are you sure you want to end this broadcast? This cannot be undone.")) {
                                    void handleUpdateBroadcastStatus("ended");
                                  }
                                }}
                              >
                                End Broadcast
                              </Button>
                            )}
                            {broadcast.status === "setup" && (
                              <Button
                                size="sm"
                                colorScheme="red"
                                variant="ghost"
                                isLoading={isSavingBroadcast}
                                onClick={() => {
                                  if (window.confirm("Cancel and delete this broadcast setup?")) {
                                    void handleDeleteBroadcast();
                                  }
                                }}
                              >
                                Cancel Setup
                              </Button>
                            )}
                          </HStack>
                        </Box>
                      ) : (
                        /* ── No active broadcast — setup form ── */
                        <Box>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={3}>
                            No active broadcast. Set up a new broadcast below.
                          </Text>
                          <VStack gap={3} align="stretch">
                            <FormControl>
                              <FormLabel fontSize="sm">Meeting (optional)</FormLabel>
                              <Select
                                size="sm"
                                value={newBroadcastMeetingId ?? ""}
                                onChange={(e) =>
                                  setNewBroadcastMeetingId(e.target.value ? Number(e.target.value) : null)
                                }
                              >
                                <option value="">— No meeting selected —</option>
                                {broadcastMeetings.map((m) => (
                                  <option key={m.id} value={m.id}>{m.title}</option>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControl>
                              <FormLabel fontSize="sm">Broadcast Title (optional)</FormLabel>
                              <Input
                                size="sm"
                                value={newBroadcastTitle}
                                onChange={(e) => setNewBroadcastTitle(e.target.value)}
                                placeholder="e.g. Ordinary Council Meeting — April 2026"
                              />
                            </FormControl>
                            <Button
                              size="sm"
                              style={{ backgroundColor: accentColor, color: "#fff" }}
                              alignSelf="flex-start"
                              isLoading={isSavingBroadcast}
                              onClick={() => void handleSetupBroadcast()}
                            >
                              Setup Broadcast
                            </Button>
                          </VStack>
                        </Box>
                      )}

                      {/* Public view link */}
                      <Box p={3} bg="gray.50" rounded="md" borderWidth={1} borderColor="gray.200">
                        <HStack justify="space-between" flexWrap="wrap" gap={2}>
                          <Text fontSize="sm" color="gray.600">
                            Public view:{" "}
                            <Text as="span" fontFamily="mono" fontSize="xs">
                              /portal/{slug}/broadcast
                            </Text>
                          </Text>
                          <Link href={`/portal/${slug}/broadcast`} target="_blank" rel="noreferrer">
                            <Button size="xs" variant="outline" rightIcon={<LuExternalLink size={12} />}>
                              Open ↗
                            </Button>
                          </Link>
                        </HStack>
                      </Box>
                    </VStack>
                  )}
                </Box>
              </TabPanel>

              {/* ── MEMBERS TAB ───────────────────────────────────────────────── */}
              <TabPanel p={0}>
                <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
                  <HStack justify="space-between" mb={4}>
                    <VStack align="start" gap={0}>
                      <Text fontSize="lg" fontWeight="semibold" color="gray.800">Members</Text>
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
                        label={atSeatLimit ? `Seat limit reached (${plan?.seatsIncluded ?? 0} seats). Upgrade to add more.` : "Add a new member"}
                        isDisabled={!atSeatLimit}
                      >
                        <Button
                          size="sm"
                          leftIcon={<LuUserPlus size={14} />}
                          style={atSeatLimit ? { cursor: "not-allowed", opacity: 0.5 } : { backgroundColor: accentColor, color: "#fff" }}
                          onClick={atSeatLimit ? undefined : addModal.onOpen}
                          isDisabled={atSeatLimit}
                        >
                          Add Member
                        </Button>
                      </Tooltip>
                    </HStack>
                  </HStack>

                  {membersError && (
                    <Alert status="error" rounded="md" mb={4} fontSize="sm">
                      <AlertIcon />{membersError}
                    </Alert>
                  )}

                  {isLoadingMembers ? (
                    <Center py={8}><Spinner size="md" color={accentColor} /></Center>
                  ) : members.length === 0 ? (
                    <Box py={8} textAlign="center"><Text color="gray.500">No members found.</Text></Box>
                  ) : (
                    <Box overflowX="auto">
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Name</Th><Th>Email</Th><Th>Role</Th>
                            <Th>Status</Th><Th>Last Login</Th><Th>Actions</Th>
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
                              <Td><Text fontSize="sm" color="gray.700">{member.email}</Text></Td>
                              <Td>
                                <Badge
                                  colorScheme={member.role === "admin" ? "purple" : member.role === "readonly" ? "gray" : "blue"}
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
                              <Td><Text fontSize="xs" color="gray.500">{formatDate(member.lastLoginAt)}</Text></Td>
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
              </TabPanel>

              {/* ── APPEARANCE TAB ────────────────────────────────────────────── */}
              <TabPanel p={0}>
                <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
                  <HStack justify="space-between" mb={2}>
                    <Text fontSize="lg" fontWeight="semibold" color="gray.800">Portal Branding</Text>
                    <IconButton
                      aria-label="Refresh appearance"
                      icon={<LuRefreshCw size={14} />}
                      size="sm"
                      variant="ghost"
                      onClick={() => { hasLoadedAppearance.current = false; fetchAppearance(); }}
                    />
                  </HStack>
                  <Text fontSize="sm" color="gray.500" mb={5}>Customise how your portal looks to the public.</Text>

                  {isLoadingAppearance ? (
                    <Center py={8}><Spinner size="md" color={accentColor} /></Center>
                  ) : (
                    <form onSubmit={handleSaveAppearance}>
                      <VStack gap={5} align="stretch">
                        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                          <FormControl>
                            <FormLabel fontSize="sm">Page Title</FormLabel>
                            <Input size="sm" value={appearanceForm.pageTitle}
                              onChange={(e) => setAppearanceForm((p) => ({ ...p, pageTitle: e.target.value }))}
                              placeholder="City Council — Public Records Portal" />
                          </FormControl>
                          <FormControl>
                            <FormLabel fontSize="sm">Logo URL</FormLabel>
                            <Input size="sm" type="url" value={appearanceForm.logoUrl}
                              onChange={(e) => setAppearanceForm((p) => ({ ...p, logoUrl: e.target.value }))}
                              placeholder="https://example.com/logo.png" />
                            {appearanceForm.logoUrl && (
                              <Box mt={2} p={2} bg="gray.50" rounded="md" display="inline-block"
                                borderWidth={1} borderColor="gray.200">
                                <Box as="img" src={appearanceForm.logoUrl} alt="Logo preview"
                                  style={{ height: 40, width: "auto", objectFit: "contain" }}
                                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }} />
                              </Box>
                            )}
                          </FormControl>
                        </SimpleGrid>

                        <FormControl>
                          <FormLabel fontSize="sm">Page Description</FormLabel>
                          <Textarea size="sm" value={appearanceForm.pageDescription}
                            onChange={(e) => setAppearanceForm((p) => ({ ...p, pageDescription: e.target.value }))}
                            placeholder="Access public records, meeting minutes, and council information."
                            rows={2} />
                        </FormControl>

                        <Divider />

                        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                          <FormControl>
                            <FormLabel fontSize="sm">Header Background</FormLabel>
                            <HStack gap={2}>
                              <Input size="sm" type="color" value={appearanceForm.headerBgColor}
                                onChange={(e) => setAppearanceForm((p) => ({ ...p, headerBgColor: e.target.value }))}
                                w="12" p={0} border="none" />
                              <Input size="sm" value={appearanceForm.headerBgColor}
                                onChange={(e) => setAppearanceForm((p) => ({ ...p, headerBgColor: e.target.value }))}
                                placeholder="#1e3a5f" fontFamily="mono" flex={1} />
                            </HStack>
                          </FormControl>
                          <FormControl>
                            <FormLabel fontSize="sm">Header Text</FormLabel>
                            <HStack gap={2}>
                              <Input size="sm" type="color" value={appearanceForm.headerTextColor}
                                onChange={(e) => setAppearanceForm((p) => ({ ...p, headerTextColor: e.target.value }))}
                                w="12" p={0} border="none" />
                              <Input size="sm" value={appearanceForm.headerTextColor}
                                onChange={(e) => setAppearanceForm((p) => ({ ...p, headerTextColor: e.target.value }))}
                                placeholder="#ffffff" fontFamily="mono" flex={1} />
                            </HStack>
                          </FormControl>
                          <FormControl>
                            <FormLabel fontSize="sm">Accent Colour</FormLabel>
                            <HStack gap={2}>
                              <Input size="sm" type="color" value={appearanceForm.accentColor}
                                onChange={(e) => setAppearanceForm((p) => ({ ...p, accentColor: e.target.value }))}
                                w="12" p={0} border="none" />
                              <Input size="sm" value={appearanceForm.accentColor}
                                onChange={(e) => setAppearanceForm((p) => ({ ...p, accentColor: e.target.value }))}
                                placeholder="#1e3a5f" fontFamily="mono" flex={1} />
                            </HStack>
                          </FormControl>
                        </SimpleGrid>

                        {/* Live preview */}
                        <Box>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={2}>Header Preview</Text>
                          <Box rounded="lg" overflow="hidden" borderWidth={1} borderColor="gray.200">
                            <Box p={4} style={{ backgroundColor: appearanceForm.headerBgColor, color: appearanceForm.headerTextColor }}>
                              <HStack gap={3}>
                                {appearanceForm.logoUrl && (
                                  <Box as="img" src={appearanceForm.logoUrl} alt=""
                                    style={{ height: 36, width: "auto", objectFit: "contain" }} />
                                )}
                                <Text fontWeight="bold" fontSize="md">
                                  {appearanceForm.pageTitle || "Your Organization Name"}
                                </Text>
                              </HStack>
                            </Box>
                          </Box>
                        </Box>

                        <Divider />

                        <Box>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700" mb={3}>Custom Navigation Links</Text>
                          {appearanceForm.navLinks.length > 0 && (
                            <VStack align="stretch" gap={2} mb={3}>
                              {appearanceForm.navLinks.map((link, index) => (
                                <HStack key={index} gap={2}>
                                  <Tag size="sm" variant="solid" colorScheme="blue" flex={1}>
                                    <TagLabel>{link.label} → {link.url}</TagLabel>
                                    <TagCloseButton onClick={() => removeNavLink(index)} />
                                  </Tag>
                                </HStack>
                              ))}
                            </VStack>
                          )}
                          <HStack gap={2}>
                            <Input size="sm" value={newNavLabel}
                              onChange={(e) => setNewNavLabel(e.target.value)}
                              placeholder="Link label" flex={1} />
                            <Input size="sm" value={newNavUrl}
                              onChange={(e) => setNewNavUrl(e.target.value)}
                              placeholder="https://..." flex={2} />
                            <IconButton aria-label="Add nav link" icon={<LuPlus size={14} />}
                              size="sm" onClick={addNavLink}
                              isDisabled={!newNavLabel.trim() || !newNavUrl.trim()} />
                          </HStack>
                        </Box>

                        {appearanceError && (
                          <Alert status="error" rounded="md" fontSize="sm">
                            <AlertIcon />{appearanceError}
                          </Alert>
                        )}
                        {appearanceSaved && (
                          <Alert status="success" rounded="md" fontSize="sm">
                            <AlertIcon />Appearance settings saved!
                          </Alert>
                        )}

                        <Button type="submit" isLoading={isSavingAppearance}
                          style={{ backgroundColor: accentColor, color: "#fff" }}
                          size="sm" alignSelf="flex-start">
                          Save Appearance
                        </Button>
                      </VStack>
                    </form>
                  )}
                </Box>
              </TabPanel>

              {/* ── SETTINGS TAB ──────────────────────────────────────────────── */}
              <TabPanel p={0}>
                <VStack gap={5} align="stretch">
                  <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
                    <Text fontSize="lg" fontWeight="semibold" color="gray.800" mb={1}>Portal Visibility</Text>
                    <Text fontSize="sm" color="gray.500" mb={4}>Enable or disable public access to this portal.</Text>
                    {isLoadingSettings ? (
                      <Center py={4}><Spinner size="sm" color={accentColor} /></Center>
                    ) : (
                      <HStack gap={3} align="center">
                        <Switch
                          isChecked={portalEnabled}
                          onChange={(e) => handleTogglePortalVisibility(e.target.checked)}
                          isDisabled={isSavingSettings}
                          colorScheme="green"
                          size="md"
                        />
                        <Text fontSize="sm" color={portalEnabled ? "green.600" : "red.500"} fontWeight="medium">
                          {portalEnabled ? "Portal is enabled (public can access)" : "Portal is disabled (access blocked)"}
                        </Text>
                        {isSavingSettings && <Spinner size="xs" />}
                      </HStack>
                    )}
                  </Box>

                  <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
                    <Text fontSize="lg" fontWeight="semibold" color="gray.800" mb={1}>Portal URL</Text>
                    <Text fontSize="sm" color="gray.500" mb={3}>Share this link so the public can access your portal.</Text>
                    <Box p={3} bg="gray.50" rounded="md" borderWidth={1} borderColor="gray.200"
                      fontFamily="mono" fontSize="sm" color="blue.600">
                      {typeof window !== "undefined" ? `${window.location.origin}/portal/${slug}` : `/portal/${slug}`}
                    </Box>
                  </Box>

                  <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
                    <HStack justify="space-between" mb={1}>
                      <Text fontSize="lg" fontWeight="semibold" color="gray.800">Allowed Email Domains</Text>
                      <IconButton
                        aria-label="Refresh settings"
                        icon={<LuRefreshCw size={14} />}
                        size="sm"
                        variant="ghost"
                        onClick={() => { hasLoadedSettings.current = false; fetchSettings(); }}
                      />
                    </HStack>
                    <Text fontSize="sm" color="gray.500" mb={4}>
                      Only users with email addresses from these domains can register and sign in.
                    </Text>

                    {settingsError && (
                      <Alert status="error" rounded="md" mb={3} fontSize="sm">
                        <AlertIcon />{settingsError}
                      </Alert>
                    )}
                    {settingsSaved && (
                      <Alert status="success" rounded="md" mb={3} fontSize="sm">
                        <AlertIcon />Settings updated!
                      </Alert>
                    )}

                    {isLoadingSettings ? (
                      <Center py={4}><Spinner size="sm" color={accentColor} /></Center>
                    ) : (
                      <VStack align="stretch" gap={3}>
                        {domains.filter((d) => d.isActive).length === 0 ? (
                          <Text fontSize="sm" color="gray.400" fontStyle="italic">
                            No allowed domains configured. All email addresses are currently accepted.
                          </Text>
                        ) : (
                          <VStack align="stretch" gap={2}>
                            {domains.filter((d) => d.isActive).map((domain) => (
                              <HStack key={domain.id} justify="space-between" p={2}
                                bg="gray.50" rounded="md" borderWidth={1} borderColor="gray.200">
                                <Text fontSize="sm" fontFamily="mono">@{domain.domain}</Text>
                                <IconButton
                                  aria-label={`Remove domain ${domain.domain}`}
                                  icon={<LuTrash2 size={13} />}
                                  size="xs" variant="ghost" colorScheme="red"
                                  isLoading={isSavingSettings}
                                  onClick={() => handleRemoveDomain(domain.id)}
                                />
                              </HStack>
                            ))}
                          </VStack>
                        )}
                        <HStack gap={2} mt={2}>
                          <Input size="sm" value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder="capetown.gov.za" fontFamily="mono"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddDomain(); } }} />
                          <Button size="sm" leftIcon={<LuPlus size={13} />}
                            onClick={() => void handleAddDomain()}
                            isLoading={isSavingSettings} isDisabled={!newDomain.trim()}
                            style={{ backgroundColor: accentColor, color: "#fff" }}>
                            Add Domain
                          </Button>
                        </HStack>
                      </VStack>
                    )}
                  </Box>

                  {sharedPasswords.length > 0 && (
                    <Box bg="white" rounded="xl" shadow="sm" p={6} borderWidth={1} borderColor="gray.200">
                      <Text fontSize="lg" fontWeight="semibold" color="gray.800" mb={1}>Shared Access Passwords</Text>
                      <Text fontSize="sm" color="gray.500" mb={4}>
                        Shared passwords allow groups (e.g. public gallery) to sign in without individual accounts.
                      </Text>
                      <VStack align="stretch" gap={2}>
                        {sharedPasswords.map((pw) => (
                          <HStack key={pw.id} p={3} bg="gray.50" rounded="md"
                            borderWidth={1} borderColor="gray.200" justify="space-between">
                            <VStack align="start" gap={0}>
                              <Text fontSize="sm" fontWeight="medium">{pw.label}</Text>
                              {pw.expiresAt && (
                                <Text fontSize="xs" color="gray.500">Expires: {formatDate(pw.expiresAt)}</Text>
                              )}
                            </VStack>
                            <Badge colorScheme={pw.isActive ? "green" : "red"} fontSize="xs">
                              {pw.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Box>

      {/* ── Add Member Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={addModal.isOpen} onClose={addModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Member</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleAddMember}>
            <ModalBody>
              <VStack gap={4}>
                {addError && <Alert status="error" rounded="md" fontSize="sm"><AlertIcon />{addError}</Alert>}
                {addSuccess && <Alert status="success" rounded="md" fontSize="sm"><AlertIcon />{addSuccess}</Alert>}
                <HStack gap={3} width="full">
                  <FormControl>
                    <FormLabel fontSize="sm">First Name</FormLabel>
                    <Input size="sm" value={addFirstName}
                      onChange={(e) => setAddFirstName(e.target.value)} placeholder="Jane" />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Last Name</FormLabel>
                    <Input size="sm" value={addLastName}
                      onChange={(e) => setAddLastName(e.target.value)} placeholder="Smith" />
                  </FormControl>
                </HStack>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Work Email</FormLabel>
                  <Input size="sm" type="email" value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="jane@organisation.gov" autoComplete="off" />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Password</FormLabel>
                  <Input size="sm" type="password" value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Minimum 8 characters" autoComplete="new-password" />
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
              <Button size="sm" variant="ghost" onClick={addModal.onClose}>Cancel</Button>
              <Button size="sm" type="submit" isLoading={isAdding}
                style={{ backgroundColor: accentColor, color: "#fff" }}>
                Add Member
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ── Edit Member Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Member</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleEditMember}>
            <ModalBody>
              <VStack gap={4}>
                {editError && <Alert status="error" rounded="md" fontSize="sm"><AlertIcon />{editError}</Alert>}
                {editUser && (
                  <Box width="full" p={3} bg="gray.50" rounded="md">
                    <Text fontSize="sm" color="gray.600">{editUser.email}</Text>
                  </Box>
                )}
                <HStack gap={3} width="full">
                  <FormControl>
                    <FormLabel fontSize="sm">First Name</FormLabel>
                    <Input size="sm" value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)} placeholder="Jane" />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Last Name</FormLabel>
                    <Input size="sm" value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)} placeholder="Smith" />
                  </FormControl>
                </HStack>
                <FormControl>
                  <FormLabel fontSize="sm">Role</FormLabel>
                  <Select size="sm" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="readonly">Read-Only</option>
                  </Select>
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter gap={2}>
              <Button size="sm" variant="ghost" onClick={editModal.onClose}>Cancel</Button>
              <Button size="sm" type="submit" isLoading={isEditing}
                style={{ backgroundColor: accentColor, color: "#fff" }}>
                Save Changes
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}

// ─── Server-Side Props ────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async (context) => {
  const { slug } = context.params as { slug: string };

  if (RESERVED_PORTAL_SLUGS.has(slug)) {
    return { notFound: true };
  }

  const cookieHeader = context.req.headers.cookie;

  const session = await getPortalSessionFromCookieHeader(cookieHeader);
  if (!session) {
    return {
      redirect: {
        destination: `/portal/${slug}/sign-in?redirect=/portal/${slug}/admin`,
        permanent: false,
      },
    };
  }

  if (!isGovClerkAdmin(session.email ?? null)) {
    if (session.portalUserId) {
      const conn = getPortalDbConnection();
      const userResult = await conn.execute(
        "SELECT role FROM gc_portal_users WHERE id = ? AND org_id = ?",
        [session.portalUserId, session.orgId]
      );
      if (userResult.rows.length === 0 || (userResult.rows[0] as any).role !== "admin") {
        return { redirect: { destination: `/portal/${slug}/trial`, permanent: false } };
      }
    } else {
      return { redirect: { destination: `/portal/${slug}/trial`, permanent: false } };
    }
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