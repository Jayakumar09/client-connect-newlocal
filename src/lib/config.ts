// ============================================
// Environment & Deployment Configuration
// ============================================

export type DeploymentMode = 'development' | 'production';
export type AppArea = 'admin' | 'client' | 'unknown';

export interface AppConfig {
  mode: DeploymentMode;
  isProduction: boolean;
  isDevelopment: boolean;
  isAdmin: boolean;
  isClient: boolean;
  area: AppArea;
  hostname: string;
  subdomain: string | null;
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  clientDomain: string;
  adminDomain: string;
  enablePWA: boolean;
}

// Get hostname from window or return empty for SSR
function getHostname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname;
}

// Get subdomain from hostname (e.g., "admin" from "admin.vijayalakshmiboyarmatrimony.com")
export function getSubdomain(hostname: string): string | null {
  if (!hostname) {
    console.log('[Config] getSubdomain: hostname is empty');
    return null;
  }
  
  console.log('[Config] getSubdomain checking:', hostname);
  
  // localhost has no subdomain
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('[Config] getSubdomain: localhost detected');
    return null;
  }
  
  const adminDomain = import.meta.env.VITE_ADMIN_DOMAIN || 'admin.vijayalakshmiboyarmatrimony.com';
  const clientDomain = import.meta.env.VITE_CLIENT_DOMAIN || 'app.vijayalakshmiboyarmatrimony.com';
  
  console.log('[Config] getSubdomain - adminDomain:', adminDomain);
  console.log('[Config] getSubdomain - clientDomain:', clientDomain);
  
  // Check if hostname ends with admin domain (with subdomain prefix)
  if (hostname.endsWith(`.${adminDomain}`)) {
    console.log('[Config] getSubdomain: matches admin wildcard');
    return 'admin';
  }
  
  // Check if hostname ends with client domain (with subdomain prefix)
  if (hostname.endsWith(`.${clientDomain}`)) {
    console.log('[Config] getSubdomain: matches client wildcard');
    return 'app';
  }
  
  // Exact match for admin domain (no subdomain)
  if (hostname === adminDomain) {
    console.log('[Config] getSubdomain: exact admin domain match');
    return 'admin';
  }
  
  // Exact match for client domain (no subdomain)
  if (hostname === clientDomain) {
    console.log('[Config] getSubdomain: exact client domain match');
    return 'app';
  }
  
  console.log('[Config] getSubdomain: no match, returning null');
  return null;
}

// Check if hostname is admin subdomain
export function isAdminHost(hostname: string): boolean {
  const subdomain = getSubdomain(hostname);
  return subdomain === 'admin';
}

// Check if hostname is client/app subdomain
export function isAppHost(hostname: string): boolean {
  const subdomain = getSubdomain(hostname);
  return subdomain === 'app';
}

// Check if hostname is Cloudflare Pages preview
export function isPagesDevHost(hostname: string): boolean {
  return hostname.endsWith('.pages.dev') || hostname.endsWith('.cloudflareapps.com');
}

// Get deployment mode from environment
function getDeploymentMode(): DeploymentMode {
  const mode = import.meta.env.VITE_DEPLOYMENT_MODE;
  if (mode === 'production') return 'production';
  
  // Detect if running on Cloudflare Pages preview
  const hostname = getHostname();
  if (hostname && isPagesDevHost(hostname)) {
    return 'production';
  }
  
  return 'development';
}

// Detect subdomain from hostname
function detectArea(): AppArea {
  const hostname = getHostname();
  console.log('[Config] === DETECT AREA START ===');
  console.log('[Config] Full hostname:', hostname);
  
  // Localhost development - use path-based fallback
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('[Config] Localhost detected, using path-based fallback');
    const path = window.location.pathname;
    console.log('[Config] Path:', path);
    if (path.startsWith('/admin') || path.includes('/admin/')) {
      console.log('[Config] -> Returning admin (localhost path)');
      return 'admin';
    }
    console.log('[Config] -> Returning client (localhost default)');
    return 'client';
  }
  
  // Cloudflare Pages preview domains - use path-based fallback
  if (isPagesDevHost(hostname)) {
    console.log('[Config] Pages.dev preview detected, using path-based fallback');
    const path = window.location.pathname;
    console.log('[Config] Path:', path);
    if (path.startsWith('/admin') || path.includes('/admin/')) {
      console.log('[Config] -> Returning admin (pages.dev path)');
      return 'admin';
    }
    console.log('[Config] -> Returning client (pages.dev default)');
    return 'client';
  }
  
  // Production subdomain detection
  const subdomain = getSubdomain(hostname);
  console.log('[Config] Subdomain result:', subdomain);
  
  if (subdomain === 'admin') {
    console.log('[Config] -> Returning admin (subdomain match)');
    return 'admin';
  }
  
  if (subdomain === 'app') {
    console.log('[Config] -> Returning client (app subdomain match)');
    return 'client';
  }
  
  // Unknown domain - default to client for safety
  console.log('[Config] -> Returning client (unknown domain fallback)');
  return 'client';
}

// Get API URL based on environment
function getApiUrl(mode: DeploymentMode): string {
  console.log('[Config] Getting API URL for mode:', mode);
  
  // Always prefer explicit VITE_API_BASE_URL from env (takes priority in all modes)
  const explicitApiUrl = import.meta.env.VITE_API_BASE_URL;
  if (explicitApiUrl) {
    console.log('[Config] Using VITE_API_BASE_URL:', explicitApiUrl);
    return explicitApiUrl;
  }
  
  // Fallback to VITE_API_URL for backward compatibility
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    console.log('[Config] Using VITE_API_URL (fallback):', apiUrl);
    return apiUrl;
  }
  
  // Development fallback only for localhost
  if (mode === 'development') {
    const devUrl = 'http://localhost:3001';
    console.log('[Config] Development API URL (localhost fallback):', devUrl);
    return devUrl;
  }
  
  // Production without explicit URL - use default Render backend
  const defaultProdUrl = 'https://matrimony-backend-8hk0.onrender.com';
  console.log('[Config] Production API URL (default):', defaultProdUrl);
  return defaultProdUrl;
}

// Create app configuration
function createConfig(): AppConfig {
  const mode = getDeploymentMode();
  const hostname = getHostname();
  const area = detectArea();
  const isAdmin = area === 'admin';
  const isClient = area === 'client';
  const subdomain = getSubdomain(hostname);
  
  console.log('[Config] Creating app config:', { mode, area, hostname, subdomain, isAdmin, isClient });
  
  // Disable PWA on preview domains (Cloudflare Pages preview)
  const isPreview = isPagesDevHost(hostname);
  
  return {
    mode,
    isProduction: mode === 'production',
    isDevelopment: mode === 'development',
    isAdmin,
    isClient,
    area,
    hostname,
    subdomain,
    apiUrl: getApiUrl(mode),
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    clientDomain: import.meta.env.VITE_CLIENT_DOMAIN || 'app.vijayalakshmiboyarmatrimony.com',
    adminDomain: import.meta.env.VITE_ADMIN_DOMAIN || 'admin.vijayalakshmiboyarmatrimony.com',
    // PWA only enabled for client app in production (never on admin)
    enablePWA: isClient && mode === 'production' && !isPreview && !isAdmin,
  };
}

// Singleton config instance
let configInstance: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (!configInstance) {
    configInstance = createConfig();
  }
  return configInstance;
}

// For server-side rendering or testing
export function resetConfig(): void {
  configInstance = null;
}

// Export a hook-friendly version
export function useAppConfig() {
  return getAppConfig();
}

// ============================================
// API Helper Functions
// ============================================

export function getApiEndpoint(path: string): string {
  const config = getAppConfig();
  const baseUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
  const apiPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${apiPath}`;
}

// Debug helper to verify Supabase configuration
export function getSupabaseDebugInfo(): { url: string; keyPrefix: string; valid: boolean } {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return {
    url,
    keyPrefix: key.substring(0, 20) + '...',
    valid: !!(url && key && url.startsWith('https://'))
  };
}

export function isAdminApp(): boolean {
  return getAppConfig().isAdmin;
}

export function isClientApp(): boolean {
  return getAppConfig().isClient;
}

// Get full URL for a path based on current area
export function getAreaUrl(path: string): string {
  const config = getAppConfig();
  const protocol = 'https://';
  
  if (config.isAdmin) {
    return `${protocol}${config.adminDomain}${path}`;
  }
  
  return `${protocol}${config.clientDomain}${path}`;
}

// Get login URL for current area
export function getLoginUrl(): string {
  const config = getAppConfig();
  
  if (config.isAdmin) {
    return '/admin-login';
  }
  
  return '/client-auth';
}

// Get logout redirect URL
export function getLogoutRedirectUrl(): string {
  const config = getAppConfig();
  
  if (config.isAdmin) {
    return '/admin-login';
  }
  
  return '/client-auth';
}