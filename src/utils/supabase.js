import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  import.meta.env.PUBLIC_SUPABASE_URL || 
  import.meta.env.VITE_SUPABASE_URL || 
  'https://kbydsthwpgjaiyjguzfd.supabase.co';

const supabaseAnonKey = 
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  'sb_publishable_idPNdZpR75bUZZSG8sT58g_d8oDky7b';

let client;
try {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'dr_pragya_clinic_auth_token'
    }
  });
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  client = createClient('https://kbydsthwpgjaiyjguzfd.supabase.co', 'sb_publishable_idPNdZpR75bUZZSG8sT58g_d8oDky7b', {
    auth: { persistSession: true }
  });
}

export const supabase = client;
