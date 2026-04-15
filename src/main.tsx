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

// Register Service Worker for PWA (client app only)
async function registerServiceWorker() {
  // Only register in production and for client app
  const config = getAppConfig();
  
  if (!config.enablePWA || !('serviceWorker' in navigator)) {
    console.log('[App] PWA service worker not enabled');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[App] Service Worker registered:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[App] New content available, refresh to update');
          }
        });
      }
    });
  } catch (error) {
    console.error('[App] Service Worker registration failed:', error);
  }
}

// Handle online/offline status
function setupNetworkStatus() {
  const updateOnlineStatus = () => {
    console.log('[App] Network:', navigator.onLine ? 'Online' : 'Offline');
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
    // Show configuration error instead of crashing
    root.render(<EnvError missingVars={missingVars} />);
    console.error('[App] App not configured - missing environment variables');
  } else {
    console.log('[Boot] App configured, rendering App');
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    
    // Register service worker after render
    registerServiceWorker();
    setupNetworkStatus();
  }
} else {
  console.error('[App] Root element not found');
}
