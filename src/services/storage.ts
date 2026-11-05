// Thin localStorage wrapper so the rest of the app never touches `localStorage` directly
// (Phase 5 layers a Supabase cloud-save sync on top of the same keys).
const PREFIX = 'mithai.';

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full/unavailable (private mode, etc.) — progress just won't persist locally.
  }
}
