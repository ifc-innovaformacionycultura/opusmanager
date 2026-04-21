// Supabase Auth Context - Reemplaza el AuthContext legacy
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const SupabaseAuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within SupabaseAuthProvider');
  }
  return context;
};

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔵 Auth event:', event, 'user:', session?.user?.email);
        console.log('🔐 Auth state changed:', event, session?.user?.email);
        setSession(session);

        // USER_UPDATED and TOKEN_REFRESHED don't need profile reload
        // (profile from backend doesn't change on password update or token refresh)
        if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          console.log('ℹ️ Skipping profile reload on', event);
          return;
        }
        
        if (session?.user) {
          // BUG 3 FIX: Solo cargar perfil si es músico
          const rol = session.user?.app_metadata?.rol;
          if (rol === 'musico') {
            console.log('✅ User detected (musico), loading profile...');
            await loadUserProfile(session.user.id);
          } else {
            console.log('❌ User detected but NOT musico (rol:', rol, ')');
            setUser(null);
            setLoading(false);
          }
        } else {
          console.log('❌ No user in session');
          setUser(null);
          setProfile(null);
          console.log('🔵 setLoading(false) called at point: 7 (No user)');
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      setSession(session);
      
      if (session?.user) {
        // BUG 2 FIX: Solo cargar perfil si es músico
        const rol = session.user?.app_metadata?.rol;
        if (rol === 'musico') {
          await loadUserProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error checking session:', error);
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId) => {
    console.log('🔵 loadUserProfile START - userId:', userId);
    
    try {
      // Get access token from current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      console.log('🔵 Session token:', currentSession?.access_token ? 'EXISTS' : 'NULL');
      
      if (!currentSession?.access_token) {
        console.error('❌ No access token available');
        console.log('🔵 setLoading(false) called at point: 1 (No token)');
        setLoading(false);
        return;
      }

      // IMPORTANT: Always use REACT_APP_BACKEND_URL for músicos
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://contact-conductor.preview.emergentagent.com';
      const profileUrl = `${API_URL}/api/auth/me`;
      
      console.log('🔵 Fetching:', profileUrl);
      
      const response = await fetch(profileUrl, {
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`
        }
      });

      console.log('🔵 Response status:', response.status, response.ok);

      if (!response.ok) {
        console.error('❌ Error loading profile:', response.status);
        
        // Si el perfil no existe (404), intentar sincronizar
        if (response.status === 404) {
          console.log('🔄 Perfil no encontrado, intentando sincronizar...');
          
          const syncUrl = `${API_URL}/api/auth/sync-profile`;
          console.log('🔵 Fetching:', syncUrl);
          
          const syncResponse = await fetch(syncUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentSession.access_token}`
            }
          });
          
          console.log('🔵 Response status (sync):', syncResponse.status, syncResponse.ok);
          
          if (syncResponse.ok) {
            try {
              const syncData = await syncResponse.json();
              console.log('✅ Perfil sincronizado:', syncData);
            } catch (e) {
              console.error('Error parsing sync response:', e);
            }
            
            // Retry loading profile
            console.log('🔵 Fetching (retry):', profileUrl);
            
            const retryResponse = await fetch(profileUrl, {
              headers: {
                'Authorization': `Bearer ${currentSession.access_token}`
              }
            });
            
            console.log('🔵 Response status (retry):', retryResponse.status, retryResponse.ok);
            
            if (retryResponse.ok) {
              try {
                const data = await retryResponse.json();
                console.log('✅ Perfil cargado después de sync:', data);
                setProfile(data.profile);
                setUser({
                  id: userId,
                  email: data.email,
                  nombre: data.nombre,
                  apellidos: data.apellidos,
                  rol: data.rol,
                  profile: data.profile
                });
                console.log('🔵 setLoading(false) called at point: 2 (After sync success)');
                setLoading(false);
              } catch (e) {
                console.error('Error parsing retry response:', e);
                console.log('🔵 setLoading(false) called at point: 3 (Parse error after sync)');
                setLoading(false);
              }
              return;
            }
          }
        }
        
        console.log('🔵 setLoading(false) called at point: 4 (Profile load failed)');
        setLoading(false);
        return;
      }

      try {
        const data = await response.json();
        console.log('✅ Profile data received:', data);

        if (data) {
          setProfile(data.profile);
          setUser({
            id: userId,
            email: data.email,
            nombre: data.nombre,
            apellidos: data.apellidos,
            rol: data.rol,
            profile: data.profile
          });
          console.log('✅ User state updated successfully');
        }
      } catch (e) {
        console.error('Error parsing profile response:', e);
      }
      
      console.log('🔵 setLoading(false) called at point: 5 (Normal completion)');
      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading profile (catch):', error);
      console.log('🔵 setLoading(false) called at point: 6 (Error caught)');
      setLoading(false);
    }
  };

  const signInWithPassword = async (email, password) => {
    try {
      console.log('🔐 Intentando login con:', email);
      
      let authData, authError;
      
      try {
        // Llamada a Supabase Auth - NO acceder a error.response
        const result = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        authData = result.data;
        authError = result.error;
      } catch (supabaseException) {
        // Si Supabase lanza una excepción (no un error en result.error)
        console.error('❌ Excepción de Supabase:', supabaseException);
        
        return {
          success: false,
          error: 'Error de conexión con el servicio de autenticación. Por favor, intenta de nuevo.'
        };
      }

      if (authError) {
        console.error('❌ Error de Supabase Auth:', {
          message: authError.message,
          // NO acceder a authError.status ni authError.response
        });
        
        // Manejar errores específicos basados solo en el mensaje
        let userMessage = 'Error al iniciar sesión';
        
        const errorMsg = authError.message?.toLowerCase() || '';
        
        if (errorMsg.includes('invalid') || errorMsg.includes('credentials') || errorMsg.includes('password')) {
          userMessage = 'Credenciales inválidas. Verifica tu email y contraseña.';
        } else if (errorMsg.includes('not confirmed') || errorMsg.includes('email')) {
          userMessage = 'Email no confirmado. Revisa tu correo.';
        } else if (errorMsg.includes('not found')) {
          userMessage = 'Usuario no encontrado.';
        } else if (authError.message) {
          userMessage = authError.message;
        }
        
        return { 
          success: false, 
          error: userMessage
        };
      }

      if (authData?.session) {
        console.log('✅ Login exitoso para:', email);
        
        // Cargar perfil de forma bloqueante para garantizar que isAuthenticated sea true
        await loadUserProfile(authData.user.id);
        
        return { success: true, user: authData.user };
      }

      return { success: false, error: 'No se pudo crear la sesión' };
      
    } catch (error) {
      console.error('❌ Error inesperado en signInWithPassword:', error);
      
      // NO intentar acceder a error.response ni error.status
      const errorMessage = typeof error === 'string' 
        ? error 
        : (error?.message || 'Error al iniciar sesión. Por favor, intenta de nuevo.');
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  // REMOVED: Magic Link authentication (replaced with email+password for músicos)

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setProfile(null);
      setSession(null);

      return { success: true };
    } catch (error) {
      console.error('❌ Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      if (data.session) {
        setSession(data.session);
        await loadUserProfile(data.user.id);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Refresh error:', error);
      return { success: false, error: error.message };
    }
  };

  const reloadProfile = async () => {
    if (user?.id) {
      await loadUserProfile(user.id);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signInWithPassword,
    signOut,
    refreshSession,
    reloadProfile,
    isAuthenticated: !!user && !!profile, // BUG 1 FIX: Solo autenticado cuando tiene perfil cargado
    isGestor: profile?.rol === 'gestor',
    isMusico: profile?.rol === 'musico'
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
