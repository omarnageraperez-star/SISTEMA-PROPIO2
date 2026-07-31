export function buildApiBaseUrl(input = '') {
  let base = (input || '').trim().replace(/\/+$/, '');
  const hasApiSegment = /\/api(\/|$)/i.test(base);

  if (!hasApiSegment) {
    base += '/api';
  }

  return `${base}/`;
}

export async function testApiConnection(rawUrl = '') {
  const baseUrl = buildApiBaseUrl(rawUrl);
  // Test check-admin which returns a clean 200 OK with correct CORS headers
  const endpoint = `${baseUrl}users/check-admin/`;

  try {
    const response = await fetch(endpoint, { method: 'GET' });
    const ok = response.ok;

    return {
      ok,
      status: response.status,
      endpoint,
      baseUrl,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      endpoint,
      baseUrl,
      error: error instanceof Error ? error.message : 'Error de conexión',
    };
  }
}
