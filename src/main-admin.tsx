import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import "./index.css";
import { getMissingEnvVars, isConfigured } from "./integrations/supabase/client";
import { EnvError } from "./components/EnvError";

console.log('[Boot] === ADMIN APP START ===');
console.log('[Boot] App area: ADMIN');

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
  }
} else {
  console.error('[App] Root element not found');
}
