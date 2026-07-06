import { createClient } from '@supabase/supabase-js'

// 🔴 TEMPORARY HARDCODE – REMOVE AFTER TESTING
const supabaseUrl = 'https://ejapxqqtvuouqggdbmxx.supabase.co'
const supabaseAnonKey = 'sb_publishable_nai6hzsVBhNW5tTAWJpS5Q_z85IOVK2'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars')
}

console.log('Supabase client initialized with URL:', supabaseUrl)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
