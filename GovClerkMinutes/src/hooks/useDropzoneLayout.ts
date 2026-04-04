import { useColorModeValue } from "@chakra-ui/react";

export type LayoutState = {
  isDragActive: boolean;
  recordingState?:
    | "idle"
    | "requesting-permission"
    | "permission-denied"
    | "recording"
    | "paused"
    | "stopped";
};

export type LayoutConfig = {
  container: {
    width: Record<string, string> | string;
    height?: Record<string, string> | string;
    minHeight?: Record<string, string>;
    bg: string;
    borderWidth: string;
    borderStyle: string;
    borderColor: string;
    borderRadius: string;
    padding: Record<string, number | string>;
    margin?: Record<string, number | string>;
    transform?: string;
    boxShadow?: string;
    transition: string;
  };
  icon: {
    size: Record<string, number>;
    color: string;
    bg: string;
    padding: Record<string, number>;
  };
  text: {
    heading: {
      size: Record<string, string>;
      color: string;
    };
    body: {
      fontSize: Record<string, string>;
      color: string;
      content?: Record<string, string>;
    };
    subtitle: {
      fontSize: Record<string, string>;
      color: string;
    };
  };
  spacing: Record<string, number>;
};

export const LAYOUT_CONSTANTS = {
  EXPANDED_HEIGHT: { base: "70vh", md: "500px" },
  EXPANDED_MIN_HEIGHT: { base: "400px", md: "500px" },
  CARD_HEIGHT: { base: "220px", md: "min(400px, 55vh)" },
  DESKTOP_CARD_HEIGHT: "min(400px, 55vh)",
  ICON_SIZES: {
    upload: { base: 10, md: 10 },
    uploadExpanded: { base: 16, md: 16 },
    mic: { base: 8, md: 8 },
    micExpanded: { base: 12, md: 10 },
  },
  SPACING: {
    card: { base: 4, md: 8 },
    cardExpanded: { base: 6, md: 8 },
    icon: { base: 4, md: 6 },
    iconExpanded: { base: 6, md: 6 },
  },
  TEXT_SIZES: {
    heading: { base: "lg", md: "lg" },
    headingExpanded: { base: "2xl", md: "2xl" },
    body: { base: "md", md: "lg" },
    bodyExpanded: { base: "xl", md: "xl" },
    subtitle: { base: "sm", md: "md" },
  },
  TEXT_CONTENT: {
    upload: {
      action: { base: "Tap to upload a file", md: "Drag and drop or click here" },
    },
    recording: {
      action: { base: "Tap to start recording", md: "Click to start recording" },
    },
  },
} as const;

