import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zmujrcvwyyilmlbtycxc.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_br78PwbhLUTq7B8e8XhVig_YD63TnEJ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

