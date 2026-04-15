import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

let supabase: SupabaseClient;

const getSupabase = (): SupabaseClient => {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
};

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }

    const token = authHeader.substring(7);

    const { data: { user }, error } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.userId = user.id;

    const { data: roleData } = await getSupabase()
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    req.userRole = roleData?.role || 'client';

    next();
  } catch (error) {
    console.error('[AuthMiddleware] Error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const adminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};