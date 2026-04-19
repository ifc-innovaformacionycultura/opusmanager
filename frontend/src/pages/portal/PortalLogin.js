// Portal de Músicos - Página de Login con Magic Link
import React, { useState } from 'react';
import { signInWithMagicLink } from '../../lib/supabaseClient';

const PortalLogin = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await signInWithMagicLink(email);

    if (result.success) {
      setMessage('✅ ¡Enlace enviado! Revisa tu email para acceder al portal.');
      setEmail('');
    } else {
      setError('❌ Error al enviar el enlace. Verifica tu email e inténtalo de nuevo.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo y Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-3xl">🎵</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Portal de Músicos</h1>
          <p className="text-slate-600">OPUS MANAGER</p>
        </div>

        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">Acceso sin contraseña</h2>
          <p className="text-slate-600 text-sm mb-6">
            Ingresa tu email y te enviaremos un enlace mágico para acceder
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
                placeholder="tu-email@ejemplo.com"
                required
                disabled={loading}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
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
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-600">
              ¿Eres gestor? <a href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">Inicia sesión aquí</a>
            </p>
          </div>
        </div>

        {/* Info adicional */}
        <div className="mt-6 text-center text-sm text-slate-600">
          <p>🔒 Acceso seguro sin contraseñas</p>
          <p className="mt-1">El enlace será válido por 1 hora</p>
        </div>
      </div>
    </div>
  );
};

export default PortalLogin;
