import {
  HiHome,
  HiCalendar,
  HiGlobeAlt,
  HiRectangleGroup,
  HiUser,
  HiBuildingOffice,
  HiWrenchScrewdriver,
  HiSignal,
  HiUsers,
} from "react-icons/hi2";

export type SidebarSection = null | "MANAGE" | "SETTINGS" | "DEVELOPER";

export interface OrgSidebarItem {
  id: string;
  label: string;
  icon: any;
  href: string;
  isPlaceholder?: boolean;
  section?: SidebarSection;
  adminOnly?: boolean;
}

export const ORG_SIDEBAR_ITEMS: OrgSidebarItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: HiHome,
    href: "/a/dashboard",
    section: null,
  },
  {
    id: "meetings",
    label: "Meetings",
    icon: HiCalendar,
    href: "/a/meetings",
    section: "MANAGE",
  },
  {
    id: "broadcast",
    label: "Broadcast",
    icon: HiSignal,
    href: "/a/broadcast",
    section: "MANAGE",
  },
  {
    id: "portal",
    label: "Public Portal",
    icon: HiGlobeAlt,
    href: "/a/portal",
    section: "MANAGE",
  },
  {
    id: "boards",
    label: "Boards",
    icon: HiRectangleGroup,
    href: "/a/boards",
    section: "MANAGE",
  },
  {
    id: "team",
    label: "Team Members",
    icon: HiUsers,
    href: "/a/team",
    section: "MANAGE",
  },
  {
    id: "account",
    label: "Account",
    icon: HiUser,
    href: "/a/account",
    section: "SETTINGS",
  },
  {
    id: "organization",
    label: "Organization",
    icon: HiBuildingOffice,
    href: "/a/organization",
    section: "SETTINGS",
  },
  {
    id: "admin",
    label: "Admin Portal",
    icon: HiWrenchScrewdriver,
    href: "/a/admin",
    section: "DEVELOPER",
    adminOnly: true,
  },
];

export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const SIDEBAR_EXPANDED_WIDTH = 240;
export const MOBILE_BREAKPOINT = 768;
