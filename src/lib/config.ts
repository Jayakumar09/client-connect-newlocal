// ============================================
// Environment & Deployment Configuration
// ============================================

export type DeploymentMode = 'development' | 'production';

export interface AppConfig {
  mode: DeploymentMode;
  isProduction: boolean;
  isDevelopment: boolean;
  isAdmin: boolean;
  isClient: boolean;
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  clientDomain: string;
  adminDomain: string;
  enablePWA: boolean;
}

// Get deployment mode from environment
function getDeploymentMode(): DeploymentMode {
  const mode = import.meta.env.VITE_DEPLOYMENT_MODE;
  if (mode === 'production') return 'production';
  
  // Detect if running on Cloudflare Pages preview
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Cloudflare Pages preview domains and production domains
    if (hostname.endsWith('.pages.dev') || hostname.endsWith('.cloudflareapps.com')) {
      return 'production';
    }
  }
  
  return 'development';
}

// Detect subdomain from hostname
function detectSubdomain(): 'admin' | 'client' {
  if (typeof window === 'undefined') {
    console.log('[Config] SSR detected, defaulting to client mode');
    return 'client';
  }
  
  const hostname = window.location.hostname;
  console.log('[Config] Detecting subdomain for hostname:', hostname);
  
  // Localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('[Config] Localhost detected');
    // Check URL path for routing in dev
    const path = window.location.pathname;
    if (path.startsWith('/admin') || path.includes('admin')) {
      console.log('[Config] Path indicates admin mode');
      return 'admin';
    }
    console.log('[Config] Path indicates client mode (default for localhost)');
    return 'client';
  }
  
  // Cloudflare Pages preview domains - treat as client
  if (hostname.endsWith('.pages.dev') || hostname.endsWith('.cloudflareapps.com')) {
    console.log('[Config] Cloudflare Pages preview detected');
    return 'client';
  }
  
  // Production subdomains
  const adminDomain = import.meta.env.VITE_ADMIN_DOMAIN || 'admin.vijayalakshmiboyarmatrimony.com';
  const clientDomain = import.meta.env.VITE_CLIENT_DOMAIN || 'app.vijayalakshmiboyarmatrimony.com';
  
  if (hostname === adminDomain || hostname.endsWith(`.${adminDomain}`)) {
    console.log('[Config] Admin domain detected');
    return 'admin';
  }
  
  if (hostname === clientDomain || hostname.endsWith(`.${clientDomain}`)) {
    console.log('[Config] Client domain detected');
    return 'client';
  }
  
  // Unknown domains - default to client mode
  console.log('[Config] Unknown domain, defaulting to client mode');
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
  const subdomain = detectSubdomain();
  const isAdmin = subdomain === 'admin';
  const isClient = subdomain === 'client';
  
  console.log('[Config] Creating app config:', { mode, subdomain, isAdmin, isClient });
  
  // Disable PWA on preview domains (Cloudflare Pages preview)
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isPreview = hostname.endsWith('.pages.dev') || hostname.endsWith('.cloudflareapps.com');
  
  return {
    mode,
    isProduction: mode === 'production',
    isDevelopment: mode === 'development',
    isAdmin,
    isClient,
    apiUrl: getApiUrl(mode),
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    clientDomain: import.meta.env.VITE_CLIENT_DOMAIN || 'app.vijayalakshmiboyarmatrimony.com',
    adminDomain: import.meta.env.VITE_ADMIN_DOMAIN || 'admin.vijayalakshmiboyarmatrimony.com',
    // PWA only enabled for client app in production (not preview domains)
    enablePWA: isClient && mode === 'production' && !isPreview,
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

export function isAdminApp(): boolean {
  return getAppConfig().isAdmin;
}

export function isClientApp(): boolean {
  return getAppConfig().isClient;
}
