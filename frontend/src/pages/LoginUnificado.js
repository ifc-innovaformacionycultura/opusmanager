// Página de Login Unificada - Gestores y Músicos
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { signInWithMagicLink } from '../lib/supabaseClient';

const API = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : '/api';

const LoginUnificado = () => {
  const navigate = useNavigate();
  const [modo, setModo] = useState('gestor'); // 'gestor' o 'musico'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Login de Gestores (email + password)
  const handleGestorLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password
      });

      if (response.data.access_token) {
        localStorage.setItem('auth_token', response.data.access_token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  // Login de Músicos (magic link)
  const handleMusicoLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await signInWithMagicLink(email);

    if (result.success) {
      setMessage('✅ ¡Enlace enviado! Revisa tu email para acceder.');
      setEmail('');
    } else {
      setError('❌ Error al enviar el enlace. Verifica tu email e inténtalo de nuevo.');
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
                setMessage(null);
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
                setMessage(null);
                setPassword('');
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
            {modo === 'gestor' ? (
              // Formulario de Gestores
              <>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">Acceso de Gestores</h2>
                <p className="text-slate-600 text-sm mb-6">
                  Ingresa con tu email y contraseña
                </p>

                <form onSubmit={handleGestorLogin} className="space-y-4">
                  <div>
                    <label htmlFor="email-gestor" className="block text-sm font-medium text-slate-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email-gestor"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@convocatorias.com"
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
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
              </>
            ) : (
              // Formulario de Músicos
              <>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">Acceso de Músicos</h2>
                <p className="text-slate-600 text-sm mb-6">
                  Te enviaremos un enlace mágico a tu email
                </p>

                <form onSubmit={handleMusicoLogin} className="space-y-4">
                  <div>
                    <label htmlFor="email-musico" className="block text-sm font-medium text-slate-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email-musico"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu-email@ejemplo.com"
                      required
                      disabled={loading}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {message && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Enviando...
                      </span>
                    ) : (
                      '🔗 Enviar enlace mágico'
                    )}
                  </button>
                </form>

                <div className="mt-4 text-center text-xs text-slate-500">
                  <p>🔒 Acceso seguro sin contraseñas</p>
                  <p className="mt-1">El enlace será válido por 1 hora</p>
                </div>
              </>
            )}
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
