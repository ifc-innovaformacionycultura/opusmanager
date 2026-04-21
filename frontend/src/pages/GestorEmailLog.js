// Gestor: Historial de emails + filtros + contadores
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const estadoBadge = (estado) => estado === 'enviado'
  ? 'bg-green-100 text-green-800'
  : estado === 'error'
  ? 'bg-red-100 text-red-800'
  : 'bg-slate-100 text-slate-700';

const GestorEmailLog = () => {
  const { api } = useAuth();
  const [emails, setEmails] = useState([]);
  const [contadores, setContadores] = useState({ enviados_hoy: 0, errores_hoy: 0, enviados_mes: 0 });
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(null);

  // Filters
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (filterTipo) params.set('tipo', filterTipo);
      if (filterEstado) params.set('estado', filterEstado);
      if (filterDesde) params.set('desde', filterDesde);
      if (filterHasta) params.set('hasta', filterHasta);
      const res = await api.get(`/api/gestor/emails/log?${params.toString()}`);
      setEmails(res.data?.emails || []);
      setContadores(res.data?.contadores || { enviados_hoy: 0, errores_hoy: 0, enviados_mes: 0 });
    } finally { setLoading(false); }
  }, [api, filterTipo, filterEstado, filterDesde, filterHasta]);

  useEffect(() => { load(); }, [load]);

  const tipos = useMemo(() => Array.from(new Set(emails.map(e => e.tipo).filter(Boolean))), [emails]);

  const reenviar = async (id) => {
    if (!window.confirm('¿Reenviar este email?')) return;
    try {
      setResending(id);
      const res = await api.post('/api/gestor/emails/reenviar', { email_log_id: id });
      alert(res.data?.sent ? '✅ Email reenviado correctamente' : `❌ ${res.data?.reason}`);
      await load();
    } catch (err) {
      alert(`Error: ${err.response?.data?.detail || err.message}`);
    } finally { setResending(null); }
  };

  return (
    <div className="p-6" data-testid="gestor-emaillog-page">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Historial de emails</h1>
          <p className="font-ibm text-slate-600 mt-1">Todos los emails enviados desde el sistema.</p>
        </div>
        <button onClick={load} className="px-3 py-2 text-sm border border-slate-300 bg-white rounded-md hover:bg-slate-50">
          Recargar
        </button>
      </header>

      {/* Contadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg" data-testid="contador-hoy">
          <p className="text-xs uppercase text-green-700 font-semibold">Enviados hoy</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{contadores.enviados_hoy}</p>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg" data-testid="contador-errores">
          <p className="text-xs uppercase text-red-700 font-semibold">Errores hoy</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{contadores.errores_hoy}</p>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="contador-mes">
          <p className="text-xs uppercase text-blue-700 font-semibold">Enviados este mes</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{contadores.enviados_mes}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
              data-testid="filter-tipo"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
              <option value="">Todos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
              data-testid="filter-estado"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
              <option value="">Todos</option>
              <option value="enviado">Enviado</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
            <input type="date" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)}
              data-testid="filter-desde"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
            <input type="date" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)}
              data-testid="filter-hasta"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500">Cargando...</div>
        ) : emails.length === 0 ? (
          <div className="py-12 text-center text-slate-500">No hay emails con estos filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="emaillog-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha y hora</th>
                  <th className="px-4 py-3 text-left">Destinatario</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Asunto</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">ID Resend</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emails.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50" data-testid={`email-row-${e.id}`}>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {e.created_at ? new Date(e.created_at).toLocaleString('es-ES') : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium">{e.destinatario_nombre || '—'}</div>
                      <div className="text-xs text-slate-500">{e.destinatario}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{e.tipo}</td>
                    <td className="px-4 py-3 text-slate-700">{e.asunto || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(e.estado)}`}>
                        {e.estado}
                      </span>
                      {e.estado === 'error' && e.error_mensaje && (
                        <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={e.error_mensaje}>
                          {e.error_mensaje}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono truncate max-w-[140px]" title={e.resend_id || ''}>
                      {e.resend_id ? e.resend_id.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => reenviar(e.id)}
                        disabled={resending === e.id}
                        data-testid={`btn-reenviar-${e.id}`}
                        className="text-xs text-slate-700 hover:bg-slate-200 px-2 py-1 rounded border border-slate-300 disabled:opacity-60"
                      >
                        {resending === e.id ? 'Reenviando...' : 'Reenviar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GestorEmailLog;
