// Tabla editable de cachets por (instrumento, nivel).
// Soporta dos modos:
//   - Plantilla base global (evento_id = NULL) → /api/gestor/cachets-base
//   - Cachets específicos de un evento (evento_id = X) → /api/gestor/cachets-config/{X}
// Acciones:
//   - Precargar cachets estándar: rellena 76 celdas con valores orientativos
//   - Copiar plantilla base: copia evento_id=NULL → evento_id=X (solo modo evento)
import React, { useState, useEffect, useMemo, useCallback } from 'react';

const NIVELES = [
  'Superior finalizado',
  'Superior cursando',
  'Profesional finalizado',
  'Profesional cursando',
];

// Valores orientativos para orquesta profesional española (€ brutos)
const STANDARD_PRESET = {
  'Superior finalizado':    400,
  'Superior cursando':      320,
  'Profesional finalizado': 260,
  'Profesional cursando':   200,
};

const SECCIONES = [
  { label: 'Cuerda',        instrumentos: ['Violín', 'Viola', 'Violonchelo', 'Contrabajo'] },
  { label: 'Viento Madera', instrumentos: ['Flauta', 'Oboe', 'Clarinete', 'Fagot'] },
  { label: 'Viento Metal',  instrumentos: ['Trompa', 'Trompeta', 'Trombón', 'Tuba'] },
  { label: 'Percusión',     instrumentos: ['Percusión'] },
  { label: 'Teclados',      instrumentos: ['Piano', 'Órgano'] },
  { label: 'Coro',          instrumentos: ['Soprano', 'Alto', 'Tenor', 'Barítono'] },
];

const CachetsBaseSection = ({ api, eventos = [] }) => {
  // 'base' = plantilla global (evento_id=NULL). Otro valor = evento_id
  const [scope, setScope] = useState('base');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cachets, setCachets] = useState({});
  const [musicosCount, setMusicosCount] = useState({});

  const cargar = useCallback(async () => {
    try {
      setLoading(true); setMsg(null);
      let rows = [];
      if (scope === 'base') {
        const r = await api.get('/api/gestor/cachets-base');
        rows = r.data?.cachets || [];
      } else {
        const r = await api.get(`/api/gestor/cachets-config/${scope}`);
        rows = r.data?.cachets || [];
        // Si el evento no tiene filas propias, precargar con plantilla base como valores iniciales
        if (rows.length === 0) {
          try {
            const rb = await api.get('/api/gestor/cachets-base');
            rows = rb.data?.cachets || [];
            if (rows.length > 0) {
              setMsg({ type: 'info', text: 'ℹ️ Valores cargados desde plantilla base (aún no guardados en este evento)' });
              setTimeout(() => setMsg(null), 4000);
            }
          } catch {}
        }
      }
      const map = {};
      rows.forEach(c => {
        if (!map[c.instrumento]) map[c.instrumento] = {};
        map[c.instrumento][c.nivel_estudios] = Number(c.importe) || 0;
      });
      setCachets(map);

      // Contar músicos por (instrumento, nivel) para total estimado
      try {
        const mr = await api.get('/api/gestor/musicos');
        const byPair = {};
        (mr.data?.musicos || []).forEach(m => {
          const k = `${m.instrumento || ''}__${m.nivel_estudios || ''}`;
          byPair[k] = (byPair[k] || 0) + 1;
        });
        setMusicosCount(byPair);
      } catch {}
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally { setLoading(false); }
  }, [scope, api]);

  useEffect(() => { cargar(); }, [cargar]);

  const setValue = (instr, nivel, val) => {
    setCachets(prev => {
      const next = { ...prev };
      if (!next[instr]) next[instr] = {};
      next[instr] = { ...next[instr], [nivel]: val === '' ? 0 : Number(val) };
      return next;
    });
  };

  const precargarEstandar = () => {
    const next = {};
    for (const sec of SECCIONES) {
      for (const instr of sec.instrumentos) {
        next[instr] = {};
        for (const nivel of NIVELES) {
          next[instr][nivel] = STANDARD_PRESET[nivel];
        }
      }
    }
    setCachets(next);
    setMsg({ type: 'info', text: '📋 Valores estándar precargados. Revisa y pulsa "Guardar" para persistir.' });
    setTimeout(() => setMsg(null), 4000);
  };

  const copiarPlantillaBase = async () => {
    if (scope === 'base') return;
    if (!window.confirm('¿Copiar la plantilla base al evento actual? Sobrescribirá los valores actuales de este evento.')) return;
    try {
      setSaving(true); setMsg(null);
      const r = await api.post(`/api/gestor/cachets-config/${scope}/copy-from-base`);
      setMsg({ type: 'success', text: `✅ Plantilla base copiada: ${r.data.copiados || 0} nuevos, ${r.data.actualizados || 0} actualizados` });
      setTimeout(() => setMsg(null), 4000);
      await cargar();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally { setSaving(false); }
  };

  const guardar = async () => {
    try {
      setSaving(true); setMsg(null);
      const payload = [];
      for (const sec of SECCIONES) {
        for (const instr of sec.instrumentos) {
          for (const nivel of NIVELES) {
            const importe = cachets[instr]?.[nivel];
            if (importe !== undefined) {
              payload.push({ instrumento: instr, nivel_estudios: nivel, importe });
            }
          }
        }
      }
      if (scope === 'base') {
        const r = await api.put('/api/gestor/cachets-base', payload);
        setMsg({ type: 'success', text: `✅ Plantilla base guardada · ${r.data.creados || 0} nuevos, ${r.data.actualizados || 0} actualizados` });
      } else {
        await api.put(`/api/gestor/cachets-config/${scope}`, payload);
        const evName = eventos.find(e => e.id === scope)?.nombre || '';
        setMsg({ type: 'success', text: `✅ Cachets guardados en evento${evName ? ` "${evName}"` : ''}` });
      }
      setTimeout(() => setMsg(null), 4000);
      await cargar();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally { setSaving(false); }
  };

  const totalEstimado = useMemo(() => {
    let total = 0;
    for (const sec of SECCIONES) {
      for (const instr of sec.instrumentos) {
        for (const nivel of NIVELES) {
          const importe = Number(cachets[instr]?.[nivel]) || 0;
          const count = musicosCount[`${instr}__${nivel}`] || 0;
          total += importe * count;
        }
      }
    }
    return total;
  }, [cachets, musicosCount]);

  const scopeLabel = scope === 'base'
    ? 'Plantilla base (global · se aplica a eventos sin cachets propios)'
    : `Evento específico: ${eventos.find(e => e.id === scope)?.nombre || scope}`;

  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-6" data-testid="cachets-base-section">
      <div className="bg-slate-800 text-white px-4 py-3 rounded-t-lg">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold">💼 Sección A · Cachets por músico</h2>
            <p className="text-xs text-slate-300 mt-0.5">{scopeLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {msg && (
              <span className={`text-xs px-2 py-1 rounded ${msg.type === 'success' ? 'bg-green-600' : msg.type === 'info' ? 'bg-blue-600' : 'bg-red-600'}`} data-testid="cachets-base-msg">
                {msg.text}
              </span>
            )}
            <button onClick={precargarEstandar}
                    data-testid="btn-precargar-cachets"
                    title="Rellena los 76 inputs con valores orientativos: S.Fin 400€, S.Curs 320€, P.Fin 260€, P.Curs 200€"
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded">
              📋 Precargar estándar
            </button>
            {scope !== 'base' && (
              <button onClick={copiarPlantillaBase} disabled={saving}
                      data-testid="btn-copiar-plantilla-base"
                      title="Copia los valores de la plantilla base a este evento"
                      className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded disabled:opacity-50">
                🧬 Copiar plantilla base
              </button>
            )}
            <button onClick={guardar} disabled={saving}
                    data-testid="btn-save-cachets-base"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded disabled:opacity-50">
              {saving ? 'Guardando...' : (scope === 'base' ? 'Guardar plantilla base' : 'Guardar cachets del evento')}
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-300">Aplicar a:</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)}
                  data-testid="select-scope-cachets"
                  className="px-2 py-1 bg-slate-700 border border-slate-600 text-white text-xs rounded">
            <option value="base">🌐 Plantilla base (global)</option>
            {(eventos || []).map(ev => (
              <option key={ev.id} value={ev.id}>🎯 {ev.nombre}{ev.fecha_inicio ? ` — ${String(ev.fecha_inicio).slice(0,10)}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-slate-500">Cargando cachets…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-[200px]">Instrumento</th>
                {NIVELES.map(n => (
                  <th key={n} className="px-3 py-2 text-center font-semibold">{n}</th>
                ))}
                <th className="px-3 py-2 text-center font-semibold">Músicos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SECCIONES.map(sec => (
                <React.Fragment key={sec.label}>
                  <tr className="bg-slate-50">
                    <td colSpan={NIVELES.length + 2} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                      {sec.label}
                    </td>
                  </tr>
                  {sec.instrumentos.map(instr => (
                    <tr key={instr} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-medium text-slate-900">{instr}</td>
                      {NIVELES.map(n => (
                        <td key={n} className="px-2 py-1 text-center">
                          <div className="relative inline-block">
                            <input
                              type="number"
                              step="10"
                              min="0"
                              value={cachets[instr]?.[n] ?? ''}
                              onChange={(e) => setValue(instr, n, e.target.value)}
                              placeholder="0"
                              data-testid={`cachet-${instr}-${n.replace(/ /g, '_')}`}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                            />
                            <span className="ml-1 text-slate-400 text-xs">€</span>
                          </div>
                        </td>
                      ))}
                      <td className="px-2 py-1 text-center text-xs text-slate-500">
                        {NIVELES.reduce((acc, n) => acc + (musicosCount[`${instr}__${n}`] || 0), 0)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300">
              <tr>
                <td colSpan={NIVELES.length + 1} className="px-3 py-2 text-right font-bold text-slate-700">
                  Total cachets estimado (importe × músicos confirmados):
                </td>
                <td className="px-3 py-2 text-right font-bold text-emerald-700" data-testid="total-cachets-estimado">
                  {totalEstimado.toFixed(2)} €
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default CachetsBaseSection;
