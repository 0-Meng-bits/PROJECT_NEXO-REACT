import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // removed lock:false — it causes concurrent refresh races that produce
    // "Already Used" token errors; the default navigator lock is safer
  },
  global: {
    headers: {
      'x-client-info': 'capstone-react'
    }
  }
});
