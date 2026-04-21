// Gestor: Historial de emails enviados (Bloque 3)
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const estadoBadge = (estado) => estado === 'enviado'
  ? 'bg-green-100 text-green-800'
  : estado === 'error'
  ? 'bg-red-100 text-red-800'
  : 'bg-slate-100 text-slate-700';

const GestorEmailLog = () => {
  const { api } = useAuth();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/gestor/emails/log?limit=200');
      setEmails(res.data?.emails || []);
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const reenviar = async (id) => {
    if (!window.confirm('¿Reenviar este email?')) return;
    try {
      setResending(id);
      const res = await api.post('/api/gestor/emails/reenviar', { email_log_id: id });
      alert(res.data?.sent ? '✅ Email reenviado correctamente' : `❌ Error: ${res.data?.reason}`);
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

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500">Cargando...</div>
        ) : emails.length === 0 ? (
          <div className="py-12 text-center text-slate-500">Aún no se han enviado emails.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="emaillog-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Destinatario</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Asunto</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emails.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50" data-testid={`email-row-${e.id}`}>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {e.created_at ? new Date(e.created_at).toLocaleString('es-ES') : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{e.destinatario}</td>
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
