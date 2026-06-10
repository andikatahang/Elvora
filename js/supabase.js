// js/supabase.js
// Shared Supabase client — initialized once and imported by all other modules.
// Service role key MUST NOT appear here — RLS enforces access control.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL ?? window.__ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? window.__ENV?.SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
