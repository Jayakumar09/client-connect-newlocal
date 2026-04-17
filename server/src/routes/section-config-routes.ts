import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

interface ProfileSectionConfig {
  id: string;
  section_key: string;
  section_label: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[ProfileSectionConfig] Supabase not configured, returning empty sections');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

router.get('/sections', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    
    if (!supabase) {
      return res.json({ 
        success: true, 
        data: [] 
      });
    }
    
    const { data, error } = await supabase
      .from('profile_section_config')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('[ProfileSectionConfig] Fetch error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch sections',
        details: error.message 
      });
    }
    
    res.json({ 
      success: true, 
      data: data || [] 
    });
  } catch (err) {
    console.error('[ProfileSectionConfig] Server error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.post('/sections', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Service unavailable' 
      });
    }
    
    const { section_key, section_label, display_order } = req.body;
    
    if (!section_key || !section_label) {
      return res.status(400).json({ 
        success: false, 
        error: 'section_key and section_label are required' 
      });
    }
    
    const { data, error } = await supabase
      .from('profile_section_config')
      .insert({ 
        section_key, 
        section_label, 
        display_order: display_order || 0 
      })
      .select()
      .single();
    
    if (error) {
      console.error('[ProfileSectionConfig] Insert error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create section',
        details: error.message 
      });
    }
    
    res.json({ 
      success: true, 
      data 
    });
  } catch (err) {
    console.error('[ProfileSectionConfig] Server error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.put('/sections/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Service unavailable' 
      });
    }
    
    const { id } = req.params;
    const { section_label, display_order, is_active } = req.body;
    
    const updates: Partial<ProfileSectionConfig> = {};
    if (section_label !== undefined) updates.section_label = section_label;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;
    
    const { data, error } = await supabase
      .from('profile_section_config')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[ProfileSectionConfig] Update error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update section',
        details: error.message 
      });
    }
    
    res.json({ 
      success: true, 
      data 
    });
  } catch (err) {
    console.error('[ProfileSectionConfig] Server error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.delete('/sections/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Service unavailable' 
      });
    }
    
    const { id } = req.params;
    
    const { error } = await supabase
      .from('profile_section_config')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[ProfileSectionConfig] Delete error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to delete section',
        details: error.message 
      });
    }
    
    res.json({ 
      success: true 
    });
  } catch (err) {
    console.error('[ProfileSectionConfig] Server error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;