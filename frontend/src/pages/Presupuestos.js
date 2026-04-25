// Presupuestos — Matriz completa por temporada (Bloque 1, feb 2026)
// Filas: secciones × instrumentos × niveles
// Columnas: bloque por evento (estado='abierto'), 5 subcolumnas cuando expandido,
//           1 (Total) cuando contraído.
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth as useGestorAuth } from "../contexts/AuthContext";

// ==================================================================
// Estructura de filas: 76 = 19 instrumentos × 4 niveles
// ==================================================================
const SECCIONES = [
  { id: 'cuerda',        name: 'CUERDA',        instrumentos: ['Violín', 'Viola', 'Violonchelo', 'Contrabajo'],
    bg: 'bg-blue-50',   bgAlt: 'bg-blue-100',   bar: 'bg-blue-500'   },
  { id: 'viento_madera', name: 'VIENTO MADERA', instrumentos: ['Flauta', 'Oboe', 'Clarinete', 'Fagot'],
    bg: 'bg-green-50',  bgAlt: 'bg-green-100',  bar: 'bg-green-500'  },
  { id: 'viento_metal',  name: 'VIENTO METAL',  instrumentos: ['Trompa', 'Trompeta', 'Trombón', 'Tuba'],
    bg: 'bg-yellow-50', bgAlt: 'bg-yellow-100', bar: 'bg-yellow-500' },
  { id: 'percusion',     name: 'PERCUSIÓN',     instrumentos: ['Percusión'],
    bg: 'bg-orange-50', bgAlt: 'bg-orange-100', bar: 'bg-orange-500' },
  { id: 'teclados',      name: 'TECLADOS',      instrumentos: ['Piano', 'Órgano'],
    bg: 'bg-purple-50', bgAlt: 'bg-purple-100', bar: 'bg-purple-500' },
  { id: 'coro',          name: 'CORO',          instrumentos: ['Soprano', 'Alto', 'Tenor', 'Barítono'],
    bg: 'bg-pink-50',   bgAlt: 'bg-pink-100',   bar: 'bg-pink-500'   },
];

const NIVELES = [
  'Superior finalizado',
  'Superior cursando',
  'Profesional finalizado',
  'Profesional cursando',
];

// Valores por defecto al precargar (aplica solo a celdas vacías)
const PRECARGA_NIVEL = {
  'Superior finalizado':    400,
  'Superior cursando':      320,
  'Profesional finalizado': 260,
  'Profesional cursando':   200,
};

// Generar las 76 filas planas (sección, instrumento, nivel)
const buildRows = () => {
  const rows = [];
  for (const sec of SECCIONES) {
    sec.instrumentos.forEach((instr, instrIdx) => {
      NIVELES.forEach((niv, nivIdx) => {
        const idx = rows.length;
        rows.push({
          key: `${instr}__${niv}`,
          seccion: sec,
          instrumento: instr,
          nivel: niv,
          // Para zebra dentro de una sección: alternamos por (instrIdx + nivIdx)
          alt: (instrIdx + nivIdx) % 2 === 1,
          isFirstOfInstr: nivIdx === 0,
          isFirstOfSec: instrIdx === 0 && nivIdx === 0,
          rowIdx: idx,
        });
      });
    });
  }
  return rows;
};

const fmtFechaCorta = (iso) => {
  if (!iso) return '';
  try {
    const datePart = String(iso).slice(0, 10);  // YYYY-MM-DD
    const d = new Date(datePart + 'T00:00:00');
    if (isNaN(d.getTime())) return datePart;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  } catch { return iso; }
};

