// Banner discreto para pedir permiso de notificaciones push.
// - Aparece sólo cuando Notification.permission === 'default'.
// - Permite "Activar", "Más tarde" (snooze 7 días en localStorage) o cerrar.
// - Acepta clientOrToken (axios o Bearer string) para suscribir.
import React, { useEffect, useState } from 'react';
import { isPushSupported, requestPushPermission } from '../lib/push';

const SNOOZE_KEY = 'push_prompt_snooze_until';

export default function PushPermissionPrompt({ clientOrToken }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (Notification.permission !== 'default') return;
    try {
      const until = parseInt(localStorage.getItem(SNOOZE_KEY) || '0', 10);
      if (until && Date.now() < until) return;
    } catch {}
    // Pequeño delay para no agobiar al usuario justo al cargar
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const activar = async () => {
    if (!clientOrToken) return;
    setBusy(true);
    try {
      const res = await requestPushPermission(clientOrToken);
      if (res === 'granted') {
        setFeedback('✅ Notificaciones activadas');
        setTimeout(() => setVisible(false), 1500);
      } else if (res === 'denied') {
        setFeedback('Permiso denegado. Puedes activarlo desde la configuración del navegador.');
      } else {
        setVisible(false);
      }
    } finally { setBusy(false); }
  };

  const snooze = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 24 * 3600 * 1000)); } catch {}
    setVisible(false);
  };

  return (
    <div
      data-testid="push-prompt"
      className="fixed bottom-4 right-4 z-50 max-w-sm bg-white rounded-xl border border-slate-200 shadow-lg p-4"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>🔔</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">Notificaciones en tiempo real</p>
          <p className="text-xs text-slate-600 mt-1">
            Recibe avisos al instante de nuevas convocatorias, tareas y comentarios — incluso con la app cerrada.
          </p>
          {feedback && <p className="text-xs text-slate-700 mt-2">{feedback}</p>}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={activar} disabled={busy}
              data-testid="push-prompt-activar"
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold disabled:opacity-60"
            >
              {busy ? 'Activando…' : 'Activar'}
            </button>
            <button
              onClick={snooze}
              data-testid="push-prompt-snooze"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium"
            >
              Más tarde
            </button>
          </div>
        </div>
        <button
          onClick={() => setVisible(false)} aria-label="Cerrar"
          data-testid="push-prompt-cerrar"
          className="text-slate-400 hover:text-slate-700 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
