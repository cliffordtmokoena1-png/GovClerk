export function debounce<F extends (...args: any[]) => void>(
  func: F,
  wait: number
): ((...args: Parameters<F>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null;

  const debounced = function (...args: Parameters<F>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as typeof debounced & { cancel: () => void };
}
