// Supabase Client Configuration
// Frontend: Portal de Músicos + Panel de Gestores
import { createClient } from '@supabase/supabase-js'

// Fallback values for production/preview environments where env vars might not load
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL 
  || 'https://fklllpaobtgvjjxgngyi.supabase.co'

const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY 
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrbGxscGFvYnRndmpqeGduZ3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTU3NjQsImV4cCI6MjA5MjE3MTc2NH0.u9GPmGiHGsauhG1sLuqc5JpAEuEe0U_nMMlcRpzCsfs'

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials missing. Check .env file.')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage
    // flowType: 'implicit' is the default for email/password (no need to specify)
  }
})

// Helper: Get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error getting user:', error)
    return null
  }
  return user
}

// Helper: Get user profile from usuarios table
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error) {
    console.error('Error getting profile:', error)
    return null
  }
  return data
}

// Helper: Check if user is gestor
export const isGestor = async () => {
  const user = await getCurrentUser()
  if (!user) return false
  
  const profile = await getUserProfile(user.id)
  return profile?.rol === 'gestor'
}

// Helper: Sign in with magic link
export const signInWithMagicLink = async (email) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/portal`
    }
  })
  
  if (error) {
    console.error('Error sending magic link:', error)
    return { success: false, error }
  }
  
  return { success: true, data }
}

// Helper: Sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error signing out:', error)
    return false
  }
  return true
}

// Helper: Listen to auth changes
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback)
}

export default supabase
