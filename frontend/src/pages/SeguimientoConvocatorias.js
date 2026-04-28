// Seguimiento de Plantillas — Bloque D
//
// Tabla pivot Músicos × Eventos (estado='abierto' o 'borrador').
//
// - Columnas fijas izquierda: checkbox, Apellidos, Nombre, Instrumento,
//   Especialidad, Nivel estudios, Baremo, Localidad.
// - Por cada evento un BLOQUE con cabecera (nombre + badge + fechas) y
//   subcolumnas: una por ensayo con la disponibilidad del músico (verde/rojo/
//   gris), "% Disp.", "Publicado" (toggle) y "Acción" (select).
// - Acciones masivas visibles SOLO cuando hay al menos 1 músico seleccionado.
// - Filtros: buscador global, filtro por instrumento y por evento.
//
// Endpoints backend:
//   GET  /api/gestor/seguimiento
//   POST /api/gestor/seguimiento/publicar       {usuario_ids, evento_id, publicar}
//   POST /api/gestor/seguimiento/bulk-accion    {usuario_ids, evento_id, accion}
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth as useGestorAuth } from "../contexts/AuthContext";
import {
  CRMToggleButton, useCRMExpandidos, ContactosBadge, UltimoContactoCell,
  RegistrarContactoModal, HistorialPanel,
} from "../components/CRMSeguimiento";

// ============================================================
// Mapeo Instrumento → sección (para ordenar y filtrar)
// Mirror del helper backend /app/backend/instrumentos.py
// ============================================================
const SECCION_ORDER = {
  cuerda: 1, viento_madera: 2, viento_metal: 3, percusion: 4, teclados: 5, coro: 6, otros: 9,
};
const SECCION_DE_INSTRUMENTO = {
  'violin':'cuerda','violín':'cuerda','viola':'cuerda','cello':'cuerda','chelo':'cuerda',
  'violonchelo':'cuerda','violoncello':'cuerda','contrabajo':'cuerda',
  'flauta':'viento_madera','flautin':'viento_madera','flautín':'viento_madera','oboe':'viento_madera',
  'clarinete':'viento_madera','fagot':'viento_madera','saxofon':'viento_madera','saxofón':'viento_madera','saxo':'viento_madera',
  'trompa':'viento_metal','corno':'viento_metal','trompeta':'viento_metal','trombon':'viento_metal','trombón':'viento_metal','tuba':'viento_metal',
  'percusion':'percusion','percusión':'percusion','timbales':'percusion','bateria':'percusion','batería':'percusion',
  'piano':'teclados','organo':'teclados','órgano':'teclados','clave':'teclados','clavecin':'teclados','teclado':'teclados',
  'tenor':'coro','soprano':'coro','baritono':'coro','barítono':'coro','bajo':'coro','alto':'coro','contralto':'coro','mezzo':'coro','coro':'coro',
};
const seccionDe = (instr) => SECCION_DE_INSTRUMENTO[(instr || '').trim().toLowerCase()] || 'otros';
const seccionRank = (instr) => SECCION_ORDER[seccionDe(instr)] ?? 99;

const ESTADO_EVENTO_BADGE = {
  borrador: { label: '🟡 Borrador', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
  abierto:  { label: '🟢 Público',  className: 'bg-green-100 text-green-800 border border-green-300' },
};
const ACCIONES = [
  { key: 'pendiente',     label: 'En espera',     color: 'bg-slate-100 text-slate-700' },
  { key: 'confirmado',    label: 'Confirmado',    color: 'bg-green-100 text-green-800' },
  { key: 'no_disponible', label: 'No disponible', color: 'bg-amber-100 text-amber-800' },
  { key: 'excluido',      label: 'Excluido',      color: 'bg-red-100 text-red-800' },
];
const ACCION_BY_KEY = Object.fromEntries(ACCIONES.map(a => [a.key, a]));

const fmtFecha = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); }
  catch { return iso; }
};
const fmtHora = (h) => h ? String(h).slice(0, 5) : '';

// Celda con el estado de disponibilidad que ha indicado el músico para un ensayo
const DispCell = ({ asiste, convocado }) => {
  if (convocado === false) {
    return (
      <span
        title="Instrumento no convocado a este ensayo"
        className="inline-block px-1 py-0.5 text-[9px] rounded bg-slate-300 text-slate-600 font-medium">
        No conv.
      </span>
    );
  }
  if (asiste === true)  return <span title="Asiste" className="inline-block w-5 h-5 rounded-full bg-green-500" />;
  if (asiste === false) return <span title="No asiste" className="inline-block w-5 h-5 rounded-full bg-red-500" />;
  return <span title="Sin respuesta" className="inline-block w-5 h-5 rounded-full bg-slate-200" />;
};

