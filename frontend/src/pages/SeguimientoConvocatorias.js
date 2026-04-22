// Seguimiento de Convocatorias — Tabla pivot Músicos × Eventos (estado='abierto')
// - Cada celda es el estado de asignación (pendiente/confirmado/rechazado/no_disponible/excluido)
// - Columna de checkbox + selector de acción + botón "Aplicar a seleccionados" por evento
// - Cada columna de evento muestra todas sus fechas (principal + secundarias)
// - Los confirmados aparecen en Plantillas Definitivas (por separado)
import React, { useState, useEffect, useCallback } from "react";
import { useAuth as useGestorAuth } from "../contexts/AuthContext";

const ESTADOS = [
  { key: 'pendiente',     label: 'Pendiente',     color: 'bg-slate-100 text-slate-700' },
  { key: 'confirmado',    label: 'Confirmado',    color: 'bg-green-100 text-green-800' },
  { key: 'no_disponible', label: 'No disponible', color: 'bg-amber-100 text-amber-800' },
  { key: 'rechazado',     label: 'Rechazado',     color: 'bg-red-100 text-red-800' },
  { key: 'excluido',      label: 'Excluido',      color: 'bg-slate-300 text-slate-800' },
];
const ESTADO_BY_KEY = Object.fromEntries(ESTADOS.map((e) => [e.key, e]));

const formatFecha = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } catch { return iso; }
};

const SeguimientoConvocatorias = () => {
  const { api } = useGestorAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ eventos: [], musicos: [], asignaciones: {} });
  const [selected, setSelected] = useState(new Set()); // musicos seleccionados
  const [bulkAction, setBulkAction] = useState({}); // { [evento_id]: estado }
  const [feedback, setFeedback] = useState(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  const cargar = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const r = await api.get('/api/gestor/seguimiento');
      setData(r.data || { eventos: [], musicos: [], asignaciones: {} });
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { cargar(); }, [cargar]);

  const musicosFiltrados = data.musicos.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.nombre || '').toLowerCase().includes(q) ||
      (m.apellidos || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.instrumento || '').toLowerCase().includes(q)
    );
  });

  const toggleSelected = (musicoId) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(musicoId) ? n.delete(musicoId) : n.add(musicoId);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === musicosFiltrados.length && musicosFiltrados.length > 0) setSelected(new Set());
    else setSelected(new Set(musicosFiltrados.map((m) => m.id)));
  };

  const aplicarBulk = async (eventoId) => {
    const estado = bulkAction[eventoId];
    if (!estado) return;
    if (selected.size === 0) {
      showFeedback('error', 'Selecciona al menos un músico');
      return;
    }
    try {
      setBusy(true);
      const r = await api.post('/api/gestor/seguimiento/bulk', {
        evento_id: eventoId,
        usuario_ids: Array.from(selected),
        estado,
      });
      showFeedback('success', `${r.data.actualizados} actualizados · ${r.data.creados} creados`);
      await cargar();
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="p-6" data-testid="seguimiento-page"><p className="text-slate-500">Cargando seguimiento...</p></div>;
  }

  return (
    <div className="p-6" data-testid="seguimiento-page">
      <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Seguimiento de convocatorias</h1>
          <p className="text-sm text-slate-600 mt-1">
            Estado de cada músico en los eventos activos. Los confirmados pasan a Plantillas Definitivas.
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar músico..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="seguimiento-search"
          className="px-3 py-2 border border-slate-300 rounded-md text-sm w-64"
        />
      </header>

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

      {error && <div className="p-3 mb-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded">{error}</div>}

      {data.eventos.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-center text-slate-500" data-testid="seguimiento-empty-eventos">
          No hay eventos abiertos. Marca uno o más eventos como <strong>abierto</strong> en Configuración de temporada → Eventos.
        </div>
      ) : data.musicos.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-center text-slate-500">
          No hay músicos en la base de datos.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 flex items-center gap-3 flex-wrap">
            <span>
              <strong>{selected.size}</strong> de <strong>{musicosFiltrados.length}</strong> músicos seleccionados
            </span>
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                data-testid="btn-clear-selection"
                className="text-xs underline text-slate-600 hover:text-slate-900"
              >
                Limpiar selección
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="seguimiento-table">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={musicosFiltrados.length > 0 && selected.size === musicosFiltrados.length}
                      onChange={toggleAll}
                      data-testid="select-all-musicos"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-600 font-semibold min-w-[200px] sticky left-0 bg-slate-50 z-10">
                    Músico
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-600 font-semibold">Instrumento</th>
                  {data.eventos.map((ev) => (
                    <th
                      key={ev.id}
                      className="px-3 py-2 text-left text-xs text-slate-700 font-semibold border-l border-slate-200 min-w-[240px]"
                      data-testid={`col-evento-${ev.id}`}
                    >
                      <div className="space-y-1.5">
                        <div className="font-semibold text-slate-900 uppercase text-xs">{ev.nombre}</div>
                        {/* Fechas (principal + secundarias) */}
                        <div className="flex flex-wrap gap-1" data-testid={`fechas-evento-${ev.id}`}>
                          {ev.funciones.map((f, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[10px] text-slate-700 font-normal"
                              title={f.label}
                            >
                              {formatFecha(f.fecha)}{f.hora ? ` ${String(f.hora).slice(0,5)}` : ''}
                            </span>
                          ))}
                        </div>
                        {/* Acción masiva por columna */}
                        <div className="flex items-center gap-1 pt-1">
                          <select
                            value={bulkAction[ev.id] || ''}
                            onChange={(e) => setBulkAction((prev) => ({ ...prev, [ev.id]: e.target.value }))}
                            data-testid={`bulk-select-${ev.id}`}
                            className="text-[11px] px-1.5 py-1 border border-slate-300 rounded bg-white font-normal"
                          >
                            <option value="">Acción...</option>
                            {ESTADOS.map((s) => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>
                          {bulkAction[ev.id] && selected.size > 0 && (
                            <button
                              onClick={() => aplicarBulk(ev.id)}
                              disabled={busy}
                              data-testid={`btn-aplicar-bulk-${ev.id}`}
                              className="text-[11px] px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded disabled:opacity-60"
                            >
                              Aplicar
                            </button>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {musicosFiltrados.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50" data-testid={`row-musico-${m.id}`}>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggleSelected(m.id)}
                        data-testid={`check-musico-${m.id}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900 sticky left-0 bg-white z-10">
                      {m.nombre} {m.apellidos}
                      <div className="text-[11px] text-slate-500">{m.email}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700 text-xs">{m.instrumento || '—'}</td>
                    {data.eventos.map((ev) => {
                      const key = `${m.id}_${ev.id}`;
                      const asig = data.asignaciones[key];
                      const estadoKey = asig?.estado || null;
                      const st = ESTADO_BY_KEY[estadoKey];
                      return (
                        <td
                          key={ev.id}
                          className="px-3 py-2 text-center border-l border-slate-100"
                          data-testid={`cell-${m.id}-${ev.id}`}
                        >
                          {st ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${st.color}`}>
                              {st.label}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeguimientoConvocatorias;
