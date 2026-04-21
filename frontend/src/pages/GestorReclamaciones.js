// Gestor: Gestión de reclamaciones (Bloque 2 - lado gestor)
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ComentariosPanel from '../components/ComentariosPanel';

const estadoBadge = (estado) => {
  const map = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    en_gestion: 'bg-blue-100 text-blue-800',
    resuelta: 'bg-green-100 text-green-800',
    rechazada: 'bg-red-100 text-red-800'
  };
  return map[estado] || 'bg-slate-100 text-slate-700';
};

const GestorReclamaciones = () => {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/gestor/reclamaciones');
      setItems(res.data?.reclamaciones || []);
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const updateReclamacion = async (id, payload) => {
    try {
      setSaving(true);
      await api.put(`/api/gestor/reclamaciones/${id}`, payload);
      await load();
      setSelected(null);
      setRespuesta('');
    } catch (err) {
      alert(`Error: ${err.response?.data?.detail || err.message}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6" data-testid="gestor-reclamaciones-page">
      <header className="mb-6">
        <h1 className="font-cabinet text-3xl font-bold text-slate-900">Reclamaciones de músicos</h1>
        <p className="font-ibm text-slate-600 mt-1">Gestiona las reclamaciones enviadas desde el portal.</p>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-500">No hay reclamaciones.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(r => (
              <div key={r.id} className="p-4" data-testid={`recl-row-${r.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(r.estado)}`}>
                        {r.estado}
                      </span>
                      <span className="text-xs text-slate-500 uppercase">{r.tipo?.replace('_',' ')}</span>
                      <span className="text-xs text-slate-500">· {new Date(r.fecha_creacion).toLocaleDateString('es-ES')}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">
                      {r.usuario?.nombre} {r.usuario?.apellidos} ({r.usuario?.email})
                      {r.evento && <> · Evento: <span className="text-slate-700">{r.evento.nombre}</span></>}
                    </p>
                    <p className="text-sm text-slate-700 mt-2">{r.descripcion}</p>
                    {r.respuesta_gestor && (
                      <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                        <strong>Respuesta:</strong> {r.respuesta_gestor}
                      </div>
                    )}
                  </div>
                  {r.estado !== 'resuelta' && r.estado !== 'rechazada' && (
                    <button
                      onClick={() => { setSelected(r); setRespuesta(r.respuesta_gestor || ''); }}
                      data-testid={`btn-gestionar-${r.id}`}
                      className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded font-medium"
                    >
                      Gestionar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="gestionar-modal">
          <div className="bg-white rounded-lg max-w-2xl w-full p-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg">Gestionar reclamación</h3>
            <p className="text-sm text-slate-600">{selected.descripcion}</p>
            <textarea
              rows={4}
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              data-testid="gestionar-respuesta"
              placeholder="Escribe una respuesta para el músico..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelected(null)} className="px-3 py-2 border border-slate-300 bg-white text-slate-700 rounded-md text-sm">Cancelar</button>
              <button
                onClick={() => updateReclamacion(selected.id, { estado: 'en_gestion', respuesta_gestor: respuesta })}
                disabled={saving}
                data-testid="btn-en-gestion"
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm disabled:opacity-60"
              >En gestión</button>
              <button
                onClick={() => updateReclamacion(selected.id, { estado: 'resuelta', respuesta_gestor: respuesta })}
                disabled={saving}
                data-testid="btn-resuelta"
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm disabled:opacity-60"
              >Marcar resuelta</button>
              <button
                onClick={() => updateReclamacion(selected.id, { estado: 'rechazada', respuesta_gestor: respuesta })}
                disabled={saving}
                data-testid="btn-rechazada"
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm disabled:opacity-60"
              >Rechazar</button>
            </div>

            {/* Notas internas del equipo (gestor ↔ gestor) */}
            <div className="pt-4 border-t border-slate-200">
              <ComentariosPanel tipo="reclamacion" entidadId={selected.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestorReclamaciones;
