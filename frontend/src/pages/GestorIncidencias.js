// Gestión de incidencias / feedback enviado por el equipo y los músicos.
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const TIPO_BADGE = {
  incidencia: { label: '🐞 Incidencia', cls: 'bg-red-100 text-red-800' },
  mejora:     { label: '✨ Mejora',     cls: 'bg-blue-100 text-blue-800' },
  pregunta:   { label: '❓ Pregunta',   cls: 'bg-slate-100 text-slate-700' },
};
const ESTADO_BADGE = {
  pendiente:    { label: 'Pendiente',    cls: 'bg-amber-100 text-amber-800' },
  en_revision:  { label: 'En revisión',  cls: 'bg-blue-100 text-blue-800' },
  resuelto:     { label: 'Resuelto',     cls: 'bg-green-100 text-green-800' },
};
const PRIO_BADGE = {
  alta:  { label: '🔴 Alta',  cls: 'bg-red-100 text-red-800' },
  media: { label: '🟡 Media', cls: 'bg-amber-100 text-amber-800' },
  baja:  { label: '🟢 Baja',  cls: 'bg-emerald-100 text-emerald-800' },
};
const MIN_DESC = 20;

const GestorIncidencias = () => {
  const { api } = useAuth();
  const loc = useLocation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [respuestas, setRespuestas] = useState({});

  // Modal de creación
  const [createOpen, setCreateOpen] = useState(false);
  const [newTipo, setNewTipo] = useState('incidencia');
  const [newPrio, setNewPrio] = useState('media');
  const [newPagina, setNewPagina] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const qs = filtroEstado ? `?estado=${filtroEstado}` : '';
      const r = await api.get(`/api/gestor/incidencias${qs}`);
      setList(r.data?.incidencias || []);
    } finally { setLoading(false); }
  }, [api, filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirCrear = () => {
    setNewTipo('incidencia');
    setNewPrio('media');
    setNewPagina(loc.pathname || '');
    setNewDesc('');
    setCreateError(null);
    setCreateOpen(true);
  };

  const crearIncidencia = async () => {
    const txt = newDesc.trim();
    if (txt.length < MIN_DESC) {
      setCreateError(`Mínimo ${MIN_DESC} caracteres (actuales: ${txt.length})`);
      return;
    }
    try {
      setCreating(true);
      setCreateError(null);
      await api.post('/api/gestor/incidencias', {
        tipo: newTipo,
        descripcion: txt,
        pagina: newPagina || null,
        prioridad: newPrio,
      });
      setCreateOpen(false);
      await cargar();
    } catch (err) {
      setCreateError(err?.response?.data?.detail || err.message || 'Error al crear');
    } finally {
      setCreating(false);
    }
  };

  const cambiarEstado = async (inc, nuevo) => {
    await api.put(`/api/gestor/incidencias/${inc.id}`, { estado: nuevo });
    await cargar();
  };
  const guardarRespuesta = async (inc) => {
    const texto = respuestas[inc.id] ?? inc.respuesta ?? '';
    await api.put(`/api/gestor/incidencias/${inc.id}`, { respuesta: texto });
    await cargar();
  };
  const cambiarPrioridad = async (inc, prio) => {
    await api.put(`/api/gestor/incidencias/${inc.id}`, { prioridad: prio });
    await cargar();
  };
  const eliminar = async (inc) => {
    if (!window.confirm('¿Eliminar esta incidencia?')) return;
    await api.delete(`/api/gestor/incidencias/${inc.id}`);
    await cargar();
  };

  const lista = list.filter(inc => {
    if (filtroTipo && inc.tipo !== filtroTipo) return false;
    if (filtroDesde && inc.created_at && inc.created_at < filtroDesde) return false;
    if (filtroHasta && inc.created_at && inc.created_at.slice(0, 10) > filtroHasta) return false;
    return true;
  });

  return (
    <div className="p-6" data-testid="incidencias-page">
      <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Feedback e incidencias</h1>
          <p className="text-sm text-slate-600 mt-1">Sugerencias y problemas reportados por el equipo y los músicos.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={abrirCrear}
            data-testid="btn-create-incidencia"
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 shadow-sm"
          >
            + Crear incidencia
          </button>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white"
                  data-testid="filter-tipo-inc">
            <option value="">Todos los tipos</option>
            <option value="incidencia">Incidencias</option>
            <option value="mejora">Mejoras</option>
            <option value="pregunta">Preguntas</option>
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white"
                  data-testid="filter-estado-inc">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_revision">En revisión</option>
            <option value="resuelto">Resueltos</option>
          </select>
          <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
                 data-testid="filter-desde-inc"
                 className="px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white" title="Desde" />
          <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
                 data-testid="filter-hasta-inc"
                 className="px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white" title="Hasta" />
        </div>
      </header>

      {createOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
          data-testid="modal-create-incidencia"
          onClick={() => !creating && setCreateOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-cabinet text-xl font-bold text-slate-900 mb-1">Crear incidencia</h2>
            <p className="text-xs text-slate-500 mb-4">Reporta una incidencia, mejora o pregunta del sistema.</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="text-xs font-medium text-slate-700">
                Tipo
                <select
                  value={newTipo}
                  onChange={(e) => setNewTipo(e.target.value)}
                  data-testid="new-inc-tipo"
                  className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="incidencia">🐞 Incidencia</option>
                  <option value="mejora">✨ Mejora</option>
                  <option value="pregunta">❓ Pregunta</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Prioridad
                <select
                  value={newPrio}
                  onChange={(e) => setNewPrio(e.target.value)}
                  data-testid="new-inc-prio"
                  className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Media</option>
                  <option value="baja">🟢 Baja</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-medium text-slate-700 mb-3">
              Página relacionada (opcional)
              <input
                type="text"
                value={newPagina}
                onChange={(e) => setNewPagina(e.target.value)}
                placeholder="/admin/incidencias"
                data-testid="new-inc-pagina"
                className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm font-mono"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              Descripción <span className="text-slate-400">(mínimo {MIN_DESC} caracteres)</span>
              <textarea
                rows={5}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                data-testid="new-inc-desc"
                placeholder="Describe la incidencia o sugerencia con el mayor detalle posible..."
                className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm"
              />
              <span className={`text-[10px] ${newDesc.trim().length < MIN_DESC ? 'text-red-500' : 'text-emerald-600'}`}>
                {newDesc.trim().length}/{MIN_DESC}
              </span>
            </label>

            {createError && (
              <div className="mt-3 px-3 py-2 bg-red-50 text-red-700 text-xs rounded-md" data-testid="new-inc-error">
                {createError}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                data-testid="btn-cancel-inc"
                className="px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={crearIncidencia}
                disabled={creating || newDesc.trim().length < MIN_DESC}
                data-testid="btn-submit-inc"
                className="px-4 py-1.5 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-slate-500">Cargando...</div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Prio.</th>
                <th className="text-left px-3 py-2">Descripción</th>
                <th className="text-left px-3 py-2">Autor</th>
                <th className="text-left px-3 py-2">Página</th>
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-left px-3 py-2 min-w-[260px]">Respuesta del gestor</th>
                <th className="text-right px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Sin incidencias.</td></tr>}
              {lista.map(inc => {
                const tb = TIPO_BADGE[inc.tipo] || TIPO_BADGE.incidencia;
                const eb = ESTADO_BADGE[inc.estado] || ESTADO_BADGE.pendiente;
                const pb = PRIO_BADGE[inc.prioridad] || PRIO_BADGE.media;
                const respValue = respuestas[inc.id] ?? inc.respuesta ?? '';
                return (
                  <tr key={inc.id} className="hover:bg-slate-50 align-top" data-testid={`inc-row-${inc.id}`}>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tb.cls}`}>{tb.label}</span></td>
                    <td className="px-3 py-2">
                      <select value={inc.prioridad || 'media'} onChange={(e) => cambiarPrioridad(inc, e.target.value)}
                              data-testid={`sel-prio-${inc.id}`}
                              className={`text-[11px] font-medium rounded px-1.5 py-0.5 ${pb.cls} border-0`}>
                        <option value="alta">🔴 Alta</option>
                        <option value="media">🟡 Media</option>
                        <option value="baja">🟢 Baja</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-900 max-w-md">{inc.descripcion}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{inc.usuario_nombre || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs font-mono">{inc.pagina || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{inc.created_at ? new Date(inc.created_at).toLocaleString('es-ES') : '—'}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${eb.cls}`}>{eb.label}</span></td>
                    <td className="px-3 py-2">
                      <textarea rows={2} value={respValue}
                                onChange={(e) => setRespuestas(prev => ({ ...prev, [inc.id]: e.target.value }))}
                                data-testid={`txt-resp-${inc.id}`}
                                placeholder="Respuesta interna…"
                                className="w-full text-xs border border-slate-300 rounded px-2 py-1" />
                      {respuestas[inc.id] !== undefined && respuestas[inc.id] !== inc.respuesta && (
                        <button type="button" onClick={() => guardarRespuesta(inc)}
                                data-testid={`btn-save-resp-${inc.id}`}
                                className="mt-1 text-[11px] text-emerald-700 hover:underline">Guardar respuesta</button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <select value={inc.estado} onChange={(e) => cambiarEstado(inc, e.target.value)}
                              className="text-xs border border-slate-300 rounded px-1 py-0.5 mr-2"
                              data-testid={`sel-estado-${inc.id}`}>
                        <option value="pendiente">Pendiente</option>
                        <option value="en_revision">En revisión</option>
                        <option value="resuelto">Resuelto</option>
                      </select>
                      <button onClick={() => eliminar(inc)} className="text-xs text-red-600 hover:underline" data-testid={`btn-del-inc-${inc.id}`}>Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GestorIncidencias;
