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
  
  // Cloudflare preview domains, unknown domains, or any other domain
  // Default to client mode to ensure app always renders
  console.log('[Config] Unknown domain, defaulting to client mode');
  return 'client';
}

// Get API URL based on environment
function getApiUrl(mode: DeploymentMode): string {
  console.log('[Config] Getting API URL for mode:', mode);
  
  if (mode === 'production') {
    // Production: Use explicit API URL from env or backend URL
    const apiDomain = import.meta.env.VITE_API_URL || 'https://matrimony-backend-8hk0.onrender.com';
    console.log('[Config] Production API URL:', apiDomain);
    return apiDomain;
  }
  
  // Development fallback
  const devUrl = import.meta.env.VITE_API_URL || 
                 import.meta.env.VITE_BACKUP_API_URL || 
                 'http://localhost:3001';
  console.log('[Config] Development API URL:', devUrl);
  return devUrl;
}

// Create app configuration
function createConfig(): AppConfig {
  const mode = getDeploymentMode();
  const subdomain = detectSubdomain();
  const isAdmin = subdomain === 'admin';
  const isClient = subdomain === 'client';
  
  console.log('[Config] Creating app config:', { mode, subdomain, isAdmin, isClient });
  
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
    // PWA only enabled for client app
    enablePWA: isClient || mode === 'development',
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
