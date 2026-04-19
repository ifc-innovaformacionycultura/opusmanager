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
        console.log('🔐 Auth state changed:', event, session?.user?.email);
        setSession(session);
        
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
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
        await loadUserProfile(session.user.id);
      }
    } catch (error) {
      console.error('❌ Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId) => {
    try {
      // Get access token from current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession?.access_token) {
        console.error('❌ No access token available');
        return;
      }

      // Call backend API to get profile (backend uses service_role key)
      // IMPORTANT: Use local backend for development
      const isDevelopment = window.location.hostname === 'localhost';
      const API_URL = isDevelopment ? 'http://localhost:8001/api' : `${process.env.REACT_APP_BACKEND_URL}/api`;
      
      console.log(`🔍 Fetching profile from: ${API_URL}/auth/me`);
      
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`
        }
      });

      if (!response.ok) {
        console.error('❌ Error loading profile:', response.status);
        
        // Si el perfil no existe (404), intentar sincronizar
        if (response.status === 404) {
          console.log('🔄 Perfil no encontrado, intentando sincronizar...');
          const syncResponse = await fetch(`${API_URL}/auth/sync-profile`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentSession.access_token}`
            }
          });
          
          if (syncResponse.ok) {
            try {
              const syncData = await syncResponse.json();
              console.log('✅ Perfil sincronizado:', syncData);
            } catch (e) {
              console.error('Error parsing sync response:', e);
            }
            
            // Retry loading profile
            const retryResponse = await fetch(`${API_URL}/auth/me`, {
              headers: {
                'Authorization': `Bearer ${currentSession.access_token}`
              }
            });
            
            if (retryResponse.ok) {
              try {
                const data = await retryResponse.json();
                setProfile(data.profile);
                setUser({
                  id: userId,
                  email: data.email,
                  nombre: data.nombre,
                  apellidos: data.apellidos,
                  rol: data.rol,
                  profile: data.profile
                });
              } catch (e) {
                console.error('Error parsing retry response:', e);
              }
              return;
            }
          }
        }
        
        return;
      }

      try {
        const data = await response.json();

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
        }
      } catch (e) {
        console.error('Error parsing profile response:', e);
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
    }
  };

  const signInWithPassword = async (email, password) => {
    try {
      console.log('🔐 Intentando login con:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ Error de Supabase Auth:', error);
        
        // Manejar errores específicos
        if (error.message?.includes('Invalid login credentials')) {
          throw new Error('Credenciales inválidas. Verifica tu email y contraseña.');
        }
        if (error.message?.includes('Email not confirmed')) {
          throw new Error('Email no confirmado. Revisa tu correo.');
        }
        if (error.message?.includes('User not found')) {
          throw new Error('Usuario no encontrado.');
        }
        
        throw error;
      }

      if (data.session) {
        console.log('✅ Login exitoso para:', email);
        await loadUserProfile(data.user.id);
        return { success: true, user: data.user };
      }

      return { success: false, error: 'No se pudo crear la sesión' };
    } catch (error) {
      console.error('❌ Login error completo:', {
        message: error.message,
        status: error.status,
        name: error.name
      });
      
      return { 
        success: false, 
        error: error.message || 'Error al iniciar sesión. Por favor, intenta de nuevo.'
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

  const value = {
    user,
    profile,
    session,
    loading,
    signInWithPassword,
    signOut,
    refreshSession,
    isAuthenticated: !!session,
    isGestor: profile?.rol === 'gestor',
    isMusico: profile?.rol === 'musico'
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
