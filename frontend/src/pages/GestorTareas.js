// Planificador de tareas — vista Lista + Gantt + Calendario
// Backend: /api/gestor/tareas (CRUD)
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ComentariosPanel from '../components/ComentariosPanel';

const CATEGORIAS = [
  { value: 'artistico',    label: 'Artístico',     color: 'bg-purple-100 text-purple-800' },
  { value: 'logistico',    label: 'Logístico',     color: 'bg-blue-100 text-blue-800' },
  { value: 'economico',    label: 'Económico',     color: 'bg-emerald-100 text-emerald-800' },
  { value: 'comunicacion', label: 'Comunicación',  color: 'bg-pink-100 text-pink-800' },
  { value: 'tecnico',      label: 'Técnico',       color: 'bg-cyan-100 text-cyan-800' },
  { value: 'otro',         label: 'Otro',          color: 'bg-slate-100 text-slate-700' },
];

const PRIORIDADES = [
  { value: 'alta',  label: 'Alta',  color: 'bg-red-100 text-red-800', bar: '#ef4444' },
  { value: 'media', label: 'Media', color: 'bg-amber-100 text-amber-800', bar: '#f59e0b' },
  { value: 'baja',  label: 'Baja',  color: 'bg-green-100 text-green-800', bar: '#10b981' },
];

const ESTADOS = [
  { value: 'pendiente',   label: 'Pendiente',   color: 'bg-slate-100 text-slate-700' },
  { value: 'en_curso',    label: 'En curso',    color: 'bg-blue-100 text-blue-800' },
  { value: 'completada',  label: 'Completada',  color: 'bg-green-100 text-green-800' },
  { value: 'cancelada',   label: 'Cancelada',   color: 'bg-red-100 text-red-800' },
];

const fmtFecha = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

const urgencyColor = (fechaLimite, estado) => {
  if (estado === 'completada' || estado === 'cancelada') return 'text-slate-400';
  if (!fechaLimite) return 'text-slate-700';
  const d = new Date(fechaLimite);
  const now = new Date();
  const diffH = (d - now) / 1000 / 3600;
  if (diffH < 24) return 'text-red-600 font-bold';
  if (diffH < 72) return 'text-orange-600 font-semibold';
  return 'text-emerald-700';
};

