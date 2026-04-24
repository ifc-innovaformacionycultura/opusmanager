// Análisis económico — resumen de temporada con gráficos y exportaciones.
// Datos desde GET /api/gestor/analisis/resumen.
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';

const fmtEuro = (n) => `${(Number(n) || 0).toFixed(2)} €`;
const fmtFecha = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); } catch { return iso; }
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const StatCard = ({ label, value, emphasis, testid }) => (
  <div className={`bg-white border border-slate-200 rounded-lg p-4 ${emphasis ? 'ring-2 ring-blue-500' : ''}`} data-testid={testid}>
    <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</p>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
  </div>
);

const AnalisisEconomico = () => {
  const { api } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [detalle, setDetalle] = useState({ eventos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [temporada, setTemporada] = useState('');
  const [temporadas, setTemporadas] = useState([]);
  const [openSet, setOpenSet] = useState(new Set());

  const cargar = async (tempSel = temporada) => {
    try {
      setLoading(true); setError(null);
      const qs = tempSel ? `?temporada=${encodeURIComponent(tempSel)}` : '';
      const [rRes, dRes] = await Promise.all([
        api.get(`/api/gestor/analisis/resumen${qs}`),
        api.get(`/api/gestor/gestion-economica${qs}`),
      ]);
      setResumen(rRes.data);
      setDetalle(dRes.data || { eventos: [] });
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  const toggleAcc = (evId) => {
    setOpenSet(prev => {
      const n = new Set(prev);
      if (n.has(evId)) n.delete(evId); else n.add(evId);
      return n;
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/gestor/eventos');
        const t = Array.from(new Set((r.data?.eventos || []).map(e => e.temporada).filter(Boolean)));
        setTemporadas(t);
        if (t.length) { setTemporada(t[0]); cargar(t[0]); } else { cargar(); }
      } catch { cargar(); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportXlsx = async () => {
    try {
      const qs = temporada ? `?temporada=${encodeURIComponent(temporada)}` : '';
      const r = await api.get(`/api/gestor/gestion-economica/export${qs}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analisis_${temporada || 'todas'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Error export: ' + err.message); }
  };

  const exportSEPA = async () => {
    try {
      const qs = temporada ? `?temporada=${encodeURIComponent(temporada)}` : '';
      const r = await api.get(`/api/gestor/analisis/sepa-xml${qs}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sepa_${temporada || 'todas'}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Error SEPA: ' + err.message); }
  };

  if (loading) return <div className="p-6 text-slate-500">Cargando análisis...</div>;
  if (error) return <div className="p-6 text-red-700">⚠️ {error}</div>;
  if (!resumen) return <div className="p-6">Sin datos.</div>;

  const barData = (resumen.por_evento || []).map(e => ({
    name: e.nombre.length > 18 ? e.nombre.slice(0, 18) + '…' : e.nombre,
    Previsto: e.cache_previsto,
    Real: e.total,
  }));
  const pieData = resumen.por_seccion || [];
  const lineData = (resumen.por_evento || []).map(e => ({
    name: e.nombre.length > 14 ? e.nombre.slice(0, 14) + '…' : e.nombre,
    'Asistencia %': e.pct_asistencia_medio,
  }));

  return (
    <div className="p-6" data-testid="analisis-page">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Análisis económico</h1>
          <p className="text-sm text-slate-600 mt-1">Panorama global de la temporada con gráficos y exportaciones.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={temporada} onChange={(e) => { setTemporada(e.target.value); cargar(e.target.value); }}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  data-testid="analisis-temporada">
            <option value="">Todas las temporadas</option>
            {temporadas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={exportXlsx} data-testid="btn-export-excel"
                  className="px-3 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700">
            📊 Excel
          </button>
          <button onClick={exportSEPA} data-testid="btn-export-sepa"
                  className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
            🏦 SEPA XML
          </button>
        </div>
      </header>

      {/* Resumen temporada */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Eventos" value={resumen.total_eventos} testid="stat-eventos" />
        <StatCard label="Músicos convocados" value={resumen.total_musicos_convocados} testid="stat-convocados" />
        <StatCard label="Músicos confirmados" value={resumen.total_musicos_confirmados} testid="stat-confirmados" />
        <StatCard label="% Asistencia media" value={`${resumen.pct_asistencia_medio}%`} testid="stat-asistencia" />
        <StatCard label="Coste previsto" value={fmtEuro(resumen.coste_previsto)} testid="stat-prev" />
        <StatCard label="Coste real" value={fmtEuro(resumen.coste_real)} testid="stat-real" />
        <StatCard
          label="Diferencia"
          value={fmtEuro(resumen.diferencia)}
          emphasis
          testid="stat-diff"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Previsto vs Real por evento</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
              <Tooltip formatter={(v) => fmtEuro(v)} />
              <Legend />
              <Bar dataKey="Previsto" fill="#3b82f6" />
              <Bar dataKey="Real" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Distribución por sección</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} dataKey="importe" nameKey="seccion" cx="50%" cy="50%" outerRadius={80} label>
                {pieData.map((entry, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtEuro(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Asistencia media por evento</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="Asistencia %" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detalle por evento - acordeones */}
      <div className="space-y-2" data-testid="analisis-acordeones">
        <h2 className="font-semibold text-slate-800 mb-2">Detalle por evento</h2>
        {(detalle.eventos || []).map(ev => {
          const open = openSet.has(ev.id);
          return (
            <div key={ev.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid={`analisis-evento-${ev.id}`}>
              <div onClick={() => toggleAcc(ev.id)}
                   className="bg-slate-700 text-white px-4 py-2 flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-semibold">{ev.nombre}</span>
                  <span className="text-xs text-slate-300 ml-3">{fmtFecha(ev.fecha_inicio)} · {ev.total_musicos} músicos</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300">Previsto: {fmtEuro(ev.totales.cache_previsto)}</span>
                  <span className="text-sm font-bold">Real: {fmtEuro(ev.totales.total)}</span>
                  <span className="text-xs">{open ? '▼' : '▶'}</span>
                </div>
              </div>
              {open && (ev.secciones || []).map(sec => (
                <div key={sec.key}>
                  <div className="bg-slate-100 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    {sec.label} <span className="text-slate-500 font-normal ml-2">({sec.count} · {fmtEuro(sec.totales.total)})</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600 text-[10px]">
                      <tr>
                        <th className="text-left px-3 py-1">Músico</th>
                        <th className="text-left px-3 py-1">Instrumento</th>
                        <th className="text-left px-3 py-1">Nivel</th>
                        <th className="text-center px-3 py-1">%Asist</th>
                        <th className="text-right px-3 py-1">Caché Prev</th>
                        <th className="text-right px-3 py-1">Caché Real</th>
                        <th className="text-right px-3 py-1">Extras</th>
                        <th className="text-right px-3 py-1 font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sec.musicos.map(m => (
                        <tr key={m.asignacion_id} className="hover:bg-slate-50">
                          <td className="px-3 py-1 font-medium">{m.apellidos}, {m.nombre}</td>
                          <td className="px-3 py-1 text-slate-600">{m.instrumento || '—'}</td>
                          <td className="px-3 py-1 text-slate-600">{m.nivel_estudios || '—'}</td>
                          <td className="px-3 py-1 text-center">{m.porcentaje_asistencia_real}%</td>
                          <td className="px-3 py-1 text-right">{fmtEuro(m.cache_previsto)}</td>
                          <td className="px-3 py-1 text-right">{fmtEuro(m.cache_real)}</td>
                          <td className="px-3 py-1 text-right">{fmtEuro(m.cache_extra)}</td>
                          <td className="px-3 py-1 text-right font-bold">{fmtEuro(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnalisisEconomico;
