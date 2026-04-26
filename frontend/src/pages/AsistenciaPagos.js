// Gestión económica — vista informativa agrupada por evento/sección.
// Muestra datos de contabilidad listos para pagar: IBAN, SWIFT, cachés,
// extras, transporte, alojamiento, otros, total a percibir.
// Datos desde GET /api/gestor/gestion-economica.
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const fmtEuro = (n) => `${(Number(n) || 0).toFixed(2)} €`;
const fmtFecha = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

const ESTADO_PAGO_COLORS = {
  pendiente: 'bg-slate-100 text-slate-700',
  pagado: 'bg-green-100 text-green-800',
  anulado: 'bg-red-100 text-red-800',
};

const AsistenciaPagos = () => {
  const { api } = useAuth();
  const [data, setData] = useState({ eventos: [], total_temporada: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openSet, setOpenSet] = useState(new Set());
  const [temporada, setTemporada] = useState('');
  const [temporadas, setTemporadas] = useState([]);
  const [busy, setBusy] = useState(false);

  const cargar = async (tempSel = temporada) => {
    try {
      setLoading(true); setError(null);
      const qs = tempSel ? `?temporada=${encodeURIComponent(tempSel)}` : '';
      const r = await api.get(`/api/gestor/gestion-economica${qs}`);
      const d = r.data || { eventos: [], total_temporada: 0 };
      setData(d);
      setOpenSet(new Set(d.eventos.map(e => e.id))); // todos abiertos por defecto
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    // cargar lista de temporadas
    (async () => {
      try {
        const r = await api.get('/api/gestor/eventos');
        const t = Array.from(new Set((r.data?.eventos || []).map(e => e.temporada).filter(Boolean)));
        setTemporadas(t);
        if (t.length && !temporada) {
          setTemporada(t[0]);
          cargar(t[0]);
        } else {
          cargar();
        }
      } catch (err) {
        cargar();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAccordion = (evId) => {
    setOpenSet(prev => {
      const n = new Set(prev);
      if (n.has(evId)) n.delete(evId); else n.add(evId);
      return n;
    });
  };

  const marcarPago = async (asignacionId, nuevoEstado) => {
    try {
      setBusy(true);
      await api.put(`/api/gestor/asignaciones/${asignacionId}/pago`, { estado_pago: nuevoEstado });
      await cargar(temporada);
    } catch (err) {
      alert('Error marcando pago: ' + (err.response?.data?.detail || err.message));
    } finally { setBusy(false); }
  };

  // TAREA 2 — Pagos masivos en cabecera de evento
  const marcarPagosBulk = async (ev, nuevoEstado) => {
    const total = (ev.secciones || []).reduce((acc, s) => acc + (s.musicos?.length || 0), 0);
    if (total === 0) return;
    const verbo = nuevoEstado === 'pagado' ? 'Pagado' : 'Pendiente';
    const ok = window.confirm(`¿Marcar ${total} músicos del evento "${ev.nombre}" como ${verbo}?`);
    if (!ok) return;
    try {
      setBusy(true);
      await api.post(`/api/gestor/eventos/${ev.id}/pagos-bulk`, { estado_pago: nuevoEstado });
      await cargar(temporada);
    } catch (err) {
      alert('Error en pago masivo: ' + (err.response?.data?.detail || err.message));
    } finally { setBusy(false); }
  };

  const exportXlsx = async (eventoId = null) => {
    try {
      const qs = new URLSearchParams();
      if (eventoId) qs.set('evento_id', eventoId);
      if (temporada) qs.set('temporada', temporada);
      const r = await api.get(`/api/gestor/gestion-economica/export?${qs}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gestion_economica_${eventoId || temporada || 'todos'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al exportar: ' + err.message);
    }
  };

  const exportSepaEvento = async (eventoId) => {
    try {
      const qs = new URLSearchParams();
      qs.set('evento_id', eventoId);
      if (temporada) qs.set('temporada', temporada);
      const r = await api.get(`/api/gestor/analisis/sepa-xml?${qs}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sepa_evento_${eventoId.slice(0, 8)}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error SEPA: ' + err.message);
    }
  };

  const totalTemporada = data.total_temporada || 0;

  if (loading) {
    return <div className="p-6 text-slate-500">Cargando gestión económica...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-700">⚠️ {error}</div>;
  }

  return (
    <div className="p-6" data-testid="gestion-economica">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Gestión económica</h1>
          <p className="text-sm text-slate-600 mt-1">Contabilidad por evento y sección. Listo para pagos bancarios.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={temporada}
            onChange={(e) => { setTemporada(e.target.value); cargar(e.target.value); }}
            data-testid="temp-select"
            className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
          >
            <option value="">Todas las temporadas</option>
            {temporadas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={() => exportXlsx(null)}
            data-testid="btn-export-all"
            className="px-3 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700"
          >📊 Exportar todo a Excel</button>
        </div>
      </header>

      <div className="bg-blue-900 text-white rounded-lg p-4 mb-4 flex items-center justify-between">
        <span className="text-sm uppercase tracking-wide">TOTAL TEMPORADA</span>
        <span className="text-2xl font-bold" data-testid="total-temporada">{fmtEuro(totalTemporada)}</span>
      </div>

      {data.eventos.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-slate-500">
          No hay asignaciones confirmadas.
        </div>
      )}

      {data.eventos.map(ev => {
        const open = openSet.has(ev.id);
        return (
          <div key={ev.id} className="bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden" data-testid={`evento-econ-${ev.id}`}>
            <div
              className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => toggleAccordion(ev.id)}
            >
              <div>
                <span className="font-semibold text-base">{ev.nombre}</span>
                <span className="text-xs text-slate-300 ml-3">{fmtFecha(ev.fecha_inicio)} · {ev.total_musicos} músicos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{fmtEuro(ev.totales.total)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); marcarPagosBulk(ev, 'pagado'); }}
                  disabled={busy}
                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-xs rounded disabled:opacity-50"
                  data-testid={`btn-bulk-pagado-${ev.id}`}
                  title="Marcar todos los músicos confirmados como Pagado"
                >✓ Marcar todos como Pagado</button>
                <button
                  onClick={(e) => { e.stopPropagation(); marcarPagosBulk(ev, 'pendiente'); }}
                  disabled={busy}
                  className="px-2 py-0.5 bg-slate-600 hover:bg-slate-700 text-xs rounded disabled:opacity-50"
                  data-testid={`btn-bulk-pendiente-${ev.id}`}
                  title="Revertir todos a Pendiente"
                >↩ Marcar todos como Pendiente</button>
                <button
                  onClick={(e) => { e.stopPropagation(); exportXlsx(ev.id); }}
                  className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-xs rounded"
                  data-testid={`btn-export-ev-${ev.id}`}
                >📥 Excel</button>
                <button
                  onClick={(e) => { e.stopPropagation(); exportSepaEvento(ev.id); }}
                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-xs rounded"
                  data-testid={`btn-sepa-ev-${ev.id}`}
                >🏦 SEPA XML</button>
                <span className="text-xs">{open ? '▼' : '▶'}</span>
              </div>
            </div>
            {open && ev.secciones.map(sec => (
              <div key={sec.key}>
                <div className="bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                  {sec.label} <span className="text-slate-500 font-normal ml-2">({sec.count} músicos · {fmtEuro(sec.totales.total)})</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 text-slate-600 text-[11px]">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium">Apellidos, Nombre</th>
                        <th className="px-2 py-2 text-left font-medium">Instrumento · Esp.</th>
                        <th className="px-2 py-2 text-left font-medium">Nivel</th>
                        <th className="px-2 py-2 text-left font-medium">IBAN</th>
                        <th className="px-2 py-2 text-left font-medium">SWIFT</th>
                        <th className="px-2 py-2 text-center font-medium">%Disp</th>
                        <th className="px-2 py-2 text-center font-medium">%Real</th>
                        {(() => {
                          const counters = { ensayo: 0, concierto: 0, funcion: 0 };
                          return (ev.ensayos || []).map(e => {
                            const tipo = (e.tipo || 'ensayo').toLowerCase();
                            counters[tipo] = (counters[tipo] || 0) + 1;
                            const abbr = tipo === 'concierto' ? 'Conc' : tipo === 'funcion' ? 'Func' : 'Ens';
                            const label = `${abbr}.${counters[tipo]}`;
                            return (
                              <th key={e.id} className="px-1 py-2 text-center font-normal text-[10px] text-slate-500 bg-slate-100 min-w-[48px]" title={`${label} ${e.fecha}`}>
                                <div className="font-semibold text-slate-700">{label}</div>
                                <div>{e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}</div>
                              </th>
                            );
                          });
                        })()}
                        <th className="px-2 py-2 text-right font-medium">Caché Previsto</th>
                        <th className="px-2 py-2 text-right font-medium">Caché Real</th>
                        <th className="px-2 py-2 text-right font-medium">Extras</th>
                        <th className="px-2 py-2 text-right font-medium">Transp.</th>
                        <th className="px-2 py-2 text-right font-medium">Aloj.</th>
                        <th className="px-2 py-2 text-right font-medium">Otros</th>
                        <th className="px-2 py-2 text-right font-bold bg-amber-100 text-amber-900">TOTAL</th>
                        <th className="px-2 py-2 text-center font-medium">Estado</th>
                        <th className="px-2 py-2 text-center font-medium">Titulaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sec.musicos.map(m => (
                        <tr key={m.asignacion_id} className="hover:bg-slate-50" data-testid={`row-pago-${m.asignacion_id}`}>
                          <td className="px-2 py-1.5 font-medium text-slate-900 whitespace-nowrap">{m.apellidos}, {m.nombre}</td>
                          <td className="px-2 py-1.5 text-slate-700">{m.instrumento}{m.especialidad ? ` · ${m.especialidad}` : ''}</td>
                          <td className="px-2 py-1.5 text-slate-600">{m.nivel_estudios || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-[11px]" data-testid={`iban-${m.asignacion_id}`}>{m.iban || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-[11px]">{m.swift || '—'}</td>
                          <td className="px-2 py-1.5 text-center">{m.porcentaje_disponibilidad}%</td>
                          <td className="px-2 py-1.5 text-center font-semibold">{m.porcentaje_asistencia_real}%</td>
                          {(ev.ensayos || []).map(e => {
                            const asis = (m.asistencia || []).find(x => x.ensayo_id === e.id);
                            const v = asis?.asistencia_real;
                            return (
                              <td key={e.id} className="px-1 py-1.5 text-center text-[11px] bg-slate-50">
                                {v === null || v === undefined ? '—' : `${v}%`}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-right">
                            <span className={m.cache_fuente === 'asignacion' ? 'text-orange-600 font-semibold' : m.cache_fuente === 'sin_datos' ? 'text-slate-400' : ''} title={`Fuente: ${m.cache_fuente || '-'}`}>{fmtEuro(m.cache_previsto)}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right">{fmtEuro(m.cache_real)}</td>
                          <td className="px-2 py-1.5 text-right">{fmtEuro(m.cache_extra)}</td>
                          <td className="px-2 py-1.5 text-right">{fmtEuro(m.transporte_importe)}</td>
                          <td className="px-2 py-1.5 text-right">{fmtEuro(m.alojamiento_importe)}</td>
                          <td className="px-2 py-1.5 text-right">{fmtEuro(m.otros_importe)}</td>
                          <td className="px-2 py-1.5 text-right font-bold bg-amber-50">{fmtEuro(m.total)}</td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => marcarPago(m.asignacion_id, m.estado_pago === 'pagado' ? 'pendiente' : 'pagado')}
                              disabled={busy}
                              data-testid={`btn-pago-${m.asignacion_id}`}
                              className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_PAGO_COLORS[m.estado_pago] || 'bg-slate-100 text-slate-700'}`}
                              title="Click para alternar pagado/pendiente"
                            >
                              {m.estado_pago === 'pagado' ? '✓ Pagado' : m.estado_pago === 'anulado' ? '✗ Anulado' : 'Pendiente'}
                            </button>
                          </td>
                          <td className="px-2 py-1.5 text-[10px] text-slate-500 max-w-[240px]">
                            {(m.titulaciones || []).length === 0 ? '—' : (m.titulaciones || []).map((t, i) => (
                              <div key={i} className="flex items-center gap-1 mb-0.5" title={`${t.titulo}${t.institucion ? ' · ' + t.institucion : ''}${t.anio ? ' · ' + t.anio : ''}`}>
                                <span className="truncate">
                                  {t.titulo}{t.institucion ? ` · ${t.institucion}` : ''}{t.anio ? ` · ${t.anio}` : ''}
                                </span>
                                {t.archivo_url && (
                                  <a href={t.archivo_url} target="_blank" rel="noreferrer"
                                     className="shrink-0 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded"
                                     onClick={(e) => e.stopPropagation()}
                                     data-testid={`titulo-link-${m.asignacion_id}-${i}`}>
                                    📄 Ver
                                  </a>
                                )}
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-200 font-semibold">
                        <td colSpan={7 + (ev.ensayos || []).length} className="px-2 py-1.5 text-right uppercase text-[11px]">Subtotal {sec.label}</td>
                        <td className="px-2 py-1.5 text-right">{fmtEuro(sec.totales.cache_previsto)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtEuro(sec.totales.cache_real)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtEuro(sec.totales.extras)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtEuro(sec.totales.transporte)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtEuro(sec.totales.alojamiento)}</td>
                        <td className="px-2 py-1.5 text-right">{fmtEuro(sec.totales.otros)}</td>
                        <td className="px-2 py-1.5 text-right bg-amber-100">{fmtEuro(sec.totales.total)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {open && (
              <div className="bg-blue-800 text-white px-4 py-2 flex items-center justify-between">
                <span className="text-sm uppercase">Total evento {ev.nombre}</span>
                <span className="text-lg font-bold">{fmtEuro(ev.totales.total)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AsistenciaPagos;
