import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { BackupProvider } from "./contexts/BackupContext";
import { getAppConfig } from "./lib/config";
import { ErrorBoundary } from "./components/ErrorBoundary";
import ClientDashboard from "./pages/ClientDashboard";
import ClientAuth from "./pages/ClientAuth";
import ClientProfile from "./pages/ClientProfile";
import Browse from "./pages/Browse";
import Install from "./pages/Install";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";
import Subscriptions from "./pages/Subscriptions";
import ClientMessages from "./pages/ClientMessages";
import Messages from "./pages/Messages";
import Help from "./pages/Help";
import Notifications from "./pages/Notifications";
import Shortlists from "./pages/Shortlists";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

console.log('[Boot] App.tsx loaded');

// TEMPORARY: Simple div to test if admin host works at all
function MinimalAdminRoutes() {
  console.log('[Admin] MinimalAdminRoutes rendering');
  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h1>Admin Area Works!</h1>
      <p>Hostname: {typeof window !== 'undefined' ? window.location.hostname : 'N/A'}</p>
    </div>
  );
}

function MinimalAppRoutes() {
  console.log('[Boot] AppRoutes called');
  let isAdmin = false;
  try {
    const config = getAppConfig();
    isAdmin = config.isAdmin;
    console.log('[Boot] isAdmin:', isAdmin);
  } catch (e) {
    console.log('[Boot] getAppConfig error:', e);
  }
  
  if (isAdmin) {
    console.log('[Boot] Returning MinimalAdminRoutes');
    return <MinimalAdminRoutes />;
  }
  
  console.log('[Boot] Returning ClientRoutes');
  return <ClientRoutesFull />;
}

function ClientRoutesFull() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/client-auth" element={<ClientAuth />} />
        <Route path="/client-dashboard" element={<ClientDashboard />} />
        <Route path="/client-profile" element={<ClientProfile />} />
        <Route path="/client-messages" element={<ClientMessages />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/help" element={<Help />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/shortlists" element={<Shortlists />} />
        <Route path="/install" element={<Install />} />
        <Route path="/" element={<Navigate to="/client-dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

const App = () => {
  console.log('[Boot] App render START');
  
  try {
    const result = (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <AuthProvider>
              <BackupProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <MinimalAppRoutes />
                </BrowserRouter>
              </BackupProvider>
            </AuthProvider>
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    );
    console.log('[Boot] App render END - returning JSX');
    return result;
  } catch (e) {
    console.log('[Boot] App render ERROR:', e);
    return <div>Error: {String(e)}</div>;
  }
};

export default App;