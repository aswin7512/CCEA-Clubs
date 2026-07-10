import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase;

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} catch (err) {
  console.warn('⚠️ Supabase initialization failed:', err.message);
  console.warn('Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable backend features.');

  // Provide a minimal stub so the app can still render without crashing
  const empty = { data: null, error: { message: 'Supabase not configured' }, count: 0 };
  const query = () => {
    const chain = {
      select: () => chain,
      insert: () => chain,
      update: () => chain,
      delete: () => chain,
      eq: () => chain,
      neq: () => chain,
      in: () => chain,
      single: () => chain,
      maybeSingle: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (resolve) => resolve(empty),
    };
    return chain;
  };
  supabase = {
    from: () => query(),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => empty,
      signUp: async () => empty,
      signOut: async () => ({}),
      resetPasswordForEmail: async () => ({}),
      updateUser: async () => empty,
    },
    storage: {
      from: () => ({
        upload: async () => empty,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };
}

export { supabase };
