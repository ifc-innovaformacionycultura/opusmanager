// TAREA 5A — Keep-alive ping silencioso a /api/health cada 14 min
// para evitar el cold start de Railway. Solo activo cuando hay user logueado.

import { useEffect } from 'react';

const PING_MS = 14 * 60 * 1000; // 14 minutos
const URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api/health`;

const pingSilencioso = () => {
  // Fire & forget. AbortController para no acumular requests si el ping falla.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  fetch(URL, { signal: ctrl.signal, cache: 'no-store' })
    .catch(() => {})
    .finally(() => clearTimeout(t));
};

export default function KeepAlive({ active = false }) {
  useEffect(() => {
    if (!active) return undefined;
    // Ping inicial diferido (5s tras login) y luego cada 14 minutos
    const tInit = setTimeout(pingSilencioso, 5000);
    const id = setInterval(pingSilencioso, PING_MS);
    return () => { clearTimeout(tInit); clearInterval(id); };
  }, [active]);
  return null;
}
