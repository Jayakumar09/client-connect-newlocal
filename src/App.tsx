import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { BackupProvider } from "./contexts/BackupContext";
import { getAppConfig, isAdminApp } from "./lib/config";
import { ErrorBoundary } from "./components/ErrorBoundary";
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
import { lazy, Suspense, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.default })));

const queryClient = new QueryClient();

console.log('[Boot] App.tsx loaded - FULL VERSION');

function AdminRoutesWrapper() {
  console.log('[Isolate] AdminRoutesWrapper rendering');
  
  function AdminLogin() {
    console.log('[Admin] Rendering AdminLogin');
    const { user, isAdmin, loading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [signingIn, setSigningIn] = useState(false);
    
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
        </div>
      );
    }
    
    if (user && isAdmin) {
      console.log('[Admin] User already logged in, redirecting to /admin/dashboard');
      return <Navigate to="/admin/dashboard" replace />;
    }
    
    const handleSignIn = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log('[Admin] Login submit start, email:', email);
      setSigningIn(true);
      
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.error('[Admin] Login error:', error.message);
          toast.error(error.message);
        } else {
          console.log('[Admin] Login success, user:', !!data.user);
          toast.success('Login successful!');
        }
      } catch (err) {
        console.error('[Admin] Login exception:', err);
        toast.error('Login failed');
      } finally {
        setSigningIn(false);
      }
    };
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Admin Login</CardTitle>
            <CardDescription className="text-center">Sign in to access admin area</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={signingIn}>
                {signingIn ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div></div>}>
      <Routes>
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={
          <div>
            <div className="p-2 bg-blue-100 text-blue-800">[Admin] Rendering /admin/dashboard</div>
            <AdminDashboard />
          </div>
        } />
        <Route path="/admin/payments" element={<div>Admin payments route works</div>} />
        <Route path="/" element={<Navigate to="/admin-login" replace />} />
      </Routes>
    </Suspense>
  );
}

// Protected route wrapper for admin
function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  console.log('[Admin] ProtectedAdminRoute rendering');
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
    console.log('[Admin] No user, redirecting to /admin-login');
    return <Navigate to="/admin-login" state={{ from: location }} replace />;
  }
  
  if (!isAdmin) {
    console.log('[Admin] User is not admin, redirecting to /client-auth');
    return <Navigate to="/client-auth" replace />;
  }
  
  console.log('[Admin] Rendering admin content');
  return <>{children}</>;
}

// Protected route wrapper for client
function ProtectedClientRoute({ children }: { children: React.ReactNode }) {
  console.log('[Client] ProtectedClientRoute rendering');
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
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Admin login page (public) - SIMPLIFIED for debugging
function AdminLogin() {
  console.log('[Admin] Rendering AdminLogin');
  const { user, isAdmin, loading } = useAuth();
  
  // Wait for auth to load
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    );
  }
  
  // Already logged in as admin
  if (user && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  // Show a simple login placeholder first to debug
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
        <p className="text-gray-600 text-center mb-4">Admin login component loading...</p>
        <div className="text-sm text-gray-400">Auth: {user ? 'logged in' : 'not logged in'}</div>
      </div>
    </div>
  );
}

// Admin routes - WRAPPED with safety
function AdminRoutes() {
  console.log('[Admin] === AdminRoutes START ===');
  
  // Safety wrapper around entire admin route tree
  const { user, loading } = useAuth();
  
  console.log('[Admin] Auth state - loading:', loading, 'user:', !!user);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p>Loading admin...</p>
        </div>
      </div>
    );
  }
  
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
        <Route path="/" element={
          <AdminRootHandler />
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

// Handle root path - redirect to dashboard or show login
function AdminRootHandler() {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (user && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  return <Navigate to="/admin-login" replace />;
}

// Client routes - SIMPLIFIED for stability
function ClientRoutes() {
  console.log('[Client] === ClientRoutes START ===');
  
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    );
  }
  
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
        <Route path="/" element={
          <ClientRootHandler />
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

// Handle root path - redirect to dashboard or show login
function ClientRootHandler() {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  // If admin user, redirect to admin
  if (user && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  // If client user, redirect to client dashboard
  if (user && !isAdmin) {
    return <Navigate to="/client-dashboard" replace />;
  }
  
  // Not logged in - go to client auth
  return <Navigate to="/client-auth" replace />;
}

function AppRoutes() {
  const config = getAppConfig();
  const { isAdmin, area, hostname } = config;
  
  console.log('[App] === RENDER START ===');
  console.log('[App] Hostname:', hostname);
  console.log('[App] Detected area:', area);
  console.log('[App] isAdmin:', isAdmin);

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

export default function App() {
  const config = getAppConfig();
  console.log('[Isolate] Layer: BrowserRouter + ErrorBoundary + AuthProvider + BackupProvider + area branch + AdminRoutes');
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <BackupProvider>
            {config.isAdmin ? (
              <AdminRoutesWrapper />
            ) : (
              <ClientRoutes />
            )}
          </BackupProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}