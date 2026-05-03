// Sección Montaje y Rider Técnico para ConfiguracionEventos.
// Contiene: selector de espacio + transporte material + tabla de montaje
// del evento + montaje específico por ensayo (toggle).
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ORIGENES = ['propio', 'alquiler', 'prestamo', 'externo'];

const fieldCls = "px-2 py-1 border border-slate-300 rounded text-sm w-full";

// Iter F2 — Etiquetas user-friendly de los 5 tipos de operación.
const TIPOS_OPERACION = [
  { value: 'carga_origen', label: '📦 Carga inicial (salida del almacén)' },
  { value: 'descarga_destino', label: '🏛️ Entrega en destino (llegada al venue)' },
  { value: 'carga_destino', label: '📦 Recogida en destino (salida del venue)' },
  { value: 'descarga_origen', label: '🏠 Devolución al almacén' },
  { value: 'otro', label: '➕ Otro desplazamiento' },
];
const tipoLabel = (v) => (TIPOS_OPERACION.find(t => t.value === v) || {}).label || v;

// Iter F2 — Helper de permisos (copia exacta del patrón de las otras páginas).
const isSuperAdminUser = (user) => {
  if (!user) return false;
  const rol = user.rol || user.profile?.rol;
  if (rol === 'admin' || rol === 'director_general') return true;
  const email = (user.email || user.profile?.email || '').toLowerCase();
  return email === 'admin@convocatorias.com';
};

