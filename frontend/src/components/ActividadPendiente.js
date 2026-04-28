// Panel de actividad pendiente con KPIs en tiempo real.
// Usa /api/gestor/dashboard/resumen.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const KPI_CFG = [
  { k: 'verificaciones_pendientes', label: 'verificaciones pendientes', icon: '🟡', color: 'amber',  link: '/configuracion/eventos' },
  { k: 'comentarios_pendientes',    label: 'comentarios sin responder', icon: '💬', color: 'blue',   link: '/configuracion/eventos' },
  { k: 'tareas_proximas',            label: 'tareas próximas (15 días)', icon: '✅', color: 'emerald',link: '/tareas' },
  { k: 'eventos_proximos',           label: 'eventos próximos (15 días)', icon: '📅', color: 'sky',   link: '/configuracion/eventos' },
  { k: 'musicos_sin_activar',        label: 'músicos pendientes de activación', icon: '📨', color: 'violet', link: '/admin/musicos?invitacion=pendiente' },
  { k: 'recordatorios_enviados_hoy', label: 'recordatorios push enviados hoy', icon: '🔔', color: 'teal',   link: '/admin/recordatorios' },
  { k: 'errores_recientes',          label: 'errores de envío recientes',     icon: '⚠️', color: 'rose',   link: '/admin/recordatorios', alertWhenPositive: true },
];

const COLOR_CFG = {
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-300',   dot: 'bg-amber-500' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-300',    dot: 'bg-blue-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-800',     border: 'border-sky-300',     dot: 'bg-sky-500' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-800',  border: 'border-violet-300',  dot: 'bg-violet-500' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-800',    border: 'border-teal-300',    dot: 'bg-teal-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-800',    border: 'border-rose-300',    dot: 'bg-rose-500' },
};

export default function ActividadPendiente() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/gestor/dashboard/resumen');
        setData(r.data);
      } catch {/* noop */ }
      finally { setCargando(false); }
    })();
  }, [api]);

  if (cargando) {
    return <div className="bg-white rounded-xl border border-slate-200 p-5 text-center text-sm text-slate-500" data-testid="actividad-loading">Cargando…</div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-4" data-testid="actividad-pendiente">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {KPI_CFG.map(k => {
          const cfg = COLOR_CFG[k.color];
          const v = data.kpis?.[k.k] || 0;
          const alerted = k.alertWhenPositive && v > 0;
          return (
            <button key={k.k}
                    onClick={() => navigate(k.link)}
                    data-testid={`kpi-${k.k}`}
                    className={`${cfg.bg} ${cfg.text} border ${cfg.border} rounded-xl p-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all relative ${alerted ? 'ring-2 ring-rose-400 animate-pulse' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{k.icon}</span>
                <span className={`text-3xl font-extrabold leading-none`}>{v}</span>
                {alerted && (
                  <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold" data-testid={`kpi-alert-${k.k}`}>!</span>
                )}
              </div>
              <div className="text-[11px] uppercase tracking-wide font-semibold opacity-80">{k.label}</div>
            </button>
          );
        })}
      </div>

      {/* Pendientes equipo */}
      {(data.pendientes_equipo || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">💬 Pendientes del equipo</h3>
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
            {data.pendientes_equipo.map(p => (
              <div key={p.id} data-testid={`pend-${p.id}`}
                   className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-slate-100 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                   onClick={() => p.tipo === 'tarea' ? navigate('/tareas') : navigate(p.pagina || '/configuracion/eventos')}>
                <span className="text-base">{p.tipo === 'tarea' ? '✅' : '💬'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{p.titulo}</div>
                  <div className="text-[11px] text-slate-500 flex gap-2">
                    {p.entidad && <span>{p.entidad}</span>}
                    {p.fecha && <span>· {p.fecha}</span>}
                    {p.autor && <span>· por {p.autor}</span>}
                  </div>
                </div>
                {p.prioridad && <span className="text-[10px] uppercase font-bold text-slate-500">{p.prioridad}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pendientes verificación */}
      {(data.pendientes_verificacion || []).length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-300 p-4">
          <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-1.5">🟡 Pendientes de verificación (eventos en borrador)</h3>
          <div className="space-y-1.5">
            {data.pendientes_verificacion.map(p => (
              <button key={p.evento_id}
                      onClick={() => navigate('/configuracion/eventos')}
                      data-testid={`verif-pend-${p.evento_id}`}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 bg-white rounded border border-amber-200 hover:bg-amber-100/30">
                <span className="text-base">📋</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{p.evento_nombre}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.pendientes}/{p.total} secciones pendientes · {p.secciones_pendientes.slice(0, 3).join(', ')}{p.secciones_pendientes.length > 3 ? '…' : ''}
                  </div>
                </div>
                <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded font-bold">{p.pendientes}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Próximos 15 días */}
      <div className="bg-white rounded-xl border border-slate-200 p-4" data-testid="proximos-15-dias">
        <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">📅 Próximos 15 días</h3>
        {(data.proximos_15_dias || []).length === 0 ? (
          <div className="text-center py-4 text-sm text-slate-400">Sin actividad en los próximos 15 días.</div>
        ) : (
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {data.proximos_15_dias.map(e => (
              <div key={e.id}
                   onClick={() => navigate('/configuracion/eventos')}
                   data-testid={`prox15-${e.id}`}
                   className="flex items-center gap-2 px-2.5 py-1.5 rounded border-l-4 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                   style={{ borderLeftColor: e.color }}>
                <span className="text-lg">{e.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{e.titulo}</div>
                  <div className="text-[11px] text-slate-500">
                    {e.fecha} {e.hora && `· ${e.hora}`}{e.lugar ? ` · ${e.lugar}` : ''}
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold opacity-60">{e.tipo}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
