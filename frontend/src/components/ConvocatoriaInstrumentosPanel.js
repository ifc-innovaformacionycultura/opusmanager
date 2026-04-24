// Panel colapsable para gestionar los instrumentos convocados a un ensayo.
// Se usa dentro de ConfiguracionEventos.js por cada ensayo persistido.
// API: GET/PUT /api/gestor/ensayos/{ensayo_id}/instrumentos
import React, { useState, useEffect, useCallback } from 'react';

const SECCIONES = [
  { key: 'cuerda',        label: 'Cuerda',        instrumentos: ['Violín', 'Viola', 'Violonchelo', 'Contrabajo'] },
  { key: 'viento_madera', label: 'Viento Madera', instrumentos: ['Flauta', 'Oboe', 'Clarinete', 'Fagot'] },
  { key: 'viento_metal',  label: 'Viento Metal',  instrumentos: ['Trompa', 'Trompeta', 'Trombón', 'Tuba'] },
  { key: 'percusion',     label: 'Percusión',     instrumentos: ['Percusión'] },
  { key: 'teclados',      label: 'Teclados',      instrumentos: ['Piano', 'Órgano'] },
  { key: 'coro',          label: 'Coro',          instrumentos: ['Soprano', 'Alto', 'Tenor', 'Barítono'] },
];

const ALL_INSTRUMENTOS = SECCIONES.flatMap(s => s.instrumentos);

