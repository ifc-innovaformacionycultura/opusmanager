// Página pública de activación de invitación.
// Ruta: /activar/:token  (sin login).
// Flujo:
//   1) GET /api/portal/activar/{token}   → datos del músico (o error 404/410).
//   2) POST /api/portal/activar/{token}  → fija contraseña, marca 'activado'.
//   3) Login automático con Supabase y redirección a /portal.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import supabase from '../lib/supabaseClient';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ActivarCuenta() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [musico, setMusico] = useState(null);
  const [error, setError] = useState(null);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/api/portal/activar/${token}`);
        setMusico(r.data);
      } catch (e) {
        const detail = e?.response?.data?.detail || e?.message || 'Token inválido';
        setError(detail);
      } finally { setLoading(false); }
    })();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (pwd.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (pwd !== pwd2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    try {
      setSubmitting(true);
      const r = await axios.post(`${API}/api/portal/activar/${token}`, { password: pwd });
      setDone(true);
      // Login automático con Supabase
      try {
        await supabase.auth.signInWithPassword({ email: r.data.email, password: pwd });
        setTimeout(() => navigate('/portal'), 1200);
      } catch {
        setTimeout(() => navigate('/login'), 1500);
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Error al activar la cuenta');
    } finally { setSubmitting(false); }
  };

  // ---------- Render states ----------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
      </div>
    );
  }

  if (error && !musico) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4" data-testid="activar-error">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="font-cabinet text-xl font-bold text-slate-900 mb-2">Enlace no válido</h1>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <p className="text-xs text-slate-500 mb-5">
            Es posible que la invitación haya caducado o ya haya sido utilizada. Si crees que es un error,
            contacta con el equipo de gestión.
          </p>
          <Link to="/login" className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium">
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4" data-testid="activar-done">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="font-cabinet text-xl font-bold text-slate-900 mb-2">¡Cuenta activada!</h1>
          <p className="text-sm text-slate-600">Te estamos redirigiendo a tu portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4" data-testid="activar-page">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-5 text-white">
          <h1 className="font-cabinet text-2xl font-bold">OPUS MANAGER</h1>
          <p className="text-sm text-slate-200 mt-1">Portal de músicos</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">¡Bienvenido/a, {musico?.nombre || 'músico'}!</h2>
            <p className="text-sm text-slate-600 mt-1">
              Establece una contraseña para acceder a tu portal.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600">
            <strong className="text-slate-800">Email:</strong> {musico?.email}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md" data-testid="activar-form-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3" data-testid="activar-form">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nueva contraseña</label>
              <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
                data-testid="activar-pwd"
                minLength={8} required
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              <p className="text-[11px] text-slate-500 mt-1">Mínimo 8 caracteres.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Confirmar contraseña</label>
              <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)}
                data-testid="activar-pwd2"
                minLength={8} required
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </div>

            <button type="submit" disabled={submitting}
              data-testid="activar-submit"
              className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-semibold disabled:opacity-60">
              {submitting ? 'Activando…' : 'Activar mi cuenta'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center pt-2">
            Al activar tu cuenta aceptas las condiciones de uso del portal.
          </p>
        </div>
      </div>
    </div>
  );
}
