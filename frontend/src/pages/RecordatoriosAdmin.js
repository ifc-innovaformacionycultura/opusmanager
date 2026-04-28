// Admin: Página de monitorización de recordatorios push.
// Ruta: /admin/recordatorios — solo admin/director_general.
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const TIPO_LABELS = {
  disponibilidad: { icon: '⏰', label: 'Disponibilidad', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  transporte: { icon: '🚐', label: 'Transporte', color: 'bg-sky-100 text-sky-800 border-sky-300' },
  alojamiento: { icon: '🏨', label: 'Alojamiento', color: 'bg-violet-100 text-violet-800 border-violet-300' },
  tarea: { icon: '📋', label: 'Tarea', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  logistica: { icon: '📦', label: 'Logística', color: 'bg-slate-100 text-slate-700 border-slate-300' },
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};
const fmtDay = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return iso; }
};

const Card = ({ title, children, action }) => (
  <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
      <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

export default function RecordatoriosAdmin() {
  const { api } = useAuth();
  const [status, setStatus] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [suscriptores, setSuscriptores] = useState([]);
  const [errores, setErrores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [filterTipo, setFilterTipo] = useState('');

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [s, h, su, er] = await Promise.all([
        api.get('/api/admin/recordatorios/status'),
        api.get(`/api/admin/recordatorios/historial${filterTipo ? `?tipo=${filterTipo}` : ''}`),
        api.get('/api/admin/recordatorios/suscriptores'),
        api.get('/api/admin/recordatorios/errores'),
      ]);
      setStatus(s.data);
      setHistorial(h.data?.historial || []);
      setSuscriptores(su.data?.suscriptores || []);
      setErrores(er.data?.errores || []);
    } catch (e) {
      setFeedback({ kind: 'error', msg: e?.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  }, [api, filterTipo]);

  useEffect(() => { cargar(); }, [cargar]);

  const ejecutarAhora = async () => {
    setRunning(true); setFeedback(null);
    try {
      const r = await api.post('/api/admin/recordatorios/run-now', {});
      const total = r.data?.total_enviados ?? 0;
      setFeedback({ kind: 'ok', msg: `✅ Job ejecutado — ${total} push enviado${total === 1 ? '' : 's'}` });
      await cargar();
    } catch (e) {
      setFeedback({ kind: 'error', msg: e?.response?.data?.detail || e.message });
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-5 max-w-6xl" data-testid="admin-recordatorios">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-cabinet text-2xl sm:text-3xl font-bold text-slate-900">Recordatorios push</h1>
          <p className="text-sm text-slate-500 mt-1">Monitorización del cron diario y suscripciones de notificaciones.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar} disabled={loading}
            data-testid="btn-recordatorios-refresh"
            className="px-3 py-2 text-sm bg-white border border-slate-300 hover:bg-slate-50 rounded-md text-slate-700 disabled:opacity-60">
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
          <button onClick={ejecutarAhora} disabled={running}
            data-testid="btn-run-now"
            className="px-3 py-2 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium disabled:opacity-60">
            {running ? 'Ejecutando…' : '▶ Ejecutar ahora'}
          </button>
        </div>
      </div>

      {feedback && (
        <div data-testid="recordatorios-feedback" className={`rounded-md px-3 py-2 text-sm ${
          feedback.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>{feedback.msg}</div>
      )}

      {/* Status del scheduler */}
      <Card title="Estado del cron">
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-50 border border-slate-200 rounded p-3" data-testid="kpi-cron-status">
            <p className="text-xs text-slate-500 uppercase">Estado</p>
            <p className={`text-lg font-semibold ${status?.running ? 'text-emerald-700' : 'text-red-700'}`}>
              {status?.running ? '🟢 Running' : '🔴 Detenido'}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <p className="text-xs text-slate-500 uppercase">Días disponibilidad</p>
            <p className="text-lg font-semibold text-slate-900">{status?.dias_antes_disponibilidad ?? '—'}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <p className="text-xs text-slate-500 uppercase">Días logística</p>
            <p className="text-lg font-semibold text-slate-900">{status?.dias_antes_logistica ?? '—'}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <p className="text-xs text-slate-500 uppercase">Días tareas</p>
            <p className="text-lg font-semibold text-slate-900">{status?.dias_antes_tareas ?? '—'}</p>
          </div>
        </div>
        {status?.jobs?.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-xs font-medium text-slate-600 uppercase mb-1">Próximos disparos</p>
            <ul className="space-y-1">
              {status.jobs.map(j => (
                <li key={j.id} className="text-sm text-slate-700 flex justify-between border-t border-slate-100 pt-1">
                  <code className="text-slate-500 text-xs">{j.id}</code>
                  <span className="font-medium">{j.next_run_time || '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Histórico */}
      <Card
        title={`Histórico (${historial.length})`}
        action={
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
            data-testid="filter-tipo-historial"
            className="px-2 py-1 text-xs border border-slate-300 rounded bg-white">
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        }
      >
        {historial.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Sin recordatorios registrados aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Usuario</th>
                  <th className="px-3 py-2 text-left">Días antes</th>
                  <th className="px-3 py-2 text-left">Fecha objetivo</th>
                  <th className="px-3 py-2 text-left">Enviado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.map(r => {
                  const cfg = TIPO_LABELS[r.tipo] || TIPO_LABELS.logistica;
                  return (
                    <tr key={r.id} data-testid={`hist-${r.id}`}>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                          <span>{cfg.icon}</span><span>{cfg.label}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-800">{r.usuario_nombre}</td>
                      <td className="px-3 py-2 text-slate-700">{r.dias_antes}</td>
                      <td className="px-3 py-2 text-slate-700">{fmtDay(r.fecha_objetivo)}</td>
                      <td className="px-3 py-2 text-slate-500">{fmtDate(r.enviado_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Suscriptores */}
      <Card title={`Suscriptores activos (${suscriptores.length})`}>
        {suscriptores.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No hay dispositivos suscritos a notificaciones.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Usuario</th>
                  <th className="px-3 py-2 text-left">Rol</th>
                  <th className="px-3 py-2 text-left">Dispositivo</th>
                  <th className="px-3 py-2 text-left">Suscrito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suscriptores.map(s => (
                  <tr key={s.id} data-testid={`susc-${s.id}`}>
                    <td className="px-3 py-2 text-slate-800">{s.usuario_nombre}</td>
                    <td className="px-3 py-2 text-slate-700">{s.rol || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{s.user_agent || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Errores */}
      <Card title={`Errores recientes (${errores.length})`}>
        {errores.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Sin errores de envío en este arranque del servidor.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {errores.map((e, i) => (
              <li key={i} className="px-4 py-2 text-sm flex items-start gap-2" data-testid={`err-${i}`}>
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{e.kind}</span>
                <span className="flex-1 text-slate-700">{e.message}</span>
                <span className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(e.when)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500">
          Buffer en memoria del servidor — se reinicia con cada deploy. Las suscripciones caducadas se purgan automáticamente.
        </p>
      </Card>
    </div>
  );
}
