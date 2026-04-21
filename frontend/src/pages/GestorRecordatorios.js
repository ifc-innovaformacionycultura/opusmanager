// Gestor: Recordatorios por evento (Bloque 3)
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const GestorRecordatorios = () => {
  const { api } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState('');
  const [recordatorios, setRecordatorios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/gestor/eventos');
        setEventos(res.data?.eventos || []);
        if (res.data?.eventos?.length > 0) setEventoId(res.data.eventos[0].id);
      } catch (err) { /* noop */ }
    })();
  }, [api]);

  const loadRecordatorios = useCallback(async () => {
    if (!eventoId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/gestor/eventos/${eventoId}/recordatorios`);
      setRecordatorios(res.data?.recordatorios || []);
    } finally { setLoading(false); }
  }, [api, eventoId]);

  useEffect(() => { loadRecordatorios(); }, [loadRecordatorios]);

  const updateRecordatorio = async (recordatorio, updates) => {
    try {
      setSaving(recordatorio.tipo);
      const payload = { tipo: recordatorio.tipo, ...updates };
      await api.put(`/api/gestor/eventos/${eventoId}/recordatorios`, payload);
      setRecordatorios(prev => prev.map(r => r.tipo === recordatorio.tipo ? { ...r, ...updates } : r));
    } catch (err) {
      alert(`Error: ${err.response?.data?.detail || err.message}`);
    } finally { setSaving(null); }
  };

  return (
    <div className="p-6" data-testid="gestor-recordatorios-page">
      <header className="mb-6">
        <h1 className="font-cabinet text-3xl font-bold text-slate-900">Recordatorios automáticos</h1>
        <p className="font-ibm text-slate-600 mt-1">Configura los recordatorios por email para cada evento.</p>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">Evento</label>
        <select
          value={eventoId}
          onChange={(e) => setEventoId(e.target.value)}
          data-testid="recordatorios-evento-select"
          className="w-full md:w-96 px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
        >
          <option value="">Selecciona un evento</option>
          {eventos.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.temporada ? `(${e.temporada})` : ''}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Cargando...</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {recordatorios.map((r, i) => (
            <div key={r.tipo} className="p-4" data-testid={`recordatorio-${r.tipo}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-slate-400 font-mono text-sm mt-0.5">({i + 1})</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900">{r.nombre}</h3>
                    <p className="text-sm text-slate-600 mt-0.5">{r.descripcion}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Destinatario: <span className="font-medium">{r.destinatario}</span>
                      {r.dias_antes != null && <> · Días antes: <span className="font-medium">{r.dias_antes}</span></>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === r.tipo ? null : r.tipo)}
                    data-testid={`btn-edit-${r.tipo}`}
                    className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded"
                  >
                    Editar
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.activo}
                      onChange={(e) => updateRecordatorio(r, { activo: e.target.checked })}
                      disabled={saving === r.tipo}
                      data-testid={`toggle-${r.tipo}`}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-slate-900 peer-focus:ring-2 peer-focus:ring-slate-300 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white"></div>
                  </label>
                </div>
              </div>

              {expanded === r.tipo && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 bg-slate-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Destinatario</label>
                      <select
                        value={r.destinatario || 'musico'}
                        onChange={(e) => updateRecordatorio(r, { destinatario: e.target.value })}
                        data-testid={`destinatario-${r.tipo}`}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                      >
                        <option value="musico">Músico</option>
                        <option value="gestor">Gestor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Días antes (si aplica)</label>
                      <input
                        type="number" min="0"
                        value={r.dias_antes ?? ''}
                        onChange={(e) => updateRecordatorio(r, { dias_antes: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                        data-testid={`dias-${r.tipo}`}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Mensaje personalizable</label>
                    <textarea
                      rows={3}
                      value={r.mensaje_personalizado || ''}
                      onChange={(e) => updateRecordatorio(r, { mensaje_personalizado: e.target.value })}
                      data-testid={`mensaje-${r.tipo}`}
                      placeholder="Usa {nombre}, {evento}, {fecha}, {lugar}, {importe}"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">Variables: <code className="bg-slate-200 px-1 rounded">{'{nombre}'}</code> <code className="bg-slate-200 px-1 rounded">{'{evento}'}</code> <code className="bg-slate-200 px-1 rounded">{'{fecha}'}</code> <code className="bg-slate-200 px-1 rounded">{'{lugar}'}</code> <code className="bg-slate-200 px-1 rounded">{'{importe}'}</code></p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GestorRecordatorios;
