// Cambio de Contraseña Obligatorio en Primer Acceso
import React, { useState } from 'react';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import supabase from '../../lib/supabaseClient';

const CambiarPasswordPrimeraVez = ({ onPasswordChanged }) => {
  const { user } = useAuth();
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  // Validación de contraseña
  const validarPassword = (password) => {
    if (password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (!/[A-Z]/.test(password)) {
      return 'La contraseña debe contener al menos una letra mayúscula';
    }
    if (!/[0-9]/.test(password)) {
      return 'La contraseña debe contener al menos un número';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    const errorValidacion = validarPassword(nuevaPassword);
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      // 1. Actualizar contraseña en Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: nuevaPassword
      });

      if (authError) throw authError;

      // 2. Actualizar campo requiere_cambio_password en tabla usuarios
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://contact-conductor.preview.emergentagent.com';
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${API_URL}/api/portal/cambiar-password-primera-vez`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error al actualizar el estado de cambio de contraseña');
      }

      // Notificar al componente padre
      if (onPasswordChanged) {
        onPasswordChanged();
      }
    } catch (err) {
      console.error('Error al cambiar contraseña:', err);
      setError(err.message || 'Error al cambiar la contraseña. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Cambio de Contraseña Requerido
            </h2>
            <p className="text-slate-600">
              Por seguridad, debes establecer una nueva contraseña en tu primer acceso
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="nueva-password" className="block text-sm font-semibold text-slate-700 mb-2">
                Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={mostrarPassword ? "text" : "password"}
                  id="nueva-password"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed transition-all"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {mostrarPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div className={`flex items-center gap-2 ${nuevaPassword.length >= 8 ? 'text-green-600' : ''}`}>
                  <span>{nuevaPassword.length >= 8 ? '✓' : '○'}</span>
                  <span>Mínimo 8 caracteres</span>
                </div>
                <div className={`flex items-center gap-2 ${/[A-Z]/.test(nuevaPassword) ? 'text-green-600' : ''}`}>
                  <span>{/[A-Z]/.test(nuevaPassword) ? '✓' : '○'}</span>
                  <span>Al menos una letra mayúscula</span>
                </div>
                <div className={`flex items-center gap-2 ${/[0-9]/.test(nuevaPassword) ? 'text-green-600' : ''}`}>
                  <span>{/[0-9]/.test(nuevaPassword) ? '✓' : '○'}</span>
                  <span>Al menos un número</span>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="confirmar-password" className="block text-sm font-semibold text-slate-700 mb-2">
                Confirmar Contraseña
              </label>
              <input
                type={mostrarPassword ? "text" : "password"}
                id="confirmar-password"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed transition-all"
                placeholder="Repite la contraseña"
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
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </span>
              ) : (
                '🔐 Establecer Nueva Contraseña'
              )}
            </button>
          </form>

          {/* Info adicional */}
          <div className="mt-6 p-4 bg-purple-50 rounded-lg">
            <p className="text-xs text-slate-600">
              <strong>Importante:</strong> Esta contraseña será tu nueva contraseña de acceso. 
              Guárdala en un lugar seguro y no la compartas con nadie.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CambiarPasswordPrimeraVez;
