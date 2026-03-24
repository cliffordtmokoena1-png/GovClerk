/**
 * Constants related to motion management and voting.
 */

import type { MgMotion, MotionStatus, VoteType } from "@/types/agenda";

/**
 * Color mappings for motion status badges.
 * Uses Tailwind CSS classes for background and text colors.
 */
export const STATUS_COLORS: Record<MotionStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  passed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  tabled: "bg-blue-100 text-blue-800",
  withdrawn: "bg-gray-100 text-gray-800",
};

/**
 * Display labels for motion statuses.
 */
export const STATUS_LABELS: Record<MotionStatus, string> = {
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  tabled: "Tabled",
  withdrawn: "Withdrawn",
};

/**
 * Color mappings for boolean motion states (is_withdrawn, is_tabled).
 * Uses the same colors as the corresponding status enum values.
 */
export const BOOLEAN_STATE_COLORS = {
  withdrawn: "bg-gray-100 text-gray-800",
  tabled: "bg-blue-100 text-blue-800",
} as const;

/**
 * Display labels for boolean motion states.
 */
export const BOOLEAN_STATE_LABELS = {
  withdrawn: "Withdrawn",
  tabled: "Tabled",
} as const;

/**
 * Gets the effective display status of a motion.
 * Prioritizes boolean flags over the status enum for backwards compatibility.
 * @param motion - The motion to get display status for
 * @returns The effective status string and color class
 */
export function getMotionDisplayStatus(motion: MgMotion): {
  label: string;
  colorClass: string;
} {
  // Boolean flags take precedence (new schema)
  if (motion.is_withdrawn) {
    return {
      label: BOOLEAN_STATE_LABELS.withdrawn,
      colorClass: BOOLEAN_STATE_COLORS.withdrawn,
    };
  }
  if (motion.is_tabled) {
    return {
      label: BOOLEAN_STATE_LABELS.tabled,
      colorClass: BOOLEAN_STATE_COLORS.tabled,
    };
  }

  // Determine status from vote counts (no status enum anymore)
  const votesFor = motion.votes_for ?? 0;
  const votesAgainst = motion.votes_against ?? 0;

  // If no votes recorded, it's pending
  if (votesFor === 0 && votesAgainst === 0) {
    return {
      label: STATUS_LABELS.pending,
      colorClass: STATUS_COLORS.pending,
    };
  }

  // Determine passed/failed based on vote comparison
  if (votesFor > votesAgainst) {
    return {
      label: STATUS_LABELS.passed,
      colorClass: STATUS_COLORS.passed,
    };
  }

  return {
    label: STATUS_LABELS.failed,
    colorClass: STATUS_COLORS.failed,
  };
}

/**
 * Color mappings for vote type badges.
 */
export const VOTE_COLORS: Record<VoteType, string> = {
  yes: "bg-green-100 text-green-800",
  no: "bg-red-100 text-red-800",
  abstain: "bg-yellow-100 text-yellow-800",
  absent: "bg-gray-100 text-gray-800",
};

/**
 * Display labels for vote types.
 */
export const VOTE_LABELS: Record<VoteType, string> = {
  yes: "Yes",
  no: "No",
  abstain: "Abstain",
  absent: "Absent",
};

/**
 * Color for uncast votes (null vote_value).
 */
export const UNCAST_VOTE_COLOR = "bg-gray-50 text-gray-400";

/**
 * Display label for uncast votes.
 */
export const UNCAST_VOTE_LABEL = "Not Cast";
