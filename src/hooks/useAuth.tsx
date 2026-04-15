import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAppConfig, getLogoutRedirectUrl } from '@/lib/config';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'vijayalakshmijayakumar45@gmail.com';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Redirect to appropriate login page based on current area
    const redirectUrl = getLogoutRedirectUrl();
    console.log('[Auth] Signing out, redirecting to:', redirectUrl);
    navigate(redirectUrl, { replace: true });
  };

  const refetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isAuthenticated: !!session, signOut, refetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const useRequireAuth = (requiredRole?: 'admin' | 'client') => {
  const { user, loading, isAdmin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const config = getAppConfig();

  useEffect(() => {
    if (loading) return;
    
    if (!isAuthenticated) {
      // Redirect to appropriate login based on required role or current area
      if (requiredRole === 'admin' || config.isAdmin) {
        navigate('/admin-login', { state: { from: location }, replace: true });
      } else {
        navigate('/client-auth', { state: { from: location }, replace: true });
      }
      return;
    }

    if (requiredRole === 'admin' && !isAdmin) {
      // Admin required but user is not admin - redirect to client area
      navigate('/client-auth', { replace: true });
      return;
    }

    if (requiredRole === 'client' && isAdmin) {
      // Client required but user is admin - redirect to admin area
      navigate('/admin/dashboard', { replace: true });
      return;
    }
  }, [loading, isAuthenticated, isAdmin, requiredRole, navigate, location, config.isAdmin]);

  return { user, loading, isAdmin, isAuthenticated };
};