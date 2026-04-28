// /admin/inventario — Inventario de Material
// 3 pestañas: Catálogo, Préstamos, Alertas.
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const GRUPOS = [
  { v: 'percusion', l: 'Percusión', c: 'bg-purple-100 text-purple-800' },
  { v: 'mobiliario', l: 'Mobiliario', c: 'bg-amber-100 text-amber-800' },
  { v: 'iluminacion', l: 'Iluminación', c: 'bg-yellow-100 text-yellow-800' },
  { v: 'audio', l: 'Audio', c: 'bg-blue-100 text-blue-800' },
  { v: 'transporte', l: 'Transporte', c: 'bg-slate-100 text-slate-800' },
  { v: 'tarimas', l: 'Tarimas', c: 'bg-orange-100 text-orange-800' },
  { v: 'otros', l: 'Otros', c: 'bg-gray-100 text-gray-800' },
];

const ESTADOS = {
  bueno: { l: '🟢 Bueno', c: 'bg-emerald-100 text-emerald-800' },
  necesita_revision: { l: '🟡 Revisión', c: 'bg-amber-100 text-amber-800' },
  fuera_servicio: { l: '🔴 Fuera servicio', c: 'bg-red-100 text-red-800' },
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; }
};

// Bloque 8 — Permiso de edición: archivero, director_general, admin@convocatorias.com
const usePuedeEditarInventario = () => {
  const { user } = useAuth();
  if (!user) return false;
  const rol = user?.profile?.rol || user?.rol;
  const email = (user?.profile?.email || user?.email || '').toLowerCase();
  return ['archivero', 'director_general', 'admin'].includes(rol) || email === 'admin@convocatorias.com';
};

export default function GestorInventario() {
  const [tab, setTab] = useState('catalogo');
  return (
    <div className="p-4 space-y-4" data-testid="page-inventario">
      <div>
        <h1 className="font-cabinet text-2xl font-bold text-slate-900 flex items-center gap-2">📦 Inventario de Material</h1>
        <p className="text-sm text-slate-500">Catálogo, préstamos y alertas del material de la orquesta.</p>
      </div>
      <div className="border-b border-slate-200 flex gap-1">
        {[
          { k: 'catalogo', l: '📦 Catálogo' },
          { k: 'prestamos', l: '🤝 Préstamos' },
          { k: 'alertas', l: '⚠️ Alertas' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
                  data-testid={`inv-tab-${t.k}`}
                  className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
            {t.l}
          </button>
        ))}
      </div>
      {tab === 'catalogo' && <CatalogoTab />}
      {tab === 'prestamos' && <PrestamosTab />}
      {tab === 'alertas' && <AlertasTab />}
    </div>
  );
}

