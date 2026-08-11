import Swal from 'sweetalert2';

/**
 * Robust fetch helper that manages content type headers, JWT authorization,
 * and handles retries or user friendly alert prompts on network failure.
 */
export async function apiRequest(url, options = {}, token = null) {
  const headers = {
    ...options.headers,
  };

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
    if (response.status === 402) {
      try {
        const errData = await response.clone().json();
        if (errData.error === 'license_expired') {
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