const MontajeRiderSection = ({ evento, api, onEventChange }) => {
  // eslint-disable-next-line no-unused-vars
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminUser(user);
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
  // Iter F2 — Estado para multi-operación
  const [operaciones, setOperaciones] = useState([]); // [{id?, tipo, fecha, hora, direccion, notas, orden, items:[]}]
  const [opsLoading, setOpsLoading] = useState(false);
  const [opSavingId, setOpSavingId] = useState(null);
  const [listasFav, setListasFav] = useState([]);
  const [modalCargarFav, setModalCargarFav] = useState(null); // {opIdx}
  const [modalGuardarFav, setModalGuardarFav] = useState(null); // {opIdx, nombre, descripcion}
  const [modalListas, setModalListas] = useState(false);

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
      // Iter F2 — operaciones del transporte multi
      try {
        setOpsLoading(true);
        const ops = await api.get(`/api/gestor/transporte-material/${evento.id}/operaciones`);
        setOperaciones(ops.data?.operaciones || []);
      } catch { setOperaciones([]); }
      finally { setOpsLoading(false); }
      try {
        const lf = await api.get('/api/gestor/listas-material-favoritas');
        setListasFav(lf.data?.listas || []);
      } catch { setListasFav([]); }
    })();
  }, [api, evento.id]);

  // Iter F2 — Helpers operaciones
  const recargarOperaciones = async () => {
    try {
      const ops = await api.get(`/api/gestor/transporte-material/${evento.id}/operaciones`);
      setOperaciones(ops.data?.operaciones || []);
    } catch { /* noop */ }
  };
  const recargarListasFav = async () => {
    try {
      const lf = await api.get('/api/gestor/listas-material-favoritas');
      setListasFav(lf.data?.listas || []);
    } catch { /* noop */ }
  };
  const opPatch = (idx, patch) => {
    setOperaciones((prev) => prev.map((op, i) => i === idx ? { ...op, ...patch } : op));
  };
  const opItemsPatch = (idx, itemsNuevos) => {
    setOperaciones((prev) => prev.map((op, i) => i === idx ? { ...op, items: itemsNuevos } : op));
  };
  const addOperacion = () => {
    setOperaciones((prev) => [...prev, {
      tipo: 'carga_origen', orden: prev.length + 1,
      fecha: '', hora: '', direccion: '', notas: '',
      items: [], _new: true,
    }]);
  };
  const removeOperacion = async (idx) => {
    const op = operaciones[idx];
    if (op.id) {
      if (!window.confirm('¿Eliminar esta operación y todos sus items?')) return;
      try {
        await api.delete(`/api/gestor/transporte-material/operaciones/${op.id}`);
        setMsg({ type: 'success', text: 'Operación eliminada.' });
        setTimeout(() => setMsg(null), 3000);
      } catch (e) {
        setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
        return;
      }
    }
    setOperaciones((prev) => prev.filter((_, i) => i !== idx));
  };
  const guardarOperacion = async (idx) => {
    const op = operaciones[idx];
    const payload = {
      tipo: op.tipo,
      orden: op.orden || (idx + 1),
      fecha: op.fecha || null,
      hora: op.hora || null,
      direccion: op.direccion || null,
      notas: op.notas || null,
      items: (op.items || []).map(it => ({
        material_id: it.material_id || null,
        nombre_manual: it.nombre_manual || null,
        cantidad: it.cantidad ?? 1,
        notas: it.notas || null,
        foto_url: it.foto_url || null,
      })),
    };
    setOpSavingId(op.id || `idx-${idx}`);
    try {
      if (op.id) {
        await api.put(`/api/gestor/transporte-material/operaciones/${op.id}`, payload);
      } else {
        await api.post(`/api/gestor/transporte-material/${evento.id}/operaciones`, payload);
      }
      setMsg({ type: 'success', text: 'Operación guardada.' });
      setTimeout(() => setMsg(null), 3000);
      await recargarOperaciones();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally {
      setOpSavingId(null);
    }
  };

  // Iter F2.1 — Reordenar operaciones con flechas ↑↓
  const reordenarOperacion = async (idx, direccion) => {
    const j = direccion === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= operaciones.length) return;
    // Swap local
    const nuevas = [...operaciones];
    [nuevas[idx], nuevas[j]] = [nuevas[j], nuevas[idx]];
    // Recalcular campo orden en local
    nuevas.forEach((op, i) => { op.orden = i + 1; });
    setOperaciones(nuevas);
    // Persistir si ambas tienen id
    const a = nuevas[idx];
    const b = nuevas[j];
    if (a.id && b.id) {
      setOpSavingId('reorder');
      try {
        const buildPayload = (op, ord) => ({
          tipo: op.tipo,
          orden: ord,
          fecha: op.fecha || null,
          hora: op.hora || null,
          direccion: op.direccion || null,
          notas: op.notas || null,
          items: (op.items || []).map(it => ({
            material_id: it.material_id || null,
            nombre_manual: it.nombre_manual || null,
            cantidad: it.cantidad ?? 1,
            notas: it.notas || null,
            foto_url: it.foto_url || null,
          })),
        });
        await Promise.all([
          api.put(`/api/gestor/transporte-material/operaciones/${a.id}`, buildPayload(a, idx + 1)),
          api.put(`/api/gestor/transporte-material/operaciones/${b.id}`, buildPayload(b, j + 1)),
        ]);
        await recargarOperaciones();
      } catch (e) {
        setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
      } finally {
        setOpSavingId(null);
      }
    }
  };
  const cargarFavoritaEnOperacion = (lista, opIdx) => {
    const itemsLista = (lista.items || []).map(it => ({
      material_id: it.material_id || null,
      nombre_manual: it.nombre_manual || null,
      cantidad: it.cantidad ?? 1,
      notas: it.notas || null,
    }));
    setOperaciones((prev) => prev.map((op, i) =>
      i === opIdx ? { ...op, items: [...(op.items || []), ...itemsLista] } : op
    ));
    setModalCargarFav(null);
    setMsg({ type: 'success', text: `Lista "${lista.nombre}" cargada con ${itemsLista.length} items.` });
    setTimeout(() => setMsg(null), 3000);
  };
  const guardarComoFavorita = async (opIdx, nombre, descripcion) => {
    if (!nombre?.trim()) return;
    const op = operaciones[opIdx];
    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion || null,
      items: (op.items || []).map(it => ({
        material_id: it.material_id || null,
        nombre_manual: it.nombre_manual || null,
        cantidad: it.cantidad ?? 1,
        notas: it.notas || null,
      })),
    };
    try {
      await api.post('/api/gestor/listas-material-favoritas', payload);
      setMsg({ type: 'success', text: `Lista "${nombre}" guardada.` });
      setTimeout(() => setMsg(null), 3000);
      await recargarListasFav();
      setModalGuardarFav(null);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    }
  };
  const eliminarFavorita = async (lista) => {
    if (!window.confirm(`¿Eliminar la lista favorita "${lista.nombre}"?`)) return;
    try {
      await api.delete(`/api/gestor/listas-material-favoritas/${lista.id}`);
      await recargarListasFav();
      setMsg({ type: 'success', text: 'Lista eliminada.' });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    }
  };

  // Cabecera transporte (versión Iter F2 — solo campos vivos).
  const guardarCabecera = async () => {
    if (!transporte) return;
    setTrSaving(true);
    try {
      const payload = {
        empresa: transporte.empresa || null,
        contacto_empresa: transporte.contacto_empresa || null,
        telefono_empresa: transporte.telefono_empresa || null,
        presupuesto_euros: transporte.presupuesto_euros || null,
        estado: transporte.estado || null,
        notas: transporte.notas || null,
      };
      await api.put(`/api/gestor/transporte-material/${evento.id}/cabecera`, payload);
      setMsg({ type: 'success', text: 'Cabecera guardada.' });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setTrSaving(false); }
  };

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

  // Bloque 6 — Duplicar montaje a otra sesión
  const duplicarMontaje = () => {
    const opciones = [{ id: '', label: 'General del evento' }, ...ensayos.map(en => ({
      id: en.id, label: `${en.tipo} · ${en.fecha} · ${(en.hora_inicio || '').slice(0, 5)}`,
    }))].filter(o => o.id !== (ensayoActivo || ''));
    if (!opciones.length) { alert('No hay otra sesión donde duplicar.'); return; }
    const dest = window.prompt(`Duplicar este montaje a:\n${opciones.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}\n\nIntroduce el número:`);
    const idx = parseInt(dest, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= opciones.length) return;
    const target = opciones[idx];
    // Clonar items (sin id, con nuevo ensayo_id)
    const clones = items.filter(it => !it._deleted).map(it => ({
      ...it, id: undefined, _local: true,
      ensayo_id: target.id || null,
    }));
    setEnsayoActivo(target.id || null);
    setItems(clones);
    setMsg({ type: 'success', text: `✅ ${clones.length} items duplicados a "${target.label}". Pulsa "Guardar montaje".` });
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

      {/* 3B — Transporte de material (Iter F2: cabecera + multi-operación) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="section-transporte">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h4 className="font-semibold text-sm text-slate-800">🚛 Transporte de material</h4>
          <button
            type="button"
            onClick={() => setModalListas(true)}
            data-testid="btn-listas-favoritas"
            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded"
            title="Gestionar listas favoritas"
          >⭐ Listas favoritas ({listasFav.length})</button>
        </div>

        {/* Cabecera */}
        <div className="bg-slate-50 rounded p-3 mb-3" data-testid="transporte-cabecera">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <label className="flex flex-col gap-0.5"><span className="text-slate-600">Empresa</span><input value={transporte?.empresa || ''} onChange={(e) => trSet('empresa', e.target.value)} className={fieldCls} data-testid="tr-empresa" /></label>
            <label className="flex flex-col gap-0.5"><span className="text-slate-600">Contacto</span><input value={transporte?.contacto_empresa || ''} onChange={(e) => trSet('contacto_empresa', e.target.value)} className={fieldCls} /></label>
            <label className="flex flex-col gap-0.5"><span className="text-slate-600">Teléfono</span><input value={transporte?.telefono_empresa || ''} onChange={(e) => trSet('telefono_empresa', e.target.value)} className={fieldCls} /></label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs mt-2">
            <label className="flex flex-col gap-0.5"><span className="text-slate-600">Presupuesto €</span><input type="number" step="0.01" value={transporte?.presupuesto_euros || ''} onChange={(e) => trSet('presupuesto_euros', parseFloat(e.target.value) || null)} className={fieldCls} /></label>
            <label className="flex flex-col gap-0.5"><span className="text-slate-600">Estado</span>
              <select value={transporte?.estado || 'pendiente'} onChange={(e) => trSet('estado', e.target.value)} className={fieldCls}>
                <option value="pendiente">Pendiente</option>
                <option value="confirmado">Confirmado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5"><span className="text-slate-600">Notas</span>
              <textarea rows={1} value={transporte?.notas || ''} onChange={(e) => trSet('notas', e.target.value)} className={fieldCls} />
            </label>
          </div>
          <div className="mt-2 flex justify-end">
            <button onClick={guardarCabecera} disabled={trSaving}
                    data-testid="btn-save-cabecera"
                    className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50">
              {trSaving ? 'Guardando…' : '💾 Guardar cabecera'}
            </button>
          </div>
        </div>

        {/* Operaciones */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 uppercase">Operaciones de transporte</span>
          <button
            type="button"
            onClick={addOperacion}
            data-testid="btn-add-operacion"
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
          >➕ Añadir operación</button>
        </div>

        {opsLoading && <p className="text-xs text-slate-500 py-2">Cargando operaciones…</p>}
        {!opsLoading && operaciones.length === 0 && (
          <p className="text-xs text-slate-400 italic py-3" data-testid="ops-empty">Sin operaciones registradas. Pulsa "➕ Añadir operación" para empezar.</p>
        )}

        {operaciones.map((op, idx) => {
          const opKey = op.id || `new-${idx}`;
          return (
            <div key={opKey} className="border border-slate-200 rounded p-3 mb-2" data-testid={`operacion-${idx}`}>
              <div className="flex items-start gap-2 flex-wrap mb-2">
                <select value={op.tipo} onChange={(e) => opPatch(idx, { tipo: e.target.value })}
                        data-testid={`op-tipo-${idx}`}
                        className={`${fieldCls} text-xs flex-1 min-w-[260px]`}>
                  {TIPOS_OPERACION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input type="date" value={op.fecha || ''} onChange={(e) => opPatch(idx, { fecha: e.target.value })}
                       data-testid={`op-fecha-${idx}`}
                       className={`${fieldCls} text-xs w-36`} />
                <input type="time" value={op.hora || ''} onChange={(e) => opPatch(idx, { hora: e.target.value })}
                       data-testid={`op-hora-${idx}`}
                       className={`${fieldCls} text-xs w-24`} />
                <button type="button"
                        onClick={() => reordenarOperacion(idx, 'up')}
                        disabled={idx === 0 || opSavingId !== null}
                        data-testid={`btn-mover-up-${idx}`}
                        title="Subir"
                        className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded disabled:opacity-30 disabled:cursor-not-allowed">↑</button>
                <button type="button"
                        onClick={() => reordenarOperacion(idx, 'down')}
                        disabled={idx === operaciones.length - 1 || opSavingId !== null}
                        data-testid={`btn-mover-down-${idx}`}
                        title="Bajar"
                        className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded disabled:opacity-30 disabled:cursor-not-allowed">↓</button>
                <button type="button" onClick={() => removeOperacion(idx)}
                        data-testid={`btn-eliminar-op-${idx}`}
                        className="px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100">
                  ✕ Eliminar
                </button>
              </div>
              <textarea rows={2} placeholder="Dirección" value={op.direccion || ''}
                        onChange={(e) => opPatch(idx, { direccion: e.target.value })}
                        className={`${fieldCls} text-xs mb-2`} />
              <textarea rows={1} placeholder="Notas" value={op.notas || ''}
                        onChange={(e) => opPatch(idx, { notas: e.target.value })}
                        className={`${fieldCls} text-xs mb-2`} />

              {/* Items */}
              <div className="bg-slate-50 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-700 uppercase">Material ({(op.items || []).length})</span>
                  <div className="flex gap-1">
                    <button type="button"
                      onClick={() => setModalCargarFav({ opIdx: idx })}
                      data-testid={`btn-cargar-fav-${idx}`}
                      className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded">
                      📂 Cargar lista favorita
                    </button>
                    <button type="button"
                      onClick={() => setModalGuardarFav({ opIdx: idx, nombre: '', descripcion: '' })}
                      data-testid={`btn-guardar-fav-${idx}`}
                      disabled={!(op.items || []).length}
                      className="px-2 py-0.5 text-[10px] bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded disabled:opacity-40">
                      ⭐ Guardar como favorita
                    </button>
                    <button type="button"
                      onClick={() => opItemsPatch(idx, [...(op.items || []), { nombre_manual: '', cantidad: 1 }])}
                      data-testid={`btn-add-item-${idx}`}
                      className="px-2 py-0.5 text-[10px] bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded">
                      ➕ Item
                    </button>
                  </div>
                </div>
                {(op.items || []).length === 0 && (
                  <p className="text-[10px] text-slate-400 italic py-1">Sin items. Añade material individual o carga una lista favorita.</p>
                )}
                {(op.items || []).map((it, iidx) => (
                  <div key={iidx} className="flex items-center gap-1 mb-1" data-testid={`item-${idx}-${iidx}`}>
                    <select value={it.material_id || ''}
                            onChange={(e) => {
                              const newItems = [...op.items];
                              const matId = e.target.value || null;
                              const mat = matId ? materiales.find(m => m.id === matId) : null;
                              newItems[iidx] = { ...it, material_id: matId, nombre_manual: mat ? null : (it.nombre_manual || '') };
                              opItemsPatch(idx, newItems);
                            }}
                            className={`${fieldCls} text-[11px] flex-1`}>
                      <option value="">— Catálogo —</option>
                      {materiales.map(m => <option key={m.id} value={m.id}>{m.nombre}{m.tipo ? ` (${m.tipo})` : ''}</option>)}
                    </select>
                    {!it.material_id && (
                      <input value={it.nombre_manual || ''} placeholder="Nombre manual"
                             onChange={(e) => {
                               const newItems = [...op.items];
                               newItems[iidx] = { ...it, nombre_manual: e.target.value };
                               opItemsPatch(idx, newItems);
                             }}
                             className={`${fieldCls} text-[11px] flex-1`} />
                    )}
                    <input type="number" min="1" value={it.cantidad ?? 1}
                           onChange={(e) => {
                             const newItems = [...op.items];
                             newItems[iidx] = { ...it, cantidad: parseInt(e.target.value, 10) || 1 };
                             opItemsPatch(idx, newItems);
                           }}
                           className="w-16 px-1 py-0.5 border border-slate-300 rounded text-[11px] text-center" />
                    <input value={it.notas || ''} placeholder="Notas"
                           onChange={(e) => {
                             const newItems = [...op.items];
                             newItems[iidx] = { ...it, notas: e.target.value };
                             opItemsPatch(idx, newItems);
                           }}
                           className={`${fieldCls} text-[11px] flex-1`} />
                    <button type="button"
                      onClick={() => opItemsPatch(idx, op.items.filter((_, i) => i !== iidx))}
                      className="text-red-600 hover:text-red-800 text-xs px-1"
                      title="Eliminar item">✕</button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-2">
                <button type="button"
                  onClick={() => guardarOperacion(idx)}
                  disabled={opSavingId === (op.id || `idx-${idx}`)}
                  data-testid={`btn-guardar-op-${idx}`}
                  className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50">
                  {opSavingId === (op.id || `idx-${idx}`) ? 'Guardando…' : '💾 Guardar operación'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Iter F2 — Modal: Listas favoritas */}
      {modalListas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-listas-fav">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-5 border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900">⭐ Listas favoritas globales</h3>
              <button onClick={() => setModalListas(false)} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 -mx-5 px-5 space-y-2">
              {listasFav.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">Sin listas favoritas creadas.</p>}
              {listasFav.map(lf => (
                <div key={lf.id} className="border border-slate-200 rounded p-2" data-testid={`lista-fav-${lf.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900">{lf.nombre}</div>
                      {lf.descripcion && <div className="text-xs text-slate-600">{lf.descripcion}</div>}
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {(lf.items || []).length} items · creada por {lf.creado_por_nombre || '—'}
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <button type="button" onClick={() => eliminarFavorita(lf)}
                              data-testid={`btn-eliminar-fav-${lf.id}`}
                              className="px-2 py-0.5 text-[10px] bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100"
                              title="Eliminar (solo super admin)">🗑️</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
              <button onClick={() => setModalListas(false)} className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Iter F2 — Modal: Cargar lista favorita en operación */}
      {modalCargarFav && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-cargar-fav">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5 border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900">📂 Cargar lista favorita</h3>
              <button onClick={() => setModalCargarFav(null)} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>
            <p className="text-xs text-slate-600 mb-2">Los items de la lista se añadirán a la operación actual (no la reemplazan).</p>
            <div className="overflow-y-auto flex-1 -mx-5 px-5 space-y-2">
              {listasFav.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">Sin listas favoritas. Crea una primero.</p>}
              {listasFav.map(lf => (
                <button key={lf.id}
                  type="button"
                  onClick={() => cargarFavoritaEnOperacion(lf, modalCargarFav.opIdx)}
                  data-testid={`btn-aplicar-fav-${lf.id}`}
                  className="w-full text-left border border-slate-200 rounded p-2 hover:bg-blue-50 hover:border-blue-300">
                  <div className="text-sm font-semibold">{lf.nombre}</div>
                  {lf.descripcion && <div className="text-xs text-slate-600">{lf.descripcion}</div>}
                  <div className="text-[11px] text-slate-500 mt-0.5">{(lf.items || []).length} items</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
              <button onClick={() => setModalCargarFav(null)} className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Iter F2 — Modal: Guardar como favorita */}
      {modalGuardarFav && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-guardar-fav">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">⭐ Guardar como lista favorita</h3>
            <label className="block text-xs text-slate-600 mb-1">Nombre <span className="text-red-500">*</span></label>
            <input value={modalGuardarFav.nombre}
                   onChange={(e) => setModalGuardarFav({ ...modalGuardarFav, nombre: e.target.value })}
                   data-testid="input-nombre-fav"
                   className={`${fieldCls} mb-2`} placeholder="Ej: Set sinfónico básico" />
            <label className="block text-xs text-slate-600 mb-1">Descripción</label>
            <textarea rows={2}
                      value={modalGuardarFav.descripcion}
                      onChange={(e) => setModalGuardarFav({ ...modalGuardarFav, descripcion: e.target.value })}
                      className={`${fieldCls} mb-3`} placeholder="Opcional" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setModalGuardarFav(null)}
                      className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50">Cancelar</button>
              <button onClick={() => guardarComoFavorita(modalGuardarFav.opIdx, modalGuardarFav.nombre, modalGuardarFav.descripcion)}
                      disabled={!modalGuardarFav.nombre?.trim()}
                      data-testid="btn-confirmar-guardar-fav"
                      className="px-3 py-1.5 text-sm font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50">
                ⭐ Guardar
              </button>
            </div>
          </div>
        </div>
      )}

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
            <button onClick={duplicarMontaje} disabled={!items.length}
                    data-testid="btn-duplicar-montaje"
                    title="Copiar este montaje a otra sesión del evento"
                    className="px-3 py-1.5 text-xs bg-amber-50 text-amber-800 border border-amber-300 rounded disabled:opacity-50">
              🔁 Duplicar
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
