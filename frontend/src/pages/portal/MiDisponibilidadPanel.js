// Panel "Fechas y mi disponibilidad" — tabla unificada del evento
// Columnas: Tipo | Fecha | Hora inicio–fin | Lugar | ¿Asisto? (Sí/No/—)
// Todas las fechas vienen SIEMPRE de la tabla `ensayos` (tipo=ensayo|concierto|funcion).
// Persiste cambios con POST /api/portal/disponibilidad/bulk.
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8001/api'
  : `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtFecha = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch { return iso; }
};
const fmtHora = (h) => h ? String(h).slice(0, 5) : '';

const tipoLabel = (t) => {
  const v = (t || 'ensayo').toLowerCase();
  if (v === 'concierto') return { label: 'Concierto', cls: 'bg-amber-100 text-amber-800' };
  if (v === 'funcion') return { label: 'Función', cls: 'bg-purple-100 text-purple-800' };
  return { label: 'Ensayo', cls: 'bg-slate-100 text-slate-700' };
};

const MiDisponibilidadPanel = ({ ensayos = [], onSaved }) => {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const init = {};
    ensayos.forEach(e => { init[e.id] = e.mi_disponibilidad; });
    setValues(init);
  }, [ensayos]);

  const setVal = (id, v) => setValues(prev => ({ ...prev, [id]: v }));

  const dirty = useMemo(() => {
    for (const e of ensayos) {
      if ((values[e.id] ?? null) !== (e.mi_disponibilidad ?? null)) return true;
    }
    return false;
  }, [values, ensayos]);

  const guardar = async () => {
    try {
      setSaving(true); setMsg(null);
      const entries = ensayos.map(e => ({ ensayo_id: e.id, asiste: values[e.id] ?? null }));
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/portal/disponibilidad/bulk`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al guardar disponibilidad');
      }
      const d = await response.json();
      const total = (d.actualizados || 0) + (d.creados || 0) + (d.borrados || 0);
      setMsg({ type: 'success', text: `${total} cambios guardados correctamente` });
      onSaved && onSaved();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 6000);
    }
  };

  if (!ensayos.length) return null;

  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-200" data-testid="mi-disponibilidad-panel">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="font-cabinet text-lg font-semibold text-slate-900 flex items-center gap-2">
            🗓️ Fechas y mi disponibilidad
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Revisa todas las fechas del evento y confirma tu asistencia. Los datos provienen directamente de la configuración del gestor.
          </p>
        </div>
        <button
          onClick={guardar}
          disabled={!dirty || saving}
          data-testid="btn-guardar-disponibilidad"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar disponibilidad'}
        </button>
      </div>

      {msg && (
        <div
          data-testid="disponibilidad-msg"
          className={`mb-3 p-2.5 rounded-lg text-sm border ${
            msg.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="tabla-fechas-disponibilidad">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">Fecha</th>
              <th className="text-left px-3 py-2 font-medium">Horario</th>
              <th className="text-left px-3 py-2 font-medium">Lugar</th>
              <th className="text-center px-3 py-2 font-medium">¿Asisto?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ensayos.map((e) => {
              const v = values[e.id] ?? null;
              const t = tipoLabel(e.tipo);
              const noConv = e.convocado === false;
              return (
                <tr key={e.id} className={`hover:bg-slate-50 ${noConv ? 'bg-slate-50/70' : ''}`} data-testid={`disp-row-${e.id}`}>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${t.cls}`}>
                      {t.label}
                    </span>
                    {e.obligatorio && !noConv && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                        Obligatorio
                      </span>
                    )}
                    {noConv && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600" title="Tu instrumento no está convocado a este ensayo">
                        No convocado
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-2 capitalize ${noConv ? 'text-slate-400' : 'text-slate-900'}`}>{fmtFecha(e.fecha)}</td>
                  <td className={`px-3 py-2 tabular-nums ${noConv ? 'text-slate-400' : 'text-slate-700'}`}>
                    {e.hora ? fmtHora(e.hora) : '—'}
                    {e.hora_fin ? ` – ${fmtHora(e.hora_fin)}` : ''}
                  </td>
                  <td className={`px-3 py-2 ${noConv ? 'text-slate-400' : 'text-slate-600'}`}>{e.lugar || '—'}</td>
                  <td className="px-3 py-2">
                    {noConv ? (
                      <span className="text-xs text-slate-400 italic" data-testid={`no-conv-${e.id}`}>— (sin asistencia requerida)</span>
                    ) : (
                      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50" role="group">
                        <button
                          type="button"
                          onClick={() => setVal(e.id, true)}
                          data-testid={`btn-si-${e.id}`}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${v === true ? 'bg-green-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                        >Sí</button>
                        <button
                          type="button"
                          onClick={() => setVal(e.id, false)}
                          data-testid={`btn-no-${e.id}`}
                          className={`px-3 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${v === false ? 'bg-red-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                        >No</button>
                        <button
                          type="button"
                          onClick={() => setVal(e.id, null)}
                          data-testid={`btn-reset-${e.id}`}
                          className={`px-2 py-1.5 text-xs border-l border-slate-200 transition-colors ${v === null ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-400 hover:bg-slate-100'}`}
                          title="Sin respuesta"
                        >—</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MiDisponibilidadPanel;
