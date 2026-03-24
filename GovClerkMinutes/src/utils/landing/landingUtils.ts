import { slugMap } from "@/components/landing/pseo/config";
import { IconType } from "react-icons";
import {
  MdPeople,
  MdRecordVoiceOver,
  MdSpeed,
  MdDevices,
  MdFileDownload,
  MdDescription,
  MdAccountBalance,
  MdCheckCircle,
  MdGavel,
  MdStars,
  MdFormatAlignLeft,
  MdChecklist,
  MdAssignment,
  MdPersonPin,
  MdVerifiedUser,
  MdHistory,
  MdTimeline,
  MdGroups,
  MdAttachMoney,
  MdWarning,
  MdAccountTree,
  MdAssessment,
  MdVisibility,
  MdBlock,
  MdMood,
  MdTrendingUp,
  MdLoop,
  MdTrackChanges,
  MdAccountBalanceWallet,
  MdVolunteerActivism,
  MdShowChart,
  MdLocalHospital,
  MdMedicalServices,
  MdSecurity,
  MdPolicy,
  MdAnalytics,
  MdEngineering,
  MdCloud,
  MdMenuBook,
  MdSchool,
  MdLock,
  MdReceipt,
  MdSchedule,
  MdHandshake,
  MdFeedback,
  MdHowToVote,
} from "react-icons/md";

export const iconMap: Record<string, IconType> = {
  MdPeople,
  MdRecordVoiceOver,
  MdSpeed,
  MdDevices,
  MdFileDownload,
  MdDescription,
  MdAccountBalance,
  MdCheckCircle,
  MdGavel,
  MdStars,
  MdFormatAlignLeft,
  MdChecklist,
  MdAssignment,
  MdPersonPin,
  MdVerifiedUser,
  MdHistory,
  MdTimeline,
  MdGroups,
  MdAttachMoney,
  MdWarning,
  MdAccountTree,
  MdAssessment,
  MdVisibility,
  MdBlock,
  MdMood,
  MdTrendingUp,
  MdLoop,
  MdTrackChanges,
  MdAccountBalanceWallet,
  MdVolunteerActivism,
  MdShowChart,
  MdLocalHospital,
  MdMedicalServices,
  MdSecurity,
  MdPolicy,
  MdAnalytics,
  MdEngineering,
  MdCloud,
  MdMenuBook,
  MdSchool,
  MdLock,
  MdReceipt,
  MdSchedule,
  MdHandshake,
  MdFeedback,
  MdHowToVote,
};

export function getIcon(iconName: string): IconType {
  return iconMap[iconName] || MdDescription;
}

export function getAllSlugs(): string[] {
  return Object.keys(slugMap);
}

export function getContentId(slug: string): string | null {
  return slugMap[slug] || null;
}

export function isValidSlug(slug: string): boolean {
  return slug in slugMap;
}

/**
 * Get a specific cookie value
 */
function getCookieValue(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const value = document.cookie
    .split(";")
    .find((cookie) => cookie.trim().startsWith(`${name}=`))
    ?.split("=")[1];

  return value ? decodeURIComponent(value) : undefined;
}

/**
 * Get personalization data from cookies set by middleware
 */
export function getPersonalizationFromCookies() {
  return {
    fromFbAd: getCookieValue("mg-from-fb-ad") === "true",
    country: getCookieValue("mg-country") || "US",
  };
}
