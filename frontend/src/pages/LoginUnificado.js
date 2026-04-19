// Página de Login Unificada - Gestores y Músicos
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/SupabaseAuthContext';

const LoginUnificado = () => {
  const navigate = useNavigate();
  const { signInWithPassword, isAuthenticated, user } = useAuth();
  const [modo, setModo] = useState('gestor'); // 'gestor' o 'musico'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.rol === 'gestor') {
        navigate('/');
      } else if (user.rol === 'musico') {
        navigate('/portal');
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Login para Gestores y Músicos (ambos usan email + password)
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signInWithPassword(email, password);

    if (result.success) {
      // Navigation handled by useEffect above
      console.log('✅ Login exitoso');
    } else {
      setError(result.error || 'Error al iniciar sesión. Verifica tus credenciales.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo y Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-3xl">OM</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">OPUS MANAGER</h1>
          <p className="text-slate-600">Sistema de Gestión y Control de Plantillas Orquestales</p>
        </div>

        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Selector de Modo */}
          <div className="grid grid-cols-2 bg-slate-100 p-1 gap-1">
            <button
              onClick={() => {
                setModo('gestor');
                setError(null);
              }}
              className={`py-3 rounded-lg font-semibold transition-all ${
                modo === 'gestor'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              👔 Gestor
            </button>
            <button
              onClick={() => {
                setModo('musico');
                setError(null);
              }}
              className={`py-3 rounded-lg font-semibold transition-all ${
                modo === 'musico'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              🎵 Músico
            </button>
          </div>

          {/* Formulario */}
          <div className="p-8">
            {/* Formulario Unificado para Gestores y Músicos */}
            <>
              <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                {modo === 'gestor' ? 'Acceso de Gestores' : 'Acceso de Músicos'}
              </h2>
              <p className="text-slate-600 text-sm mb-6">
                Ingresa con tu email y contraseña
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
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
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
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
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
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
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' 
                      : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
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

              {/* TODO: Recuperación de contraseña (FASE 6) */}
              <div className="mt-4 text-center">
                <button className="text-sm text-slate-600 hover:text-slate-900 underline">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* TODO: Google OAuth (FASE 3) */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-slate-500">O continúa con</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-sm font-medium text-slate-700">Google (Próximamente)</span>
                </button>
              </div>
            </>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-600">
          <p>© 2025 OPUS MANAGER</p>
        </div>
      </div>
    </div>
  );
};

export default LoginUnificado;
