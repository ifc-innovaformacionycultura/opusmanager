// Gestión de incidencias / feedback enviado por el equipo.
import React, { useState, useEffect } from 'react';
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

const GestorIncidencias = () => {
  const { api } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');

  const cargar = async () => {
    try {
      setLoading(true);
      const qs = filtroEstado ? `?estado=${filtroEstado}` : '';
      const r = await api.get(`/api/gestor/incidencias${qs}`);
      setList(r.data?.incidencias || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [filtroEstado]);

  const cambiarEstado = async (inc, nuevo) => {
    await api.put(`/api/gestor/incidencias/${inc.id}`, { estado: nuevo });
    await cargar();
  };
  const eliminar = async (inc) => {
    if (!confirm('¿Eliminar esta incidencia?')) return;
    await api.delete(`/api/gestor/incidencias/${inc.id}`);
    await cargar();
  };

  return (
    <div className="p-6" data-testid="incidencias-page">
      <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Feedback e incidencias</h1>
          <p className="text-sm text-slate-600 mt-1">Sugerencias y problemas reportados por el equipo.</p>
        </div>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                data-testid="filter-estado-inc">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="en_revision">En revisión</option>
          <option value="resuelto">Resueltos</option>
        </select>
      </header>
      {loading ? <div className="text-slate-500">Cargando...</div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Descripción</th>
                <th className="text-left px-3 py-2">Autor</th>
                <th className="text-left px-3 py-2">Página</th>
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-right px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Sin incidencias.</td></tr>}
              {list.map(inc => {
                const tb = TIPO_BADGE[inc.tipo] || TIPO_BADGE.incidencia;
                const eb = ESTADO_BADGE[inc.estado] || ESTADO_BADGE.pendiente;
                return (
                  <tr key={inc.id} className="hover:bg-slate-50" data-testid={`inc-row-${inc.id}`}>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tb.cls}`}>{tb.label}</span></td>
                    <td className="px-3 py-2 text-slate-900 max-w-md">{inc.descripcion}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{inc.usuario_nombre || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs font-mono">{inc.pagina || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{inc.created_at ? new Date(inc.created_at).toLocaleString('es-ES') : '—'}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${eb.cls}`}>{eb.label}</span></td>
                    <td className="px-3 py-2 text-right">
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
