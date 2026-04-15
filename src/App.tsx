import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { BackupProvider } from "./contexts/BackupContext";
import { getAppConfig, getLogoutRedirectUrl } from "./lib/config";
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

// Protected route wrapper for admin
function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/admin-login" state={{ from: location }} replace />;
  }
  
  if (!isAdmin) {
    // Admin trying to access admin area without admin privileges
    return <Navigate to="/client-auth" replace />;
  }
  
  return <>{children}</>;
}

// Protected route wrapper for client
function ProtectedClientRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/client-auth" state={{ from: location }} replace />;
  }
  
  if (isAdmin) {
    // Admin trying to access client area - redirect to admin
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Admin login page (public)
function AdminLogin() {
  const { user, isAdmin } = useAuth();
  
  // If already logged in as admin, redirect to dashboard
  if (user && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  // Use existing Auth page for admin login
  return <Auth />;
}

// Admin routes
function AdminRoutes() {
  console.log('[AdminRoutes] Rendering admin routes');
  
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={
          <ProtectedAdminRoute>
            <AdminDashboard />
          </ProtectedAdminRoute>
        } />
        <Route path="/admin/payments" element={
          <ProtectedAdminRoute>
            <AdminPayments />
          </ProtectedAdminRoute>
        } />
        <Route path="/admin/messages" element={
          <ProtectedAdminRoute>
            <AdminMessages />
          </ProtectedAdminRoute>
        } />
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

// Client routes
function ClientRoutes() {
  console.log('[ClientRoutes] Rendering client routes');
  
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/client-auth" element={<ClientAuth />} />
        <Route path="/client-dashboard" element={
          <ProtectedClientRoute>
            <ClientDashboard />
          </ProtectedClientRoute>
        } />
        <Route path="/client-profile" element={
          <ProtectedClientRoute>
            <ClientProfile />
          </ProtectedClientRoute>
        } />
        <Route path="/client-messages" element={
          <ProtectedClientRoute>
            <ClientMessages />
          </ProtectedClientRoute>
        } />
        <Route path="/browse" element={
          <ProtectedClientRoute>
            <Browse />
          </ProtectedClientRoute>
        } />
        <Route path="/plans" element={<Plans />} />
        <Route path="/payments" element={
          <ProtectedClientRoute>
            <Payments />
          </ProtectedClientRoute>
        } />
        <Route path="/subscriptions" element={
          <ProtectedClientRoute>
            <Subscriptions />
          </ProtectedClientRoute>
        } />
        <Route path="/messages" element={
          <ProtectedClientRoute>
            <Messages />
          </ProtectedClientRoute>
        } />
        <Route path="/help" element={<Help />} />
        <Route path="/notifications" element={
          <ProtectedClientRoute>
            <Notifications />
          </ProtectedClientRoute>
        } />
        <Route path="/shortlists" element={
          <ProtectedClientRoute>
            <Shortlists />
          </ProtectedClientRoute>
        } />
        <Route path="/install" element={<Install />} />
        <Route path="/" element={<Navigate to="/client-dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

function AppRoutes() {
  const config = getAppConfig();
  const { isAdmin, isClient, area, hostname } = config;
  
  // Debug logging for production troubleshooting
  console.log('[App] === RENDER START ===');
  console.log('[App] Hostname:', hostname);
  console.log('[App] Detected area:', area);
  console.log('[App] isAdmin:', isAdmin);
  console.log('[App] isClient:', isClient);
  console.log('[App] Mode:', config.mode);
  console.log('[App] API URL:', config.apiUrl);

  // Render based on detected area
  if (isAdmin) {
    console.log('[App] Rendering AdminRoutes');
    return <AdminRoutes />;
  }
  
  console.log('[App] Rendering ClientRoutes');
  return <ClientRoutes />;
}

// Global error boundary wrapper
function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppErrorBoundary>
        <AuthProvider>
          <BackupProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </BackupProvider>
        </AuthProvider>
      </AppErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;