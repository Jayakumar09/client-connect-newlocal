import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { BackupProvider } from "./contexts/BackupContext";
import { getAppConfig } from "./lib/config";
import { ErrorBoundary } from "./components/ErrorBoundary";
import AdminDashboard from "./pages/AdminDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import Auth from "./pages/Auth";
import ClientAuth from "./pages/ClientAuth";
import ClientProfile from "./pages/ClientProfile";
import Browse from "./pages/Browse";
import Install from "./pages/Install";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";
import Subscriptions from "./pages/Subscriptions";
import AdminPayments from "./pages/AdminPayments";
import AdminMessages from "./pages/AdminMessages";
import ClientMessages from "./pages/ClientMessages";
import Messages from "./pages/Messages";
import Help from "./pages/Help";
import Notifications from "./pages/Notifications";
import Shortlists from "./pages/Shortlists";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

console.log('[Boot] App.tsx loaded');

// Temporary minimal admin routes for debugging
function MinimalAdminRoutes() {
  console.log('[Boot] MinimalAdminRoutes rendering');
  return (
    <Routes>
      <Route path="/admin-login" element={<div>Admin Login Placeholder</div>} />
      <Route path="/admin/dashboard" element={<div>Admin Dashboard Placeholder</div>} />
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}

function MinimalAppRoutes() {
  const config = getAppConfig();
  console.log('[Boot] AppRoutes - isAdmin:', config.isAdmin, 'hostname:', config.hostname);
  
  if (config.isAdmin) {
    console.log('[Boot] Returning MinimalAdminRoutes');
    return <MinimalAdminRoutes />;
  }
  
  console.log('[Boot] Returning ClientRoutes (full)');
  return <ClientRoutesFull />;
}

// Full client routes
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
  console.log('[Boot] App component rendering');
  return (
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
};

export default App;