import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

console.log('[Boot] App.tsx loaded - MINIMAL VERSION');

// Even more minimal - no imports that could fail
function UltraMinimalAdminRoutes() {
  console.log('[Admin] UltraMinimalAdminRoutes rendering');
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<div style={{padding: 50, textAlign: 'center'}}><h1>Admin Dashboard Works!</h1></div>} />
    </Routes>
  );
}

function MinimalAppRoutes() {
  console.log('[Boot] MinimalAppRoutes rendering');
  
  // Direct check without using getAppConfig to avoid any config issues
  let isAdmin = false;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    isAdmin = hostname === 'admin.vijayalakshmiboyarmatrimony.com' || hostname.endsWith('.admin.vijayalakshmiboyarmatrimony.com');
  }
  
  console.log('[Boot] isAdmin (direct check):', isAdmin);
  
  if (isAdmin) {
    return <UltraMinimalAdminRoutes />;
  }
  
  return <div style={{padding: 50}}><h1>Client mode - requires full setup</h1></div>;
}

const App = () => {
  console.log('[Boot] App component rendering');
  
  try {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <BrowserRouter>
              <MinimalAppRoutes />
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    );
  } catch (e) {
    console.log('[Boot] App render caught error:', e);
    return <div style={{padding: 50, color: 'red'}}>Error: {String(e)}</div>;
  }
};

export default App;