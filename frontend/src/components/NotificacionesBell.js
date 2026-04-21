// Campana de notificaciones internas para gestores.
// - Icono fijo con contador de no leídas.
// - Panel desplegable con las últimas notificaciones.
// - Polling cada 60s a /api/gestor/notificaciones.
// - Botón "marcar todas como leídas" + click individual marca y cierra.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const formatFecha = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'hace unos segundos';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

const tipoIcon = (tipo) => {
  switch (tipo) {
    case 'mencion_comentario': return '💬';
    case 'reclamacion_nueva':
    case 'reclamacion_asignada': return '🚩';
    case 'musico_creado': return '👤';
    default: return '🔔';
  }
};

const NotificacionesBell = () => {
  const { api, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const r = await api.get('/api/gestor/notificaciones');
      setItems(r.data?.notificaciones || []);
      setNoLeidas(r.data?.no_leidas || 0);
    } catch (err) {
      // silencio: puede ser 401 durante logout
    } finally { setLoading(false); }
  }, [api, isAuthenticated]);

  // Polling
  useEffect(() => {
    if (!isAuthenticated) return;
    cargar();
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, [cargar, isAuthenticated]);

  // Click fuera cierra el panel
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const marcarLeida = async (id) => {
    try {
      await api.put(`/api/gestor/notificaciones/${id}/leer`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
      setNoLeidas((prev) => Math.max(0, prev - 1));
    } catch { /* noop */ }
  };

  const marcarTodas = async () => {
    try {
      await api.post('/api/gestor/notificaciones/leer-todas');
      setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
      setNoLeidas(0);
    } catch { /* noop */ }
  };

  if (!isAuthenticated) return null;

  return (
    <div ref={containerRef} className="fixed top-4 right-4 z-40" data-testid="notificaciones-bell-container">
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="btn-notificaciones"
        aria-label="Notificaciones"
        className="relative w-11 h-11 bg-white hover:bg-slate-50 border border-slate-200 rounded-full shadow-sm flex items-center justify-center transition-colors"
      >
        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {noLeidas > 0 && (
          <span
            data-testid="badge-notificaciones"
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notificaciones-panel"
          className="absolute top-full right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Notificaciones</h3>
              <p className="text-[11px] text-slate-500">
                {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
              </p>
            </div>
            {noLeidas > 0 && (
              <button
                onClick={marcarTodas}
                data-testid="btn-marcar-todas"
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto" data-testid="notificaciones-list">
            {loading && items.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">🔕</div>
                <p className="text-sm text-slate-500">No hay notificaciones todavía.</p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.leida && marcarLeida(n.id)}
                  data-testid={`notif-${n.id}`}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex gap-3 ${
                    !n.leida ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-base">
                    {tipoIcon(n.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm truncate ${!n.leida ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                        {n.titulo || n.tipo}
                      </p>
                      {!n.leida && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5"></span>}
                    </div>
                    {n.descripcion && (
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.descripcion}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">{formatFecha(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificacionesBell;