const SeguimientoConvocatorias = () => {
  const { api } = useGestorAuth();
  const [data, setData] = useState({ eventos: [], musicos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selección y acciones masivas
  const [selected, setSelected] = useState(new Set());
  const [bulkEventos, setBulkEventos] = useState([]); // MULTI-SELECT
  const [bulkAccion, setBulkAccion] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Filtros múltiples acumulativos
  const [search, setSearch] = useState('');
  const [filterInstrumentos, setFilterInstrumentos] = useState([]); // multi-select
  const [filterEspecialidad, setFilterEspecialidad] = useState('');
  const [filterNivel, setFilterNivel] = useState('');
  const [filterLocalidad, setFilterLocalidad] = useState('');
  const [filterEvento, setFilterEvento] = useState(''); // columna (no filtra músicos)

  // CRM (Bloque 1) — bloques de evento expandidos persisten en localStorage
  const { expandidos: crmExpandidos, toggle: toggleCRM } = useCRMExpandidos();
  const [crmRegistrar, setCrmRegistrar] = useState(null); // {musicoId, eventoId, musicoNombre, eventoNombre}
  const [crmHistorial, setCrmHistorial] = useState(null); // {musicoId, eventoId, musicoNombre, eventoNombre}
  const [crmHistorialData, setCrmHistorialData] = useState({ loading: false, contactos: [] });

  // Columnas de datos personales visibles (persistido en localStorage)
  const COLUMN_DEFS = [
    { key: 'apellidos',     label: 'Apellidos',     defaultVisible: true },
    { key: 'nombre',        label: 'Nombre',        defaultVisible: true },
    { key: 'instrumento',   label: 'Instrumento',   defaultVisible: true },
    { key: 'especialidad',  label: 'Especialidad',  defaultVisible: false },
    { key: 'nivel_estudios',label: 'Nivel est.',    defaultVisible: false },
    { key: 'baremo',        label: 'Baremo',        defaultVisible: false },
    { key: 'localidad',     label: 'Localidad',     defaultVisible: false },
  ];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const raw = localStorage.getItem('seguimiento_visible_cols');
      if (raw) return JSON.parse(raw);
    } catch {}
    return Object.fromEntries(COLUMN_DEFS.map(c => [c.key, c.defaultVisible]));
  });
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('seguimiento_visible_cols', JSON.stringify(visibleCols)); } catch {}
  }, [visibleCols]);
  const toggleColumn = (key) => setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }));

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  const cargar = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      setError(null);
      const r = await api.get('/api/gestor/seguimiento');
      setData(r.data || { eventos: [], musicos: [] });
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { if (!silencioso) setLoading(false); }
  }, [api]);

  useEffect(() => { cargar(); }, [cargar]);

  // Listas únicas para cada filtro
  const instrumentosList = useMemo(() => {
    const s = new Set();
    data.musicos.forEach(m => m.instrumento && s.add(m.instrumento));
    return Array.from(s).sort();
  }, [data.musicos]);
  const especialidadesList = useMemo(() => {
    const s = new Set();
    data.musicos.forEach(m => m.especialidad && s.add(m.especialidad));
    return Array.from(s).sort();
  }, [data.musicos]);
  const nivelesList = useMemo(() => {
    const s = new Set();
    data.musicos.forEach(m => m.nivel_estudios && s.add(m.nivel_estudios));
    return Array.from(s).sort();
  }, [data.musicos]);
  const localidadesList = useMemo(() => {
    const s = new Set();
    data.musicos.forEach(m => m.localidad && s.add(m.localidad));
    return Array.from(s).sort();
  }, [data.musicos]);

  const filtrosActivos = (
    search.trim().length > 0 ||
    filterInstrumentos.length > 0 ||
    filterEspecialidad ||
    filterNivel ||
    filterLocalidad ||
    filterEvento
  );

  // Músicos ordenados por (sección → apellidos) y filtrados con TODOS los filtros acumulados
  const musicosVisibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = data.musicos.slice();
    if (q) {
      out = out.filter(m => (
        (m.apellidos || '').toLowerCase().includes(q) ||
        (m.nombre || '').toLowerCase().includes(q)
      ));
    }
    if (filterInstrumentos.length > 0) {
      const set = new Set(filterInstrumentos);
      out = out.filter(m => set.has(m.instrumento));
    }
    if (filterEspecialidad) out = out.filter(m => m.especialidad === filterEspecialidad);
    if (filterNivel)        out = out.filter(m => m.nivel_estudios === filterNivel);
    if (filterLocalidad)    out = out.filter(m => m.localidad === filterLocalidad);
    out.sort((a, b) => {
      const ra = seccionRank(a.instrumento), rb = seccionRank(b.instrumento);
      if (ra !== rb) return ra - rb;
      return (a.apellidos || '').localeCompare(b.apellidos || '', 'es');
    });
    return out;
  }, [data.musicos, search, filterInstrumentos, filterEspecialidad, filterNivel, filterLocalidad]);

  const limpiarFiltros = () => {
    setSearch(''); setFilterInstrumentos([]); setFilterEspecialidad('');
    setFilterNivel(''); setFilterLocalidad(''); setFilterEvento('');
  };

  const eventosVisibles = useMemo(() => {
    if (!filterEvento) return data.eventos;
    return data.eventos.filter(e => e.id === filterEvento);
  }, [data.eventos, filterEvento]);

  // === Actualización optimista del toggle Publicar ===
  const togglePublicar = async (musicoId, eventoId, next) => {
    // Optimista
    setData(prev => ({
      ...prev,
      musicos: prev.musicos.map(m => {
        if (m.id !== musicoId) return m;
        const asigs = Array.isArray(m.asignaciones) ? m.asignaciones : [];
        const idx = asigs.findIndex(a => a.evento_id === eventoId);
        const base = idx >= 0
          ? asigs[idx]
          : { evento_id: eventoId, estado: null, disponibilidad: [], porcentaje_disponibilidad: 0 };
        const nextAsig = {
          ...base,
          publicado_musico: next,
          estado: base.estado || (next ? 'pendiente' : null),
        };
        const nextList = idx >= 0
          ? asigs.map((a, i) => (i === idx ? nextAsig : a))
          : [...asigs, nextAsig];
        return { ...m, asignaciones: nextList };
      })
    }));
    try {
      await api.post('/api/gestor/seguimiento/publicar', {
        usuario_ids: [musicoId], evento_id: eventoId, publicar: next,
      });
    } catch (err) {
      // Rollback
      await cargar();
      showFeedback('error', err.response?.data?.detail || err.message);
    }
  };

  // === Cambio directo de acción en el select por-celda ===
  const cambiarAccion = async (musicoId, eventoId, accion) => {
    if (!accion) return;
    // Optimista
    setData(prev => ({
      ...prev,
      musicos: prev.musicos.map(m => {
        if (m.id !== musicoId) return m;
        const asigs = Array.isArray(m.asignaciones) ? m.asignaciones : [];
        const idx = asigs.findIndex(a => a.evento_id === eventoId);
        const base = idx >= 0
          ? asigs[idx]
          : { evento_id: eventoId, publicado_musico: false, disponibilidad: [], porcentaje_disponibilidad: 0 };
        const nextAsig = { ...base, estado: accion };
        const nextList = idx >= 0
          ? asigs.map((a, i) => (i === idx ? nextAsig : a))
          : [...asigs, nextAsig];
        return { ...m, asignaciones: nextList };
      })
    }));
    try {
      await api.post('/api/gestor/seguimiento/bulk-accion', {
        usuario_ids: [musicoId], evento_id: eventoId, accion,
      });
    } catch (err) {
      await cargar();
      showFeedback('error', err.response?.data?.detail || err.message);
    }
  };

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleSelectAll = () => {
    if (musicosVisibles.every(m => selected.has(m.id)) && musicosVisibles.length > 0) setSelected(new Set());
    else setSelected(new Set(musicosVisibles.map(m => m.id)));
  };

  // === Aplicar acción masiva (ahora sobre MULTI-EVENTOS) ===
  const aplicarBulk = async () => {
    if (bulkEventos.length === 0 || !bulkAccion || selected.size === 0) {
      showFeedback('error', 'Selecciona músicos, al menos un evento y una acción');
      return;
    }
    try {
      setBusy(true);
      let totalAct = 0, totalCre = 0, totalPub = 0, totalDespub = 0;
      for (const evId of bulkEventos) {
        if (bulkAccion === 'publicar_on' || bulkAccion === 'publicar_off') {
          const publicar = bulkAccion === 'publicar_on';
          const r = await api.post('/api/gestor/seguimiento/publicar', {
            usuario_ids: Array.from(selected), evento_id: evId, publicar,
          });
          totalPub += (r.data.publicados || 0);
          totalCre += (r.data.creados || 0);
          totalDespub += (r.data.despublicados || 0);
        } else {
          const r = await api.post('/api/gestor/seguimiento/bulk-accion', {
            usuario_ids: Array.from(selected), evento_id: evId, accion: bulkAccion,
          });
          totalAct += (r.data.actualizados || 0);
          totalCre += (r.data.creados || 0);
        }
      }
      const msg = (bulkAccion === 'publicar_on' || bulkAccion === 'publicar_off')
        ? `Publicados:${totalPub} · Creados:${totalCre} · Despublicados:${totalDespub} (en ${bulkEventos.length} eventos)`
        : `Actualizados:${totalAct} · Creados:${totalCre} (en ${bulkEventos.length} eventos)`;
      showFeedback('success', msg);
      await cargar();
      setSelected(new Set());
      setBulkAccion('');
      setBulkEventos([]);
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    } finally { setBusy(false); }
  };

  // === CRM Contactos (Bloque 1) ===
  const cargarHistorial = useCallback(async (musicoId, eventoId) => {
    setCrmHistorialData({ loading: true, contactos: [] });
    try {
      const r = await api.get(`/api/gestor/contactos/${musicoId}/${eventoId}`);
      setCrmHistorialData({ loading: false, contactos: r.data?.contactos || [] });
    } catch (err) {
      setCrmHistorialData({ loading: false, contactos: [] });
      showFeedback('error', err.response?.data?.detail || err.message);
    }
  }, [api]);

  const abrirHistorial = (musico, evento) => {
    const ctx = {
      musicoId: musico.id, eventoId: evento.id,
      musicoNombre: `${musico.apellidos || ''}, ${musico.nombre || ''}`.trim().replace(/^,\s*/, ''),
      eventoNombre: evento.nombre,
    };
    setCrmHistorial(ctx);
    cargarHistorial(musico.id, evento.id);
  };

  const abrirRegistrar = (musico, evento) => {
    setCrmRegistrar({
      musicoId: musico.id, eventoId: evento.id,
      musicoNombre: `${musico.apellidos || ''}, ${musico.nombre || ''}`.trim().replace(/^,\s*/, ''),
      eventoNombre: evento.nombre,
    });
  };

  const guardarContacto = async (payload) => {
    if (!crmRegistrar) return;
    const body = {
      usuario_id: crmRegistrar.musicoId,
      evento_id: crmRegistrar.eventoId,
      ...payload,
    };
    await api.post('/api/gestor/contactos', body);
    showFeedback('success', 'Contacto registrado');
    // Refrescar resumen sin spinner global
    await cargar(true);
    if (crmHistorial && crmHistorial.musicoId === crmRegistrar.musicoId
        && crmHistorial.eventoId === crmRegistrar.eventoId) {
      await cargarHistorial(crmRegistrar.musicoId, crmRegistrar.eventoId);
    }
  };

  if (loading) {
    return <div className="p-6" data-testid="seguimiento-page"><p className="text-slate-500">Cargando seguimiento...</p></div>;
  }

  return (
    <div className="p-6" data-testid="seguimiento-page">
      <header className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Seguimiento de plantillas</h1>
          <p className="text-sm text-slate-600 mt-1">
            Publica eventos a los músicos, recoge disponibilidades y confirma la plantilla. Los confirmados pasan a Plantillas Definitivas.
          </p>
        </div>
      </header>

      {/* Filtros acumulativos */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3" data-testid="filtros-bar">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por nombre o apellidos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="seguimiento-search"
            className="px-3 py-2 border border-slate-300 rounded-md text-sm w-64"
          />

          {/* Multi-select instrumentos via chips */}
          <div className="relative">
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setFilterInstrumentos(prev => prev.includes(v) ? prev : [...prev, v]);
              }}
              data-testid="filter-instrumento"
              className="px-2 py-2 border border-slate-300 rounded-md text-sm bg-white min-w-[180px]"
            >
              <option value="">+ Instrumento</option>
              {instrumentosList.filter(i => !filterInstrumentos.includes(i)).map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <select
            value={filterEspecialidad}
            onChange={(e) => setFilterEspecialidad(e.target.value)}
            data-testid="filter-especialidad"
            className="px-2 py-2 border border-slate-300 rounded-md text-sm bg-white"
          >
            <option value="">Todas las especialidades</option>
            {especialidadesList.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <select
            value={filterNivel}
            onChange={(e) => setFilterNivel(e.target.value)}
            data-testid="filter-nivel"
            className="px-2 py-2 border border-slate-300 rounded-md text-sm bg-white"
          >
            <option value="">Todos los niveles</option>
            {nivelesList.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <select
            value={filterLocalidad}
            onChange={(e) => setFilterLocalidad(e.target.value)}
            data-testid="filter-localidad"
            className="px-2 py-2 border border-slate-300 rounded-md text-sm bg-white"
          >
            <option value="">Todas las localidades</option>
            {localidadesList.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <select
            value={filterEvento}
            onChange={(e) => setFilterEvento(e.target.value)}
            data-testid="filter-evento"
            className="px-2 py-2 border border-slate-300 rounded-md text-sm bg-white"
          >
            <option value="">Todos los eventos</option>
            {data.eventos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>

          {/* Botón Columnas (3B) */}
          <div className="relative ml-auto">
            <button
              onClick={() => setShowColumnsMenu(v => !v)}
              data-testid="btn-columnas"
              className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white hover:bg-slate-50 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
              Columnas
            </button>
            {showColumnsMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg p-2 z-30 min-w-[180px]" data-testid="columnas-menu">
                {COLUMN_DEFS.map(c => (
                  <label key={c.key} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={!!visibleCols[c.key]}
                      onChange={() => toggleColumn(c.key)}
                      data-testid={`col-check-${c.key}`}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chips de filtros activos */}
        {filtrosActivos && (
          <div className="mt-2 flex items-center gap-2 flex-wrap" data-testid="filtros-activos">
            {search.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                "{search.trim()}" <button onClick={() => setSearch('')} className="ml-1 hover:text-blue-900">×</button>
              </span>
            )}
            {filterInstrumentos.map(i => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-800 text-xs rounded-full" data-testid={`chip-instr-${i}`}>
                🎻 {i}
                <button onClick={() => setFilterInstrumentos(prev => prev.filter(x => x !== i))} className="ml-1 hover:text-violet-900">×</button>
              </span>
            ))}
            {filterEspecialidad && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                {filterEspecialidad} <button onClick={() => setFilterEspecialidad('')} className="ml-1 hover:text-emerald-900">×</button>
              </span>
            )}
            {filterNivel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">
                {filterNivel} <button onClick={() => setFilterNivel('')} className="ml-1 hover:text-amber-900">×</button>
              </span>
            )}
            {filterLocalidad && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-800 text-xs rounded-full">
                📍 {filterLocalidad} <button onClick={() => setFilterLocalidad('')} className="ml-1 hover:text-teal-900">×</button>
              </span>
            )}
            {filterEvento && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-800 text-xs rounded-full">
                Evento único <button onClick={() => setFilterEvento('')} className="ml-1 hover:text-slate-900">×</button>
              </span>
            )}
            <button
              onClick={limpiarFiltros}
              data-testid="btn-clear-filters"
              className="text-xs text-slate-600 hover:text-slate-900 underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          data-testid="seguimiento-feedback"
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border max-w-sm text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <strong>{feedback.type === 'success' ? '✅ ' : '❌ '}</strong>{feedback.text}
        </div>
      )}

      {/* Barra de acciones masivas — sólo si hay selección */}
      {selected.size > 0 && (
        <div className="bg-slate-900 text-white rounded-lg p-3 mb-3" data-testid="bulk-bar">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base font-semibold">⚡ ACCIONES MASIVAS</span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-sm"><strong>{selected.size}</strong> músicos seleccionados</span>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs underline text-slate-300 hover:text-white"
              data-testid="btn-clear-selection"
            >
              Limpiar selección
            </button>
          </div>
          <p className="text-xs text-slate-300 mb-3">
            Selecciona músicos con el checkbox y elige el evento y la acción a aplicar a todos los seleccionados.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Multi-select eventos con chips */}
            <div className="flex items-center gap-1 flex-wrap">
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setBulkEventos(prev => prev.includes(v) ? prev : [...prev, v]);
                }}
                data-testid="bulk-evento"
                className="px-2 py-1.5 rounded-md text-sm text-slate-900 min-w-[180px]"
              >
                <option value="">+ Añadir evento...</option>
                {data.eventos.filter(e => !bulkEventos.includes(e.id)).map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
              {bulkEventos.map(id => {
                const ev = data.eventos.find(e => e.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full" data-testid={`bulk-evento-chip-${id}`}>
                    {ev?.nombre || id.slice(0, 8)}
                    <button onClick={() => setBulkEventos(prev => prev.filter(x => x !== id))} className="ml-1 hover:text-blue-100">×</button>
                  </span>
                );
              })}
            </div>
            <select
              value={bulkAccion}
              onChange={(e) => setBulkAccion(e.target.value)}
              data-testid="bulk-accion"
              className="px-2 py-1.5 rounded-md text-sm text-slate-900"
            >
              <option value="">Selecciona acción...</option>
              <option value="publicar_on">Publicar</option>
              <option value="publicar_off">Despublicar</option>
              <option value="pendiente">En espera</option>
              <option value="confirmado">Confirmar</option>
              <option value="no_disponible">No disponible</option>
              <option value="excluido">Excluir</option>
            </select>
            <button
              onClick={aplicarBulk}
              disabled={busy || bulkEventos.length === 0 || !bulkAccion}
              data-testid="btn-aplicar-bulk"
              className="px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-md text-sm font-medium disabled:opacity-60"
            >
              {busy ? 'Aplicando...' : `Aplicar a seleccionados (${selected.size})`}
            </button>
          </div>
        </div>
      )}

      {error && <div className="p-3 mb-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded">{error}</div>}

      {/* Tabla pivot */}
      {data.eventos.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-center text-slate-500" data-testid="seguimiento-empty-eventos">
          No hay eventos en estado <strong>borrador</strong> o <strong>abierto</strong>.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" data-testid="seguimiento-table">
              {/* Cabecera en 2 filas: bloque de evento + subcolumnas */}
              <thead className="sticky top-0 bg-slate-50 z-20">
                {/* Fila 1: columnas fijas (rowspan=2) + bloque evento con colspan */}
                <tr>
                  <th rowSpan={2} className="px-2 py-2 w-8 border-b border-slate-200 bg-slate-50">
                    <input
                      type="checkbox"
                      checked={musicosVisibles.length > 0 && musicosVisibles.every(m => selected.has(m.id))}
                      onChange={toggleSelectAll}
                      data-testid="select-all-musicos"
                    />
                  </th>
                  {visibleCols.apellidos && (
                    <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 border-r bg-slate-50 min-w-[140px]" data-testid="col-head-apellidos">Apellidos</th>
                  )}
                  {visibleCols.nombre && (
                    <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[120px]" data-testid="col-head-nombre">Nombre</th>
                  )}
                  {visibleCols.instrumento && (
                    <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[110px]" data-testid="col-head-instrumento">Instrumento</th>
                  )}
                  {visibleCols.especialidad && (
                    <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[120px]" data-testid="col-head-especialidad">Especialidad</th>
                  )}
                  {visibleCols.nivel_estudios && (
                    <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[120px]" data-testid="col-head-nivel">Nivel est.</th>
                  )}
                  {visibleCols.baremo && (
                    <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[80px]" data-testid="col-head-baremo">Baremo</th>
                  )}
                  {visibleCols.localidad && (
                    <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b-2 border-r-2 border-slate-400 bg-slate-50 min-w-[110px]" data-testid="col-head-localidad">Localidad</th>
                  )}
                  {eventosVisibles.map(ev => {
                    const badge = ESTADO_EVENTO_BADGE[ev.estado] || { label: ev.estado, className: 'bg-slate-200 text-slate-700' };
                    const crmOn = crmExpandidos.has(ev.id);
                    const subcols = ev.ensayos.length + 3 + (crmOn ? 3 : 0); // ensayos + %Disp + Publicado + Acción + (CRM 3)
                    // Total contactos del evento (sumatorio musicos.asignaciones[ev.id].crm.total_contactos)
                    const totalCRM = data.musicos.reduce((acc, m) => {
                      const a = (Array.isArray(m.asignaciones) ? m.asignaciones.find(x => x.evento_id === ev.id) : null);
                      return acc + (a?.crm?.total_contactos || 0);
                    }, 0);
                    return (
                      <th
                        key={ev.id}
                        colSpan={subcols}
                        className="px-2 py-2 text-center font-semibold text-slate-900 border-b border-r-2 border-slate-400 bg-slate-100"
                        data-testid={`block-evento-${ev.id}`}
                      >
                        <div className="text-sm">{ev.nombre}</div>
                        <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          {ev.fechas.map((f, idx) => (
                            <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[10px] font-normal">
                              {fmtFecha(f.fecha)}{f.hora ? ` ${fmtHora(f.hora)}` : ''}
                            </span>
                          ))}
                          <CRMToggleButton expanded={crmOn} onClick={() => toggleCRM(ev.id)} total={totalCRM} eventoId={ev.id} />
                        </div>
                      </th>
                    );
                  })}
                </tr>
                {/* Fila 2: subcolumnas (ensayos + %Disp + Publicado + Acción + [CRM 3]) */}
                <tr>
                  {eventosVisibles.map(ev => {
                    // Contadores por tipo para numerar subcolumnas: Ens.1, Ens.2, Func.1...
                    const counters = { ensayo: 0, concierto: 0, funcion: 0 };
                    const tipoAbrev = (t) => {
                      if (t === 'ensayo') return 'Ens';
                      if (t === 'concierto') return 'Conc';
                      if (t === 'funcion') return 'Func';
                      return 'Ens';
                    };
                    const crmOn = crmExpandidos.has(ev.id);
                    return (
                      <React.Fragment key={ev.id}>
                        {ev.ensayos.map(e => {
                          const tipo = (e.tipo || 'ensayo').toLowerCase();
                          counters[tipo] = (counters[tipo] || 0) + 1;
                          const label = `${tipoAbrev(tipo)}.${counters[tipo]}`;
                          return (
                            <th
                              key={e.id}
                              className="px-1 py-1.5 text-center font-normal text-[10px] text-slate-600 border-b border-slate-200 bg-slate-50 min-w-[70px]"
                              data-testid={`subcol-ensayo-${e.id}`}
                              title={`${label} · ${fmtFecha(e.fecha)}${e.hora ? ' ' + fmtHora(e.hora) : ''}`}
                            >
                              <div className="font-semibold text-slate-800">{label}</div>
                              <div>{fmtFecha(e.fecha)}</div>
                              {e.hora && <div className="text-slate-500">{fmtHora(e.hora)}</div>}
                            </th>
                          );
                        })}
                        <th className="px-1 py-1.5 text-center font-normal text-[10px] text-slate-600 border-b border-slate-200 bg-slate-50 min-w-[50px]" title="% Disponibilidad">% Disp.</th>
                        <th className="px-1 py-1.5 text-center font-normal text-[10px] text-slate-600 border-b border-slate-200 bg-slate-50 min-w-[60px]">Publicado</th>
                        <th className={`px-1 py-1.5 text-center font-normal text-[10px] text-slate-600 border-b ${crmOn ? '' : 'border-r-2 border-slate-400'} border-slate-200 bg-slate-50 min-w-[120px]`}>Acción</th>
                        {crmOn && (
                          <>
                            <th className="px-1 py-1.5 text-center font-normal text-[10px] text-slate-600 border-b border-slate-200 bg-blue-50 min-w-[60px]" data-testid={`crm-head-contactos-${ev.id}`}>Contactos</th>
                            <th className="px-1 py-1.5 text-center font-normal text-[10px] text-slate-600 border-b border-slate-200 bg-blue-50 min-w-[90px]">Último</th>
                            <th className="px-1 py-1.5 text-center font-normal text-[10px] text-slate-600 border-b border-r-2 border-slate-400 bg-blue-50 min-w-[40px]">➕</th>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {musicosVisibles.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50" data-testid={`row-musico-${m.id}`}>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        data-testid={`check-musico-${m.id}`}
                      />
                    </td>
                    {visibleCols.apellidos && (
                      <td className="px-2 py-1.5 font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{m.apellidos || '—'}</span>
                          {(m.estado_invitacion && m.estado_invitacion !== 'activado') && (
                            <span
                              title={m.estado_invitacion === 'invitado' ? 'Invitado pero sin activar la cuenta' : 'Cuenta nunca invitada'}
                              data-testid={`badge-sin-activar-${m.id}`}
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                              ⚠️ Sin activar
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleCols.nombre && (
                      <td className="px-2 py-1.5 text-slate-900 whitespace-nowrap">{m.nombre || '—'}</td>
                    )}
                    {visibleCols.instrumento && (
                      <td className="px-2 py-1.5 text-slate-700">{m.instrumento || '—'}</td>
                    )}
                    {visibleCols.especialidad && (
                      <td className="px-2 py-1.5 text-slate-700">{m.especialidad || '—'}</td>
                    )}
                    {visibleCols.nivel_estudios && (
                      <td className="px-2 py-1.5 text-slate-700">{m.nivel_estudios || '—'}</td>
                    )}
                    {visibleCols.baremo && (
                      <td className="px-2 py-1.5 text-slate-700">{m.baremo != null ? m.baremo : '—'}</td>
                    )}
                    {visibleCols.localidad && (
                      <td className="px-2 py-1.5 text-slate-700 border-r-2 border-slate-300">{m.localidad || '—'}</td>
                    )}
                    {eventosVisibles.map(ev => {
                      const asig = (Array.isArray(m.asignaciones)
                        ? m.asignaciones.find(a => a.evento_id === ev.id)
                        : (m.asignaciones || {})[ev.id])
                        || { publicado_musico: false, estado: null, disponibilidad: [], porcentaje_disponibilidad: 0 };
                      const isPub = Boolean(asig.publicado_musico);
                      const crmOn = crmExpandidos.has(ev.id);
                      return (
                        <React.Fragment key={ev.id}>
                          {ev.ensayos.map(e => {
                            const d = Array.isArray(asig.disponibilidad)
                              ? asig.disponibilidad.find(x => x.ensayo_id === e.id)
                              : (asig.disponibilidad ? asig.disponibilidad[e.id] : null);
                            return (
                              <td key={e.id} className="px-1 py-1.5 text-center" data-testid={`cell-disp-${m.id}-${e.id}`}>
                                {isPub ? <DispCell asiste={d?.asiste} convocado={d?.convocado} /> : <span className="text-slate-300">-</span>}
                              </td>
                            );
                          })}
                          <td className="px-1 py-1.5 text-center text-slate-700 font-medium" data-testid={`cell-pct-${m.id}-${ev.id}`}>
                            {isPub ? `${asig.porcentaje_disponibilidad}%` : '—'}
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isPub}
                                onChange={(e) => togglePublicar(m.id, ev.id, e.target.checked)}
                                className="sr-only"
                                data-testid={`toggle-publicar-${m.id}-${ev.id}`}
                              />
                              <span className={`relative inline-block w-9 h-5 rounded-full transition-colors ${
                                isPub ? 'bg-blue-600' : 'bg-slate-300'
                              }`}>
                                <span className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                                  isPub ? 'translate-x-4' : ''
                                }`} />
                              </span>
                            </label>
                          </td>
                          <td className={`px-1 py-1.5 text-center ${crmOn ? '' : 'border-r-2 border-slate-300'}`}>
                            <select
                              value={asig.estado || ''}
                              onChange={(e) => cambiarAccion(m.id, ev.id, e.target.value)}
                              data-testid={`accion-${m.id}-${ev.id}`}
                              className={`text-[11px] px-1 py-0.5 border border-slate-300 rounded bg-white ${
                                asig.estado ? (ACCION_BY_KEY[asig.estado]?.color || '') : ''
                              }`}
                            >
                              <option value="">—</option>
                              {ACCIONES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                            </select>
                          </td>
                          {crmOn && (
                            <>
                              <td className="px-1 py-1.5 text-center bg-blue-50/50" data-testid={`cell-crm-contactos-${m.id}-${ev.id}`}>
                                <ContactosBadge crm={asig.crm} onClick={() => abrirHistorial(m, ev)}
                                  dataTestId={`crm-badge-${m.id}-${ev.id}`} />
                              </td>
                              <td className="px-1 py-1.5 text-center bg-blue-50/50">
                                <UltimoContactoCell crm={asig.crm} />
                              </td>
                              <td className="px-1 py-1.5 text-center border-r-2 border-slate-300 bg-blue-50/50">
                                <button
                                  type="button"
                                  onClick={() => abrirRegistrar(m, ev)}
                                  data-testid={`crm-add-${m.id}-${ev.id}`}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                                  title="Registrar nuevo contacto"
                                >
                                  +
                                </button>
                              </td>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-600 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
            <span>
              Mostrando <strong>{musicosVisibles.length}</strong> de <strong>{data.musicos.length}</strong> músicos · <strong>{eventosVisibles.length}</strong> eventos
            </span>
          </div>
        </div>
      )}

      {/* Mensaje informativo permanente sobre guardado automático */}
      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-900 flex items-start gap-2" data-testid="autosave-info">
        <span>💾</span>
        <span>Los cambios individuales (toggle <strong>Publicar</strong> y selector <strong>Acción</strong>) se guardan automáticamente al instante.</span>
      </div>

      {/* CRM — Modales y panel lateral (Bloque 1) */}
      <RegistrarContactoModal
        open={!!crmRegistrar}
        onClose={() => setCrmRegistrar(null)}
        onSubmit={guardarContacto}
        musicoNombre={crmRegistrar?.musicoNombre}
        eventoNombre={crmRegistrar?.eventoNombre}
      />
      <HistorialPanel
        open={!!crmHistorial}
        onClose={() => setCrmHistorial(null)}
        contactos={crmHistorialData.contactos}
        loading={crmHistorialData.loading}
        musicoNombre={crmHistorial?.musicoNombre}
        eventoNombre={crmHistorial?.eventoNombre}
        onAddNew={() => {
          if (!crmHistorial) return;
          // Abrir modal de registro con el mismo contexto, sin cerrar el panel
          setCrmRegistrar({
            musicoId: crmHistorial.musicoId,
            eventoId: crmHistorial.eventoId,
            musicoNombre: crmHistorial.musicoNombre,
            eventoNombre: crmHistorial.eventoNombre,
          });
        }}
      />
    </div>
  );
};

export default SeguimientoConvocatorias;
