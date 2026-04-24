// Panel "Mi disponibilidad" — se muestra dentro del detalle de cada convocatoria
// del portal del músico. Una fila por ensayo/función con toggle Sí/No.
// Se inicializa con `mi_disponibilidad` viniendo del backend
// y persiste con POST /api/portal/disponibilidad/bulk.
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/SupabaseAuthContext';

const fmtFecha = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  } catch { return iso; }
};
const fmtHora = (h) => h ? String(h).slice(0, 5) : '';

const MiDisponibilidadPanel = ({ ensayos = [], onSaved }) => {
  const { api } = useAuth();
  // Estado local por ensayo_id -> true | false | null
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
      const r = await api.post('/api/portal/disponibilidad/bulk', { entries });
      setMsg({ type: 'success', text: `Disponibilidad guardada · ${r.data.actualizados + r.data.creados} actualizaciones` });
      onSaved && onSaved();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  if (!ensayos.length) return null;

  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-slate-200" data-testid="mi-disponibilidad-panel">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="font-cabinet text-lg font-semibold text-slate-900 flex items-center gap-2">
            🗓️ Mi disponibilidad
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Marca si asistirás a cada ensayo/función. Puedes cambiar tu respuesta mientras la convocatoria esté abierta.
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

      <div className="divide-y divide-slate-100">
        {ensayos.map(e => {
          const v = values[e.id] ?? null;
          return (
            <div
              key={e.id}
              className="py-3 flex items-center justify-between gap-3 flex-wrap"
              data-testid={`disp-row-${e.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 capitalize">
                    {e.tipo || 'ensayo'}
                  </span>
                  {e.obligatorio && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-800">
                      Obligatorio
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-900 mt-1 capitalize">{fmtFecha(e.fecha)}</p>
                <p className="text-xs text-slate-500">
                  {e.hora ? `${fmtHora(e.hora)} · ` : ''}{e.lugar || 'Lugar por confirmar'}
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50" role="group" aria-label="Disponibilidad">
                <button
                  type="button"
                  onClick={() => setVal(e.id, true)}
                  data-testid={`btn-si-${e.id}`}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    v === true
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setVal(e.id, false)}
                  data-testid={`btn-no-${e.id}`}
                  className={`px-3 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${
                    v === false
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setVal(e.id, null)}
                  data-testid={`btn-reset-${e.id}`}
                  className={`px-2 py-1.5 text-xs border-l border-slate-200 transition-colors ${
                    v === null
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-white text-slate-400 hover:bg-slate-100'
                  }`}
                  title="Sin respuesta"
                >
                  —
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MiDisponibilidadPanel;