const ConvocatoriaInstrumentosPanel = ({ ensayoId, api, ensayoAnteriorId, ensayoAnteriorLabel, onSaved, mode, tempKey, onLocalChange }) => {
  // mode === 'new' → ensayo aún no persistido; no llama API ni guarda;
  //                  inicializa todo TRUE y propaga cambios al padre vía onLocalChange.
  const isNew = mode === 'new' || !ensayoId;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [state, setState] = useState({}); // { instrumento: true/false }
  const [msg, setMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const cargar = useCallback(async () => {
    if (isNew) {
      // ensayo aún no persistido: inicializar todos TRUE en local
      const map = {};
      ALL_INSTRUMENTOS.forEach(i => { map[i] = true; });
      setState(map);
      setLoaded(true);
      return;
    }
    if (!ensayoId) return;
    try {
      setLoading(true);
      const r = await api.get(`/api/gestor/ensayos/${ensayoId}/instrumentos`);
      const map = {};
      (r.data?.instrumentos || []).forEach(row => {
        map[row.instrumento] = !!row.convocado;
      });
      // Asegurar que todos los estándar están presentes (default true)
      ALL_INSTRUMENTOS.forEach(i => { if (!(i in map)) map[i] = true; });
      setState(map);
      setLoaded(true);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally { setLoading(false); }
  }, [ensayoId, api, isNew]);

  useEffect(() => {
    if (open && !loaded) cargar();
  }, [open, loaded, cargar]);

  // Si es nuevo, inicializar de inmediato sin esperar a abrir el panel
  // y abrirlo automáticamente para que el gestor lo vea (Bloque 4).
  useEffect(() => {
    if (isNew && !loaded) {
      const map = {};
      ALL_INSTRUMENTOS.forEach(i => { map[i] = true; });
      setState(map);
      setLoaded(true);
      setOpen(true);
    }
  }, [isNew, loaded]);

  // Propagar cambios al padre cuando es ensayo nuevo
  useEffect(() => {
    if (isNew && loaded && typeof onLocalChange === 'function') {
      onLocalChange(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isNew, loaded]);

  const toggleInstrumento = (instr) => {
    setState(prev => ({ ...prev, [instr]: !prev[instr] }));
  };

  const toggleSeccion = (instrs, value) => {
    setState(prev => {
      const next = { ...prev };
      instrs.forEach(i => { next[i] = value; });
      return next;
    });
  };

  const toggleTodos = (value) => {
    setState(prev => {
      const next = { ...prev };
      ALL_INSTRUMENTOS.forEach(i => { next[i] = value; });
      return next;
    });
  };

  const copiarEnsayoAnterior = async () => {
    if (!ensayoAnteriorId) return;
    try {
      setCopying(true); setMsg(null);
      const r = await api.get(`/api/gestor/ensayos/${ensayoAnteriorId}/instrumentos`);
      const next = {};
      (r.data?.instrumentos || []).forEach(row => {
        next[row.instrumento] = !!row.convocado;
      });
      ALL_INSTRUMENTOS.forEach(i => { if (!(i in next)) next[i] = true; });
      setState(next);
      setMsg({ type: 'info', text: '📋 Convocatoria copiada del ensayo anterior. Pulsa "Guardar convocatoria" para persistir.' });
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally { setCopying(false); }
  };

  const guardar = async () => {
    try {
      setSaving(true); setMsg(null);
      const payload = ALL_INSTRUMENTOS.map(i => ({ instrumento: i, convocado: state[i] !== false }));
      await api.put(`/api/gestor/ensayos/${ensayoId}/instrumentos`, payload);
      setMsg({ type: 'success', text: '✅ Convocatoria guardada' });
      setTimeout(() => setMsg(null), 2500);
      if (onSaved) onSaved();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally { setSaving(false); }
  };

  const totalConvocados = ALL_INSTRUMENTOS.filter(i => state[i] !== false).length;

  return (
    <div className="border border-slate-200 rounded bg-slate-50/60 mt-1" data-testid={`convocatoria-panel-${ensayoId}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        data-testid={`btn-toggle-convocatoria-${ensayoId}`}
      >
        <span>🎼 Instrumentos convocados {loaded && <span className="ml-2 text-slate-500 font-normal">({totalConvocados}/{ALL_INSTRUMENTOS.length})</span>}</span>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="p-3 border-t border-slate-200 space-y-3">
          {loading ? (
            <div className="text-xs text-slate-500">Cargando convocatoria…</div>
          ) : (
            <>
              {/* Acciones masivas globales */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600 mr-1">Todos:</span>
                <button type="button" onClick={() => toggleTodos(true)}
                        data-testid={`btn-all-on-${ensayoId}`}
                        className="px-2 py-0.5 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded">Convocar todos</button>
                <button type="button" onClick={() => toggleTodos(false)}
                        data-testid={`btn-all-off-${ensayoId}`}
                        className="px-2 py-0.5 border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 rounded">Desconvocar todos</button>
                {ensayoAnteriorId && (
                  <button type="button" onClick={copiarEnsayoAnterior} disabled={copying}
                          data-testid={`btn-copy-prev-${ensayoId}`}
                          title={ensayoAnteriorLabel ? `Copia la convocatoria de: ${ensayoAnteriorLabel}` : 'Copia la convocatoria del ensayo anterior'}
                          className="px-2 py-0.5 border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded disabled:opacity-50">
                    {copying ? 'Copiando…' : '📋 Copiar del ensayo anterior'}
                  </button>
                )}
              </div>

              {/* Acciones por sección */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-600 mr-1">Por sección:</span>
                {SECCIONES.map(sec => {
                  const allOn = sec.instrumentos.every(i => state[i] !== false);
                  return (
                    <div key={sec.key} className="inline-flex border border-slate-300 rounded overflow-hidden">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-medium">{sec.label}</span>
                      <button type="button" onClick={() => toggleSeccion(sec.instrumentos, true)}
                              data-testid={`btn-seccion-on-${sec.key}-${ensayoId}`}
                              title="Convocar toda la sección"
                              className={`px-2 py-0.5 ${allOn ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}>✓</button>
                      <button type="button" onClick={() => toggleSeccion(sec.instrumentos, false)}
                              data-testid={`btn-seccion-off-${sec.key}-${ensayoId}`}
                              title="Desconvocar toda la sección"
                              className="px-2 py-0.5 bg-white text-red-600 hover:bg-red-50 border-l border-slate-200">✗</button>
                    </div>
                  );
                })}
              </div>

              {/* Grid por instrumento */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {SECCIONES.map(sec => (
                  <div key={sec.key} className="border border-slate-200 rounded bg-white p-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{sec.label}</div>
                    <div className="space-y-1">
                      {sec.instrumentos.map(instr => {
                        const on = state[instr] !== false;
                        return (
                          <label key={instr} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded"
                                 data-testid={`chk-instr-${instr}-${ensayoId}`}>
                            <input type="checkbox" checked={on}
                                   onChange={() => toggleInstrumento(instr)}
                                   className="w-3.5 h-3.5 accent-emerald-600" />
                            <span className={on ? 'text-slate-800' : 'text-slate-400 line-through'}>{instr}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                {isNew ? (
                  <span className="text-xs italic text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200" data-testid={`convocatoria-pending-${tempKey || 'new'}`}>
                    ℹ️ Los cambios se guardarán al guardar el evento.
                  </span>
                ) : (
                  <>
                    <button type="button" onClick={guardar} disabled={saving}
                            data-testid={`btn-save-convocatoria-${ensayoId}`}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white text-xs rounded disabled:opacity-50">
                      {saving ? 'Guardando…' : 'Guardar convocatoria'}
                    </button>
                    {msg && (
                      <span className={`text-xs ${msg.type === 'success' ? 'text-emerald-700' : msg.type === 'info' ? 'text-blue-700' : 'text-red-700'}`}
                            data-testid={`msg-convocatoria-${ensayoId}`}>
                        {msg.text}
                      </span>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ConvocatoriaInstrumentosPanel;
