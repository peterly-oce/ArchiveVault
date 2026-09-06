import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://ykvkghcyvwzeibhfddho.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = Boolean(url && anonKey)

// When the anon key is missing we still export a client so imports don't crash;
// calls will fail and the UI surfaces a "not configured" message.
export const supabase = createClient(url, anonKey || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const TRACKS_BUCKET = 'tracks'

export function publicAudioUrl(storagePath) {
  const { data } = supabase.storage.from(TRACKS_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}
