import { Preferences } from '@capacitor/preferences';

/**
 * Storage utility — wraps Capacitor Preferences with localStorage fallback.
 * Works both in the native APK (Capacitor) and in the browser (dev mode).
 */
export const storage = {
  async get(key) {
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        return JSON.parse(value);
      }
    } catch (e) {
      console.warn("Preferences get failed, trying localStorage:", e);
    }
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : null;
  },

  async set(key, value) {
    const serialized = JSON.stringify(value);
    try {
      await Preferences.set({ key, value: serialized });
    } catch (e) {
      console.warn("Preferences set failed, trying localStorage:", e);
    }
    localStorage.setItem(key, serialized);
  },

  async remove(key) {
    try {
      await Preferences.remove({ key });
    } catch (e) {
      console.warn("Preferences remove failed, trying localStorage:", e);
    }
    localStorage.removeItem(key);
  },

  async clear() {
    try {
      await Preferences.clear();
    } catch (e) {
      console.warn("Preferences clear failed, trying localStorage:", e);
    }
    localStorage.clear();
  }
};
