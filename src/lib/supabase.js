import { createClient } from '@supabase/supabase-js'

export const SUPA_URL = 'https://khtpnbzfjggezlmnnsgt.supabase.co'
export const SUPA_KEY = 'sb_publishable_VonNsePJIpR1wCmEFmYa1g_YiYADATR'

export const client = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})
