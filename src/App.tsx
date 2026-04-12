import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { BackupProvider } from "./contexts/BackupContext";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ClientAuth from "./pages/ClientAuth";
import ClientProfile from "./pages/ClientProfile";
import Browse from "./pages/Browse";
import Install from "./pages/Install";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";
import Subscriptions from "./pages/Subscriptions";
import AdminPayments from "./pages/AdminPayments";
import Messages from "./pages/Messages";
import Help from "./pages/Help";
import Notifications from "./pages/Notifications";
import Shortlists from "./pages/Shortlists";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BackupProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/client-auth" element={<ClientAuth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/client-profile" element={<ClientProfile />} />
            <Route path="/install" element={<Install />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/admin-payments" element={<AdminPayments />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/help" element={<Help />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/shortlists" element={<Shortlists />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </BackupProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
