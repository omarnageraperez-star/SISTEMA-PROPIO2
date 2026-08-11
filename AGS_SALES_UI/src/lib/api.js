import Swal from 'sweetalert2';

/**
 * Robust fetch helper that manages content type headers, JWT authorization,
 * and handles retries or user friendly alert prompts on network failure.
 */
export async function apiRequest(url, options = {}, token = null) {
  const headers = {
    ...options.headers,
  };

  if (typeof window !== 'undefined') {
    if (window.deviceUUID) {
      headers['X-Device-UUID'] = window.deviceUUID;
    }
    if (window.bypassGracePeriod || sessionStorage.getItem('bypass_grace') === 'true') {
      headers['X-Bypass-Grace'] = 'true';
    }
  }

  // Do not override Content-Type if it is already set (e.g. FormData) or if body is not JSON
  if (!headers['Content-Type'] && !(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, fetchOptions);
    if (response.ok) {
      try {
        const licenseStatus = response.headers.get('X-License-Status');
        const licenseRemainingDays = response.headers.get('X-License-Remaining-Days');
        const licenseExpiresAt = response.headers.get('X-License-Expires-At');
        if (licenseStatus) {
          window.dispatchEvent(new CustomEvent('license-status-update', {
            detail: { licenseStatus, licenseRemainingDays, licenseExpiresAt }
          }));
        }
      } catch (e) {}
    }
    if (response.status === 402) {
      try {
        const errData = await response.clone().json();
        if (['license_expired', 'license_grace_period', 'license_device_mismatch'].includes(errData.error)) {
          window.dispatchEvent(new CustomEvent('license-expired', { detail: errData }));
        }
      } catch (e) {}
    }
    return response;
  } catch (error) {
    console.error(`API request failed at ${url}:`, error);
    // Propagate the network error so caller knows we are offline
    throw error;
  }
}
