import { getApiEndpoint } from '@/lib/config';
import { toast } from 'sonner';

const ADMIN_HEADER_NAME = 'x-admin-api-key';
const LOG_PREFIX = '[AdminAPI]';

const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY;
const API_BASE_URL = getApiEndpoint('');

const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

if (!ADMIN_API_KEY) {
  console.error('[Config] FATAL: VITE_ADMIN_API_KEY is not configured. Admin endpoints will fail.');
  if (isProduction) {
    console.error('[Config] Production build missing admin API key - check Cloudflare Pages env vars');
  }
} else {
  console.log('[Config] VITE_ADMIN_API_KEY configured:', ADMIN_API_KEY.substring(0, 8) + '... (key length: ' + ADMIN_API_KEY.length + ')');
}

if (!API_BASE_URL) {
  console.warn('[Config] Missing VITE_API_BASE_URL');
}

function isAdminRoute(url: string): boolean {
  return url.includes('/api/admin');
}

let hasHadAuthError = false;

export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const isAdmin = isAdminRoute(fullUrl);

  if (isAdmin && hasHadAuthError) {
    console.warn(`${LOG_PREFIX} Skipping request - previous auth error detected:`, fullUrl);
    return new Response(JSON.stringify({ error: 'Authentication failed. Please refresh the page.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`${LOG_PREFIX} Request:`, {
    method: options.method || 'GET',
    url: fullUrl,
    isAdminRoute: isAdmin,
    hasApiKey: !!ADMIN_API_KEY,
  });

  if (isAdmin && !ADMIN_API_KEY) {
    console.error(`${LOG_PREFIX} Admin API key missing for admin route:`, fullUrl);
    toast.error('Admin API key not configured. Please contact administrator.');
    hasHadAuthError = true;
    return new Response(JSON.stringify({ error: 'Admin API key not configured. Please refresh or contact support.' }), {
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
      hasHadAuthError = true;
      toast.error('Unauthorized - admin key invalid or expired. Please refresh the page.');
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

export function resetAdminAuthError(): void {
  hasHadAuthError = false;
  console.log(`${LOG_PREFIX} Auth error state reset`);
}

export { API_BASE_URL, ADMIN_HEADER_NAME };