import { useCallback, useRef } from "react";

export const useDebouncedSave = (onSave?: (content: string) => void, delay = 500) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback(
    (content: string) => {
      if (!onSave) {
        return;
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        onSave(content);
      }, delay);
    },
    [onSave, delay]
  );

  return debouncedSave;
};
