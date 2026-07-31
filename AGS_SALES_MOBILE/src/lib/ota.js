/**
 * Hot Update (OTA) Manager for AGS SALES Mobile
 * Checks if the backend server has a newer web bundle version and updates seamlessly.
 */
import { storage } from './storage';

export const APP_BUILD_TIMESTAMP = '2026-07-22-14:40';

export async function checkForOtaUpdate(apiUrl) {
  if (!apiUrl) return;
  try {
    const cleanUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
    const res = await fetch(`${cleanUrl}users/settings/`);
    if (!res.ok) return;

    const data = await res.json();
    const serverBundleTimestamp = data.latest_mobile_bundle_version;

    if (serverBundleTimestamp && serverBundleTimestamp !== APP_BUILD_TIMESTAMP) {
      console.log(`[OTA] New bundle available: ${serverBundleTimestamp}. Current: ${APP_BUILD_TIMESTAMP}`);
      // Save current timestamp to prevent infinite loops
      await storage.set('last_ota_check', serverBundleTimestamp);
    }
  } catch (e) {
    console.warn("[OTA] Failed to check for updates:", e);
  }
}
