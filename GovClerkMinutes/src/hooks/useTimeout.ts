import { useEffect, useRef } from "react";

const useTimeout = (callback: () => void, delay: number) => {
  const timeoutRef = useRef<number | undefined>(undefined);
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const start = () => {
    clear();
    timeoutRef.current = window.setTimeout(() => savedCallback.current(), delay);
  };

  const clear = () => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  useEffect(() => {
    return clear;
  }, []);

  return { start, clear };
};

export default useTimeout;
