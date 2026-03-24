import { Box } from "@chakra-ui/react";
import { useLayoutEffect, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { WheelEvent as ReactWheelEvent, TouchEvent as ReactTouchEvent } from "react";

const TRANSCRIPT_SCROLLBAR_STYLES = {
  "&::-webkit-scrollbar": { width: "7px" },
  "&::-webkit-scrollbar-thumb": { backgroundColor: "gray", borderRadius: "7px" },
} as const;

const TRANSCRIPT_SCROLL_ANIMATIONS = {
  "@keyframes gradient-animation": {
    "0%": { backgroundPosition: "200% 0" },
    "100%": { backgroundPosition: "-200% 0" },
  },
  "@keyframes pulse": {
    "0%": { opacity: 0.5 },
    "50%": { opacity: 1 },
    "100%": { opacity: 0.5 },
  },
} as const;

export type TranscriptScrollManagerProps = {
  parentRef: RefObject<HTMLDivElement | null>;
  isScrollLocked: boolean;
  onScroll: () => void;
  onWheelCapture: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onTouchMove: (event: ReactTouchEvent<HTMLDivElement>) => void;
  children: ReactNode;
};

export function TranscriptScrollManager({
  parentRef,
  isScrollLocked,
  onScroll,
  onWheelCapture,
  onTouchMove,
  children,
}: TranscriptScrollManagerProps) {
  const [scrollbarCompensation, setScrollbarCompensation] = useState(0);

  useLayoutEffect(() => {
    const scrollContainer = parentRef.current;
    if (!scrollContainer || isScrollLocked) {
      return;
    }

    const measureScrollbar = () => {
      const width = scrollContainer.offsetWidth - scrollContainer.clientWidth;
      setScrollbarCompensation(width > 0 ? width : 0);
    };

    measureScrollbar();
    window.addEventListener("resize", measureScrollbar);

    return () => {
      window.removeEventListener("resize", measureScrollbar);
    };
  }, [parentRef, isScrollLocked]);

  return (
    <Box
      ref={parentRef}
      w="full"
      flex="1"
      bg="white"
      position="relative"
      overflowY={isScrollLocked ? "hidden" : "auto"}
      onWheelCapture={onWheelCapture}
      onTouchMove={onTouchMove}
      onScroll={onScroll}
      sx={{
        touchAction: isScrollLocked ? "none" : "auto",
        overscrollBehaviorY: isScrollLocked ? "contain" : "auto",
      }}
      css={{
        ...TRANSCRIPT_SCROLLBAR_STYLES,
        ...TRANSCRIPT_SCROLL_ANIMATIONS,
        paddingRight:
          isScrollLocked && scrollbarCompensation > 0 ? `${scrollbarCompensation}px` : undefined,
      }}
    >
      {children}
    </Box>
  );
}
