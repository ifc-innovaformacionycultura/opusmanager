// Gestión de incidencias / feedback enviado por el equipo y los músicos.
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

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

const GestorIncidencias = () => {
  const { api } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [respuestas, setRespuestas] = useState({});

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const qs = filtroEstado ? `?estado=${filtroEstado}` : '';
      const r = await api.get(`/api/gestor/incidencias${qs}`);
      setList(r.data?.incidencias || []);
    } finally { setLoading(false); }
  }, [api, filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

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
