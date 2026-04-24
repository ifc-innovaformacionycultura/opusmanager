// Tabla editable de cachets base por (instrumento, nivel).
// Escribe en cachets_config con evento_id=NULL (plantilla global).
import React, { useState, useEffect, useMemo } from 'react';

const NIVELES = [
  'Superior finalizado',
  'Superior cursando',
  'Profesional finalizado',
  'Profesional cursando',
];

// Orden pedido por el usuario, por sección instrumental
const SECCIONES = [
  { label: 'Cuerda', instrumentos: ['Violín', 'Viola', 'Violonchelo', 'Contrabajo'] },
  { label: 'Viento Madera', instrumentos: ['Flauta', 'Oboe', 'Clarinete', 'Fagot'] },
  { label: 'Viento Metal', instrumentos: ['Trompa', 'Trompeta', 'Trombón', 'Tuba'] },
  { label: 'Percusión', instrumentos: ['Percusión'] },
  { label: 'Teclados', instrumentos: ['Piano', 'Órgano'] },
  { label: 'Coro', instrumentos: ['Soprano', 'Alto', 'Tenor', 'Barítono'] },
];

const CachetsBaseSection = ({ api }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  // cachets[instrumento][nivel] = importe number
  const [cachets, setCachets] = useState({});
  const [musicosCount, setMusicosCount] = useState({}); // key = `${instr}__${nivel}`

  const cargar = async () => {
    try {
      setLoading(true);
      const r = await api.get('/api/gestor/cachets-base');
      const map = {};
      (r.data?.cachets || []).forEach(c => {
        if (!map[c.instrumento]) map[c.instrumento] = {};
        map[c.instrumento][c.nivel_estudios] = Number(c.importe) || 0;
      });
      setCachets(map);

      // Contar músicos confirmados por (instrumento, nivel) para cálculo total
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
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const setValue = (instr, nivel, val) => {
    setCachets(prev => {
      const next = { ...prev };
      if (!next[instr]) next[instr] = {};
      next[instr] = { ...next[instr], [nivel]: val === '' ? 0 : Number(val) };
      return next;
    });
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
      const r = await api.put('/api/gestor/cachets-base', payload);
      setMsg({ type: 'success', text: `✅ Cachets base guardados · ${r.data.creados} nuevos, ${r.data.actualizados} actualizados` });
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

  if (loading) return <div className="p-4 text-sm text-slate-500">Cargando cachets...</div>;

  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-6" data-testid="cachets-base-section">
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between rounded-t-lg">
        <div>
          <h2 className="font-semibold">💼 Sección A · Cachets por músico (plantilla global)</h2>
          <p className="text-xs text-slate-300 mt-0.5">Importe base de caché por instrumento y nivel de estudios. Se aplica a todos los eventos sin cachet específico.</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && (
            <span className={`text-xs px-2 py-1 rounded ${msg.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`} data-testid="cachets-base-msg">
              {msg.text}
            </span>
          )}
          <button
            onClick={guardar}
            disabled={saving}
            data-testid="btn-save-cachets-base"
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cachets'}
          </button>
        </div>
      </div>
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
    </div>
  );
};

export default CachetsBaseSection;
