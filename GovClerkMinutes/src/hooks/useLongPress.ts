import { useCallback, useRef, useState } from "react";
import { LONG_PRESS_DELAY } from "@/constants/layout";

export interface UseLongPressOptions {
  delay?: number;
  preventDefault?: boolean;
}

export interface UseLongPressHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

export function useLongPress(
  onLongPress: () => void,
  onClick: () => void,
  options: UseLongPressOptions = {}
): UseLongPressHandlers {
  const { delay = LONG_PRESS_DELAY, preventDefault = true } = options;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    isLongPressRef.current = false;

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, delay);
  }, [delay, onLongPress, clearTimer]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (preventDefault) {
        e.preventDefault();
      }
      startTimer();
    },
    [startTimer, preventDefault]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      clearTimer();
    },
    [clearTimer]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      clearTimer();
    },
    [clearTimer]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (preventDefault) {
        e.preventDefault();
      }
      startTimer();
    },
    [startTimer, preventDefault]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (preventDefault) {
        e.preventDefault();
      }
      clearTimer();
    },
    [clearTimer, preventDefault]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      clearTimer();
    },
    [clearTimer]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (preventDefault) {
        e.preventDefault();
      }

      if (!isLongPressRef.current) {
        onClick();
      }
      isLongPressRef.current = false;
    },
    [onClick, preventDefault]
  );

  return {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
    onClick: handleClick,
  };
}
