// Widget flotante de feedback/incidencias.
// Envía a POST /api/gestor/incidencias (tabla `incidencias`).
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const FeedbackButton = () => {
  const auth = useAuth();
  const api = auth?.api;
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState('incidencia');
  const [descripcion, setDescripcion] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  // Solo se muestra si hay un api disponible (= usuario gestor autenticado con AuthContext)
  if (!api) return null;

  const enviar = async () => {
    if (!descripcion.trim()) { setMsg({ type: 'error', text: 'Descripción obligatoria' }); return; }
    try {
      setSending(true); setMsg(null);
      await api.post('/api/gestor/incidencias', {
        tipo,
        descripcion: descripcion.trim(),
        pagina: loc.pathname,
      });
      setMsg({ type: 'success', text: '✅ Gracias por tu feedback. Lo revisaremos pronto.' });
      setDescripcion('');
      setTimeout(() => { setOpen(false); setMsg(null); }, 2000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally { setSending(false); }
  };

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
                <label className="text-xs text-slate-600 mb-1 block">Descripción *</label>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={5}
                          data-testid="feedback-descripcion"
                          placeholder="Describe lo que ocurre, qué esperabas, y cualquier detalle útil..."
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
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
              <button onClick={enviar} disabled={sending}
                      data-testid="btn-feedback-enviar"
                      className="ml-auto px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
