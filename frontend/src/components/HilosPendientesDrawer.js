// HilosPendientesDrawer.js — Bloque 4
// Drawer lateral derecho que muestra los comentarios_equipo donde el usuario actual
// está en menciones, estado != resuelto, en la página actual.
// Uso: <HilosPendientesDrawer pagina="/configuracion/eventos" />
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function HilosPendientesDrawer({ pagina }) {
  const { api, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hilos, setHilos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Resolver usuario_id en tabla `usuarios` para mencionado_id
  const userId = user?.profile?.id || user?.id;

  const cargar = useCallback(async () => {
    if (!userId || !pagina) return;
    setCargando(true);
    try {
      const r = await api.get('/api/gestor/comentarios-equipo', {
        params: {
          mencionado_id: userId,
          pagina,
          incluye_resueltos: false,
          limit: 100,
        },
      });
      const arr = (r.data?.comentarios || []).filter(c => c.estado !== 'resuelto');
      setHilos(arr);
    } catch {/* noop */ }
    finally { setCargando(false); }
  }, [api, pagina, userId]);

  useEffect(() => {
    cargar();
    const i = setInterval(cargar, 60000); // refresh cada 60s
    return () => clearInterval(i);
  }, [cargar]);

  const resolver = async (id) => {
    try {
      await api.put(`/api/gestor/comentarios-equipo/${id}/estado`, { estado: 'resuelto' });
      setHilos(prev => prev.filter(h => h.id !== id));
    } catch (e) {
      alert('No se pudo resolver: ' + (e.response?.data?.detail || e.message));
    }
  };

  if (!userId) return null;

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        data-testid="hilos-drawer-toggle"
        className={`fixed right-4 bottom-20 z-40 px-3 py-2 rounded-full shadow-lg flex items-center gap-2 font-semibold text-sm transition ${hilos.length ? 'bg-[#C9920A] text-white hover:bg-[#a87908]' : 'bg-slate-700 text-white hover:bg-slate-800'}`}
        title="Hilos pendientes donde te han mencionado"
      >
        <span>💬</span>
        <span>Hilos pendientes</span>
        {hilos.length > 0 && (
          <span className="bg-white text-[#C9920A] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
            {hilos.length}
          </span>
        )}
      </button>

      {/* Drawer lateral */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />
          <aside className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col"
                 data-testid="hilos-drawer">
            <header className="bg-gradient-to-r from-[#1A3A5C] to-[#234265] text-white px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold flex items-center gap-2">💬 Hilos pendientes</h3>
                <p className="text-xs text-slate-200">Menciones en esta página · {hilos.length} sin resolver</p>
              </div>
              <button onClick={() => setOpen(false)}
                      data-testid="hilos-drawer-close"
                      className="text-2xl text-slate-200 hover:text-white leading-none">×</button>
            </header>
            <div className="flex-1 overflow-y-auto p-3 bg-slate-50">
              {cargando ? (
                <div className="text-center py-12 text-sm text-slate-500">
                  <span className="animate-spin inline-block h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full mr-2 align-middle" />
                  Cargando…
                </div>
              ) : hilos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-2">✨</div>
                  <p className="text-sm font-medium text-slate-700">Sin menciones pendientes</p>
                  <p className="text-xs text-slate-500 mt-1">Las menciones a tu nombre en esta página aparecerán aquí.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {hilos.map(h => (
                    <article key={h.id} className="bg-white border border-slate-200 rounded-lg p-3" data-testid={`hilo-${h.id}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">
                          {h.entidad_tipo}{h.entidad_nombre ? ' · ' + h.entidad_nombre : ''}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${h.estado === 'pendiente' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {h.estado || 'pendiente'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-800 line-clamp-3">{h.contenido || h.mensaje || '—'}</div>
                      <div className="text-[11px] text-slate-500 mt-1.5 flex justify-between items-center">
                        <span>👤 {h.autor_nombre || '—'}</span>
                        <span>{(h.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <button onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('open-hilo', { detail: { id: h.id } })); }}
                                data-testid={`btn-responder-${h.id}`}
                                className="flex-1 text-xs px-2 py-1 bg-[#1A3A5C] hover:bg-[#163050] text-white rounded font-medium">
                          ↩ Responder
                        </button>
                        <button onClick={() => resolver(h.id)}
                                data-testid={`btn-resolver-${h.id}`}
                                className="flex-1 text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">
                          ✓ Resolver
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
