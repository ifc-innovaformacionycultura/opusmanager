// Sección "Servicio de comedor" para ConfiguracionEventos.js
// Carga, edita y guarda evento_comidas + muestra confirmaciones de músicos.
// Mismo patrón que LogisticaSection.js
import React, { useState, useEffect, useCallback, useRef } from 'react';

const fmtDateES = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};
const fmtTime = (t) => (t ? String(t).slice(0, 5) : '');
const fmtMoney = (n) => `${parseFloat(n || 0).toFixed(2)} €`;

const newComida = () => ({
  _local: true,
  orden: 1,
  fecha: '',
  hora_inicio: '',
  hora_fin: '',
  lugar: '',
  menu: '',
  precio_menu: 0,
  incluye_cafe: false,
  precio_cafe: 0,
  fecha_limite_confirmacion: '',
  notas: '',
});

// ---- Panel de confirmaciones de músicos -----------------------------------
const ConfirmacionesComidaPanel = ({ comidaId, api }) => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (!comidaId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/gestor/comidas/${comidaId}/confirmaciones`);
      setData(r.data);
    } catch (e) {
      setData({ error: e.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  }, [comidaId, api]);

  useEffect(() => { if (open && !data) cargar(); }, [open, data, cargar]);

  const fmtUser = (u) => `${u.apellidos || ''}, ${u.nombre || ''} (${u.instrumento || '—'})${u.toma_cafe ? ' ☕' : ''}`;

  return (
    <div className="mt-2 border-t border-slate-200 pt-2">
      <button type="button" onClick={() => setOpen(o => !o)}
              className="text-xs text-orange-700 hover:underline"
              data-testid={`btn-toggle-confs-comida-${comidaId}`}>
        {open ? '▾' : '▸'} Confirmaciones de músicos
      </button>
      {open && (
        <div className="mt-2 text-xs">
          {loading && <div className="text-slate-500">Cargando…</div>}
          {data?.error && <div className="text-red-600">{data.error}</div>}
          {data && !data.error && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="border border-emerald-200 bg-emerald-50/50 rounded p-2">
                  <div className="font-semibold text-emerald-700">✅ Asistirán ({data.confirmados.length})</div>
                  <ul className="mt-1 space-y-0.5">
                    {data.confirmados.map(u => <li key={u.id}>{fmtUser(u)}</li>)}
                    {data.confirmados.length === 0 && <li className="text-slate-400 italic">—</li>}
                  </ul>
                </div>
                <div className="border border-red-200 bg-red-50/50 rounded p-2">
                  <div className="font-semibold text-red-700">❌ No asistirán ({data.rechazados.length})</div>
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
              <div className="mt-2 text-right text-xs">
                <span className="text-slate-500">Total recaudación estimada: </span>
                <strong className="text-emerald-700">{fmtMoney(data.total_recaudado)}</strong>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Tarjeta resumen para comidas ya guardadas -----------------------------
const ComidaSummaryCard = ({ it, onEdit, onRemove, api }) => (
  <div className="border border-orange-200 bg-white rounded-lg p-3 shadow-sm" data-testid={`comida-card-${it.id}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-base">🍽️</span>
          <span className="font-semibold text-sm text-slate-800">
            {fmtDateES(it.fecha)}{it.hora_inicio ? ` · ${fmtTime(it.hora_inicio)}` : ''}{it.hora_fin ? `–${fmtTime(it.hora_fin)}` : ''}
          </span>
          {it.lugar && <span className="text-xs text-slate-600">📍 {it.lugar}</span>}
          {it.fecha_limite_confirmacion && (
            <span className="ml-auto text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              Lím: {fmtDateES(it.fecha_limite_confirmacion)}
            </span>
          )}
        </div>
        {it.menu && (
          <div className="text-xs text-slate-700 mt-1 whitespace-pre-line line-clamp-3">
            <span className="text-slate-500">Menú:</span> {it.menu}
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-slate-700 mt-1">
          <span><span className="text-slate-500">Precio menú:</span> <strong>{fmtMoney(it.precio_menu)}</strong></span>
          {it.incluye_cafe && (
            <span>☕ <span className="text-slate-500">Café:</span> <strong>{fmtMoney(it.precio_cafe)}</strong></span>
          )}
        </div>
        {it.notas && <div className="text-[11px] text-slate-500 mt-1 italic line-clamp-1">📝 {it.notas}</div>}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button type="button" onClick={onEdit}
                data-testid={`btn-edit-comida-${it.id}`}
                className="px-2 py-1 text-xs bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded">
          ✎ Editar
        </button>
        <button type="button" onClick={onRemove}
                data-testid={`btn-remove-comida-${it.id}`}
                className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded">
          🗑 Eliminar
        </button>
      </div>
    </div>
    {it.id && <ConfirmacionesComidaPanel comidaId={it.id} api={api} />}
  </div>
);

// ---- Componente principal ---------------------------------------------------
const ComidasSection = ({ eventoId, api }) => {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState([]);
  const [eliminarIds, setEliminarIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [editingIds, setEditingIds] = useState(new Set());

  // Mantener una ref a 'api' para que el efecto de carga no se reactive en cada render.
  const apiRef = useRef(api);
  useEffect(() => { apiRef.current = api; }, [api]);

  // Si el usuario activa manualmente el toggle, ya no permitimos que cargar() lo desactive.
  const userToggledRef = useRef(false);

  const cargar = useCallback(async () => {
    if (!eventoId) return;
    setLoading(true);
    try {
      const r = await apiRef.current.get(`/api/gestor/eventos/${eventoId}/comidas`);
      const list = r.data?.comidas || [];
      setItems(list);
      setEliminarIds([]);
      if (!userToggledRef.current) {
        setEnabled(list.length > 0);
      }
      setEditingIds(new Set());
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  }, [eventoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const updateField = (idx, k, v) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  };

  const removeItem = (idx) => {
    const it = items[idx];
    if (it.id) setEliminarIds(prev => [...prev, it.id]);
    setItems(prev => prev.filter((_, i) => i !== idx));
    setEditingIds(prev => { if (!it.id) return prev; const next = new Set(prev); next.delete(it.id); return next; });
  };

  const addComida = () => setItems(prev => [...prev, newComida()]);

  const isEditing = (it) => !it.id || editingIds.has(it.id);
  const toggleEdit = (id) => setEditingIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const guardar = async () => {
    if (!eventoId) return;
    setSaving(true); setMsg(null);
    try {
      const payload = {
        items: items.map(it => {
          const x = { ...it };
          delete x._local;
          if (!x.id) delete x.id;
          // Sanear numéricos vacíos
          x.precio_menu = parseFloat(x.precio_menu) || 0;
          x.precio_cafe = parseFloat(x.precio_cafe) || 0;
          return x;
        }),
        eliminar_ids: eliminarIds,
      };
      const r = await apiRef.current.put(`/api/gestor/eventos/${eventoId}/comidas`, payload);
      setMsg({ type: 'success', text: `✅ Comedor guardado · +${r.data.creados} / ±${r.data.actualizados} / −${r.data.borrados}` });
      setTimeout(() => setMsg(null), 3500);
      await cargar();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || e.message });
    } finally { setSaving(false); }
  };

  if (!enabled) {
    return (
      <div className="mt-4 border-t pt-4" data-testid="comidas-section">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={false}
                 onChange={() => { userToggledRef.current = true; setEnabled(true); }}
                 data-testid="toggle-comidas" className="w-4 h-4 accent-orange-600" />
          <span className="font-medium text-slate-700">Este evento ofrece servicio de comedor</span>
          <span className="text-xs text-slate-500">(activa para configurar menús, precios y café)</span>
        </label>
      </div>
    );
  }

  const renderEdit = (it, idx) => (
    <div key={it.id || `new-c-${idx}`} className="border border-amber-300 rounded p-3 bg-amber-50/60"
         data-testid={`comida-edit-${idx}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase font-semibold text-amber-800">Servicio de comida</span>
        <div className="flex gap-1">
          {it.id && (
            <button type="button" onClick={() => toggleEdit(it.id)}
                    className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded">
              ↩ Cerrar
            </button>
          )}
          <button type="button" onClick={() => removeItem(idx)}
                  className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded">
            🗑
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-600">Fecha *</span>
          <input type="date" value={it.fecha || ''} onChange={(e) => updateField(idx, 'fecha', e.target.value)}
                 data-testid={`inp-comida-fecha-${idx}`}
                 className="border border-slate-300 rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-600">Hora inicio</span>
          <input type="time" value={it.hora_inicio || ''} onChange={(e) => updateField(idx, 'hora_inicio', e.target.value)}
                 className="border border-slate-300 rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-600">Hora fin</span>
          <input type="time" value={it.hora_fin || ''} onChange={(e) => updateField(idx, 'hora_fin', e.target.value)}
                 className="border border-slate-300 rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-0.5 md:col-span-3">
          <span className="text-slate-600">Lugar</span>
          <input type="text" value={it.lugar || ''} onChange={(e) => updateField(idx, 'lugar', e.target.value)}
                 placeholder="Restaurante, comedor, sala…"
                 className="border border-slate-300 rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-0.5 md:col-span-3">
          <span className="text-slate-600">Menú</span>
          <textarea rows={3} value={it.menu || ''} onChange={(e) => updateField(idx, 'menu', e.target.value)}
                    placeholder="Ensalada · Lentejas · Filete · Postre · Pan · Bebida"
                    data-testid={`inp-comida-menu-${idx}`}
                    className="border border-slate-300 rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-600">Precio menú (€)</span>
          <input type="number" step="0.01" min="0" value={it.precio_menu ?? 0}
                 onChange={(e) => updateField(idx, 'precio_menu', e.target.value)}
                 data-testid={`inp-comida-precio-${idx}`}
                 className="border border-slate-300 rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-600">Café</span>
          <div className="flex items-center gap-2 mt-1">
            <input type="checkbox" checked={!!it.incluye_cafe}
                   onChange={(e) => updateField(idx, 'incluye_cafe', e.target.checked)}
                   data-testid={`inp-comida-cafe-${idx}`}
                   className="w-4 h-4 accent-orange-600" />
            <span className="text-xs">Incluye opción de café</span>
          </div>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-slate-600">Precio café (€)</span>
          <input type="number" step="0.01" min="0" value={it.precio_cafe ?? 0}
                 onChange={(e) => updateField(idx, 'precio_cafe', e.target.value)}
                 disabled={!it.incluye_cafe}
                 className="border border-slate-300 rounded px-2 py-1 disabled:bg-slate-100 disabled:text-slate-400" />
        </label>
        <label className="flex flex-col gap-0.5 md:col-span-2">
          <span className="text-slate-600">Fecha límite confirmación músicos</span>
          <input type="date" value={it.fecha_limite_confirmacion || ''}
                 onChange={(e) => updateField(idx, 'fecha_limite_confirmacion', e.target.value)}
                 className="border border-slate-300 rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-0.5 md:col-span-3">
          <span className="text-slate-600">Notas</span>
          <textarea rows={2} value={it.notas || ''} onChange={(e) => updateField(idx, 'notas', e.target.value)}
                    placeholder="Avisar de alergias, opciones vegetarianas, etc."
                    className="border border-slate-300 rounded px-2 py-1" />
        </label>
      </div>
    </div>
  );

  return (
    <div className="mt-4 border-t pt-4" data-testid="comidas-section">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={enabled}
                 onChange={() => { userToggledRef.current = true; setEnabled(false); }}
                 data-testid="toggle-comidas" className="w-4 h-4 accent-orange-600" />
          <span className="font-semibold text-slate-800">🍽️ Servicio de comedor</span>
        </label>
        <div className="flex items-center gap-2">
          {msg && (
            <span className={`text-xs px-2 py-1 rounded ${msg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}
                  data-testid="comidas-msg">{msg.text}</span>
          )}
          <button type="button" onClick={guardar} disabled={saving}
                  data-testid="btn-save-comidas"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar comedor'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Cargando comedor…</div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-slate-800 text-sm">🍽️ Servicios programados</h4>
            <button type="button" onClick={addComida}
                    data-testid="btn-add-comida"
                    className="px-2 py-1 text-xs border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded">
              + Añadir comida
            </button>
          </div>
          {items.length === 0 && (
            <p className="text-xs text-slate-500 italic">Sin servicios de comedor configurados.</p>
          )}
          <div className="space-y-2">
            {items.map((it, idx) => isEditing(it)
              ? renderEdit(it, idx)
              : <ComidaSummaryCard key={it.id} it={it} api={api}
                                  onEdit={() => toggleEdit(it.id)}
                                  onRemove={() => removeItem(idx)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComidasSection;
