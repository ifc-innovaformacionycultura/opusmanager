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

// Iter E2 — Helpers de cierre. Copia exacta de PlantillasDefinitivas.js.
const isSuperAdminUser = (user) => {
  if (!user) return false;
  const rol = user.rol || user.profile?.rol;
  if (rol === 'admin' || rol === 'director_general') return true;
  const email = (user.email || user.profile?.email || '').toLowerCase();
  return email === 'admin@convocatorias.com';
};
const fmtFechaCierre = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};
const plantillaConcluida = (ev) => (ev?.estado_cierre || 'abierto') === 'cerrado_plantilla';
const economicoCerrado = (ev) => (ev?.estado_cierre || 'abierto') === 'cerrado_economico';

const ESTADO_PAGO_COLORS = {
  pendiente: 'bg-slate-100 text-slate-700',
  pagado: 'bg-green-100 text-green-800',
  anulado: 'bg-red-100 text-red-800',
};

const AsistenciaPagos = () => {
  const { api, user } = useAuth();
  const isSuperAdmin = isSuperAdminUser(user);
  const [data, setData] = useState({ eventos: [], total_temporada: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openSet, setOpenSet] = useState(new Set());
  const [temporada, setTemporada] = useState('');
  const [temporadas, setTemporadas] = useState([]);
  const [busy, setBusy] = useState(false);
  // Iter E2 — modales y feedback
  const [cerrarEconModal, setCerrarEconModal] = useState(null);   // {ev}
  const [reabrirEconModal, setReabrirEconModal] = useState(null); // {ev}
  const [historialModal, setHistorialModal] = useState(null);     // {ev, loading, entries, error}
  const [econBusy, setEconBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

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

  // ============================================================
  // Iter E2 — Cerrar / Reabrir económico + Historial
  // ============================================================
  const cerrarEconomico = async (ev) => {
    try {
      setEconBusy(true);
      const r = await api.post(`/api/gestor/eventos/${ev.id}/cerrar-economico`);
      const generados = r.data?.recibos_generados || 0;
      showFeedback(
        'success',
        generados > 0
          ? `Económico de "${ev.nombre}" cerrado. ${generados} recibo${generados !== 1 ? 's' : ''} generado${generados !== 1 ? 's' : ''}.`
          : `Económico de "${ev.nombre}" cerrado correctamente.`,
      );
      setCerrarEconModal(null);
      await cargar(temporada);
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    } finally {
      setEconBusy(false);
    }
  };

  const reabrirEconomico = async (ev) => {
    try {
      setEconBusy(true);
      await api.post(`/api/gestor/eventos/${ev.id}/reabrir-economico`);
      showFeedback('success', `Económico de "${ev.nombre}" reabierto. Volverás a poder modificar pagos.`);
      setReabrirEconModal(null);
      await cargar(temporada);
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    } finally {
      setEconBusy(false);
    }
  };

  const abrirHistorial = async (ev) => {
    setHistorialModal({ ev, loading: true, entries: [], error: null });
    try {
      const r = await api.get(`/api/gestor/eventos/${ev.id}/historial-cierres`);
      setHistorialModal({ ev, loading: false, entries: r.data?.entries || [], error: null });
    } catch (err) {
      setHistorialModal({
        ev,
        loading: false,
        entries: [],
        error: err.response?.data?.detail || err.message,
      });
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
        const econCerrado = economicoCerrado(ev);
        const plantOk = plantillaConcluida(ev);
        return (
          <div key={ev.id} className="bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden" data-testid={`evento-econ-${ev.id}`}>
            <div
              className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => toggleAccordion(ev.id)}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-base">{ev.nombre}</span>
                {econCerrado && (
                  <span
                    data-testid={`badge-econ-cerrado-${ev.id}`}
                    title={ev.cerrado_economico_at
                      ? `Cerrado por ${ev.cerrado_economico_por_nombre || '—'} el ${fmtFechaCierre(ev.cerrado_economico_at)}`
                      : 'Económico cerrado'}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30"
                  >
                    💰 Económico cerrado
                  </span>
                )}
                <span className="text-xs text-slate-300 ml-3">{fmtFecha(ev.fecha_inicio)} · {ev.total_musicos} músicos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{fmtEuro(ev.totales.total)}</span>
                {ev.tiene_historial_cierre && (
                  <button
                    onClick={(e) => { e.stopPropagation(); abrirHistorial(ev); }}
                    data-testid={`btn-historial-econ-${ev.id}`}
                    className="px-2 py-0.5 bg-slate-600 hover:bg-slate-500 text-xs rounded border border-slate-400"
                    title="Ver historial de cierres y reaperturas"
                  >🕒 Historial</button>
                )}
                {!econCerrado && isSuperAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (plantOk) setCerrarEconModal({ ev }); }}
                    data-testid={`btn-cerrar-econ-${ev.id}`}
                    disabled={!plantOk || busy || econBusy}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-xs rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    title={plantOk ? 'Cerrar económicamente este evento' : 'Concluye primero la plantilla del evento'}
                  >💰 Cerrar económico</button>
                )}
                {econCerrado && isSuperAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setReabrirEconModal({ ev }); }}
                    data-testid={`btn-reabrir-econ-${ev.id}`}
                    disabled={busy || econBusy}
                    className="px-2 py-0.5 bg-amber-700 hover:bg-amber-600 text-xs rounded disabled:opacity-40"
                    title="Reabrir el económico (solo administradores)"
                  >🔓 Reabrir económico</button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); marcarPagosBulk(ev, 'pagado'); }}
                  disabled={busy || econCerrado}
                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid={`btn-bulk-pagado-${ev.id}`}
                  title={econCerrado ? 'Económico cerrado — pagos bloqueados' : 'Marcar todos los músicos confirmados como Pagado'}
                >✓ Marcar todos como Pagado</button>
                <button
                  onClick={(e) => { e.stopPropagation(); marcarPagosBulk(ev, 'pendiente'); }}
                  disabled={busy || econCerrado}
                  className="px-2 py-0.5 bg-slate-600 hover:bg-slate-700 text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid={`btn-bulk-pendiente-${ev.id}`}
                  title={econCerrado ? 'Económico cerrado — pagos bloqueados' : 'Revertir todos a Pendiente'}
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
                              disabled={busy || econCerrado}
                              data-testid={`btn-pago-${m.asignacion_id}`}
                              className={`px-2 py-0.5 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed ${ESTADO_PAGO_COLORS[m.estado_pago] || 'bg-slate-100 text-slate-700'}`}
                              title={econCerrado ? 'Económico cerrado — pagos bloqueados' : 'Click para alternar pagado/pendiente'}
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

      {/* Iter E2 — Feedback flotante */}
      {feedback && (
        <div
          data-testid="econ-feedback"
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border max-w-sm text-sm ${
            feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-800'
                                         : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <strong>{feedback.type === 'success' ? '✅ ' : '❌ '}</strong>{feedback.text}
        </div>
      )}

      {/* Iter E2 — Modal: Cerrar económico */}
      {cerrarEconModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-cerrar-econ">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">💰 Cerrar económico</h3>
            <p className="text-sm text-slate-700 mb-5 leading-relaxed">
              ¿Cerrar económicamente el evento <strong>{cerrarEconModal.ev.nombre}</strong>?
              Se generarán automáticamente los recibos pendientes y los pagos quedarán bloqueados.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCerrarEconModal(null)}
                disabled={econBusy}
                data-testid="btn-cancelar-cerrar-econ"
                className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => cerrarEconomico(cerrarEconModal.ev)}
                disabled={econBusy}
                data-testid="btn-confirmar-cerrar-econ"
                className="px-3 py-1.5 text-sm font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
              >
                {econBusy ? 'Cerrando…' : '💰 Sí, cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Iter E2 — Modal: Reabrir económico (solo super admins) */}
      {reabrirEconModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-reabrir-econ">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">🔓 Reabrir económico</h3>
            <p className="text-sm text-slate-700 mb-5 leading-relaxed">
              ¿Reabrir el económico del evento <strong>{reabrirEconModal.ev.nombre}</strong>?
              Volverás al estado de plantilla concluida y podrás modificar pagos.
              Si existen recibos emitidos, se regenerarán al volver a cerrar.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReabrirEconModal(null)}
                disabled={econBusy}
                data-testid="btn-cancelar-reabrir-econ"
                className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => reabrirEconomico(reabrirEconModal.ev)}
                disabled={econBusy}
                data-testid="btn-confirmar-reabrir-econ"
                className="px-3 py-1.5 text-sm font-semibold rounded bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50"
              >
                {econBusy ? 'Reabriendo…' : '🔓 Sí, reabrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Iter E2 — Modal: Historial de cierres/reaperturas */}
      {historialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-historial-econ">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-5 border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">🕒 Historial de cierres</h3>
                <p className="text-xs text-slate-500 mt-0.5">{historialModal.ev.nombre}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistorialModal(null)}
                data-testid="btn-cerrar-historial-econ"
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 -mx-5 px-5">
              {historialModal.loading && (
                <p className="text-sm text-slate-500 py-4 text-center" data-testid="historial-econ-loading">Cargando historial…</p>
              )}
              {!historialModal.loading && historialModal.error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3" data-testid="historial-econ-error">
                  {historialModal.error}
                </p>
              )}
              {!historialModal.loading && !historialModal.error && historialModal.entries.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center" data-testid="historial-econ-empty">
                  Sin actividad de cierre/reapertura registrada.
                </p>
              )}
              {!historialModal.loading && !historialModal.error && historialModal.entries.length > 0 && (
                <ol className="relative border-l-2 border-slate-200 ml-2 pl-5 space-y-4 py-1" data-testid="historial-econ-timeline">
                  {historialModal.entries.map((entry) => {
                    const meta = (() => {
                      switch (entry.tipo) {
                        case 'evento_concluido':   return { icon: '🏁', label: 'Plantilla concluida', color: 'bg-emerald-500', text: 'text-emerald-700' };
                        case 'evento_reabierto':   return { icon: '🔓', label: 'Plantilla reabierta', color: 'bg-amber-500', text: 'text-amber-700' };
                        case 'economico_cerrado':  return { icon: '💰', label: 'Económico cerrado', color: 'bg-amber-600', text: 'text-amber-800' };
                        case 'economico_reabierto':return { icon: '🔓', label: 'Económico reabierto', color: 'bg-amber-700', text: 'text-amber-900' };
                        default:                   return { icon: '•', label: entry.tipo, color: 'bg-slate-500', text: 'text-slate-700' };
                      }
                    })();
                    return (
                      <li key={entry.id} className="relative" data-testid={`historial-econ-entry-${entry.id}`}>
                        <span className={`absolute -left-[1.7rem] top-0.5 flex items-center justify-center w-6 h-6 rounded-full text-xs ring-4 ring-white text-white ${meta.color}`} aria-hidden>
                          {meta.icon}
                        </span>
                        <div className="text-sm">
                          <div className={`font-semibold ${meta.text}`}>{meta.label}</div>
                          <div className="text-slate-700">por <strong>{entry.usuario_nombre || '—'}</strong></div>
                          <div className="text-xs text-slate-500 mt-0.5">{fmtFechaCierre(entry.created_at)}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setHistorialModal(null)}
                data-testid="btn-cerrar-historial-econ-footer"
                className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AsistenciaPagos;