const fmtEuro = (v) => `${(Number(v) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// Construye el mapa { 'eventoId__instr__nivel' : {id, importe, factor} } a partir de las cachets devueltas
const buildCachetsMap = (rows) => {
  const map = {};
  for (const r of (rows || [])) {
    const key = `${r.evento_id}__${r.instrumento}__${r.nivel_estudios}`;
    map[key] = {
      id: r.id,
      importe: Number(r.importe) || 0,
      factor: Number(r.factor_ponderacion ?? 100),
    };
  }
  return map;
};

// ==================================================================
// Componente principal
// ==================================================================
const Presupuestos = () => {
  const { api } = useGestorAuth();
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [eventos, setEventos] = useState([]);          // eventos abiertos de la temporada
  const [cachets, setCachets] = useState({});           // mapa eventoId__instr__nivel → {id, importe, factor}
  const [collapsed, setCollapsed] = useState({});       // {eventoId: true} cuando contraído
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const ROWS = useMemo(() => buildRows(), []);

  const fetchSeasons = useCallback(async () => {
    try {
      const r = await api.get('/api/gestor/eventos');
      const all = r.data?.eventos || [];
      const t = Array.from(new Set(all.map(e => e.temporada).filter(Boolean)));
      setSeasons(t);
      if (!selectedSeason && t.length > 0) {
        // Preferimos la temporada con más eventos en estado "abierto"
        // (que es la que realmente alimenta la matriz). Si ninguna tiene
        // eventos abiertos, caemos a la temporada más reciente alfabéticamente.
        const openCount = {};
        for (const ev of all) {
          if (ev.estado === 'abierto' && ev.temporada) {
            openCount[ev.temporada] = (openCount[ev.temporada] || 0) + 1;
          }
        }
        const sorted = [...t].sort();
        const seasonsWithOpen = sorted.filter(s => (openCount[s] || 0) > 0);
        const best = seasonsWithOpen.length > 0
          ? seasonsWithOpen.reduce((a, b) => (openCount[b] >= openCount[a] ? b : a), seasonsWithOpen[0])
          : sorted[sorted.length - 1];
        setSelectedSeason(best);
      }
    } catch (e) {
      console.error('[Presupuestos] error temporadas', e);
    }
  }, [api, selectedSeason]);

  const fetchMatriz = useCallback(async () => {
    if (!selectedSeason) { setEventos([]); setCachets({}); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await api.get('/api/gestor/presupuestos-matriz', { params: { temporada: selectedSeason } });
      setEventos(r.data?.eventos || []);
      setCachets(buildCachetsMap(r.data?.cachets || []));
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  }, [api, selectedSeason]);

  useEffect(() => { fetchSeasons(); }, [fetchSeasons]);
  useEffect(() => { fetchMatriz(); }, [fetchMatriz]);

  const setCell = (eventoId, instr, nivel, field, value) => {
    setCachets(prev => {
      const key = `${eventoId}__${instr}__${nivel}`;
      const prevCell = prev[key] || { importe: 0, factor: 100, _dirty: false };
      const num = value === '' ? 0 : Number(value);
      return {
        ...prev,
        [key]: { ...prevCell, [field]: num, _dirty: true },
      };
    });
  };

  const cellValue = (eventoId, instr, nivel) => {
    const k = `${eventoId}__${instr}__${nivel}`;
    return cachets[k] || { importe: 0, factor: 100 };
  };

  const totalCelda = (eventoId, instr, nivel) => {
    const c = cellValue(eventoId, instr, nivel);
    return c.importe * (c.factor / 100);
  };

  const totalEvento = (eventoId) => {
    let total = 0;
    for (const sec of SECCIONES) {
      for (const instr of sec.instrumentos) {
        for (const niv of NIVELES) {
          total += totalCelda(eventoId, instr, niv);
        }
      }
    }
    return total;
  };

  const totalGeneral = useMemo(() => {
    return eventos.reduce((acc, e) => acc + totalEvento(e.id), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos, cachets]);

  const precargarEstandar = async () => {
    try {
      // Cargar la plantilla base (cachets_config WHERE evento_id IS NULL)
      const r = await api.get('/api/gestor/cachets-base');
      const baseRows = r.data?.cachets || [];
      const baseMap = {};
      for (const row of baseRows) {
        baseMap[`${row.instrumento}__${row.nivel_estudios}`] = Number(row.importe) || 0;
      }
      setCachets(prev => {
        const next = { ...prev };
        let added = 0;
        for (const ev of eventos) {
          for (const sec of SECCIONES) {
            for (const instr of sec.instrumentos) {
              for (const niv of NIVELES) {
                const k = `${ev.id}__${instr}__${niv}`;
                const cur = next[k];
                if (!cur || (Number(cur.importe) || 0) === 0) {
                  // Usar plantilla base si existe; si no, fallback a valores estándar
                  const baseVal = baseMap[`${instr}__${niv}`];
                  const valor = (baseVal !== undefined && baseVal > 0) ? baseVal : PRECARGA_NIVEL[niv];
                  next[k] = {
                    ...cur,
                    importe: valor,
                    factor: cur?.factor ?? 100,
                    _dirty: true,
                  };
                  added++;
                }
              }
            }
          }
        }
        const fuente = baseRows.length > 0 ? 'plantilla base configurada' : 'valores estándar (no hay plantilla base)';
        setMsg({ type: 'info', text: `📋 ${added} celdas precargadas desde ${fuente}.` });
        setTimeout(() => setMsg(null), 4500);
        return next;
      });
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    }
  };

  const aplicarPlantillaBaseEvento = async (eventoId) => {
    try {
      const r = await api.post(`/api/gestor/cachets-config/${eventoId}/copy-from-base`);
      const ev = eventos.find(e => e.id === eventoId);
      setMsg({ type: 'success', text: `✅ ${ev?.nombre || 'Evento'}: ${r.data.copiados || 0} aplicados, ${r.data.actualizados || 0} actualizados` });
      setTimeout(() => setMsg(null), 4000);
      await fetchMatriz();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    }
  };

  const aplicarPlantillaTodos = async () => {
    if (!window.confirm(`¿Aplicar la plantilla base a los ${eventos.length} eventos abiertos? Solo rellenará celdas vacías; no sobrescribirá valores ya guardados.`)) return;
    try {
      let totalC = 0; let totalA = 0;
      for (const ev of eventos) {
        const r = await api.post(`/api/gestor/cachets-config/${ev.id}/copy-from-base`);
        totalC += r.data.copiados || 0;
        totalA += r.data.actualizados || 0;
      }
      setMsg({ type: 'success', text: `✅ Aplicada a ${eventos.length} eventos · ${totalC} creados, ${totalA} actualizados` });
      setTimeout(() => setMsg(null), 4500);
      await fetchMatriz();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    }
  };

  const guardarTodos = async () => {
    setSaving(true); setMsg(null);
    try {
      const payload = { rows: [] };
      for (const ev of eventos) {
        for (const sec of SECCIONES) {
          for (const instr of sec.instrumentos) {
            for (const niv of NIVELES) {
              const k = `${ev.id}__${instr}__${niv}`;
              const c = cachets[k];
              if (c && c._dirty) {
                payload.rows.push({
                  id: c.id,
                  evento_id: ev.id,
                  instrumento: instr,
                  nivel_estudios: niv,
                  importe: Number(c.importe) || 0,
                  factor_ponderacion: Number(c.factor) || 100,
                });
              }
            }
          }
        }
      }
      if (payload.rows.length === 0) {
        setMsg({ type: 'info', text: 'No hay cambios pendientes.' });
        setTimeout(() => setMsg(null), 2500);
        return;
      }
      const r = await api.post('/api/gestor/presupuestos-matriz/bulk', payload);
      setMsg({ type: 'success', text: `✅ Guardado: ${r.data.total || 0} registros (creados ${r.data.creados || 0}, actualizados ${r.data.actualizados || 0})` });
      setTimeout(() => setMsg(null), 4000);
      await fetchMatriz();  // recargar para sincronizar IDs y limpiar dirty
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setSaving(false); }
  };

  const toggleCollapse = (evId) => setCollapsed(prev => ({ ...prev, [evId]: !prev[evId] }));

  const [showBaseModal, setShowBaseModal] = useState(false);

  // ==================================================================
  // RENDER
  // ==================================================================
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">💰 Presupuestos</h1>
        <p className="text-sm text-slate-600 mb-4">Matriz de cachets por instrumento, nivel y evento. Solo se muestran eventos publicados (estado <em>abierto</em>).</p>

        {/* Barra superior — NO sticky para que el thead pueda fijarse correctamente al hacer scroll */}
        <div className="bg-slate-50 border-b border-slate-200 py-3 flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm">
            <span className="text-slate-600 mr-2">Temporada:</span>
            <select value={selectedSeason || ''} onChange={(e) => setSelectedSeason(e.target.value)}
                    data-testid="select-temporada-presup"
                    className="border border-slate-300 rounded px-3 py-1.5 bg-white text-sm">
              <option value="">— elige temporada —</option>
              {seasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setShowBaseModal(true)}
                  data-testid="btn-cfg-plantilla-base"
                  title="Configurar la plantilla base de cachets (evento_id NULL)"
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded">
            ⚙️ Configurar plantilla base
          </button>
          <button type="button" onClick={precargarEstandar}
                  data-testid="btn-precargar-presup"
                  title="Rellena celdas vacías leyendo de la plantilla base; usa 400/320/260/200€ como fallback si no hay plantilla"
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded">
            📋 Precargar estándar
          </button>
          <button type="button" onClick={aplicarPlantillaTodos}
                  data-testid="btn-aplicar-todos"
                  title="Copia la plantilla base a TODOS los eventos abiertos"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded">
            📋 Aplicar a todos los eventos
          </button>
          <button type="button" onClick={guardarTodos} disabled={saving}
                  data-testid="btn-guardar-presup"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar todos'}
          </button>
          {msg && (
            <span className={`text-xs px-2 py-1 rounded ${msg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : msg.type === 'info' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-700'}`}
                  data-testid="presup-msg">{msg.text}</span>
          )}
          <span className="ml-auto text-sm text-slate-700">
            Total temporada: <strong className="text-emerald-700 tabular-nums" data-testid="total-temporada">{fmtEuro(totalGeneral)}</strong>
          </span>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg p-8 text-center text-slate-500 border">Cargando matriz de presupuestos…</div>
        ) : eventos.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-slate-500 border">
            {selectedSeason ? 'No hay eventos publicados (estado abierto) en esta temporada.' : 'Selecciona una temporada para empezar.'}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto" data-testid="presup-matriz-wrap">
              <table className="text-xs border-collapse" style={{ minWidth: 900 + eventos.length * 280 }}>
                <thead className="bg-slate-100 sticky top-0 z-20">
                  {/* Fila 1: secciones de columnas (header de evento) */}
                  <tr>
                    <th colSpan={3} className="sticky left-0 z-30 bg-slate-100 border-b border-slate-300 px-3 py-2 text-left text-slate-700 font-semibold" style={{ minWidth: 360 }}>
                      Instrumento / Nivel
                    </th>
                    {eventos.map(ev => {
                      const expanded = !collapsed[ev.id];
                      return (
                        <th key={ev.id} colSpan={expanded ? 5 : 1}
                            className="border-b border-l border-slate-300 px-2 py-2 text-center align-top"
                            data-testid={`evt-header-${ev.id}`}>
                          <div className="flex items-center justify-between gap-2">
                            <button type="button" onClick={() => toggleCollapse(ev.id)}
                                    data-testid={`btn-collapse-${ev.id}`}
                                    className="text-slate-500 hover:text-slate-800">
                              {expanded ? '◧' : '▸'}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-900 truncate" title={ev.nombre}>{ev.nombre}</div>
                              <div className="text-[10px] text-slate-600 mt-0.5">
                                {fmtFechaCorta(ev.fecha_inicio)}{ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio ? ` – ${fmtFechaCorta(ev.fecha_fin)}` : ''}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {ev.n_ensayos} ens · {ev.n_funciones} func
                              </div>
                              <button type="button" onClick={() => aplicarPlantillaBaseEvento(ev.id)}
                                      data-testid={`btn-aplicar-base-${ev.id}`}
                                      title="Copia la plantilla base a este evento (solo rellena celdas vacías)"
                                      className="mt-1 text-[10px] px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded">
                                📋 Aplicar plantilla base
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                    <th className="border-b border-l-2 border-slate-400 bg-slate-200 px-3 py-2 text-center font-semibold text-slate-800" style={{ minWidth: 110 }}>
                      Total fila
                    </th>
                  </tr>
                  {/* Fila 2: subcabeceras de cada evento */}
                  <tr className="text-[10px]">
                    <th className="sticky left-0 z-30 bg-slate-50 border-b border-slate-300 px-2 py-1 text-left text-slate-500 font-medium">Sección</th>
                    <th className="sticky bg-slate-50 border-b border-slate-300 px-2 py-1 text-left text-slate-500 font-medium" style={{ left: 100 }}>Instrumento</th>
                    <th className="sticky bg-slate-50 border-b border-slate-300 px-2 py-1 text-left text-slate-500 font-medium" style={{ left: 220 }}>Nivel</th>
                    {eventos.map(ev => {
                      const expanded = !collapsed[ev.id];
                      if (!expanded) {
                        return <th key={ev.id} className="border-b border-l border-slate-300 px-2 py-1 text-center text-slate-500 font-medium bg-slate-50">Total €</th>;
                      }
                      return (
                        <React.Fragment key={ev.id}>
                          <th className="border-b border-l border-slate-300 px-2 py-1 text-center text-slate-500 font-medium bg-slate-50">Caché €</th>
                          <th className="border-b border-slate-300 px-1 py-1 text-center text-slate-400 font-medium bg-slate-100">Ens.</th>
                          <th className="border-b border-slate-300 px-1 py-1 text-center text-slate-400 font-medium bg-slate-100">Func.</th>
                          <th className="border-b border-slate-300 px-2 py-1 text-center text-slate-500 font-medium bg-slate-50">Pond. %</th>
                          <th className="border-b border-slate-300 px-2 py-1 text-center text-slate-700 font-semibold bg-slate-100">Total €</th>
                        </React.Fragment>
                      );
                    })}
                    <th className="border-b border-l-2 border-slate-400 bg-slate-200" />
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => {
                    const sec = row.seccion;
                    const rowBg = row.alt ? sec.bgAlt : sec.bg;
                    const totalFila = eventos.reduce((acc, ev) => acc + totalCelda(ev.id, row.instrumento, row.nivel), 0);
                    return (
                      <tr key={row.key} className={`border-t border-slate-200 ${rowBg}`}>
                        {/* Sticky cols */}
                        <td className={`sticky left-0 z-10 px-2 py-1.5 ${rowBg} border-r border-slate-200`} style={{ width: 100 }}>
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded ${sec.bar} text-white`}>{sec.name}</span>
                        </td>
                        <td className={`sticky z-10 px-2 py-1.5 ${rowBg} border-r border-slate-200 font-medium text-slate-800`} style={{ left: 100, width: 120 }}>
                          {row.instrumento}
                        </td>
                        <td className={`sticky z-10 px-2 py-1.5 ${rowBg} border-r border-slate-200 text-slate-700`} style={{ left: 220, width: 140 }}>
                          {row.nivel}
                        </td>
                        {eventos.map(ev => {
                          const c = cellValue(ev.id, row.instrumento, row.nivel);
                          const expanded = !collapsed[ev.id];
                          const total = totalCelda(ev.id, row.instrumento, row.nivel);
                          if (!expanded) {
                            return (
                              <td key={ev.id} className="border-l border-slate-200 px-2 py-1 text-right tabular-nums font-semibold text-slate-800"
                                  data-testid={`total-${ev.id}-${row.instrumento}-${row.nivel.replace(/ /g,'_')}`}>
                                {fmtEuro(total)}
                              </td>
                            );
                          }
                          return (
                            <React.Fragment key={ev.id}>
                              <td className="border-l border-slate-200 px-1 py-1 text-right">
                                <input type="number" min="0" step="10" value={c.importe || ''}
                                       onChange={(e) => setCell(ev.id, row.instrumento, row.nivel, 'importe', e.target.value)}
                                       data-testid={`cache-${ev.id}-${row.instrumento}-${row.nivel.replace(/ /g,'_')}`}
                                       placeholder="0"
                                       className="w-20 px-1.5 py-0.5 text-right border border-slate-300 rounded bg-white tabular-nums" />
                              </td>
                              <td className="px-1 py-1 text-center text-slate-400 tabular-nums bg-slate-50/40">{ev.n_ensayos}</td>
                              <td className="px-1 py-1 text-center text-slate-400 tabular-nums bg-slate-50/40">{ev.n_funciones}</td>
                              <td className="px-1 py-1 text-right">
                                <input type="number" min="0" max="200" step="5" value={c.factor ?? 100}
                                       onChange={(e) => setCell(ev.id, row.instrumento, row.nivel, 'factor', e.target.value)}
                                       data-testid={`factor-${ev.id}-${row.instrumento}-${row.nivel.replace(/ /g,'_')}`}
                                       className="w-16 px-1.5 py-0.5 text-right border border-slate-300 rounded bg-white tabular-nums" />
                              </td>
                              <td className="px-2 py-1 text-right font-semibold tabular-nums text-emerald-700 bg-emerald-50/40"
                                  data-testid={`total-${ev.id}-${row.instrumento}-${row.nivel.replace(/ /g,'_')}`}>
                                {fmtEuro(total)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="border-l-2 border-slate-400 bg-slate-100 px-2 py-1 text-right tabular-nums font-semibold text-slate-900">
                          {fmtEuro(totalFila)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-200 border-t-2 border-slate-400">
                    <td colSpan={3} className="sticky left-0 z-10 bg-slate-200 px-3 py-2 text-right font-bold text-slate-800">
                      Total por evento:
                    </td>
                    {eventos.map(ev => {
                      const expanded = !collapsed[ev.id];
                      const total = totalEvento(ev.id);
                      return (
                        <td key={ev.id} colSpan={expanded ? 5 : 1}
                            className="border-l border-slate-400 px-3 py-2 text-right tabular-nums font-bold text-emerald-700"
                            data-testid={`total-evt-${ev.id}`}>
                          {fmtEuro(total)}
                        </td>
                      );
                    })}
                    <td className="border-l-2 border-slate-500 bg-slate-300 px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                      {fmtEuro(totalGeneral)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Plantilla Base */}
      {showBaseModal && (
        <PlantillaBaseModal api={api} onClose={() => { setShowBaseModal(false); fetchMatriz(); }} />
      )}
    </div>
  );
};

// ==================================================================
// Modal: configurar la plantilla base global de cachets
// ==================================================================
const PlantillaBaseModal = ({ api, onClose }) => {
  const [base, setBase] = useState({}); // { 'instr__nivel': importe }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await api.get('/api/gestor/cachets-base');
        const m = {};
        for (const row of (r.data?.cachets || [])) {
          m[`${row.instrumento}__${row.nivel_estudios}`] = Number(row.importe) || 0;
        }
        setBase(m);
      } finally { setLoading(false); }
    })();
  }, [api]);

  const setVal = (instr, niv, v) => setBase(prev => ({ ...prev, [`${instr}__${niv}`]: v === '' ? 0 : Number(v) }));

  const guardar = async () => {
    try {
      setSaving(true); setMsg(null);
      const data = [];
      for (const sec of SECCIONES) {
        for (const instr of sec.instrumentos) {
          for (const niv of NIVELES) {
            const v = base[`${instr}__${niv}`];
            if (v !== undefined) {
              data.push({ instrumento: instr, nivel_estudios: niv, importe: v });
            }
          }
        }
      }
      const r = await api.put('/api/gestor/cachets-base', data);
      setMsg({ type: 'success', text: `✅ Plantilla base guardada · ${r.data.creados || 0} nuevos, ${r.data.actualizados || 0} actualizados` });
      setTimeout(() => { setMsg(null); onClose(); }, 1800);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" data-testid="plantilla-base-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">⚙️ Plantilla base de cachets (global)</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 text-xl leading-none" data-testid="btn-close-base-modal">×</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-xs text-slate-600 mb-3">Estos valores se usan como referencia para "Precargar estándar" y "Aplicar plantilla base". Se guardan en <code>cachets_config</code> con <code>evento_id IS NULL</code>.</p>
          {loading ? <div className="text-slate-500">Cargando…</div> : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Instrumento</th>
                  {NIVELES.map(n => <th key={n} className="text-center px-2 py-2">{n}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SECCIONES.map(sec => (
                  <React.Fragment key={sec.id}>
                    <tr className={sec.bg}>
                      <td colSpan={NIVELES.length + 1} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{sec.name}</td>
                    </tr>
                    {sec.instrumentos.map(instr => (
                      <tr key={instr} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-medium text-slate-800">{instr}</td>
                        {NIVELES.map(niv => (
                          <td key={niv} className="px-2 py-1 text-center">
                            <input type="number" min="0" step="10"
                                   value={base[`${instr}__${niv}`] ?? ''}
                                   onChange={(e) => setVal(instr, niv, e.target.value)}
                                   data-testid={`base-${instr}-${niv.replace(/ /g,'_')}`}
                                   placeholder="0"
                                   className="w-20 px-1.5 py-0.5 text-right border border-slate-300 rounded tabular-nums" />
                            <span className="ml-1 text-slate-400 text-xs">€</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-3 bg-slate-50 border-t flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">Cerrar</button>
          {msg && <span className={`text-xs ${msg.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`} data-testid="plantilla-base-msg">{msg.text}</span>}
          <button onClick={guardar} disabled={saving}
                  data-testid="btn-save-plantilla-base"
                  className="ml-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar plantilla base'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Presupuestos;
