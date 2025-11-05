// client/src/utils/debounce.ts

// Simple debounce function
export const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return function(...args: any) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};