// ============================================================
// PESTAÑA CATÁLOGO
// ============================================================
function CatalogoTab() {
  const { api } = useAuth();
  const puedeEditar = usePuedeEditarInventario();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ grupo: '', estado: '', q: '' });
  const [ficha, setFicha] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
      const r = await api.get(`/api/gestor/inventario?${params}`);
      setItems(r.data?.material || []);
    } catch (e) {
      // silencioso
    } finally { setLoading(false); }
  }, [api, filtros]);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap bg-white p-3 rounded-lg border border-slate-200">
        <input type="text" placeholder="Buscar nombre/código…"
               value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
               data-testid="inv-search"
               className="px-3 py-1.5 text-sm border border-slate-300 rounded-md w-64" />
        <select value={filtros.grupo} onChange={(e) => setFiltros({ ...filtros, grupo: e.target.value })}
                data-testid="inv-filter-grupo"
                className="px-2 py-1.5 text-sm border border-slate-300 rounded-md">
          <option value="">Grupo</option>
          {GRUPOS.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
        </select>
        <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                data-testid="inv-filter-estado"
                className="px-2 py-1.5 text-sm border border-slate-300 rounded-md">
          <option value="">Estado</option>
          <option value="bueno">Bueno</option>
          <option value="necesita_revision">Necesita revisión</option>
          <option value="fuera_servicio">Fuera de servicio</option>
        </select>
        <button onClick={() => puedeEditar && setShowNew(true)} data-testid="btn-nuevo-material"
                disabled={!puedeEditar}
                title={puedeEditar ? '' : 'Sin permisos de edición'}
                className={`ml-auto px-3 py-1.5 text-sm rounded ${puedeEditar ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          + Nuevo elemento
        </button>
      </div>
      {loading ? <div className="p-6 text-slate-500 text-sm">Cargando…</div> : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Grupo</th>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2">Modelo</th>
                <th className="text-center px-3 py-2">Total</th>
                <th className="text-center px-3 py-2">Disponible</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">Sin material.</td></tr>}
              {items.map(m => {
                const g = GRUPOS.find(x => x.v === m.grupo) || GRUPOS[6];
                const est = ESTADOS[m.estado] || ESTADOS.bueno;
                return (
                  <tr key={m.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setFicha(m.id)} data-testid={`inv-row-${m.id}`}>
                    <td className="px-3 py-2 font-mono text-xs">{m.codigo || '—'}</td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${g.c}`}>{g.l}</span></td>
                    <td className="px-3 py-2 font-medium">{m.nombre}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{m.modelo || '—'}</td>
                    <td className="px-3 py-2 text-center font-mono">{m.cantidad_total}</td>
                    <td className="px-3 py-2 text-center font-mono">
                      <span className={m.disponibles === 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-medium'}>{m.disponibles}</span>
                      {m.prestados_activos > 0 && <span className="text-[10px] text-slate-400 ml-1">({m.prestados_activos} prest.)</span>}
                    </td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${est.c}`}>{est.l}</span></td>
                    <td className="px-3 py-2 text-right text-xs text-blue-600">Ver →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {ficha && <FichaMaterialModal materialId={ficha} api={api} onClose={() => setFicha(null)} onChange={cargar} puedeEditar={puedeEditar} />}
      {showNew && puedeEditar && <FichaMaterialModal materialId={null} api={api} onClose={() => setShowNew(false)} onChange={cargar} puedeEditar={puedeEditar} />}
    </div>
  );
}

function FichaMaterialModal({ materialId, api, onClose, onChange, puedeEditar = true }) {
  const [m, setM] = useState({ grupo: 'mobiliario', cantidad_total: 1, estado: 'bueno' });
  const [historial, setHistorial] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const isNew = !materialId;

  useEffect(() => {
    if (!materialId) return;
    (async () => {
      try {
        const r = await api.get(`/api/gestor/inventario/${materialId}`);
        setM(r.data.material);
        setHistorial(r.data.historial || []);
      } catch { /* noop */ }
    })();
  }, [materialId, api]);

  const guardar = async () => {
    setSaving(true);
    try {
      if (isNew) await api.post('/api/gestor/inventario', m);
      else await api.put(`/api/gestor/inventario/${materialId}`, m);
      onChange && onChange();
      onClose();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };

  const subirFoto = async (file) => {
    if (!materialId) return alert('Guarda primero el elemento.');
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const r = await api.post(`/api/gestor/inventario/${materialId}/foto`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setM({ ...m, foto_url: r.data.url });
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    finally { setUploadingFoto(false); }
  };

  const f = (k) => (e) => setM({ ...m, [k]: e.target.value });

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="ficha-material-modal">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{isNew ? 'Nuevo elemento' : `${m.codigo || ''} · ${m.nombre || ''}`}</h2>
          <button onClick={onClose} className="text-slate-400 text-xl">×</button>
        </header>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
              {m.foto_url ? <img src={m.foto_url} alt="" className="w-full h-full object-cover" /> :
                <span className="text-slate-400 text-sm">Sin foto</span>}
            </div>
            {!isNew && (
              <label className="mt-2 block">
                <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && subirFoto(e.target.files[0])} className="hidden" data-testid="input-foto-material" />
                <span className="block w-full px-3 py-2 bg-blue-50 text-blue-700 border border-blue-300 rounded text-xs text-center cursor-pointer hover:bg-blue-100">
                  {uploadingFoto ? 'Subiendo…' : '📷 Subir foto'}
                </span>
              </label>
            )}
          </div>
          <div className="md:col-span-2 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Código">
                <input value={m.codigo || ''} onChange={f('codigo')} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" data-testid="inp-codigo" />
              </Field>
              <Field label="Grupo*">
                <select value={m.grupo} onChange={f('grupo')} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" data-testid="inp-grupo">
                  {GRUPOS.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
                </select>
              </Field>
              <Field label="Nombre*" col2>
                <input value={m.nombre || ''} onChange={f('nombre')} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" data-testid="inp-nombre" />
              </Field>
              <Field label="Marca">
                <input value={m.marca || ''} onChange={f('marca')} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
              </Field>
              <Field label="Modelo">
                <input value={m.modelo || ''} onChange={f('modelo')} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
              </Field>
              <Field label="Cantidad total">
                <input type="number" min="1" value={m.cantidad_total || 1}
                       onChange={(e) => setM({ ...m, cantidad_total: parseInt(e.target.value) || 1 })}
                       className="w-full px-2 py-1 border border-slate-300 rounded text-sm" data-testid="inp-cantidad" />
              </Field>
              <Field label="Estado">
                <select value={m.estado} onChange={f('estado')} className="w-full px-2 py-1 border border-slate-300 rounded text-sm">
                  <option value="bueno">Bueno</option>
                  <option value="necesita_revision">Necesita revisión</option>
                  <option value="fuera_servicio">Fuera de servicio</option>
                </select>
              </Field>
              <Field label="Notas" col2>
                <textarea rows={2} value={m.notas || ''} onChange={f('notas')} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
              </Field>
            </div>
          </div>
        </div>
        {!isNew && historial.length > 0 && (
          <div className="px-6 pb-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Historial de préstamos ({historial.length})</h3>
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-2 py-1">Tipo</th>
                  <th className="text-left px-2 py-1">Destino</th>
                  <th className="text-left px-2 py-1">Salida</th>
                  <th className="text-left px-2 py-1">Devolución</th>
                  <th className="text-left px-2 py-1">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.map(h => (
                  <tr key={h.id}>
                    <td className="px-2 py-1">{h.tipo}</td>
                    <td className="px-2 py-1">{h.evento?.nombre || h.entidad_externa || '—'}</td>
                    <td className="px-2 py-1">{fmtDate(h.fecha_salida)}</td>
                    <td className="px-2 py-1">{fmtDate(h.fecha_devolucion_real || h.fecha_prevista_devolucion)}</td>
                    <td className="px-2 py-1">{h.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white">{puedeEditar ? 'Cancelar' : 'Cerrar'}</button>
          {puedeEditar && (
            <button onClick={guardar} disabled={saving || !m.nombre || !m.grupo} data-testid="btn-guardar-material"
                    className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded disabled:opacity-50 hover:bg-emerald-700">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

const Field = ({ label, col2, children }) => (
  <label className={`flex flex-col gap-0.5 ${col2 ? 'col-span-2' : ''}`}>
    <span className="text-xs text-slate-600 font-medium">{label}</span>
    {children}
  </label>
);

// ============================================================
// PESTAÑA PRÉSTAMOS
// ============================================================
function PrestamosTab() {
  const { api } = useAuth();
  const puedeEditar = usePuedeEditarInventario();
  const [prestamos, setPrestamos] = useState([]);
  const [filtros, setFiltros] = useState({ tipo: '', estado: '' });
  const [showNew, setShowNew] = useState(false);
  const [materiales, setMateriales] = useState([]);
  const [eventos, setEventos] = useState([]);

  const cargar = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
    const r = await api.get(`/api/gestor/inventario/prestamos?${params}`);
    setPrestamos(r.data?.prestamos || []);
  }, [api, filtros]);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    (async () => {
      const m = await api.get('/api/gestor/inventario');
      setMateriales(m.data?.material || []);
      const e = await api.get('/api/gestor/eventos');
      setEventos(Array.isArray(e.data) ? e.data : (e.data?.eventos || []));
    })();
  }, [api]);

  const devolver = async (id) => {
    if (!window.confirm('¿Marcar como devuelto?')) return;
    await api.put(`/api/gestor/inventario/prestamos/${id}`, {
      fecha_devolucion_real: new Date().toISOString().split('T')[0],
      estado: 'devuelto',
    });
    cargar();
  };

  const estadoFila = (p) => {
    if (p.estado === 'devuelto') return 'bg-emerald-50';
    if (!p.fecha_prevista_devolucion) return '';
    const d = new Date(p.fecha_prevista_devolucion);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dias = Math.round((d - today) / 86400000);
    if (dias < 0) return 'bg-red-50';
    if (dias <= 7) return 'bg-orange-50';
    return '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap bg-white p-3 rounded-lg border border-slate-200">
        <select value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })} className="px-2 py-1.5 text-sm border border-slate-300 rounded-md">
          <option value="">Tipo</option>
          <option value="interno">Interno (a evento)</option>
          <option value="externo">Externo</option>
        </select>
        <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })} className="px-2 py-1.5 text-sm border border-slate-300 rounded-md">
          <option value="">Estado</option>
          <option value="activo">Activo</option>
          <option value="devuelto">Devuelto</option>
          <option value="parcial">Parcial</option>
        </select>
        <button onClick={() => puedeEditar && setShowNew(true)} data-testid="btn-nuevo-prestamo"
                disabled={!puedeEditar}
                title={puedeEditar ? '' : 'Sin permisos de edición'}
                className={`ml-auto px-3 py-1.5 text-sm rounded ${puedeEditar ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          + Nuevo préstamo
        </button>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Material</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Destino</th>
              <th className="text-center px-3 py-2">Cant.</th>
              <th className="text-left px-3 py-2">Salida</th>
              <th className="text-left px-3 py-2">Devolución prev.</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prestamos.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">Sin préstamos.</td></tr>}
            {prestamos.map(p => (
              <tr key={p.id} className={estadoFila(p)} data-testid={`prestamo-row-${p.id}`}>
                <td className="px-3 py-2 font-medium">{p.material?.nombre || '—'}</td>
                <td className="px-3 py-2 text-xs">{p.tipo}</td>
                <td className="px-3 py-2 text-xs">{p.evento?.nombre || p.entidad_externa || '—'}</td>
                <td className="px-3 py-2 text-center font-mono">{p.cantidad}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(p.fecha_salida)}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(p.fecha_prevista_devolucion)}</td>
                <td className="px-3 py-2"><span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-100">{p.estado}</span></td>
                <td className="px-3 py-2 text-right">
                  {p.estado === 'activo' && (
                    <button onClick={() => devolver(p.id)} data-testid={`btn-devolver-${p.id}`}
                            className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">
                      ↩ Devolver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showNew && <NuevoPrestamoModal api={api} materiales={materiales} eventos={eventos}
                                       onClose={() => setShowNew(false)} onSaved={cargar} />}
    </div>
  );
}

function NuevoPrestamoModal({ api, materiales, eventos, onClose, onSaved }) {
  const [data, setData] = useState({
    material_id: '', tipo: 'interno', cantidad: 1,
    fecha_salida: new Date().toISOString().split('T')[0],
    fecha_prevista_devolucion: '',
    evento_id: '', entidad_externa: '', contacto: '', notas: '',
  });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    setSaving(true);
    try {
      const payload = { ...data };
      if (payload.tipo === 'interno') delete payload.entidad_externa;
      if (payload.tipo === 'externo') delete payload.evento_id;
      if (!payload.evento_id) delete payload.evento_id;
      await api.post('/api/gestor/inventario/prestamos', payload);
      onSaved && onSaved();
      onClose();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} data-testid="modal-nuevo-prestamo">
        <h2 className="text-lg font-bold mb-4">Nuevo préstamo</h2>
        <div className="space-y-2">
          <Field label="Material*">
            <select value={data.material_id} onChange={(e) => setData({ ...data, material_id: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" data-testid="np-material">
              <option value="">— Selecciona material —</option>
              {materiales.map(m => <option key={m.id} value={m.id}>{m.codigo} · {m.nombre} (disp. {m.disponibles}/{m.cantidad_total})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <select value={data.tipo} onChange={(e) => setData({ ...data, tipo: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="interno">Interno (a evento)</option>
                <option value="externo">Externo</option>
              </select>
            </Field>
            <Field label="Cantidad">
              <input type="number" min="1" value={data.cantidad}
                     onChange={(e) => setData({ ...data, cantidad: parseInt(e.target.value) || 1 })}
                     className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </Field>
            <Field label="Salida*">
              <input type="date" value={data.fecha_salida} onChange={(e) => setData({ ...data, fecha_salida: e.target.value })}
                     className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </Field>
            <Field label="Devolución prevista">
              <input type="date" value={data.fecha_prevista_devolucion} onChange={(e) => setData({ ...data, fecha_prevista_devolucion: e.target.value })}
                     className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </Field>
          </div>
          {data.tipo === 'interno' ? (
            <Field label="Evento">
              <select value={data.evento_id} onChange={(e) => setData({ ...data, evento_id: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="">— Sin evento —</option>
                {eventos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Entidad externa">
                <input value={data.entidad_externa} onChange={(e) => setData({ ...data, entidad_externa: e.target.value })}
                       className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Conservatorio, otra orquesta…" />
              </Field>
              <Field label="Contacto">
                <input value={data.contacto} onChange={(e) => setData({ ...data, contacto: e.target.value })}
                       className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </Field>
            </>
          )}
          <Field label="Notas">
            <textarea rows={2} value={data.notas} onChange={(e) => setData({ ...data, notas: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-300 rounded">Cancelar</button>
          <button onClick={guardar} disabled={saving || !data.material_id} data-testid="btn-save-prestamo"
                  className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded disabled:opacity-50">
            {saving ? 'Guardando…' : 'Crear préstamo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PESTAÑA ALERTAS
// ============================================================
function AlertasTab() {
  const { api } = useAuth();
  const [data, setData] = useState({ necesita_revision: [], fuera_servicio: [], prestamos_vencidos: [], prestamos_proximos: [], sin_disponibilidad: [] });

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/gestor/inventario/alertas');
        setData(r.data);
      } catch { /* noop */ }
    })();
  }, [api]);

  const Card = ({ title, items, render, cls = 'border-slate-200' }) => (
    <div className={`bg-white border rounded-lg p-4 ${cls}`}>
      <h3 className="text-sm font-semibold text-slate-800 mb-2">{title} ({items.length})</h3>
      {items.length === 0 ? <p className="text-xs text-slate-400">Sin elementos.</p> :
        <ul className="text-xs space-y-1 max-h-64 overflow-y-auto">{items.map(render)}</ul>}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="🟡 Material que necesita revisión" items={data.necesita_revision}
            cls="border-amber-300 bg-amber-50/40"
            render={(m) => <li key={m.id}>{m.codigo} · {m.nombre}</li>} />
      <Card title="🔴 Material fuera de servicio" items={data.fuera_servicio}
            cls="border-red-300 bg-red-50/40"
            render={(m) => <li key={m.id}>{m.codigo} · {m.nombre}</li>} />
      <Card title="⏰ Préstamos vencidos" items={data.prestamos_vencidos}
            cls="border-red-300 bg-red-50/40"
            render={(p) => <li key={p.id}>{p.material?.nombre} · {fmtDate(p.fecha_prevista_devolucion)}</li>} />
      <Card title="📅 Próximos a vencer (≤7d)" items={data.prestamos_proximos}
            cls="border-orange-300 bg-orange-50/40"
            render={(p) => <li key={p.id}>{p.material?.nombre} · {fmtDate(p.fecha_prevista_devolucion)}</li>} />
      <Card title="❌ Sin disponibilidad" items={data.sin_disponibilidad}
            cls="border-slate-300 bg-slate-50 md:col-span-2"
            render={(m) => <li key={m.id}>{m.codigo} · {m.nombre} (total {m.cantidad_total})</li>} />
    </div>
  );
}
