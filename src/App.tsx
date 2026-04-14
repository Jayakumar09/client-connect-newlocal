import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { BackupProvider } from "./contexts/BackupContext";
import { getAppConfig } from "./lib/config";
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

function AppRoutes() {
  // Detect config synchronously to avoid blank screen
  const config = getAppConfig();
  
  console.log('[App] Rendering with config:', {
    isAdmin: config.isAdmin,
    isClient: config.isClient,
    mode: config.mode,
    apiUrl: config.apiUrl,
  });

  // Admin Routes - accessible from admin subdomain
  const adminRoutes = (
    <>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<AdminDashboard />} />
      <Route path="/admin-payments" element={<AdminPayments />} />
      <Route path="/admin-messages" element={<AdminMessages />} />
      <Route path="*" element={<NotFound />} />
    </>
  );

  // Client Routes - accessible from client subdomain
  const clientRoutes = (
    <>
      <Route path="/" element={<Navigate to="/client-dashboard" replace />} />
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
      <Route path="*" element={<NotFound />} />
    </>
  );

  // In development, show all routes for easier testing
  // In production, restrict based on subdomain
  if (config.isAdmin) {
    return <Routes>{adminRoutes}</Routes>;
  }

  return <Routes>{clientRoutes}</Routes>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BackupProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </BackupProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
