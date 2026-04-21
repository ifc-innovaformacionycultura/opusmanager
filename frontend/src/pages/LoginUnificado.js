// Página de Login Unificada - Gestores y Músicos
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth as useGestorAuth } from '../contexts/AuthContext';
import { useAuth as useMusicoAuth } from '../contexts/SupabaseAuthContext';
import supabase from '../lib/supabaseClient';

const LoginUnificado = () => {
  const navigate = useNavigate();
  const gestorAuth = useGestorAuth();
  const musicoAuth = useMusicoAuth();
  
  const [modo, setModo] = useState('gestor'); // 'gestor' o 'musico'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estado para recuperación de contraseña
  const [mostrarRecuperacion, setMostrarRecuperacion] = useState(false);
  const [emailRecuperacion, setEmailRecuperacion] = useState('');
  const [loadingRecuperacion, setLoadingRecuperacion] = useState(false);
  const [mensajeRecuperacion, setMensajeRecuperacion] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    if (modo === 'gestor' && gestorAuth.isAuthenticated) {
      navigate('/');
    } else if (modo === 'musico' && musicoAuth.isAuthenticated && musicoAuth.user) {
      navigate('/portal');
    }
  }, [modo, gestorAuth.isAuthenticated, musicoAuth.isAuthenticated, musicoAuth.user, navigate]);

  // Login handler - usa el contexto apropiado según el modo
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let result;
    
    if (modo === 'gestor') {
      // Gestores: usar AuthContext (axios + backend propio)
      result = await gestorAuth.login(email, password);
      if (result.success) {
        navigate('/');
      }
    } else {
      // Músicos: usar SupabaseAuthContext
      result = await musicoAuth.signInWithPassword(email, password);
      if (result.success) {
        navigate('/portal');
      }
    }

    if (!result.success) {
      setError(result.error || 'Error al iniciar sesión. Verifica tus credenciales.');
    }

    setLoading(false);
  };

  // Handler para recuperación de contraseña
  const handleRecuperarPassword = async (e) => {
    e.preventDefault();
    setLoadingRecuperacion(true);
    setMensajeRecuperacion(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperacion, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      setMensajeRecuperacion('✅ Te hemos enviado un email con instrucciones para recuperar tu contraseña.');
      setEmailRecuperacion('');
    } catch (err) {
      setMensajeRecuperacion('❌ Error al enviar email. Verifica que el correo sea correcto.');
    } finally {
      setLoadingRecuperacion(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado Izquierdo - Imagen de Auditorio */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://static.prod-images.emergentagent.com/jobs/234efbab-6f82-4a1d-a46a-8abdc8d709c6/images/72918666a3aff7419cc647ca9dbd829fc66c63a17a0ae330882aae3b0e9e0827.png)'
        }}
      >
        {/* Overlay oscuro */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90"></div>
        
        {/* Contenido */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <h1 className="text-5xl font-bold mb-6">
            OPUS MANAGER
          </h1>
          <p className="text-xl text-slate-300 mb-8 leading-relaxed">
            Sistema integral de gestión de convocatorias musicales profesionales
          </p>
          <div className="space-y-4 text-slate-400">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Gestión centralizada de eventos y convocatorias</span>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Control de asistencia y seguimiento de músicos</span>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Análisis económico y gestión presupuestaria</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lado Derecho - Formulario de Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-50 px-8 py-12">
        <div className="w-full max-w-md">
          {/* Logo y Título */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Bienvenido</h2>
            <p className="text-slate-600">Inicia sesión para continuar</p>
          </div>

          {/* Toggle Gestor/Músico */}
          <div className="bg-white rounded-xl p-2 shadow-sm mb-8 flex gap-2">
            <button
              onClick={() => {
                setModo('gestor');
                setError(null);
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                modo === 'gestor'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              👔 Gestor
            </button>
            <button
              onClick={() => {
                setModo('musico');
                setError(null);
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                modo === 'musico'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🎵 Músico
            </button>
          </div>

          {/* Formulario */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={modo === 'gestor' ? 'admin@convocatorias.com' : 'tu-email@ejemplo.com'}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed transition-all"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed transition-all"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full ${
                  modo === 'gestor' 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-purple-600 hover:bg-purple-700'
                } text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Iniciando sesión...
                  </span>
                ) : (
                  '🔐 Iniciar sesión'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-6 text-center">
              <button 
                type="button"
                onClick={() => setMostrarRecuperacion(true)}
                className="text-sm text-slate-600 hover:text-slate-900 underline transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {/* Copyright */}
          <p className="text-center text-sm text-slate-500 mt-8">
            © 2025 OPUS MANAGER. Todos los derechos reservados.
          </p>
        </div>
      </div>

      {/* Modal de Recuperación de Contraseña */}
      {mostrarRecuperacion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800">
                Recuperar Contraseña
              </h3>
              <button
                onClick={() => {
                  setMostrarRecuperacion(false);
                  setMensajeRecuperacion(null);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {mensajeRecuperacion ? (
              <div className={`p-4 rounded-lg mb-6 ${
                mensajeRecuperacion.startsWith('✅') 
                  ? 'bg-green-50 text-green-800' 
                  : 'bg-red-50 text-red-800'
              }`}>
                {mensajeRecuperacion}
              </div>
            ) : (
              <>
                <p className="text-slate-600 mb-6">
                  Ingresa tu email y te enviaremos instrucciones para recuperar tu contraseña.
                </p>

                <form onSubmit={handleRecuperarPassword} className="space-y-6">
                  <div>
                    <label htmlFor="email-recuperacion" className="block text-sm font-semibold text-slate-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email-recuperacion"
                      value={emailRecuperacion}
                      onChange={(e) => setEmailRecuperacion(e.target.value)}
                      required
                      disabled={loadingRecuperacion}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                      placeholder="tu-email@ejemplo.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loadingRecuperacion}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                  >
                    {loadingRecuperacion ? 'Enviando...' : 'Enviar Instrucciones'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginUnificado;
