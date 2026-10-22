/**
 * localStorage for per-device conveniences (guest token, profile). It can be
 * unavailable (private mode, blocked storage); callers get null and the app still works,
 * the player just starts as a new guest.
 */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`localStorage read failed for ${key}`, error);
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`localStorage write failed for ${key}`, error);
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`localStorage remove failed for ${key}`, error);
  }
}