const GestorTareas = () => {
  const { api } = useAuth();
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gestores, setGestores] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [vista, setVista] = useState('lista'); // 'lista' | 'gantt'
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);

  const [filterEstado, setFilterEstado] = useState('');
  const [filterPrioridad, setFilterPrioridad] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterResponsable, setFilterResponsable] = useState('');
  const [filterEvento, setFilterEvento] = useState('');

  const cargar = async () => {
    try {
      setLoading(true);
      const [tRes, gRes, eRes] = await Promise.all([
        api.get('/api/gestor/tareas'),
        api.get('/api/gestor/gestores'),
        api.get('/api/gestor/eventos'),
      ]);
      setTareas(tRes.data.tareas || []);
      setGestores(gRes.data.gestores || []);
      setEventos(eRes.data.eventos || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const tareasFiltradas = useMemo(() => {
    return tareas.filter(t => (
      (!filterEstado      || t.estado === filterEstado) &&
      (!filterPrioridad   || t.prioridad === filterPrioridad) &&
      (!filterCategoria   || t.categoria === filterCategoria) &&
      (!filterResponsable || t.responsable_id === filterResponsable) &&
      (!filterEvento      || t.evento_id === filterEvento)
    )).sort((a, b) => (a.fecha_limite || '').localeCompare(b.fecha_limite || ''));
  }, [tareas, filterEstado, filterPrioridad, filterCategoria, filterResponsable, filterEvento]);

  const guardarTarea = async (payload) => {
    try {
      if (edit && edit.id) {
        await api.put(`/api/gestor/tareas/${edit.id}`, payload);
      } else {
        await api.post('/api/gestor/tareas', payload);
      }
      await cargar();
      setShowForm(false);
      setEdit(null);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const completar = async (t) => {
    try {
      await api.put(`/api/gestor/tareas/${t.id}`, { estado: 'completada' });
      await cargar();
    } catch (err) { alert(err.message); }
  };

  const eliminar = async (t) => {
    if (!confirm(`¿Eliminar la tarea "${t.titulo}"?`)) return;
    try {
      await api.delete(`/api/gestor/tareas/${t.id}`);
      await cargar();
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div className="p-6 text-slate-500">Cargando tareas...</div>;
  if (error) return <div className="p-6 text-red-700">⚠️ {error}</div>;

  return (
    <div className="p-6" data-testid="tareas-page">
      <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Planificador de tareas</h1>
          <p className="text-sm text-slate-600 mt-1">Gestiona las tareas del equipo. Vista lista o diagrama de Gantt.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-slate-300 rounded-md overflow-hidden">
            <button onClick={() => setVista('lista')}
                    data-testid="btn-vista-lista"
                    className={`px-3 py-1.5 text-sm ${vista === 'lista' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>
              📋 Lista
            </button>
            <button onClick={() => setVista('gantt')}
                    data-testid="btn-vista-gantt"
                    className={`px-3 py-1.5 text-sm border-l border-slate-300 ${vista === 'gantt' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>
              📊 Gantt
            </button>
            <button onClick={() => setVista('calendario')}
                    data-testid="btn-vista-calendario"
                    className={`px-3 py-1.5 text-sm border-l border-slate-300 ${vista === 'calendario' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>
              📅 Calendario
            </button>
          </div>
          <button onClick={() => { setEdit(null); setShowForm(true); }}
                  data-testid="btn-nueva-tarea"
                  className="px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-semibold hover:bg-slate-800">
            + Nueva tarea
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3 flex items-center gap-2 flex-wrap">
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-sm" data-testid="filter-tarea-estado">
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <select value={filterPrioridad} onChange={(e) => setFilterPrioridad(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-sm">
          <option value="">Todas las prioridades</option>
          {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-sm">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterResponsable} onChange={(e) => setFilterResponsable(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-sm">
          <option value="">Todos los responsables</option>
          {gestores.map(g => <option key={g.id} value={g.id}>{g.apellidos}, {g.nombre}</option>)}
        </select>
        <select value={filterEvento} onChange={(e) => setFilterEvento(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-sm">
          <option value="">Todos los eventos</option>
          {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-auto">{tareasFiltradas.length} tareas</span>
      </div>

      {vista === 'lista' ? (
        <>
          {/* Vista tabla — ≥ md */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Título</th>
                  <th className="text-left px-3 py-2">Categoría</th>
                  <th className="text-left px-3 py-2">Prioridad</th>
                  <th className="text-left px-3 py-2">Responsable</th>
                  <th className="text-left px-3 py-2">Evento</th>
                  <th className="text-left px-3 py-2">Fecha límite</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-right px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tareasFiltradas.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">No hay tareas.</td></tr>
                )}
                {tareasFiltradas.map(t => {
                  const cat = CATEGORIAS.find(c => c.value === t.categoria) || CATEGORIAS[5];
                  const pri = PRIORIDADES.find(p => p.value === t.prioridad) || PRIORIDADES[1];
                  const est = ESTADOS.find(e => e.value === t.estado) || ESTADOS[0];
                  const ev = eventos.find(e => e.id === t.evento_id);
                  const g = gestores.find(x => x.id === t.responsable_id);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50" data-testid={`row-tarea-${t.id}`}>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        <button onClick={() => { setEdit(t); setShowForm(true); }} className="text-left hover:underline">
                          {t.titulo}
                        </button>
                        {t.descripcion && <p className="text-xs text-slate-500 truncate max-w-md">{t.descripcion}</p>}
                      </td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${cat.color}`}>{cat.label}</span></td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${pri.color}`}>{pri.label}</span></td>
                      <td className="px-3 py-2 text-slate-600">{g ? `${g.apellidos}, ${g.nombre}` : (t.responsable_nombre || '—')}</td>
                      <td className="px-3 py-2 text-slate-600">{ev?.nombre || '—'}</td>
                      <td className={`px-3 py-2 ${urgencyColor(t.fecha_limite, t.estado)}`}>{fmtFecha(t.fecha_limite)}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${est.color}`}>{est.label}</span></td>
                      <td className="px-3 py-2 text-right">
                        {t.estado !== 'completada' && (
                          <button onClick={() => completar(t)} className="text-xs text-emerald-700 hover:underline mr-2" data-testid={`btn-complete-${t.id}`}>✓ Completar</button>
                        )}
                        <button onClick={() => { setEdit(t); setShowForm(true); }} className="text-xs text-blue-600 hover:underline mr-2">Editar</button>
                        <button onClick={() => eliminar(t)} className="text-xs text-red-600 hover:underline" data-testid={`btn-delete-${t.id}`}>Eliminar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista cards móvil — < md */}
          <div className="md:hidden space-y-3" data-testid="tareas-mobile-cards">
            {tareasFiltradas.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">No hay tareas.</div>
            )}
            {tareasFiltradas.map(t => {
              const cat = CATEGORIAS.find(c => c.value === t.categoria) || CATEGORIAS[5];
              const pri = PRIORIDADES.find(p => p.value === t.prioridad) || PRIORIDADES[1];
              const est = ESTADOS.find(e => e.value === t.estado) || ESTADOS[0];
              const ev = eventos.find(e => e.id === t.evento_id);
              const g = gestores.find(x => x.id === t.responsable_id);
              return (
                <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-4" data-testid={`card-tarea-${t.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <button onClick={() => { setEdit(t); setShowForm(true); }} className="font-semibold text-slate-900 text-base text-left flex-1">
                      {t.titulo}
                    </button>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${est.color}`}>{est.label}</span>
                  </div>
                  {t.descripcion && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{t.descripcion}</p>}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${cat.color}`}>{cat.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${pri.color}`}>{pri.label}</span>
                    {ev?.nombre && <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700">{ev.nombre}</span>}
                  </div>
                  <div className="text-xs text-slate-600 mb-3">
                    <div>👤 {g ? `${g.apellidos}, ${g.nombre}` : (t.responsable_nombre || '—')}</div>
                    {t.fecha_limite && <div className={urgencyColor(t.fecha_limite, t.estado)}>📅 {fmtFecha(t.fecha_limite)}</div>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {t.estado !== 'completada' && (
                      <button onClick={() => completar(t)} className="flex-1 min-h-[44px] px-3 py-2 bg-emerald-600 text-white rounded text-sm font-medium" data-testid={`mbtn-complete-${t.id}`}>✓ Completar</button>
                    )}
                    <button onClick={() => { setEdit(t); setShowForm(true); }} className="flex-1 min-h-[44px] px-3 py-2 bg-blue-50 text-blue-700 border border-blue-300 rounded text-sm font-medium">Editar</button>
                    <button onClick={() => eliminar(t)} className="min-h-[44px] px-3 py-2 bg-red-50 text-red-700 border border-red-300 rounded text-sm font-medium" data-testid={`mbtn-delete-${t.id}`}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : vista === 'gantt' ? (
        <GanttView tareas={tareasFiltradas} onOpen={(t) => { setEdit(t); setShowForm(true); }} />
      ) : (
        <CalendarView tareas={tareasFiltradas} onOpen={(t) => { setEdit(t); setShowForm(true); }} />
      )}

      {showForm && (
        <TareaForm
          tarea={edit}
          gestores={gestores}
          eventos={eventos}
          onSave={guardarTarea}
          onClose={() => { setShowForm(false); setEdit(null); }}
        />
      )}
    </div>
  );
};

// ------------------ Form Modal ------------------
const TareaForm = ({ tarea, gestores, eventos, onSave, onClose }) => {
  const [f, setF] = useState({
    titulo: tarea?.titulo || '',
    descripcion: tarea?.descripcion || '',
    evento_id: tarea?.evento_id || '',
    responsable_id: tarea?.responsable_id || '',
    fecha_inicio: tarea?.fecha_inicio || '',
    fecha_limite: tarea?.fecha_limite || '',
    prioridad: tarea?.prioridad || 'media',
    estado: tarea?.estado || 'pendiente',
    categoria: tarea?.categoria || 'otro',
    recordatorio_fecha: tarea?.recordatorio_fecha ? String(tarea.recordatorio_fecha).slice(0, 16) : '',
  });
  const setK = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!f.titulo.trim()) return alert('Título obligatorio');
    if (!f.fecha_limite) return alert('Fecha límite obligatoria');
    const payload = { ...f };
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
    // nombre responsable para snapshot
    const g = gestores.find(x => x.id === payload.responsable_id);
    if (g) payload.responsable_nombre = `${g.apellidos || ''}, ${g.nombre || ''}`.trim();
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="tarea-form-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold">{tarea?.id ? 'Editar tarea' : 'Nueva tarea'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900" data-testid="btn-close-form">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-slate-600 mb-1 block">Título *</label>
            <input value={f.titulo} onChange={(e) => setK('titulo', e.target.value)} required
                   data-testid="input-titulo"
                   className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">Descripción</label>
            <textarea value={f.descripcion} onChange={(e) => setK('descripcion', e.target.value)} rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Evento</label>
              <select value={f.evento_id || ''} onChange={(e) => setK('evento_id', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                <option value="">Sin evento</option>
                {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Responsable</label>
              <select value={f.responsable_id || ''} onChange={(e) => setK('responsable_id', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                <option value="">Sin responsable</option>
                {gestores.map(g => <option key={g.id} value={g.id}>{g.apellidos}, {g.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Fecha inicio</label>
              <input type="date" value={f.fecha_inicio || ''} onChange={(e) => setK('fecha_inicio', e.target.value)}
                     className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Fecha límite *</label>
              <input type="date" value={f.fecha_limite || ''} onChange={(e) => setK('fecha_limite', e.target.value)} required
                     data-testid="input-fecha-limite"
                     className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Prioridad</label>
              <select value={f.prioridad} onChange={(e) => setK('prioridad', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Estado</label>
              <select value={f.estado} onChange={(e) => setK('estado', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                {ESTADOS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Categoría</label>
              <select value={f.categoria} onChange={(e) => setK('categoria', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Recordatorio (fecha/hora)</label>
              <input type="datetime-local" value={f.recordatorio_fecha || ''} onChange={(e) => setK('recordatorio_fecha', e.target.value)}
                     className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
            <button type="submit" data-testid="btn-guardar-tarea"
                    className="ml-auto px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-800">
              {tarea?.id ? 'Guardar cambios' : 'Crear tarea'}
            </button>
          </div>
        </form>
        {tarea?.id && (
          <div className="px-5 pb-5 pt-0 border-t border-slate-200">
            <ComentariosPanel tipo="tarea" entidadId={tarea.id} title="💬 Comentarios del equipo" />
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------ Gantt View ------------------
const GanttView = ({ tareas, onOpen }) => {
  const [month, setMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const grupos = useMemo(() => {
    const g = {};
    tareas.forEach(t => {
      const cat = t.categoria || 'otro';
      if (!g[cat]) g[cat] = [];
      g[cat].push(t);
    });
    return g;
  }, [tareas]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="gantt-view">
      <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="px-2 py-1 hover:bg-slate-700 rounded">←</button>
        <span className="font-semibold capitalize">{month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="px-2 py-1 hover:bg-slate-700 rounded">→</button>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header días */}
          <div className="grid text-xs text-slate-500 border-b border-slate-200" style={{ gridTemplateColumns: `180px repeat(${daysInMonth}, 1fr)` }}>
            <div className="px-2 py-1 font-medium text-slate-700 border-r border-slate-200">Categoría / Tarea</div>
            {Array.from({ length: daysInMonth }, (_, i) => (
              <div key={i} className="py-1 text-center border-r border-slate-100 text-[10px]">{i + 1}</div>
            ))}
          </div>
          {Object.entries(grupos).map(([catKey, tks]) => {
            const cat = CATEGORIAS.find(c => c.value === catKey) || CATEGORIAS[5];
            return (
              <div key={catKey}>
                <div className="grid bg-slate-100 border-b border-slate-200" style={{ gridTemplateColumns: `180px repeat(${daysInMonth}, 1fr)` }}>
                  <div className={`px-2 py-1 text-xs font-semibold ${cat.color} col-span-1`}>{cat.label} <span className="text-slate-500 font-normal">({tks.length})</span></div>
                  <div style={{ gridColumn: `2 / span ${daysInMonth}` }}></div>
                </div>
                {tks.map(t => {
                  const fi = t.fecha_inicio ? new Date(t.fecha_inicio) : new Date(t.fecha_limite);
                  const ff = t.fecha_limite ? new Date(t.fecha_limite) : fi;
                  // si la tarea está fuera del mes, saltamos
                  if (ff < monthStart || fi > monthEnd) {
                    return (
                      <div key={t.id} className="grid border-b border-slate-100" style={{ gridTemplateColumns: `180px repeat(${daysInMonth}, 1fr)` }}>
                        <div className="px-2 py-1 text-xs text-slate-400 truncate">{t.titulo}</div>
                        <div className="text-[10px] text-slate-400 px-2" style={{ gridColumn: `2 / span ${daysInMonth}` }}>fuera del mes</div>
                      </div>
                    );
                  }
                  const startDay = Math.max(1, fi.getMonth() === month.getMonth() ? fi.getDate() : 1);
                  const endDay   = Math.min(daysInMonth, ff.getMonth() === month.getMonth() ? ff.getDate() : daysInMonth);
                  const pri = PRIORIDADES.find(p => p.value === t.prioridad) || PRIORIDADES[1];
                  return (
                    <div key={t.id} className="grid border-b border-slate-100 hover:bg-slate-50 cursor-pointer" style={{ gridTemplateColumns: `180px repeat(${daysInMonth}, 1fr)` }}
                         onClick={() => onOpen(t)}
                         data-testid={`gantt-row-${t.id}`}>
                      <div className="px-2 py-1 text-xs text-slate-700 truncate" title={t.titulo}>{t.titulo}</div>
                      <div style={{ gridColumn: `${startDay + 1} / span ${Math.max(1, endDay - startDay + 1)}`, background: pri.bar }}
                           className="my-1 mx-0.5 rounded text-white text-[10px] px-1 py-0.5 truncate">
                        {t.titulo}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GestorTareas;

// ------------------ Calendar View (Mensual/Semanal/Anual) ------------------
const CalendarView = ({ tareas, onOpen }) => {
  const [sub, setSub] = useState('mensual'); // 'mensual' | 'semanal' | 'anual'
  const [ref, setRef] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  // Color por prioridad
  const priColor = (p) => p === 'alta' ? 'bg-red-500' : p === 'media' ? 'bg-amber-500' : 'bg-emerald-500';

  const tareasByDate = useMemo(() => {
    const m = {};
    (tareas || []).forEach(t => {
      if (!t.fecha_limite) return;
      const k = String(t.fecha_limite).slice(0, 10);
      if (!m[k]) m[k] = [];
      m[k].push(t);
    });
    return m;
  }, [tareas]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="calendar-view">
      <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
        <div className="inline-flex border border-slate-600 rounded overflow-hidden text-xs">
          {['mensual', 'semanal', 'anual'].map(v => (
            <button key={v} onClick={() => setSub(v)}
                    className={`px-3 py-1 capitalize ${sub === v ? 'bg-white text-slate-900' : 'bg-slate-700'}`}
                    data-testid={`cal-sub-${v}`}>
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            const d = new Date(ref);
            if (sub === 'mensual') d.setMonth(d.getMonth() - 1);
            else if (sub === 'semanal') d.setDate(d.getDate() - 7);
            else d.setFullYear(d.getFullYear() - 1);
            setRef(d);
          }} className="px-2 py-1 hover:bg-slate-700 rounded">←</button>
          <span className="font-semibold">
            {sub === 'mensual' && ref.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            {sub === 'semanal' && `Sem. de ${ref.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            {sub === 'anual' && ref.getFullYear()}
          </span>
          <button onClick={() => {
            const d = new Date(ref);
            if (sub === 'mensual') d.setMonth(d.getMonth() + 1);
            else if (sub === 'semanal') d.setDate(d.getDate() + 7);
            else d.setFullYear(d.getFullYear() + 1);
            setRef(d);
          }} className="px-2 py-1 hover:bg-slate-700 rounded">→</button>
        </div>
      </div>
      {sub === 'mensual' && <CalMensual ref_={ref} tareasByDate={tareasByDate} onOpen={onOpen} priColor={priColor} />}
      {sub === 'semanal' && <CalSemanal ref_={ref} tareasByDate={tareasByDate} onOpen={onOpen} priColor={priColor} />}
      {sub === 'anual' && <CalAnual ref_={ref} tareas={tareas} setSub={setSub} setRef={setRef} />}
    </div>
  );
};

const CalMensual = ({ ref_, tareasByDate, onOpen, priColor }) => {
  const y = ref_.getFullYear(), m = ref_.getMonth();
  const firstDay = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // lunes=0
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  return (
    <div className="p-3">
      <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs font-semibold text-slate-600">
        {weekDays.map(w => <div key={w}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="min-h-[80px] bg-slate-50 rounded" />;
          const k = d.toISOString().slice(0, 10);
          const ts = tareasByDate[k] || [];
          return (
            <div key={i} className="min-h-[80px] border border-slate-200 rounded p-1 text-xs">
              <div className="text-[10px] text-slate-500 mb-0.5">{d.getDate()}</div>
              {ts.slice(0, 3).map(t => (
                <div key={t.id} onClick={() => onOpen(t)}
                     className={`${priColor(t.prioridad)} text-white px-1 py-0.5 rounded truncate cursor-pointer mb-0.5 text-[10px]`}
                     title={t.titulo} data-testid={`cal-chip-${t.id}`}>
                  {t.titulo}
                </div>
              ))}
              {ts.length > 3 && <div className="text-[9px] text-slate-500">+{ts.length - 3} más</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CalSemanal = ({ ref_, tareasByDate, onOpen, priColor }) => {
  // Calcular lunes de la semana del ref_
  const start = new Date(ref_);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d;
  });
  return (
    <div className="p-3">
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, idx) => {
          const k = d.toISOString().slice(0, 10);
          const ts = tareasByDate[k] || [];
          return (
            <div key={idx} className="border border-slate-200 rounded p-2 min-h-[200px]">
              <div className="text-xs font-semibold text-slate-700 mb-1 capitalize">
                {d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
              </div>
              {ts.map(t => (
                <div key={t.id} onClick={() => onOpen(t)}
                     className={`${priColor(t.prioridad)} text-white p-1 rounded mb-1 cursor-pointer text-xs`}>
                  <div className="font-medium truncate">{t.titulo}</div>
                  {t.responsable_nombre && <div className="text-[10px] opacity-80 truncate">{t.responsable_nombre}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CalAnual = ({ ref_, tareas, setSub, setRef }) => {
  const y = ref_.getFullYear();
  const counts = Array.from({ length: 12 }, (_, m) => {
    const c = tareas.filter(t => {
      if (!t.fecha_limite) return false;
      const d = new Date(t.fecha_limite);
      return d.getFullYear() === y && d.getMonth() === m && t.estado !== 'completada' && t.estado !== 'cancelada';
    }).length;
    return c;
  });
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return (
    <div className="p-3 grid grid-cols-4 gap-3">
      {nombres.map((n, i) => (
        <div key={i}
             onClick={() => { setRef(new Date(y, i, 1)); setSub('mensual'); }}
             className="border border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 cursor-pointer"
             data-testid={`cal-anual-${i}`}>
          <div className="font-semibold text-slate-900">{n}</div>
          <div className="text-xs text-slate-500">{y}</div>
          <div className="mt-2 flex items-center justify-center gap-1">
            <span className={`w-3 h-3 rounded-full ${counts[i] > 0 ? 'bg-red-500' : 'bg-slate-200'}`}></span>
            <span className="text-xs font-medium">{counts[i]} pendientes</span>
          </div>
        </div>
      ))}
    </div>
  );
};
