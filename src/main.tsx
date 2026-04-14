import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getAppConfig } from "./lib/config";

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
            // New content available
            console.log('[App] New content available, refresh to update');
            
            // Optionally show update notification
            // toast.info('New version available! Refresh to update.');
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
    if (navigator.onLine) {
      console.log('[App] Network: Online');
    } else {
      console.log('[App] Network: Offline');
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

// Initialize app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
  
  // Register service worker after render
  registerServiceWorker();
  setupNetworkStatus();
} else {
  console.error('[App] Root element not found');
}
