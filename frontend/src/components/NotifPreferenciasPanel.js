// Panel reusable: Preferencias de notificaciones push.
// Carga GET y guarda PUT en `endpoint`. `clientOrToken` es axios o Bearer string
// (ver lib/push.js para misma convención).
//
// Props:
//   - clientOrToken: axios instance OR Bearer token string
//   - endpoint: '/api/auth/me/notif-preferencias' (gestor) o
//               '/api/portal/perfil/notif-preferencias' (músico)
//   - showVerificaciones: bool — mostrar el toggle de verificaciones (solo admins)
import React, { useEffect, useState } from 'react';

const TIPOS = [
  { key: 'convocatorias', icon: '🎼', label: 'Convocatorias nuevas',
    desc: 'Cuando se publica una nueva convocatoria para ti.' },
  { key: 'tareas',        icon: '📋', label: 'Tareas asignadas',
    desc: 'Cuando se te asigna o reasigna una tarea.' },
  { key: 'comentarios',   icon: '💬', label: 'Comentarios con mención',
    desc: 'Cuando alguien te menciona en un comentario interno.' },
  { key: 'recordatorios', icon: '⏰', label: 'Recordatorios de fechas límite',
    desc: 'Avisos antes del plazo de disponibilidad o transporte.' },
  { key: 'reclamaciones', icon: '📬', label: 'Respuestas a reclamaciones',
    desc: 'Cuando un gestor responde a tu reclamación.' },
  { key: 'verificaciones',icon: '🛡️', label: 'Solicitudes de verificación',
    desc: 'Cuando un gestor pide tu verificación de una sección.',
    onlyAdmin: true },
];

const _post = async (clientOrToken, path, body, method = 'PUT') => {
  if (typeof clientOrToken === 'string') {
    const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clientOrToken}` },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error(await r.text() || `${method} ${path} ${r.status}`);
    return r.json();
  }
  const fn = method === 'PUT' ? clientOrToken.put : clientOrToken.post;
  const resp = await fn.call(clientOrToken, path, body);
  return resp.data;
};
const _get = async (clientOrToken, path) => {
  if (typeof clientOrToken === 'string') {
    const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}${path}`, {
      headers: { Authorization: `Bearer ${clientOrToken}` },
    });
    if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
    return r.json();
  }
  const resp = await clientOrToken.get(path);
  return resp.data;
};

export default function NotifPreferenciasPanel({
  clientOrToken,
  endpoint,
  showVerificaciones = false,
  className = '',
}) {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // key actualmente guardándose
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!clientOrToken) return;
    (async () => {
      try {
        setLoading(true); setError(null);
        const d = await _get(clientOrToken, endpoint);
        setPrefs(d?.preferencias || {});
      } catch (e) {
        setError(e?.message || 'Error al cargar preferencias');
      } finally { setLoading(false); }
    })();
  }, [clientOrToken, endpoint]);

  const togglePref = async (key, value) => {
    if (!prefs) return;
    setSaving(key); setError(null); setFeedback(null);
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    try {
      const d = await _post(clientOrToken, endpoint, { [key]: value }, 'PUT');
      setPrefs(d?.preferencias || optimistic);
      setFeedback('✅ Guardado');
      setTimeout(() => setFeedback(null), 1200);
    } catch (e) {
      // revertir
      setPrefs(prefs);
      setError(e?.message || 'Error al guardar');
    } finally { setSaving(null); }
  };

  // === Botón "Enviarme un push de prueba" ===
  const [testing, setTesting] = useState(false);
  const enviarPushPrueba = async () => {
    setTesting(true); setError(null); setFeedback(null);
    try {
      const d = await _post(clientOrToken, '/api/push/test', {
        titulo: '🔔 Prueba OPUS MANAGER',
        body: 'Si ves esta notificación, todo funciona correctamente.',
        url: '/',
      }, 'POST');
      const n = d?.enviadas ?? 0;
      if (n > 0) setFeedback(`✅ Push enviado (${n} dispositivo${n === 1 ? '' : 's'})`);
      else setFeedback('⚠️ No hay dispositivos suscritos. Acepta el permiso de notificaciones primero.');
      setTimeout(() => setFeedback(null), 4000);
    } catch (e) {
      setError(e?.message || 'No se pudo enviar el push de prueba');
    } finally { setTesting(false); }
  };

  if (loading) {
    return (
      <div className={`bg-white border border-slate-200 rounded-lg p-4 ${className}`} data-testid="notif-prefs-loading">
        <p className="text-sm text-slate-500">Cargando preferencias…</p>
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className={`bg-white border border-slate-200 rounded-lg p-4 ${className}`}>
        <p className="text-sm text-slate-500">No se pudieron cargar las preferencias.</p>
        {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
      </div>
    );
  }

  const visibles = TIPOS.filter(t => !t.onlyAdmin || showVerificaciones);

  return (
    <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${className}`} data-testid="notif-prefs-panel">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <span className="text-xl">🔔</span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Notificaciones</h3>
          <p className="text-xs text-slate-500">Elige qué tipos de avisos quieres recibir.</p>
        </div>
        {feedback && <span className="ml-auto text-xs text-emerald-700 font-medium">{feedback}</span>}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-800" data-testid="notif-prefs-error">
          {error}
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {visibles.map(t => {
          const v = prefs[t.key] !== false; // default true
          return (
            <li key={t.key} className="px-4 py-3 flex items-center gap-3">
              <span className="text-lg" aria-hidden>{t.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{t.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={v}
                disabled={saving === t.key}
                onClick={() => togglePref(t.key, !v)}
                data-testid={`notif-pref-toggle-${t.key}`}
                title={v ? 'Activado' : 'Desactivado'}
                className={`relative inline-block w-10 h-6 rounded-full transition-colors ${
                  v ? 'bg-emerald-600' : 'bg-slate-300'
                } ${saving === t.key ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
              >
                <span className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                  v ? 'translate-x-4' : ''
                }`} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 flex-1">
          Las notificaciones críticas (errores, incidencias) siempre se entregan.
        </span>
        <button
          type="button"
          onClick={enviarPushPrueba}
          disabled={testing}
          data-testid="btn-push-test"
          className="px-2.5 py-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-white rounded disabled:opacity-60 whitespace-nowrap"
        >
          {testing ? 'Enviando…' : '🔔 Enviarme un push de prueba'}
        </button>
      </div>
    </div>
  );
}
