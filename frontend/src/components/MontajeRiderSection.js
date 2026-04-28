// Sección Montaje y Rider Técnico para ConfiguracionEventos.
// Contiene: selector de espacio + transporte material + tabla de montaje
// del evento + montaje específico por ensayo (toggle).
import React, { useCallback, useEffect, useState } from 'react';

const ORIGENES = ['propio', 'alquiler', 'prestamo', 'externo'];

const fieldCls = "px-2 py-1 border border-slate-300 rounded text-sm w-full";

const MontajeRiderSection = ({ evento, api, onEventChange }) => {
  const [espacios, setEspacios] = useState([]);
  const [transporte, setTransporte] = useState(null);
  const [trSaving, setTrSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [eliminarIds, setEliminarIds] = useState([]);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [ensayoActivo, setEnsayoActivo] = useState(null);  // null = montaje del evento
  const [ensayos, setEnsayos] = useState([]);

  // Carga de espacios + transporte + materiales + ensayos
  useEffect(() => {
    (async () => {
      try {
        const e = await api.get('/api/gestor/espacios');
        setEspacios(e.data?.espacios || []);
      } catch { /* noop */ }
      try {
        const t = await api.get(`/api/gestor/transporte-material/${evento.id}`);
        setTransporte(t.data?.transporte || {});
      } catch { setTransporte({}); }
      try {
        const m = await api.get('/api/gestor/inventario');
        setMateriales(m.data?.material || []);
      } catch { /* noop */ }
      try {
        const en = await api.get(`/api/gestor/eventos/${evento.id}/ensayos`);
        setEnsayos(en.data?.ensayos || en.data || []);
      } catch { setEnsayos([]); }
    })();
  }, [api, evento.id]);

  const cargarMontaje = useCallback(async () => {
    try {
      const url = ensayoActivo
        ? `/api/gestor/montaje/${evento.id}/ensayo/${ensayoActivo}`
        : `/api/gestor/montaje/${evento.id}`;
      const r = await api.get(url);
      setItems(r.data?.items || []);
      setEliminarIds([]);
    } catch { setItems([]); }
  }, [api, evento.id, ensayoActivo]);
  useEffect(() => { cargarMontaje(); }, [cargarMontaje]);

  const generar = async () => {
    if (!window.confirm('Sobrescribirá el montaje actual del evento. ¿Continuar?')) return;
    setGenerando(true); setMsg(null);
    try {
      const r = await api.post(`/api/gestor/montaje/${evento.id}/generar`);
      const stats = r.data?.stats || {};
      setMsg({ type: 'success', text: `✅ ${r.data.generados} items generados (sillas: ${stats.sillas || 0}, atriles: ${stats.atriles || 0}).` });
      setEnsayoActivo(null);
      await cargarMontaje();
      setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setGenerando(false); }
  };

  const guardar = async () => {
    setGuardando(true); setMsg(null);
    try {
      const payload = { items: items.map(i => ({ ...i, _local: undefined })), eliminar_ids: eliminarIds };
      if (ensayoActivo) payload.ensayo_id = ensayoActivo;
      const r = await api.put(`/api/gestor/montaje/${evento.id}`, payload);
      setMsg({ type: 'success', text: `✅ Guardado · +${r.data.creados}/±${r.data.actualizados}/−${r.data.borrados}` });
      await cargarMontaje();
      setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setGuardando(false); }
  };

  const updateItem = (idx, k, v) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  const addRow = () => setItems(prev => [...prev, { _local: true, evento_id: evento.id, ensayo_id: ensayoActivo, cantidad_necesaria: 1, origen: 'propio' }]);
  const removeRow = (idx) => {
    const it = items[idx];
    if (it.id) setEliminarIds(prev => [...prev, it.id]);
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const espacioSel = espacios.find(e => e.id === evento.espacio_id);
  const matMap = Object.fromEntries(materiales.map(m => [m.id, m]));

  // Transporte material handlers
  const trSet = (k, v) => setTransporte(t => ({ ...(t || {}), [k]: v }));
  const guardarTransporte = async () => {
    setTrSaving(true);
    try {
      await api.put(`/api/gestor/transporte-material/${evento.id}`, transporte || {});
      setMsg({ type: 'success', text: '✅ Transporte de material guardado' });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setTrSaving(false); }
  };

  return (
    <div className="space-y-5" data-testid="montaje-rider-section">
      {msg && (
        <div className={`px-3 py-2 rounded text-sm ${msg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* 3A — Selector de espacio */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h4 className="font-semibold text-sm text-slate-800 mb-2">🏛️ Espacio / Sala</h4>
        <select value={evento.espacio_id || ''}
                onChange={(e) => onEventChange({ espacio_id: e.target.value || null })}
                data-testid="select-espacio"
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-md w-full max-w-md">
          <option value="">— Selecciona espacio —</option>
          {espacios.map(es => <option key={es.id} value={es.id}>{es.nombre} ({es.tipo === 'sede_propia' ? 'sede' : 'externo'}, aforo {es.aforo_orquesta || '?'})</option>)}
        </select>
        {espacioSel && (
          <div className="mt-2 text-xs text-slate-600 flex flex-wrap gap-3">
            <span>👥 Aforo: <strong>{espacioSel.aforo_orquesta || '—'}</strong></span>
            {espacioSel.tiene_piano_cola && <span>🎹 Piano de cola</span>}
            {espacioSel.tiene_audio && <span>🔊 Equipo de audio</span>}
            {espacioSel.tiene_focos && <span>💡 Focos</span>}
          </div>
        )}
      </div>

      {/* 3B — Transporte de material */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h4 className="font-semibold text-sm text-slate-800 mb-2">🚛 Transporte de material</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Empresa</span><input value={transporte?.empresa || ''} onChange={(e) => trSet('empresa', e.target.value)} className={fieldCls} data-testid="tr-empresa" /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Contacto</span><input value={transporte?.contacto_empresa || ''} onChange={(e) => trSet('contacto_empresa', e.target.value)} className={fieldCls} /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Teléfono</span><input value={transporte?.telefono_empresa || ''} onChange={(e) => trSet('telefono_empresa', e.target.value)} className={fieldCls} /></label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs mt-2">
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Carga · fecha</span><input type="date" value={transporte?.fecha_carga || ''} onChange={(e) => trSet('fecha_carga', e.target.value)} className={fieldCls} /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Carga · hora</span><input type="time" value={transporte?.hora_carga || ''} onChange={(e) => trSet('hora_carga', e.target.value)} className={fieldCls} /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Carga · dirección</span><input value={transporte?.direccion_carga || ''} onChange={(e) => trSet('direccion_carga', e.target.value)} className={fieldCls} /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Descarga · fecha</span><input type="date" value={transporte?.fecha_descarga || ''} onChange={(e) => trSet('fecha_descarga', e.target.value)} className={fieldCls} /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Descarga · hora</span><input type="time" value={transporte?.hora_descarga || ''} onChange={(e) => trSet('hora_descarga', e.target.value)} className={fieldCls} /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Descarga · dirección</span><input value={transporte?.direccion_descarga || ''} onChange={(e) => trSet('direccion_descarga', e.target.value)} className={fieldCls} /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Devolución · fecha</span><input type="date" value={transporte?.fecha_devolucion || ''} onChange={(e) => trSet('fecha_devolucion', e.target.value)} className={fieldCls} /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Devolución · hora</span><input type="time" value={transporte?.hora_devolucion || ''} onChange={(e) => trSet('hora_devolucion', e.target.value)} className={fieldCls} /></label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Presupuesto €</span><input type="number" step="0.01" value={transporte?.presupuesto_euros || ''} onChange={(e) => trSet('presupuesto_euros', parseFloat(e.target.value) || null)} className={fieldCls} /></label>
        </div>
        {/* Paradas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs mt-2">
          {[1, 2, 3].map(n => (
            <div key={n} className="border border-dashed border-slate-200 rounded p-2">
              <div className="text-[10px] text-slate-500 font-semibold mb-1">Parada {n}</div>
              <input value={transporte?.[`parada_${n}_direccion`] || ''} onChange={(e) => trSet(`parada_${n}_direccion`, e.target.value)}
                     placeholder="Dirección" className={`${fieldCls} mb-1`} />
              <input type="time" value={transporte?.[`parada_${n}_hora`] || ''} onChange={(e) => trSet(`parada_${n}_hora`, e.target.value)} className={fieldCls} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs">
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Estado</span>
            <select value={transporte?.estado || 'pendiente'} onChange={(e) => trSet('estado', e.target.value)} className={fieldCls}>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5"><span className="text-slate-600">Notas</span>
            <textarea rows={2} value={transporte?.notas || ''} onChange={(e) => trSet('notas', e.target.value)} className={fieldCls} />
          </label>
        </div>
        <div className="mt-2 flex justify-end">
          <button onClick={guardarTransporte} disabled={trSaving}
                  data-testid="btn-save-transporte"
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50">
            {trSaving ? 'Guardando…' : 'Guardar transporte material'}
          </button>
        </div>
      </div>

      {/* 3C/3D — Montaje del evento o por ensayo */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h4 className="font-semibold text-sm text-slate-800">📋 Montaje del {ensayoActivo ? 'ensayo seleccionado' : 'evento (general)'}</h4>
          <div className="flex items-center gap-2">
            <select value={ensayoActivo || ''} onChange={(e) => setEnsayoActivo(e.target.value || null)}
                    data-testid="select-ensayo-montaje"
                    className="text-xs border border-slate-300 rounded px-2 py-1">
              <option value="">— Montaje general del evento —</option>
              {ensayos.map(en => <option key={en.id} value={en.id}>{en.tipo} · {en.fecha} · {(en.hora_inicio || '').slice(0, 5)}</option>)}
            </select>
            <button onClick={generar} disabled={generando || ensayoActivo}
                    data-testid="btn-generar-montaje"
                    title={ensayoActivo ? 'El generador automático trabaja sólo con el montaje general del evento.' : ''}
                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
              {generando ? 'Generando…' : '✨ Generar montaje automático'}
            </button>
            <button onClick={addRow} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-300 rounded">
              + Fila
            </button>
            <button onClick={guardar} disabled={guardando} data-testid="btn-save-montaje"
                    className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar montaje'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-2 py-1.5">Material</th>
                <th className="text-center px-2 py-1.5">Cant.</th>
                <th className="text-center px-2 py-1.5">Disp.</th>
                <th className="text-left px-2 py-1.5">Origen</th>
                <th className="text-left px-2 py-1.5">Sección</th>
                <th className="text-left px-2 py-1.5">Posición</th>
                <th className="text-center px-2 py-1.5">Conf</th>
                <th className="text-left px-2 py-1.5">Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-slate-400">Sin items. Pulsa "Generar montaje automático" o "+ Fila".</td></tr>}
              {items.map((it, idx) => {
                const mat = it.material || matMap[it.material_id];
                return (
                  <tr key={it.id || `n${idx}`} className="hover:bg-slate-50" data-testid={`montaje-row-${idx}`}>
                    <td className="px-2 py-1">
                      {mat ? <span className="font-medium">{mat.codigo} · {mat.nombre}</span> : (
                        <select value={it.material_id || ''} onChange={(e) => {
                          const id = e.target.value;
                          updateItem(idx, 'material_id', id || null);
                          if (id && matMap[id]) updateItem(idx, 'nombre_material', null);
                        }} className="px-1 py-0.5 border border-slate-300 rounded text-xs w-44">
                          <option value="">— libre —</option>
                          {materiales.map(m => <option key={m.id} value={m.id}>{m.codigo} · {m.nombre}</option>)}
                        </select>
                      )}
                      {!it.material_id && (
                        <input value={it.nombre_material || ''} onChange={(e) => updateItem(idx, 'nombre_material', e.target.value)}
                               placeholder="Nombre libre" className="ml-1 px-1 py-0.5 border border-slate-300 rounded text-xs" />
                      )}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="number" min="1" value={it.cantidad_necesaria || 1}
                             onChange={(e) => updateItem(idx, 'cantidad_necesaria', parseInt(e.target.value) || 1)}
                             className="w-14 px-1 py-0.5 border border-slate-300 rounded text-xs text-center" />
                    </td>
                    <td className="px-2 py-1 text-center font-mono text-[11px]">
                      {mat ? <span className={(mat.disponibles ?? mat.cantidad_total) >= (it.cantidad_necesaria || 1) ? 'text-emerald-700' : 'text-red-600 font-bold'}>{mat.disponibles ?? mat.cantidad_total}</span> : '—'}
                    </td>
                    <td className="px-2 py-1">
                      <select value={it.origen || 'propio'} onChange={(e) => updateItem(idx, 'origen', e.target.value)}
                              className="px-1 py-0.5 border border-slate-300 rounded text-xs">
                        {ORIGENES.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input value={it.seccion_escenario || ''} onChange={(e) => updateItem(idx, 'seccion_escenario', e.target.value)}
                             className="w-28 px-1 py-0.5 border border-slate-300 rounded text-xs" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={it.posicion_escenario || ''} onChange={(e) => updateItem(idx, 'posicion_escenario', e.target.value)}
                             className="w-28 px-1 py-0.5 border border-slate-300 rounded text-xs" />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" checked={!!it.confirmado} onChange={(e) => updateItem(idx, 'confirmado', e.target.checked)}
                             data-testid={`montaje-conf-${idx}`}
                             className="w-4 h-4 accent-emerald-600" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={it.notas || ''} onChange={(e) => updateItem(idx, 'notas', e.target.value)}
                             className="w-32 px-1 py-0.5 border border-slate-300 rounded text-xs" />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button onClick={() => removeRow(idx)} className="text-red-600 hover:underline text-xs">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MontajeRiderSection;
