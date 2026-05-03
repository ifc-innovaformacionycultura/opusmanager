// Dashboard — extraído de App.js (iter 29).
// Reorganización visual en 4 bloques coloreados con encabezado cada uno.
// NO se toca lógica ni endpoints — solo CSS/layout.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth as useGestorAuth } from "../contexts/AuthContext";
import ActividadPendiente from "../components/ActividadPendiente";

// Iter F1 — Helper de permisos (copia exacta de la lógica usada en otras páginas).
const isSuperAdminUser = (user) => {
  if (!user) return false;
  const rol = user.rol || user.profile?.rol;
  if (rol === 'admin' || rol === 'director_general') return true;
  const email = (user.email || user.profile?.email || '').toLowerCase();
  return email === 'admin@convocatorias.com';
};

const DashboardPage = () => {
  const [stats, setStats] = useState({ events: 0, contacts: 0, seasons: 0 });
  const [recentEvents, setRecentEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendientes, setPendientes] = useState(null);
  // Iter E3 · Estado de cierres del ciclo de vida de eventos.
  const [cierres, setCierres] = useState(null);
  const [cierresErr, setCierresErr] = useState(false);
  // Iter 30 · Colapsar/expandir bloques con persistencia en localStorage
  // Iter E3 · 'bloque-cierres' añadido con default seguro FALSE (expandido).
  const [collapsed, setCollapsed] = useState(() => {
    const defaults = {
      'bloque-1': false, 'bloque-2': false, 'bloque-3': false,
      'bloque-cierres': false, 'bloque-4': false,
    };
    try {
      const raw = localStorage.getItem('dashboard_bloques_collapsed');
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch { /* noop */ }
    return defaults;
  });
  useEffect(() => {
    try { localStorage.setItem('dashboard_bloques_collapsed', JSON.stringify(collapsed)); } catch { /* noop */ }
  }, [collapsed]);
  const toggle = (key) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const { api, user } = useGestorAuth();
  const isSuperAdmin = isSuperAdminUser(user);
  const navigate = useNavigate();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current && !isLoading) {
      loadedRef.current = true;
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/gestor/pendientes');
        setPendientes(r.data);
        // Marcar acceso actual (después de cargar contadores)
        await api.post('/api/gestor/marcar-acceso');
      } catch (e) { /* noop */ }
    })();
  }, [api]);

  // Iter E3 · Cargar estado de cierres reusando GET /gestion-economica.
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/gestor/gestion-economica');
        const evs = r.data?.eventos || [];
        const hoyMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
        const diasDesde = (iso) => {
          if (!iso) return null;
          const t = new Date(iso).getTime();
          if (Number.isNaN(t)) return null;
          return Math.floor((hoyMs - t) / 86400000);
        };
        const abierto = [];
        const plantilla = [];
        const economico = [];
        for (const ev of evs) {
          const ec = ev.estado_cierre || 'abierto';
          if (ec === 'abierto') {
            const d = diasDesde(ev.fecha_inicio);
            if (d !== null && d >= 0) {
              abierto.push({ id: ev.id, nombre: ev.nombre, dias: d, alerta: d > 3 });
            }
          } else if (ec === 'cerrado_plantilla') {
            const d = diasDesde(ev.cerrado_plantilla_at) ?? diasDesde(ev.fecha_inicio);
            plantilla.push({
              id: ev.id, nombre: ev.nombre, dias: d ?? 0, alerta: (d ?? 0) > 7,
            });
          } else if (ec === 'cerrado_economico') {
            economico.push({
              id: ev.id, nombre: ev.nombre,
              cerrado_economico_at: ev.cerrado_economico_at,
              fecha_inicio: ev.fecha_inicio,
            });
          }
        }
        // Orden DESC por días (más antiguos / urgentes primero).
        abierto.sort((a, b) => b.dias - a.dias);
        plantilla.sort((a, b) => b.dias - a.dias);
        // Económico cerrado: más recientes primero.
        economico.sort((a, b) => String(b.cerrado_economico_at || '').localeCompare(String(a.cerrado_economico_at || '')));
        setCierres({ abierto, plantilla, economico });
        setCierresErr(false);
      } catch (e) {
        setCierresErr(true);
      }
    })();
  }, [api]);

  const loadData = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      console.log('📊 Cargando datos del dashboard...');

      // Cargar eventos desde Supabase usando axios con token
      const eventsResponse = await api.get('/api/gestor/eventos');

      let eventsData = [];
      if (eventsResponse.data?.eventos) {
        eventsData = eventsResponse.data.eventos;
        console.log(`✅ ${eventsData.length} eventos cargados`);
      }

      // Ordenar por fecha_inicio ascendente, próximos 5
      const upcoming = [...eventsData]
        .filter(e => e && e.fecha_inicio)
        .sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)))
        .slice(0, 5);

      setStats({
        events: eventsData.length,
        contacts: 0, // TODO: Implementar endpoint de contactos
        seasons: 0   // TODO: Implementar endpoint de temporadas
      });
      setRecentEvents(upcoming);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setStats({ events: 0, contacts: 0, seasons: 0 });
      setRecentEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6" data-testid="dashboard-page">
      <header className="mb-6">
        <h1 className="font-cabinet text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="font-ibm text-slate-600 mt-1">Visión general de la temporada actual</p>
      </header>

      {/* ═══════════ BLOQUE 1 — Resumen de actividad ═══════════ */}
      <section className="bg-blue-50 rounded-xl p-4 mb-4" data-testid="bloque-resumen-actividad">
        <button
          type="button"
          onClick={() => toggle('bloque-1')}
          data-testid="toggle-bloque-1"
          className="w-full flex items-center justify-between text-left mb-3 hover:opacity-80 transition"
          aria-expanded={!collapsed['bloque-1']}
        >
          <div>
            <h2 className="text-base font-bold text-gray-800">Resumen de actividad</h2>
            <p className="text-xs text-gray-500">Estado general de la temporada en curso</p>
          </div>
          <span className={`text-gray-500 text-sm transform transition-transform ${collapsed['bloque-1'] ? '' : 'rotate-90'}`}>▶</span>
        </button>

        {!collapsed['bloque-1'] && (<>

        {/* Pendientes de atención (tiles) */}
        {pendientes && (pendientes.reclamaciones_pendientes + pendientes.perfiles_actualizados + pendientes.respuestas_nuevas + pendientes.tareas_proximas + (isSuperAdmin ? (pendientes.importes_pendientes_validacion || 0) : 0)) > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4" data-testid="pendientes-section">
            <button onClick={() => navigate('/admin/reclamaciones')}
              data-testid="tile-reclamaciones"
              className="p-4 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg text-left transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🔴</span>
                <span className="text-3xl font-bold text-red-900">{pendientes.reclamaciones_pendientes}</span>
              </div>
              <p className="text-xs font-medium text-red-800 mt-2 uppercase">Reclamaciones sin atender</p>
            </button>
            <button onClick={() => navigate('/admin/musicos')}
              data-testid="tile-perfiles"
              className="p-4 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg text-left transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🟡</span>
                <span className="text-3xl font-bold text-amber-900">{pendientes.perfiles_actualizados}</span>
              </div>
              <p className="text-xs font-medium text-amber-800 mt-2 uppercase">Perfiles actualizados 24h</p>
            </button>
            <button onClick={() => navigate('/seguimiento')}
              data-testid="tile-respuestas"
              className="p-4 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-lg text-left transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🟠</span>
                <span className="text-3xl font-bold text-orange-900">{pendientes.respuestas_nuevas}</span>
              </div>
              <p className="text-xs font-medium text-orange-800 mt-2 uppercase">Respuestas nuevas</p>
            </button>
            <div className="p-4 bg-blue-100 border border-blue-200 rounded-lg text-left" data-testid="tile-tareas">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🔵</span>
                <span className="text-3xl font-bold text-blue-900">{pendientes.tareas_proximas}</span>
              </div>
              <p className="text-xs font-medium text-blue-800 mt-2 uppercase">Tareas en 24h</p>
            </div>
            {isSuperAdmin && (pendientes.importes_pendientes_validacion || 0) > 0 && (
              <button onClick={() => navigate('/plantillas-definitivas')}
                data-testid="tile-importes-pendientes"
                className="p-4 bg-orange-50 border border-orange-300 hover:bg-orange-100 rounded-lg text-left transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">⏳</span>
                  <span className="text-3xl font-bold text-orange-900">{pendientes.importes_pendientes_validacion}</span>
                </div>
                <p className="text-xs font-medium text-orange-800 mt-2 uppercase">Importes pendientes validar</p>
              </button>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200" data-testid="stat-events">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Eventos</p>
                <p className="text-3xl font-bold text-slate-900 font-mono">{stats.events}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200" data-testid="stat-contacts">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Contactos</p>
                <p className="text-3xl font-bold text-slate-900 font-mono">{stats.contacts}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200" data-testid="stat-seasons">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Temporadas</p>
                <p className="text-3xl font-bold text-slate-900 font-mono">{stats.seasons}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
        </>)}
      </section>

      {/* ═══════════ BLOQUE 2 — Pendientes de tu atención ═══════════ */}
      <section className="bg-amber-50 rounded-xl p-4 mb-4" data-testid="bloque-pendientes-atencion">
        <button
          type="button"
          onClick={() => toggle('bloque-2')}
          data-testid="toggle-bloque-2"
          className="w-full flex items-center justify-between text-left mb-3 hover:opacity-80 transition"
          aria-expanded={!collapsed['bloque-2']}
        >
          <div>
            <h2 className="text-base font-bold text-gray-800">Pendientes de tu atención</h2>
            <p className="text-xs text-gray-500">Elementos que requieren acción por tu parte hoy</p>
          </div>
          <span className={`text-gray-500 text-sm transform transition-transform ${collapsed['bloque-2'] ? '' : 'rotate-90'}`}>▶</span>
        </button>
        {!collapsed['bloque-2'] && <ActividadPendiente />}
      </section>

      {/* ═══════════ BLOQUE 3 — Próximos 15 días ═══════════ */}
      <section className="bg-green-50 rounded-xl p-4 mb-4" data-testid="bloque-proximos-15-dias">
        <button
          type="button"
          onClick={() => toggle('bloque-3')}
          data-testid="toggle-bloque-3"
          className="w-full flex items-center justify-between text-left mb-3 hover:opacity-80 transition"
          aria-expanded={!collapsed['bloque-3']}
        >
          <div>
            <h2 className="text-base font-bold text-gray-800">Próximos 15 días</h2>
            <p className="text-xs text-gray-500">Ensayos, funciones y desplazamientos programados</p>
          </div>
          <span className={`text-gray-500 text-sm transform transition-transform ${collapsed['bloque-3'] ? '' : 'rotate-90'}`}>▶</span>
        </button>

        {!collapsed['bloque-3'] && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-cabinet text-lg font-semibold text-slate-900">Próximos eventos</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {!recentEvents || recentEvents.length === 0 ? (
              <p className="p-4 text-slate-500 text-sm">No hay eventos programados</p>
            ) : (
              (recentEvents || []).map(event => {
                const fecha = event.fecha_inicio
                  ? new Date(event.fecha_inicio).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })
                  : 'Sin fecha';
                const estadoColors = {
                  borrador:   'bg-slate-200 text-slate-700',
                  abierto:    'bg-blue-100 text-blue-800',
                  cerrado:    'bg-amber-100 text-amber-800',
                  en_curso:   'bg-green-100 text-green-800',
                  cancelado:  'bg-red-100 text-red-800',
                  finalizado: 'bg-purple-100 text-purple-800'
                };
                const estadoClass = estadoColors[event.estado] || 'bg-slate-100 text-slate-700';
                return (
                  <div key={event.id} className="p-4 hover:bg-slate-50 transition-colors" data-testid={`event-${event.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-slate-900 truncate" data-testid={`event-nombre-${event.id}`}>
                          {event.nombre || 'Sin nombre'}
                        </h4>
                        <p className="text-sm text-slate-500" data-testid={`event-fecha-${event.id}`}>
                          {fecha}
                          {event.lugar ? ` · ${event.lugar}` : ''}
                          {event.temporada ? ` · ${event.temporada}` : ''}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${estadoClass}`}
                        data-testid={`event-estado-${event.id}`}
                      >
                        {event.estado || 'abierto'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        )}
      </section>

      {/* ═══════════ BLOQUE E3 — Estado de cierres ═══════════ */}
      {(() => {
        const totalAlertas =
          (cierres?.abierto?.filter(x => x.alerta).length || 0) +
          (cierres?.plantilla?.filter(x => x.alerta).length || 0);
        const cAbierto = cierres?.abierto?.length || 0;
        const cPlantilla = cierres?.plantilla?.length || 0;
        const cEconomico = cierres?.economico?.length || 0;
        return (
          <section className="bg-emerald-50 rounded-xl p-4 mb-4" data-testid="bloque-estado-cierres">
            <button
              type="button"
              onClick={() => toggle('bloque-cierres')}
              data-testid="toggle-bloque-cierres"
              className="w-full flex items-center justify-between text-left mb-3 hover:opacity-80 transition"
              aria-expanded={!collapsed['bloque-cierres']}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-800">Estado de cierres</h2>
                  {cierres && (
                    <span className="text-xs text-slate-600 font-mono" data-testid="cierres-counters">
                      🟠 {cAbierto} · 🟡 {cPlantilla} · ✅ {cEconomico}
                    </span>
                  )}
                  {totalAlertas > 0 && (
                    <span
                      data-testid="cierres-alerta-badge"
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200"
                    >
                      ⚠️ {totalAlertas} alerta{totalAlertas !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Ciclo de vida de los eventos: abierto → concluido → económico cerrado</p>
              </div>
              <span className={`text-gray-500 text-sm transform transition-transform ${collapsed['bloque-cierres'] ? '' : 'rotate-90'}`}>▶</span>
            </button>

            {!collapsed['bloque-cierres'] && (
              <>
                {cierresErr && (
                  <div data-testid="cierres-error" className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-500 text-center">
                    No se pudo cargar el estado de cierres.
                  </div>
                )}
                {!cierresErr && !cierres && (
                  <div data-testid="cierres-loading" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse h-44" />
                    ))}
                  </div>
                )}
                {!cierresErr && cierres && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Col 1 — Abiertos pendientes de concluir */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden" data-testid="col-abiertos">
                      <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-900 uppercase">🟠 Pendientes de concluir</span>
                        <span className="text-base font-mono font-bold text-amber-900" data-testid="col-abiertos-count">{cAbierto}</span>
                      </div>
                      <div className="p-3 space-y-2 min-h-[110px]">
                        {cAbierto === 0 && (
                          <p className="text-xs text-slate-400 text-center py-6" data-testid="col-abiertos-empty">
                            Ningún evento en esta fase.
                          </p>
                        )}
                        {cierres.abierto.slice(0, 10).map(it => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => navigate('/plantillas-definitivas')}
                            data-testid={`cierre-abierto-${it.id}`}
                            className={`w-full text-left p-2 rounded-md border transition hover:bg-slate-50 ${
                              it.alerta
                                ? 'bg-red-50 border-red-300 hover:bg-red-100'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-slate-900 truncate">{it.nombre}</span>
                              {it.alerta && <span className="text-base leading-none" aria-label="alerta">🚨</span>}
                            </div>
                            <p className={`text-[11px] mt-0.5 ${it.alerta ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                              Hace {it.dias} día{it.dias !== 1 ? 's' : ''}
                              {it.alerta && ' · Pendiente de concluir'}
                            </p>
                          </button>
                        ))}
                        {cAbierto > 10 && (
                          <button
                            onClick={() => navigate('/plantillas-definitivas')}
                            className="w-full text-xs text-amber-700 hover:text-amber-900 underline pt-1"
                          >
                            …y {cAbierto - 10} más →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Col 2 — Concluidos pendientes de cerrar económico */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden" data-testid="col-plantilla">
                      <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-900 uppercase">🟡 Pendientes de cerrar económico</span>
                        <span className="text-base font-mono font-bold text-amber-900" data-testid="col-plantilla-count">{cPlantilla}</span>
                      </div>
                      <div className="p-3 space-y-2 min-h-[110px]">
                        {cPlantilla === 0 && (
                          <p className="text-xs text-slate-400 text-center py-6" data-testid="col-plantilla-empty">
                            Ningún evento en esta fase.
                          </p>
                        )}
                        {cierres.plantilla.slice(0, 10).map(it => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => navigate('/asistencia/pagos')}
                            data-testid={`cierre-plantilla-${it.id}`}
                            className={`w-full text-left p-2 rounded-md border transition hover:bg-slate-50 ${
                              it.alerta
                                ? 'bg-red-50 border-red-300 hover:bg-red-100'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-slate-900 truncate">{it.nombre}</span>
                              {it.alerta && <span className="text-base leading-none" aria-label="alerta">🚨</span>}
                            </div>
                            <p className={`text-[11px] mt-0.5 ${it.alerta ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                              Concluido hace {it.dias} día{it.dias !== 1 ? 's' : ''}
                              {it.alerta && ' · Cerrar económico'}
                            </p>
                          </button>
                        ))}
                        {cPlantilla > 10 && (
                          <button
                            onClick={() => navigate('/asistencia/pagos')}
                            className="w-full text-xs text-amber-800 hover:text-amber-900 underline pt-1"
                          >
                            …y {cPlantilla - 10} más →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Col 3 — Económico cerrado (completados) */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden" data-testid="col-economico">
                      <div className="px-3 py-2 bg-emerald-100 border-b border-emerald-200 flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-900 uppercase">✅ Económico cerrado</span>
                        <span className="text-base font-mono font-bold text-emerald-900" data-testid="col-economico-count">{cEconomico}</span>
                      </div>
                      <div className="p-3 space-y-2 min-h-[110px]">
                        {cEconomico === 0 && (
                          <p className="text-xs text-slate-400 text-center py-6" data-testid="col-economico-empty">
                            Ningún evento completado todavía.
                          </p>
                        )}
                        {cierres.economico.slice(0, 5).map(it => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => navigate('/asistencia/pagos')}
                            data-testid={`cierre-economico-${it.id}`}
                            className="w-full text-left p-2 rounded-md border bg-white border-emerald-100 hover:bg-emerald-50 transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-slate-900 truncate">{it.nombre}</span>
                              <span className="text-emerald-600 text-base leading-none" aria-hidden>✓</span>
                            </div>
                            {it.cerrado_economico_at && (
                              <p className="text-[11px] mt-0.5 text-slate-500">
                                Cerrado el {new Date(it.cerrado_economico_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </button>
                        ))}
                        {cEconomico > 5 && (
                          <button
                            onClick={() => navigate('/asistencia/pagos')}
                            className="w-full text-xs text-emerald-700 hover:text-emerald-900 underline pt-1"
                          >
                            …y {cEconomico - 5} más →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })()}

      {/* ═══════════ BLOQUE 4 — Estado del sistema ═══════════ */}
      <section className="bg-gray-50 rounded-xl p-4 mb-4" data-testid="bloque-estado-sistema">
        <button
          type="button"
          onClick={() => toggle('bloque-4')}
          data-testid="toggle-bloque-4"
          className="w-full flex items-center justify-between text-left mb-3 hover:opacity-80 transition"
          aria-expanded={!collapsed['bloque-4']}
        >
          <div>
            <h2 className="text-base font-bold text-gray-800">Estado del sistema</h2>
            <p className="text-xs text-gray-500">Monitorización de notificaciones y comunicaciones</p>
          </div>
          <span className={`text-gray-500 text-sm transform transition-transform ${collapsed['bloque-4'] ? '' : 'rotate-90'}`}>▶</span>
        </button>

        {!collapsed['bloque-4'] && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-600 flex items-start gap-3">
          <span className="text-2xl">🔔</span>
          <div className="flex-1">
            <p className="mb-1">
              Los indicadores de <strong>recordatorios push enviados hoy</strong> y <strong>errores de envío recientes</strong>
              {' '}aparecen en el <em>Bloque 2 — Pendientes de tu atención</em>, dentro de la fila de KPIs.
            </p>
            <button
              onClick={() => navigate('/admin/recordatorios')}
              data-testid="btn-ir-recordatorios"
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
            >
              Ver monitorización completa →
            </button>
          </div>
        </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
