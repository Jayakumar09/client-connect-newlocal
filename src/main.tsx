import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App.tsx";
import "./index.css";
import { getAppConfig } from "./lib/config";
import { getMissingEnvVars, isConfigured } from "./integrations/supabase/client";
import { EnvError } from "./components/EnvError";

console.log('[Boot] === MAIN.TSX START ===');

// Check environment configuration
function checkEnvConfig(): string[] {
  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    console.error('[App] Missing required environment variables:', missing);
  }
  return missing;
}

// Register Service Worker for PWA (CLIENT APP ONLY - NEVER ON ADMIN)
async function registerServiceWorker() {
  console.log('[PWA] Checking service worker registration...');
  
  try {
    const config = getAppConfig();
    
    // HARD BLOCK: Never register SW on admin domain
    if (config.isAdmin) {
      console.log('[PWA] Skipped - admin domain detected');
      return;
    }
    
    // Check if PWA is enabled and service worker is supported
    if (!config.enablePWA) {
      console.log('[PWA] Skipped - PWA not enabled');
      return;
    }
    
    if (typeof window === 'undefined') {
      console.log('[PWA] Skipped - no window (SSR)');
      return;
    }
    
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Skipped - service worker not supported');
      return;
    }

    console.log('[PWA] Registering service worker...');
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[PWA] Service Worker registered:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New content available, refresh to update');
          }
        });
      }
    });
  } catch (error) {
    console.error('[PWA] Registration failed:', error);
  }
}

// Handle online/offline status (CLIENT ONLY)
function setupNetworkStatus() {
  const config = getAppConfig();
  
  // Skip on admin domain
  if (config.isAdmin) {
    console.log('[Network] Skipped - admin domain');
    return;
  }
  
  if (typeof window === 'undefined') {
    return;
  }
  
  const updateOnlineStatus = () => {
    console.log('[Network]', navigator.onLine ? 'Online' : 'Offline');
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

// Initialize app
const container = document.getElementById('root');
console.log('[Boot] Container found:', !!container);

if (container) {
  const root = createRoot(container);
  console.log('[Boot] Root created');
  
  const missingVars = checkEnvConfig();
  console.log('[Boot] Config check done, missing vars:', missingVars);
  
  if (!isConfigured()) {
    console.log('[Boot] App NOT configured, showing EnvError');
    root.render(<EnvError missingVars={missingVars} />);
    console.error('[App] App not configured - missing environment variables');
  } else {
    console.log('[Boot] App configured, rendering App');
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    
    // Only run browser-specific code after render
    // These are deferred and won't block initial render
    setTimeout(() => {
      registerServiceWorker();
      setupNetworkStatus();
    }, 0);
  }
} else {
  console.error('[App] Root element not found');
}