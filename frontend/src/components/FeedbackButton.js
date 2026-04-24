// Widget flotante de feedback/incidencias.
// Funciona en gestor (POST /api/gestor/incidencias) y en portal de músico
// (POST /api/portal/incidencias).
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const MIN_DESC = 20;

const FeedbackButton = ({ mode = 'gestor' }) => {
  const auth = useAuth();
  const api = auth?.api;
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState('incidencia');
  const [prioridad, setPrioridad] = useState('media');
  const [descripcion, setDescripcion] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  // En modo gestor exigimos AuthContext (api del gestor).
  // En modo portal usamos la sesión Supabase directamente.
  if (mode === 'gestor' && !api) return null;

  const apiUrl = process.env.REACT_APP_BACKEND_URL || '';

  const enviar = async () => {
    const txt = descripcion.trim();
    if (txt.length < MIN_DESC) {
      setMsg({ type: 'error', text: `Mínimo ${MIN_DESC} caracteres (actuales: ${txt.length})` });
      return;
    }
    try {
      setSending(true); setMsg(null);
      const payload = { tipo, descripcion: txt, pagina: loc.pathname, prioridad };
      if (mode === 'portal') {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${apiUrl}/api/portal/incidencias`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.detail || 'Error');
        }
      } else {
        await api.post('/api/gestor/incidencias', payload);
      }
      setMsg({ type: 'success', text: '✅ Gracias por tu feedback. Lo revisaremos pronto.' });
      setDescripcion('');
      setTimeout(() => { setOpen(false); setMsg(null); }, 2000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally { setSending(false); }
  };

  const charsLeft = Math.max(0, MIN_DESC - descripcion.trim().length);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="btn-feedback"
        className="fixed bottom-6 right-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5"
        title="Reportar incidencia, mejora o pregunta"
      >
        💬 Feedback
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="feedback-modal">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold">Reportar feedback</h3>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-900">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Tipo</label>
                <div className="inline-flex border border-slate-300 rounded-md overflow-hidden text-sm">
                  {[
                    { v: 'incidencia', label: '🐞 Incidencia' },
                    { v: 'mejora',     label: '✨ Mejora' },
                    { v: 'pregunta',   label: '❓ Pregunta' },
                  ].map(o => (
                    <button key={o.v} type="button"
                            onClick={() => setTipo(o.v)}
                            data-testid={`feedback-tipo-${o.v}`}
                            className={`px-3 py-1.5 ${tipo === o.v ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Prioridad</label>
                <div className="inline-flex border border-slate-300 rounded-md overflow-hidden text-sm">
                  {[
                    { v: 'alta',  label: '🔴 Alta',  cls: 'bg-red-600 text-white' },
                    { v: 'media', label: '🟡 Media', cls: 'bg-amber-500 text-white' },
                    { v: 'baja',  label: '🟢 Baja',  cls: 'bg-emerald-600 text-white' },
                  ].map(o => (
                    <button key={o.v} type="button"
                            onClick={() => setPrioridad(o.v)}
                            data-testid={`feedback-prio-${o.v}`}
                            className={`px-3 py-1.5 ${prioridad === o.v ? o.cls : 'bg-white text-slate-700'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Descripción * <span className="text-slate-400">(mín. {MIN_DESC} caracteres)</span></label>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={5}
                          data-testid="feedback-descripcion"
                          placeholder="Describe lo que ocurre, qué esperabas, y cualquier detalle útil..."
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
                <div className={`mt-1 text-[11px] ${charsLeft > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {charsLeft > 0 ? `Faltan ${charsLeft} caracteres` : '✓ Suficientemente detallado'}
                </div>
              </div>
              <div className="text-xs text-slate-500">📍 Página: <code className="bg-slate-100 px-1">{loc.pathname}</code></div>
              {msg && (
                <div className={`text-sm p-2 rounded ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                     data-testid="feedback-msg">
                  {msg.text}
                </div>
              )}
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
              <button onClick={enviar} disabled={sending || charsLeft > 0}
                      data-testid="btn-feedback-enviar"
                      className="ml-auto px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
                {sending ? 'Enviando...' : 'Enviar reporte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