export const useDropzoneLayout = ({ isDragActive, recordingState }: LayoutState) => {
  const bgColor = useColorModeValue("white", "gray.800");

  const getDragActiveConfig = (): LayoutConfig => ({
    container: {
      width: { base: "full", md: "md", lg: "4xl" },
      height: LAYOUT_CONSTANTS.EXPANDED_HEIGHT,
      minHeight: LAYOUT_CONSTANTS.EXPANDED_MIN_HEIGHT,
      bg: "blue.100",
      borderWidth: "4px",
      borderStyle: "dashed",
      borderColor: "blue.500",
      borderRadius: "2xl",
      padding: LAYOUT_CONSTANTS.SPACING.cardExpanded,
      margin: { base: 4, md: 0 },
      transform: "scale(1.02)",
      boxShadow: "xl",
      transition: "all 0.3s ease-in-out",
    },
    icon: {
      size: LAYOUT_CONSTANTS.ICON_SIZES.uploadExpanded,
      color: "blue.600",
      bg: "blue.200",
      padding: LAYOUT_CONSTANTS.SPACING.iconExpanded,
    },
    text: {
      heading: {
        size: LAYOUT_CONSTANTS.TEXT_SIZES.headingExpanded,
        color: "blue.700",
      },
      body: {
        fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.bodyExpanded,
        color: "blue.600",
      },
      subtitle: {
        fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.subtitle,
        color: "gray.500",
      },
    },
    spacing: LAYOUT_CONSTANTS.SPACING.cardExpanded,
  });

  const getRecordingActiveConfig = (): LayoutConfig => ({
    container: {
      width: { base: "full", md: "md", lg: "4xl" },
      height: LAYOUT_CONSTANTS.EXPANDED_HEIGHT,
      minHeight: LAYOUT_CONSTANTS.EXPANDED_MIN_HEIGHT,
      bg: "red.50",
      borderWidth: "3px",
      borderStyle: "solid",
      borderColor: "red.300",
      borderRadius: "2xl",
      padding: LAYOUT_CONSTANTS.SPACING.cardExpanded,
      margin: { base: 4, md: 0 },
      boxShadow: "lg",
      transition: "all 0.3s",
    },
    icon: {
      size: LAYOUT_CONSTANTS.ICON_SIZES.micExpanded,
      color: "red.500",
      bg: "red.100",
      padding: LAYOUT_CONSTANTS.SPACING.iconExpanded,
    },
    text: {
      heading: {
        size: LAYOUT_CONSTANTS.TEXT_SIZES.headingExpanded,
        color: "red.700",
      },
      body: {
        fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.bodyExpanded,
        color: "red.600",
      },
      subtitle: {
        fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.subtitle,
        color: "red.500",
      },
    },
    spacing: LAYOUT_CONSTANTS.SPACING.cardExpanded,
  });

  const getUploadCardConfig = (): LayoutConfig => ({
    container: {
      width: "full",
      height: { base: "auto", lg: LAYOUT_CONSTANTS.DESKTOP_CARD_HEIGHT },
      minHeight: LAYOUT_CONSTANTS.CARD_HEIGHT,
      bg: "blue.50",
      borderWidth: "3px",
      borderStyle: "dashed",
      borderColor: "blue.400",
      borderRadius: "xl",
      padding: LAYOUT_CONSTANTS.SPACING.card,
      transition: "all 0.2s",
    },
    icon: {
      size: LAYOUT_CONSTANTS.ICON_SIZES.upload,
      color: "blue.600",
      bg: "blue.200",
      padding: LAYOUT_CONSTANTS.SPACING.icon,
    },
    text: {
      heading: {
        size: LAYOUT_CONSTANTS.TEXT_SIZES.heading,
        color: "blue.700",
      },
      body: {
        fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.body,
        color: "blue.600",
        content: LAYOUT_CONSTANTS.TEXT_CONTENT.upload.action,
      },
      subtitle: {
        fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.subtitle,
        color: "gray.500",
      },
    },
    spacing: LAYOUT_CONSTANTS.SPACING.card,
  });

  const getRecordingCardConfig = (recordingState?: string): LayoutConfig => {
    if (recordingState === "permission-denied") {
      return {
        container: {
          width: "full",
          height: { base: "auto", lg: LAYOUT_CONSTANTS.DESKTOP_CARD_HEIGHT },
          minHeight: LAYOUT_CONSTANTS.CARD_HEIGHT,
          bg: "orange.50",
          borderWidth: "2px",
          borderStyle: "solid",
          borderColor: "orange.300",
          borderRadius: "xl",
          padding: LAYOUT_CONSTANTS.SPACING.card,
          transition: "all 0.2s",
        },
        icon: {
          size: LAYOUT_CONSTANTS.ICON_SIZES.mic,
          color: "orange.500",
          bg: "orange.100",
          padding: LAYOUT_CONSTANTS.SPACING.icon,
        },
        text: {
          heading: {
            size: LAYOUT_CONSTANTS.TEXT_SIZES.heading,
            color: "orange.600",
          },
          body: {
            fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.body,
            color: "orange.500",
            content: LAYOUT_CONSTANTS.TEXT_CONTENT.recording.action,
          },
          subtitle: {
            fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.subtitle,
            color: "gray.500",
          },
        },
        spacing: LAYOUT_CONSTANTS.SPACING.card,
      };
    }

    // Requesting permission state
    if (recordingState === "requesting-permission") {
      return {
        container: {
          width: "full",
          height: { base: "auto", lg: LAYOUT_CONSTANTS.DESKTOP_CARD_HEIGHT },
          minHeight: LAYOUT_CONSTANTS.CARD_HEIGHT,
          bg: "blue.50",
          borderWidth: "2px",
          borderStyle: "solid",
          borderColor: "blue.300",
          borderRadius: "xl",
          padding: LAYOUT_CONSTANTS.SPACING.card,
          transition: "all 0.2s",
        },
        icon: {
          size: LAYOUT_CONSTANTS.ICON_SIZES.mic,
          color: "blue.500",
          bg: "blue.100",
          padding: LAYOUT_CONSTANTS.SPACING.icon,
        },
        text: {
          heading: {
            size: LAYOUT_CONSTANTS.TEXT_SIZES.heading,
            color: "blue.600",
          },
          body: {
            fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.body,
            color: "blue.500",
            content: LAYOUT_CONSTANTS.TEXT_CONTENT.recording.action,
          },
          subtitle: {
            fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.subtitle,
            color: "blue.500",
          },
        },
        spacing: LAYOUT_CONSTANTS.SPACING.card,
      };
    }

    return {
      container: {
        width: "full",
        height: { base: "auto", lg: LAYOUT_CONSTANTS.DESKTOP_CARD_HEIGHT },
        minHeight: LAYOUT_CONSTANTS.CARD_HEIGHT,
        bg: bgColor,
        borderWidth: "2px",
        borderStyle: "dashed",
        borderColor: "gray.300",
        borderRadius: "xl",
        padding: LAYOUT_CONSTANTS.SPACING.card,
        transition: "all 0.2s",
      },
      icon: {
        size: LAYOUT_CONSTANTS.ICON_SIZES.mic,
        color: "gray.500",
        bg: "gray.100",
        padding: LAYOUT_CONSTANTS.SPACING.icon,
      },
      text: {
        heading: {
          size: LAYOUT_CONSTANTS.TEXT_SIZES.heading,
          color: "gray.600",
        },
        body: {
          fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.body,
          color: "gray.500",
          content: LAYOUT_CONSTANTS.TEXT_CONTENT.recording.action,
        },
        subtitle: {
          fontSize: LAYOUT_CONSTANTS.TEXT_SIZES.subtitle,
          color: "gray.400",
        },
      },
      spacing: LAYOUT_CONSTANTS.SPACING.card,
    };
  };

  if (isDragActive) {
    return { type: "dragActive" as const, config: getDragActiveConfig() };
  }

  return {
    type: "normal" as const,
    uploadCard: getUploadCardConfig(),
    recordingCard: getRecordingCardConfig(recordingState),
  };
};
