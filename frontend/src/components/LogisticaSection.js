// Sección "Transportes y Alojamientos" para ConfiguracionEventos.js
// Carga, edita y guarda evento_logistica + muestra confirmaciones de músicos.
import React, { useState, useEffect, useCallback } from 'react';

const TIPOS_TRANSPORTE = [
  { value: 'transporte_ida',    label: 'Ida' },
  { value: 'transporte_vuelta', label: 'Vuelta' },
];

const newTransporte = (tipo = 'transporte_ida') => ({
  _local: true,  // marca cliente para evitar enviar id null
  tipo,
  orden: 1,
  fecha: '',
  hora_salida: '', lugar_salida: '',
  hora_llegada: '', lugar_llegada: '',
  recogida_1_lugar: '', recogida_1_hora: '',
  recogida_2_lugar: '', recogida_2_hora: '',
  recogida_3_lugar: '', recogida_3_hora: '',
  fecha_limite_confirmacion: '',
  notas: '',
});

const newAlojamiento = () => ({
  _local: true,
  tipo: 'alojamiento',
  orden: 1,
  hotel_nombre: '',
  hotel_direccion: '',
  fecha_checkin: '',
  fecha_checkout: '',
  fecha_limite_confirmacion: '',
  notas: '',
});

const ConfirmacionesPanel = ({ logisticaId, api }) => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (!logisticaId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/gestor/logistica/${logisticaId}/confirmaciones`);
      setData(r.data);
    } catch (e) {
      setData({ error: e.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  }, [logisticaId, api]);

  useEffect(() => { if (open && !data) cargar(); }, [open, data, cargar]);

  const fmtUser = (u) => `${u.apellidos || ''}, ${u.nombre || ''} (${u.instrumento || '—'})`;

  return (
    <div className="mt-2 border-t border-slate-200 pt-2">
      <button type="button" onClick={() => setOpen(o => !o)}
              className="text-xs text-indigo-700 hover:underline"
              data-testid={`btn-toggle-confs-${logisticaId}`}>
        {open ? '▾' : '▸'} Confirmaciones de músicos
      </button>
      {open && (
        <div className="mt-2 text-xs">
          {loading && <div className="text-slate-500">Cargando…</div>}
          {data?.error && <div className="text-red-600">{data.error}</div>}
          {data && !data.error && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="border border-emerald-200 bg-emerald-50/50 rounded p-2">
                <div className="font-semibold text-emerald-700">✅ Confirmados ({data.confirmados.length})</div>
                <ul className="mt-1 space-y-0.5">
                  {data.confirmados.map(u => <li key={u.id}>{fmtUser(u)}</li>)}
                  {data.confirmados.length === 0 && <li className="text-slate-400 italic">—</li>}
                </ul>
              </div>
              <div className="border border-red-200 bg-red-50/50 rounded p-2">
                <div className="font-semibold text-red-700">❌ Rechazados ({data.rechazados.length})</div>
                <ul className="mt-1 space-y-0.5">
                  {data.rechazados.map(u => <li key={u.id}>{fmtUser(u)}</li>)}
                  {data.rechazados.length === 0 && <li className="text-slate-400 italic">—</li>}
                </ul>
              </div>
              <div className="border border-slate-200 bg-slate-50 rounded p-2">
                <div className="font-semibold text-slate-600">⏳ Sin respuesta ({data.sin_respuesta.length})</div>
                <ul className="mt-1 space-y-0.5">
                  {data.sin_respuesta.map(u => <li key={u.id}>{fmtUser(u)}</li>)}
                  {data.sin_respuesta.length === 0 && <li className="text-slate-400 italic">—</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LogisticaSection = ({ eventoId, api }) => {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState([]);
  const [eliminarIds, setEliminarIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const cargar = useCallback(async () => {
    if (!eventoId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/gestor/eventos/${eventoId}/logistica`);
      const list = r.data?.logistica || [];
      setItems(list);
      setEliminarIds([]);
      setEnabled(list.length > 0);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  }, [eventoId, api]);

  useEffect(() => { cargar(); }, [cargar]);

  const transportes  = items.filter(i => i.tipo !== 'alojamiento');
  const alojamientos = items.filter(i => i.tipo === 'alojamiento');

  const updateField = (idx, k, v) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  };

  const removeItem = (idx) => {
    const it = items[idx];
    if (it.id) setEliminarIds(prev => [...prev, it.id]);
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addTransporte = () => setItems(prev => [...prev, newTransporte()]);
  const addAlojamiento = () => setItems(prev => [...prev, newAlojamiento()]);

  const guardar = async () => {
    if (!eventoId) return;
    setSaving(true); setMsg(null);
    try {
      const payload = {
        items: items.map(it => {
          const x = { ...it };
          delete x._local;
          if (!x.id) delete x.id;
          return x;
        }),
        eliminar_ids: eliminarIds,
      };
      const r = await api.put(`/api/gestor/eventos/${eventoId}/logistica`, payload);
      setMsg({ type: 'success', text: `✅ Logística guardada · +${r.data.creados} / ±${r.data.actualizados} / −${r.data.borrados}` });
      setTimeout(() => setMsg(null), 3500);
      await cargar();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setSaving(false); }
  };

  // Toggle: si lo desactiva con items, no borramos nada — sólo ocultamos UI hasta que vuelva a activarlo
  if (!enabled) {
    return (
      <div className="mt-4 border-t pt-4" data-testid="logistica-section">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={false} onChange={() => setEnabled(true)}
                 data-testid="toggle-logistica" className="w-4 h-4 accent-indigo-600" />
          <span className="font-medium text-slate-700">Este evento requiere transporte/alojamiento</span>
          <span className="text-xs text-slate-500">(activa para configurar desplazamientos y hoteles)</span>
        </label>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t pt-4" data-testid="logistica-section">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={() => setEnabled(false)}
                 data-testid="toggle-logistica" className="w-4 h-4 accent-indigo-600" />
          <span className="font-semibold text-slate-800">🚌 Transportes y Alojamientos</span>
        </label>
        <div className="flex items-center gap-2">
          {msg && (
            <span className={`text-xs px-2 py-1 rounded ${msg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}
                  data-testid="logistica-msg">{msg.text}</span>
          )}
          <button type="button" onClick={guardar} disabled={saving}
                  data-testid="btn-save-logistica"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar logística'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Cargando logística…</div>
      ) : (
        <div className="space-y-4">
          {/* Transportes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-slate-800 text-sm">🚌 Transportes</h4>
              <button type="button" onClick={addTransporte}
                      data-testid="btn-add-transporte"
                      className="px-2 py-1 text-xs border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded">
                + Añadir desplazamiento
              </button>
            </div>
            {transportes.length === 0 && (
              <p className="text-xs text-slate-500 italic">Sin desplazamientos configurados.</p>
            )}
            <div className="space-y-3">
              {items.map((it, idx) => it.tipo === 'alojamiento' ? null : (
                <div key={it.id || `new-t-${idx}`} className="border border-slate-200 rounded p-3 bg-slate-50/50" data-testid={`logistica-transporte-${idx}`}>
                  <div className="flex items-center justify-between mb-2">
                    <select value={it.tipo} onChange={(e) => updateField(idx, 'tipo', e.target.value)}
                            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white">
                      {TIPOS_TRANSPORTE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button type="button" onClick={() => removeItem(idx)}
                            data-testid={`btn-del-transporte-${idx}`}
                            className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded">
                      Eliminar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Fecha</span>
                      <input type="date" value={it.fecha || ''} onChange={(e) => updateField(idx, 'fecha', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Hora salida</span>
                      <input type="time" value={it.hora_salida || ''} onChange={(e) => updateField(idx, 'hora_salida', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Lugar salida</span>
                      <input type="text" value={it.lugar_salida || ''} onChange={(e) => updateField(idx, 'lugar_salida', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" placeholder="Madrid, P.º del Prado" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Hora llegada</span>
                      <input type="time" value={it.hora_llegada || ''} onChange={(e) => updateField(idx, 'hora_llegada', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-0.5 md:col-span-2">
                      <span className="text-slate-600">Lugar llegada</span>
                      <input type="text" value={it.lugar_llegada || ''} onChange={(e) => updateField(idx, 'lugar_llegada', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" placeholder="Auditorio Bilbao" />
                    </label>
                  </div>

                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">Puntos de recogida (opcionales)</div>
                    {[1,2,3].map(n => (
                      <div key={n} className="grid grid-cols-3 gap-2 mb-1">
                        <input type="text" value={it[`recogida_${n}_lugar`] || ''} onChange={(e) => updateField(idx, `recogida_${n}_lugar`, e.target.value)}
                               className="border border-slate-300 rounded px-2 py-1 text-xs col-span-2" placeholder={`Punto ${n}: lugar`} />
                        <input type="time" value={it[`recogida_${n}_hora`] || ''} onChange={(e) => updateField(idx, `recogida_${n}_hora`, e.target.value)}
                               className="border border-slate-300 rounded px-2 py-1 text-xs" />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Fecha límite confirmación músicos</span>
                      <input type="date" value={it.fecha_limite_confirmacion || ''}
                             onChange={(e) => updateField(idx, 'fecha_limite_confirmacion', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Notas</span>
                      <textarea rows={2} value={it.notas || ''} onChange={(e) => updateField(idx, 'notas', e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                  </div>

                  {it.id && <ConfirmacionesPanel logisticaId={it.id} api={api} />}
                </div>
              ))}
            </div>
          </div>

          {/* Alojamientos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-slate-800 text-sm">🏨 Alojamientos</h4>
              <button type="button" onClick={addAlojamiento}
                      data-testid="btn-add-alojamiento"
                      className="px-2 py-1 text-xs border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded">
                + Añadir alojamiento
              </button>
            </div>
            {alojamientos.length === 0 && (
              <p className="text-xs text-slate-500 italic">Sin alojamientos configurados.</p>
            )}
            <div className="space-y-3">
              {items.map((it, idx) => it.tipo !== 'alojamiento' ? null : (
                <div key={it.id || `new-a-${idx}`} className="border border-slate-200 rounded p-3 bg-slate-50/50" data-testid={`logistica-alojamiento-${idx}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">🏨 Alojamiento</span>
                    <button type="button" onClick={() => removeItem(idx)}
                            data-testid={`btn-del-alojamiento-${idx}`}
                            className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded">
                      Eliminar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Hotel / Alojamiento</span>
                      <input type="text" value={it.hotel_nombre || ''} onChange={(e) => updateField(idx, 'hotel_nombre', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" placeholder="Hotel Carlton" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Dirección</span>
                      <input type="text" value={it.hotel_direccion || ''} onChange={(e) => updateField(idx, 'hotel_direccion', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" placeholder="Plaza Federico Moyúa, 2" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Check-in</span>
                      <input type="date" value={it.fecha_checkin || ''} onChange={(e) => updateField(idx, 'fecha_checkin', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Check-out</span>
                      <input type="date" value={it.fecha_checkout || ''} onChange={(e) => updateField(idx, 'fecha_checkout', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Fecha límite confirmación músicos</span>
                      <input type="date" value={it.fecha_limite_confirmacion || ''}
                             onChange={(e) => updateField(idx, 'fecha_limite_confirmacion', e.target.value)}
                             className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-600">Notas</span>
                      <textarea rows={2} value={it.notas || ''} onChange={(e) => updateField(idx, 'notas', e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1" />
                    </label>
                  </div>
                  {it.id && <ConfirmacionesPanel logisticaId={it.id} api={api} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogisticaSection;
