import { createClient } from '@supabase/supabase-js'

// Try both VITE_* and plain – works regardless of how env vars are named
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars. Check Vercel dashboard.')
  throw new Error('Supabase client missing URL or key.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
