export type AnnouncementVariant = "info" | "warning" | "error" | "success" | "slow-network";

export type Announcement = {
  id: string;
  text: string;
  variant: AnnouncementVariant;
  customColor?: string;
  customBg?: string;
  action?: () => void;
  actionText?: string;
  actionLink?: string;
  dismissible: boolean;
  transcriptId?: number;
};

export const ANNOUNCEMENT_BAR_HEIGHT_PX = 40;

export const SLOW_NETWORK_TEXT =
  "Slow network detected. Uploads may take longer than usual or fail.";
