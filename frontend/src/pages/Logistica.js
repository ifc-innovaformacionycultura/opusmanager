// /asistencia/logistica — Vista global de logística por evento.
// Acordeón: cada evento con logística (estado=abierto) muestra una tabla de
// músicos confirmados + estado de Ida / Vuelta / Alojamiento + totales.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const fmtDateES = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};
const daysFromNow = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.round((d - today) / (1000 * 60 * 60 * 24));
  } catch { return null; }
};

const EstadoBadge = ({ value }) => {
  if (!value) return <span className="text-slate-300">—</span>;
  const cls = value === '✅' ? 'text-emerald-600' : value === '❌' ? 'text-red-600' : 'text-amber-500';
  return <span className={`text-base ${cls}`}>{value}</span>;
};

function EventoAccordion({ ev }) {
  const [open, setOpen] = useState(false);
  const dl = daysFromNow(ev.fecha_limite_min);
  const limiteAlerta = dl !== null && dl <= 7;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white" data-testid={`logistica-evento-${ev.evento_id}`}
         {...(open ? {
           'data-entidad-nombre': ev.nombre || '',
           'data-entidad-tipo': 'evento',
           'data-entidad-id': ev.evento_id || '',
         } : {})}>
      <button type="button" onClick={() => setOpen(o => !o)}
              data-testid={`btn-toggle-${ev.evento_id}`}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">{ev.nombre}</span>
            <span className="text-xs text-slate-500">
              {fmtDateES(ev.fecha_inicio)}{ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio ? ` → ${fmtDateES(ev.fecha_fin)}` : ''}
            </span>
          </div>
          <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-2">
            <span>👥 {ev.totales?.asignados_confirmados || 0} confirmados</span>
            <span>🚌➡️ Ida: <strong>{ev.totales?.ida_confirmada || 0}</strong></span>
            <span>⬅️🚌 Vuelta: <strong>{ev.totales?.vuelta_confirmada || 0}</strong></span>
            <span>🏨 Alojamiento: <strong>{ev.totales?.alojamiento_confirmado || 0}</strong></span>
            {ev.fecha_limite_min && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${limiteAlerta ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}
                    title="Fecha límite mínima">
                {limiteAlerta ? '⚠️ ' : ''}Lím: {fmtDateES(ev.fecha_limite_min)}{dl !== null ? ` · ${dl}d` : ''}
              </span>
            )}
          </div>
        </div>
        <span className="text-slate-400 shrink-0">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-200 p-4 bg-slate-50/50">
          {(ev.musicos || []).length === 0 ? (
            <p className="text-sm text-slate-500 italic">Sin músicos confirmados en este evento.</p>
          ) : (
            <div className="overflow-x-auto bg-white rounded border border-slate-200">
              <table className="w-full text-xs" data-testid={`tabla-musicos-${ev.evento_id}`}>
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Músico</th>
                    <th className="px-3 py-2 text-left">Instrumento</th>
                    <th className="px-3 py-2 text-center">Ida</th>
                    <th className="px-3 py-2 text-center">Vuelta</th>
                    <th className="px-3 py-2 text-center">Alojamiento</th>
                    <th className="px-3 py-2 text-left">Punto recogida</th>
                    <th className="px-3 py-2 text-left">Fecha confirmación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ev.musicos.map(m => (
                    <tr key={m.usuario_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{m.apellidos || ''}, {m.nombre || ''}</td>
                      <td className="px-3 py-2">{m.instrumento || '—'}</td>
                      <td className="px-3 py-2 text-center"><EstadoBadge value={m.ida} /></td>
                      <td className="px-3 py-2 text-center"><EstadoBadge value={m.vuelta} /></td>
                      <td className="px-3 py-2 text-center"><EstadoBadge value={m.alojamiento} /></td>
                      <td className="px-3 py-2">{m.punto_recogida || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{m.fecha_confirmacion ? fmtDateES(m.fecha_confirmacion) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Logistica() {
  const { api } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const r = await api.get('/api/gestor/logistica');
        setEventos(r.data?.eventos || []);
      } catch (e) {
        setError(e.response?.data?.detail || e.message);
      } finally { setLoading(false); }
    };
    cargar();
  }, [api]);

  return (
    <div className="space-y-4 p-4" data-testid="page-logistica">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-2xl font-bold text-slate-900 flex items-center gap-2">🚌 Logística</h1>
          <p className="text-sm text-slate-500">Resumen global de transportes y alojamientos por evento.</p>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-500">Cargando…</div>}
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3" data-testid="logistica-error">{error}</div>}

      {!loading && !error && eventos.length === 0 && (
        <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-lg p-6 text-center" data-testid="logistica-empty">
          No hay eventos abiertos con logística configurada.
        </div>
      )}

      <div className="space-y-2">
        {eventos.map(ev => <EventoAccordion key={ev.evento_id} ev={ev} />)}
      </div>
    </div>
  );
}
