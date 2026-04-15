import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";

console.log('[Boot] App.tsx loaded - FIXED VERSION');

// Fixed - no redirect, just render content directly
function UltraMinimalAdminRoutes() {
  console.log('[Admin] UltraMinimalAdminRoutes rendering');
  return (
    <Routes>
      {/* No redirect - just serve the content directly */}
      <Route path="/admin/dashboard" element={
        <div style={{padding: 50, textAlign: 'center', background: '#f0f0f0', minHeight: '100vh'}}>
          <h1 style={{color: '#2a2'}}>Admin Dashboard Works!</h1>
          <p>No redirect, no router magic.</p>
          <p>Host: {window.location.hostname}</p>
        </div>
      } />
      {/* Catch all - serve the same content */}
      <Route path="*" element={
        <div style={{padding: 50, textAlign: 'center', background: '#f0f0f0', minHeight: '100vh'}}>
          <h1 style={{color: '#2a2'}}>Admin Dashboard Works!</h1>
          <p>Catch-all route</p>
        </div>
      } />
    </Routes>
  );
}

function MinimalAppRoutes() {
  console.log('[Boot] MinimalAppRoutes rendering');
  
  // Direct check without using getAppConfig
  let isAdmin = false;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    isAdmin = hostname === 'admin.vijayalakshmiboyarmatrimony.com' || hostname.endsWith('.admin.vijayalakshmiboyarmatrimony.com');
  }
  
  console.log('[Boot] isAdmin (direct check):', isAdmin);
  
  if (isAdmin) {
    return <UltraMinimalAdminRoutes />;
  }
  
  return <div style={{padding: 50}}><h1>Client mode</h1></div>;
}

const App = () => {
  console.log('[Boot] App component rendering');
  
  try {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <MinimalAppRoutes />
        </BrowserRouter>
      </ErrorBoundary>
    );
  } catch (e) {
    console.log('[Boot] App render caught error:', e);
    return <div style={{padding: 50, color: 'red'}}>Error: {String(e)}</div>;
  }
};

export default App;