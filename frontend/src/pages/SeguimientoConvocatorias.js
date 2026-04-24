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
const DispCell = ({ asiste }) => {
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
  const [bulkEvento, setBulkEvento] = useState('');
  const [bulkAccion, setBulkAccion] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [filterInstr, setFilterInstr] = useState('');
  const [filterEvento, setFilterEvento] = useState(''); // si se define, sólo esa columna

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  const cargar = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const r = await api.get('/api/gestor/seguimiento');
      setData(r.data || { eventos: [], musicos: [] });
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { cargar(); }, [cargar]);

  // Lista de instrumentos únicos para el filtro
  const instrumentosList = useMemo(() => {
    const s = new Set();
    data.musicos.forEach(m => m.instrumento && s.add(m.instrumento));
    return Array.from(s).sort();
  }, [data.musicos]);

  // Músicos ordenados por (sección → apellidos) y filtrados
  const musicosVisibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = data.musicos.slice();
    if (q) {
      out = out.filter(m => (
        (m.apellidos || '').toLowerCase().includes(q) ||
        (m.nombre || '').toLowerCase().includes(q) ||
        (m.instrumento || '').toLowerCase().includes(q) ||
        (m.especialidad || '').toLowerCase().includes(q) ||
        (m.localidad || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q)
      ));
    }
    if (filterInstr) out = out.filter(m => m.instrumento === filterInstr);
    out.sort((a, b) => {
      const ra = seccionRank(a.instrumento), rb = seccionRank(b.instrumento);
      if (ra !== rb) return ra - rb;
      return (a.apellidos || '').localeCompare(b.apellidos || '', 'es');
    });
    return out;
  }, [data.musicos, search, filterInstr]);

  const eventosVisibles = useMemo(() => {
    if (!filterEvento) return data.eventos;
    return data.eventos.filter(e => e.id === filterEvento);
  }, [data.eventos, filterEvento]);

  // === Actualización optimista del toggle Publicar ===
  const togglePublicar = async (musicoId, eventoId, next) => {
    // Optimista
    setData(prev => ({
      ...prev,
      musicos: prev.musicos.map(m => m.id === musicoId
        ? { ...m, asignaciones: {
            ...m.asignaciones,
            [eventoId]: {
              ...(m.asignaciones[eventoId] || { estado: null, disponibilidad: {}, porcentaje_disponibilidad: 0 }),
              publicado_musico: next,
              estado: (m.asignaciones[eventoId]?.estado) || (next ? 'pendiente' : null),
            }
          }}
        : m)
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
      musicos: prev.musicos.map(m => m.id === musicoId
        ? { ...m, asignaciones: {
            ...m.asignaciones,
            [eventoId]: {
              ...(m.asignaciones[eventoId] || { publicado_musico: false, disponibilidad: {}, porcentaje_disponibilidad: 0 }),
              estado: accion,
            }
          }}
        : m)
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

  // === Aplicar acción masiva ===
  const aplicarBulk = async () => {
    if (!bulkEvento || !bulkAccion || selected.size === 0) {
      showFeedback('error', 'Selecciona músicos, evento y acción');
      return;
    }
    try {
      setBusy(true);
      if (bulkAccion === 'publicar_on' || bulkAccion === 'publicar_off') {
        const publicar = bulkAccion === 'publicar_on';
        const r = await api.post('/api/gestor/seguimiento/publicar', {
          usuario_ids: Array.from(selected), evento_id: bulkEvento, publicar,
        });
        showFeedback('success', `Publicados:${r.data.publicados} Creados:${r.data.creados} Despublicados:${r.data.despublicados}`);
      } else {
        const r = await api.post('/api/gestor/seguimiento/bulk-accion', {
          usuario_ids: Array.from(selected), evento_id: bulkEvento, accion: bulkAccion,
        });
        showFeedback('success', `Actualizados:${r.data.actualizados} Creados:${r.data.creados}`);
      }
      await cargar();
      setSelected(new Set());
      setBulkAccion('');
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    } finally { setBusy(false); }
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

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3 flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Buscar apellidos, nombre, instrumento, localidad..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="seguimiento-search"
          className="px-3 py-2 border border-slate-300 rounded-md text-sm w-80"
        />
        <select
          value={filterInstr}
          onChange={(e) => setFilterInstr(e.target.value)}
          data-testid="filter-instrumento"
          className="px-2 py-2 border border-slate-300 rounded-md text-sm bg-white"
        >
          <option value="">Todos los instrumentos</option>
          {instrumentosList.map(i => <option key={i} value={i}>{i}</option>)}
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
        {(search || filterInstr || filterEvento) && (
          <button
            onClick={() => { setSearch(''); setFilterInstr(''); setFilterEvento(''); }}
            data-testid="btn-clear-filters"
            className="text-xs text-slate-600 hover:text-slate-900 underline"
          >
            Limpiar filtros
          </button>
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
        <div className="bg-slate-900 text-white rounded-lg p-3 mb-3 flex items-center gap-2 flex-wrap" data-testid="bulk-bar">
          <span className="text-sm"><strong>{selected.size}</strong> músicos seleccionados</span>
          <span className="text-slate-500">·</span>
          <select
            value={bulkEvento}
            onChange={(e) => setBulkEvento(e.target.value)}
            data-testid="bulk-evento"
            className="px-2 py-1.5 rounded-md text-sm text-slate-900"
          >
            <option value="">Selecciona evento...</option>
            {data.eventos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
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
            disabled={busy || !bulkEvento || !bulkAccion}
            data-testid="btn-aplicar-bulk"
            className="px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-md text-sm font-medium disabled:opacity-60"
          >
            {busy ? 'Aplicando...' : `Aplicar a seleccionados (${selected.size})`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs underline text-slate-300 hover:text-white"
            data-testid="btn-clear-selection"
          >
            Limpiar selección
          </button>
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
                  <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 border-r bg-slate-50 min-w-[140px]">Apellidos</th>
                  <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[120px]">Nombre</th>
                  <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[110px]">Instrumento</th>
                  <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[120px]">Especialidad</th>
                  <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[120px]">Nivel est.</th>
                  <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 bg-slate-50 min-w-[80px]">Baremo</th>
                  <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-slate-700 border-b-2 border-r-2 border-slate-400 bg-slate-50 min-w-[110px]">Localidad</th>
                  {eventosVisibles.map(ev => {
                    const badge = ESTADO_EVENTO_BADGE[ev.estado] || { label: ev.estado, className: 'bg-slate-200 text-slate-700' };
                    const subcols = ev.ensayos.length + 3; // ensayos + %Disp + Publicado + Acción
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
                        </div>
                      </th>
                    );
                  })}
                </tr>
                {/* Fila 2: subcolumnas (ensayos + %Disp + Publicado + Acción) */}
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
                        <th className="px-1 py-1.5 text-center font-normal text-[10px] text-slate-600 border-b border-r-2 border-slate-400 bg-slate-50 min-w-[120px]">Acción</th>
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
                    <td className="px-2 py-1.5 font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap">{m.apellidos || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-900 whitespace-nowrap">{m.nombre || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-700">{m.instrumento || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-700">{m.especialidad || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-700">{m.nivel_estudios || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-700">{m.baremo != null ? m.baremo : '—'}</td>
                    <td className="px-2 py-1.5 text-slate-700 border-r-2 border-slate-300">{m.localidad || '—'}</td>
                    {eventosVisibles.map(ev => {
                      const asig = m.asignaciones[ev.id] || { publicado_musico: false, estado: null, disponibilidad: {}, porcentaje_disponibilidad: 0 };
                      const isPub = Boolean(asig.publicado_musico);
                      return (
                        <React.Fragment key={ev.id}>
                          {ev.ensayos.map(e => {
                            const d = asig.disponibilidad[e.id];
                            return (
                              <td key={e.id} className="px-1 py-1.5 text-center" data-testid={`cell-disp-${m.id}-${e.id}`}>
                                {isPub ? <DispCell asiste={d?.asiste} /> : <span className="text-slate-300">-</span>}
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
                          <td className="px-1 py-1.5 text-center border-r-2 border-slate-300">
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
    </div>
  );
};

export default SeguimientoConvocatorias;
