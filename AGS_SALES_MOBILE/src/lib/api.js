/**
 * API helper — same logic as the desktop .exe (AGS_SALES_UI/src/lib/api.js)
 * Adds JWT Authorization header automatically when token is provided.
 */

let on401Callback = null;

export function register401Callback(cb) {
  on401Callback = cb;
}

export async function apiRequest(url, options = {}, token = null) {
  const headers = { ...options.headers };

  headers['ngrok-skip-browser-warning'] = 'true';

  if (!headers['Content-Type'] && !(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 30-second timeout — enough for Django cold start on local WiFi
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, { 
      ...options, 
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.status === 401) {
      if (on401Callback) {
        on401Callback();
      }
    }

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
    clearTimeout(timeoutId);
    // Convert AbortError into a user-friendly error
    if (error?.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado. El servidor tardó demasiado en responder.');
    }
    throw error;
  }
}

/**
 * Build a full API URL from a base URL and a path segment.
 * Ensures proper trailing slashes.
 * 
 * @param {string} base  — e.g. "http://192.168.1.5:8000/api/"
 * @param {string} path  — e.g. "inventory/products/"
 */
export function apiUrl(base, path) {
  if (!base || typeof base !== 'string') return path;
  const b = base.endsWith('/') ? base : base + '/';
  return b + path;
}

/**
 * Parse a Django REST framework error response into a human-readable string.
 */
export async function parseError(response) {
  try {
    const data = await response.json();
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.non_field_errors) return data.non_field_errors.join(', ');
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      return `${firstKey}: ${Array.isArray(val) ? val.join(', ') : val}`;
    }
  } catch { /* ignore */ }
  return `Error ${response.status}`;
}

/**
 * Robust currency formatter using regex to guarantee dot (.) as thousands/millions separator
 * and comma (,) as decimals separator across all mobile devices and webviews.
 */
export function formatCurrency(n, symbol = '$', decimals = 0) {
  const num = parseFloat(n) || 0;
  const fixed = num.toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${symbol} ${parts.join(',')}`;
}
