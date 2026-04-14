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
function detectSubdomain(): 'admin' | 'client' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';
  
  const hostname = window.location.hostname;
  
  // Localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Check URL path for routing in dev
    const path = window.location.pathname;
    if (path.startsWith('/admin') || path.includes('admin')) {
      return 'admin';
    }
    return 'client';
  }
  
  // Production subdomains
  const adminDomain = import.meta.env.VITE_ADMIN_DOMAIN || 'admin.vijayalakshmiboyarmatrimony.com';
  const clientDomain = import.meta.env.VITE_CLIENT_DOMAIN || 'app.vijayalakshmiboyarmatrimony.com';
  
  if (hostname === adminDomain || hostname.endsWith(`.${adminDomain}`)) {
    return 'admin';
  }
  
  if (hostname === clientDomain || hostname.endsWith(`.${clientDomain}`)) {
    return 'client';
  }
  
  // Default to client for root domain or unknown
  return 'client';
}

// Get API URL based on environment
function getApiUrl(mode: DeploymentMode): string {
  if (mode === 'production') {
    // In production, API is typically at the same domain or a dedicated API subdomain
    const apiDomain = import.meta.env.VITE_API_URL;
    if (apiDomain) return apiDomain;
    
    // Fallback: use same domain with /api prefix
    if (typeof window !== 'undefined') {
      return `${window.location.origin}`;
    }
  }
  
  // Development fallback
  return import.meta.env.VITE_API_URL || 
         import.meta.env.VITE_BACKUP_API_URL || 
         'http://localhost:3001';
}

// Create app configuration
function createConfig(): AppConfig {
  const mode = getDeploymentMode();
  const subdomain = detectSubdomain();
  
  return {
    mode,
    isProduction: mode === 'production',
    isDevelopment: mode === 'development',
    isAdmin: subdomain === 'admin',
    isClient: subdomain === 'client',
    apiUrl: getApiUrl(mode),
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    clientDomain: import.meta.env.VITE_CLIENT_DOMAIN || 'app.vijayalakshmiboyarmatrimony.com',
    adminDomain: import.meta.env.VITE_ADMIN_DOMAIN || 'admin.vijayalakshmiboyarmatrimony.com',
    // PWA only enabled for client app
    enablePWA: subdomain === 'client' || mode === 'development',
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
