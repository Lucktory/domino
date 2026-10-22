import { useSyncExternalStore } from "react";

/** Two-column screens: must match `@media (min-aspect-ratio: 4/3) and (min-width: 560px)` in styles.css. */
export const WIDE_LAYOUT_QUERY = "(min-aspect-ratio: 4/3) and (min-width: 560px)";

/** The player asked the system for less motion. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Whether a CSS media query matches now; updates when it changes (rotation, window resize). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    () => window.matchMedia(query).matches,
  );
}
