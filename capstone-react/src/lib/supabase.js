import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    lock: false, // prevent NavigatorLockAcquireTimeoutError across tabs
  },
  global: {
    headers: {
      'x-client-info': 'capstone-react'
    }
  }
});
