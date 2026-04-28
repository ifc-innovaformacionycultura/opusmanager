// Widget de próximos 7 días — usa /api/gestor/calendario-eventos
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const TIPO_CFG = {
  ensayo: { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '🎼' },
  funcion: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: '🎻' },
  logistica: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🚌' },
  montaje: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '🛠️' },
};

export default function Proximos7Dias() {
  const { api } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const hoy = new Date();
      const fin = new Date(); fin.setDate(fin.getDate() + 7);
      const desde = hoy.toISOString().slice(0, 10);
      const hasta = fin.toISOString().slice(0, 10);
      try {
        const r = await api.get(`/api/gestor/calendario-eventos?desde=${desde}&hasta=${hasta}`);
        const arr = (r.data?.eventos || []).sort((a, b) => (a.fecha + (a.hora_inicio || '')).localeCompare(b.fecha + (b.hora_inicio || '')));
        setEventos(arr);
      } catch {/* noop */ }
      finally { setCargando(false); }
    })();
  }, [api]);

  // Agrupar por fecha
  const porFecha = {};
  eventos.forEach(e => { (porFecha[e.fecha] = porFecha[e.fecha] || []).push(e); });
  const fechas = Object.keys(porFecha).sort();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5" data-testid="widget-proximos-7">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <span className="text-xl">📅</span> Próximos 7 días
        </h3>
        <span className="text-xs text-slate-500">{eventos.length} eventos</span>
      </div>
      {cargando ? (
        <div className="text-center py-4 text-sm text-slate-500">Cargando…</div>
      ) : fechas.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400">
          <div className="text-3xl mb-1">✨</div>
          Sin eventos en los próximos 7 días.
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto">
          {fechas.map(f => {
            const date = new Date(f + 'T00:00:00');
            const label = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <div key={f}>
                <div className="text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">{label}</div>
                <div className="space-y-1.5">
                  {porFecha[f].map(e => {
                    const cfg = TIPO_CFG[e.tipo_calendario] || { color: 'bg-slate-100 text-slate-700 border-slate-300', icon: '📌' };
                    return (
                      <button key={e.id}
                              onClick={() => navigate('/configuracion/eventos')}
                              data-testid={`prox-evento-${e.id}`}
                              className={`w-full text-left px-3 py-2 rounded-lg border ${cfg.color} hover:shadow-sm transition flex items-center gap-2`}>
                        <span className="text-base flex-shrink-0">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{e.titulo}</div>
                          {(e.hora_inicio || e.lugar) && (
                            <div className="text-[11px] opacity-70">
                              {e.hora_inicio ? e.hora_inicio.slice(0, 5) : ''}{e.hora_inicio && e.lugar ? ' · ' : ''}{e.lugar || ''}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
