import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import "./index.css";
import { getMissingEnvVars, isConfigured } from "./integrations/supabase/client";
import { EnvError } from "./components/EnvError";

console.log('[Boot] === CLIENT APP START ===');
console.log('[Boot] App area: CLIENT');

async function registerServiceWorker() {
  console.log('[PWA] Checking service worker registration...');

  try {
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

function setupNetworkStatus() {
  if (typeof window === 'undefined') return;

  const updateOnlineStatus = () => {
    console.log('[Network]', navigator.onLine ? 'Online' : 'Offline');
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

function checkEnvConfig(): string[] {
  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    console.error('[App] Missing required environment variables:', missing);
  }
  return missing;
}

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  console.log('[Boot] Root created');

  const missingVars = checkEnvConfig();
  console.log('[Boot] Config check done, missing vars:', missingVars);

  if (!isConfigured()) {
    console.log('[Boot] App NOT configured, showing EnvError');
    root.render(<EnvError missingVars={missingVars} />);
  } else {
    console.log('[Boot] App configured, rendering App');
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    setTimeout(() => {
      registerServiceWorker();
      setupNetworkStatus();
    }, 0);
  }
} else {
  console.error('[App] Root element not found');
}
