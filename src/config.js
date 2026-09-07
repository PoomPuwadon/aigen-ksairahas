import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fails loudly in dev/build rather than silently hitting nothing.
  // Copy .env.example to .env and fill in your own project's values.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.'
  );
}

// This is the anon key — it's meant to be public. All real access control
// happens server-side: every table has RLS enabled with zero policies (so
// PostgREST can't touch them directly), and all reads/writes go through
// SECURITY DEFINER RPC functions defined in supabase/schema.sql. Never put
// the service_role key here or anywhere in this frontend — see the Google
// Apps Script sync tool for where that key belongs instead.
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
