import { getApiEndpoint } from '@/lib/config';
import { toast } from 'sonner';

const ADMIN_HEADER_NAME = 'x-admin-api-key';
const LOG_PREFIX = '[AdminAPI]';

const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY;
const API_BASE_URL = getApiEndpoint('');

if (!ADMIN_API_KEY) {
  console.warn('[Config] Missing VITE_ADMIN_API_KEY');
} else {
  console.log('[Config] VITE_ADMIN_API_KEY is configured:', ADMIN_API_KEY.substring(0, 8) + '...');
}

if (!API_BASE_URL) {
  console.warn('[Config] Missing VITE_API_BASE_URL');
}

function isAdminRoute(url: string): boolean {
  return url.includes('/api/admin');
}

export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const isAdmin = isAdminRoute(fullUrl);

  console.log(`${LOG_PREFIX} Request:`, {
    method: options.method || 'GET',
    url: fullUrl,
    isAdminRoute: isAdmin,
    hasApiKey: !!ADMIN_API_KEY,
  });

  if (isAdmin && !ADMIN_API_KEY) {
    console.error(`${LOG_PREFIX} Admin API key missing for admin route:`, fullUrl);
    toast.error('Unauthorized access - admin key missing');
    return new Response(JSON.stringify({ error: 'Admin API key not configured' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers: HeadersInit = {
    ...options.headers,
  };

  if (isAdmin && ADMIN_API_KEY) {
    (headers as Record<string, string>)['x-admin-api-key'] = ADMIN_API_KEY;
    (headers as Record<string, string>)['X-Admin-API-Key'] = ADMIN_API_KEY;
    console.log(`${LOG_PREFIX} Admin key attached for route:`, fullUrl);
    console.log(`${LOG_PREFIX} Headers being sent:`, { 'x-admin-api-key': ADMIN_API_KEY.substring(0, 8) + '...' });
  }

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    console.log(`${LOG_PREFIX} Response:`, {
      url: fullUrl,
      status: response.status,
      ok: response.ok,
    });

    if (response.status === 401) {
      console.error(`${LOG_PREFIX} 401 Unauthorized for:`, fullUrl);
      toast.error('Unauthorized access - admin key invalid or expired');
    }

    return response;
  } catch (error) {
    console.error(`${LOG_PREFIX} Network error:`, error);
    throw error;
  }
}

export function getAdminApiKey(): string | undefined {
  return ADMIN_API_KEY;
}

export function isAdminApiKeyConfigured(): boolean {
  return !!ADMIN_API_KEY;
}

export { API_BASE_URL, ADMIN_HEADER_NAME };