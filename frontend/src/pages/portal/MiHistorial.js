// Portal Músico - Mi Historial (Bloque 2)
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8001/api'
  : `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authedFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
}

const estadoAsignacionBadge = (estado) => {
  const map = {
    confirmado: 'bg-green-100 text-green-800',
    pendiente: 'bg-yellow-100 text-yellow-800',
    rechazado: 'bg-red-100 text-red-800'
  };
  return map[estado] || 'bg-slate-100 text-slate-700';
};

const estadoPagoBadge = (estado) => {
  const map = {
    pagado: 'bg-green-100 text-green-800 border-green-200',
    pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    enviado: 'bg-blue-100 text-blue-800 border-blue-200',
    'enviado_banco': 'bg-blue-100 text-blue-800 border-blue-200',
  };
  return map[estado] || 'bg-slate-100 text-slate-700 border-slate-200';
};

const estadoReclamacionBadge = (estado) => {
  const map = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    en_gestion: 'bg-blue-100 text-blue-800',
    resuelta: 'bg-green-100 text-green-800',
    rechazada: 'bg-red-100 text-red-800'
  };
  return map[estado] || 'bg-slate-100 text-slate-700';
};

// ========== Sub-tabs ==========

const HistorialEventos = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTemporada, setFiltroTemporada] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch('/portal/mi-historial/eventos');
        const json = await res.json();
        setData(json.asignaciones || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const temporadas = useMemo(
    () => Array.from(new Set(data.map(a => a.evento?.temporada).filter(Boolean))),
    [data]
  );

  const filtered = data.filter(a => {
    if (filtroEstado && a.estado !== filtroEstado) return false;
    if (filtroTemporada && a.evento?.temporada !== filtroTemporada) return false;
    return true;
  });

  if (loading) return <div className="py-8 text-center text-slate-500">Cargando...</div>;

  return (
    <div className="space-y-4" data-testid="hist-eventos">
      <div className="flex flex-wrap gap-3">
        <select value={filtroTemporada} onChange={(e) => setFiltroTemporada(e.target.value)}
          data-testid="hist-filter-temporada"
          className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
          <option value="">Todas las temporadas</option>
          {temporadas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
          data-testid="hist-filter-estado"
          className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="confirmado">Confirmado</option>
          <option value="rechazado">Rechazado</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">No hay eventos que coincidan con los filtros.</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Evento</th>
                <th className="px-4 py-3 text-left">Temporada</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Ensayos confirmados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{a.evento?.nombre || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{a.evento?.temporada || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoAsignacionBadge(a.estado)}`}>
                      {a.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {a.ensayos_confirmados || 0} / {a.ensayos_total || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const HistorialPagos = () => {
  const [pagos, setPagos] = useState([]);
  const [cobrado, setCobrado] = useState(0);
  const [pendiente, setPendiente] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch('/portal/mi-historial/pagos');
        const json = await res.json();
        setPagos(json.pagos || []);
        setCobrado(json.total_cobrado || 0);
        setPendiente(json.total_pendiente || 0);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="py-8 text-center text-slate-500">Cargando...</div>;

  return (
    <div className="space-y-4" data-testid="hist-pagos">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs uppercase text-green-700 font-semibold">Total cobrado</p>
          <p className="text-2xl font-bold text-green-900 mt-1" data-testid="total-cobrado">{cobrado.toFixed(2)}€</p>
        </div>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs uppercase text-amber-700 font-semibold">Total pendiente</p>
          <p className="text-2xl font-bold text-amber-900 mt-1" data-testid="total-pendiente">{pendiente.toFixed(2)}€</p>
        </div>
      </div>

      {pagos.length === 0 ? (
        <div className="text-center py-8 text-slate-500">No hay pagos registrados.</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Evento</th>
                <th className="px-4 py-3 text-left">Temporada</th>
                <th className="px-4 py-3 text-right">Importe</th>
                <th className="px-4 py-3 text-left">Estado pago</th>
                <th className="px-4 py-3 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagos.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.evento?.nombre || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{p.evento?.temporada || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{parseFloat(p.importe || 0).toFixed(2)}€</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${estadoPagoBadge(p.estado_pago)}`}>
                      {p.estado_pago || 'pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {p.updated_at ? new Date(p.updated_at).toLocaleDateString('es-ES') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ReclamacionModal = ({ isOpen, onClose, onCreated, eventos }) => {
  const [tipo, setTipo] = useState('otro');
  const [eventoId, setEventoId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!descripcion.trim()) { setError('Describe la reclamación'); return; }
    setSaving(true);
    try {
      const res = await authedFetch('/portal/mi-historial/reclamaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          descripcion,
          evento_id: eventoId || null
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || 'Error al enviar');
      }
      onCreated && onCreated();
      onClose();
      setTipo('otro'); setEventoId(''); setDescripcion('');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="reclamacion-modal">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
          <h3 className="font-semibold text-lg">Nueva reclamación</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">✕</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Evento relacionado</label>
            <select value={eventoId} onChange={(e) => setEventoId(e.target.value)}
              data-testid="recl-evento"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
              <option value="">Ninguno / general</option>
              {eventos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de reclamación *</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              data-testid="recl-tipo"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
              <option value="pago_incorrecto">Pago incorrecto</option>
              <option value="pago_no_recibido">Pago no recibido</option>
              <option value="error_asistencia">Error en asistencia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Descripción *</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              rows={4} required
              data-testid="recl-descripcion"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Describe el motivo de la reclamación..." />
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-md">Cancelar</button>
            <button type="submit" disabled={saving}
              data-testid="submit-reclamacion"
              className="flex-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md disabled:opacity-60">
              {saving ? 'Enviando...' : 'Enviar reclamación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HistorialReclamaciones = () => {
  const [items, setItems] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [r1, r2] = await Promise.all([
        authedFetch('/portal/mi-historial/reclamaciones').then(r => r.json()),
        authedFetch('/portal/mis-eventos').then(r => r.json())
      ]);
      setItems(r1.reclamaciones || []);
      setEventos((r2.asignaciones || []).map(a => a.evento).filter(Boolean));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="py-8 text-center text-slate-500">Cargando...</div>;

  return (
    <div className="space-y-4" data-testid="hist-reclamaciones">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-900">Mis reclamaciones</h3>
        <button onClick={() => setModalOpen(true)}
          data-testid="btn-nueva-reclamacion"
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium">
          + Nueva reclamación
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-white rounded-lg border border-slate-200">
          Aún no has enviado ninguna reclamación.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(r => (
            <div key={r.id} className="p-4 bg-white rounded-lg border border-slate-200" data-testid={`recl-item-${r.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-500 uppercase">{r.tipo?.replace('_', ' ')}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoReclamacionBadge(r.estado)}`}>
                      {r.estado}
                    </span>
                  </div>
                  {r.evento && <p className="text-sm text-slate-700 font-medium">{r.evento.nombre}</p>}
                  <p className="text-sm text-slate-600 mt-1">{r.descripcion}</p>
                  {r.respuesta_gestor && (
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-900">
                      <strong>Respuesta del gestor:</strong> {r.respuesta_gestor}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 whitespace-nowrap">
                  {r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleDateString('es-ES') : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ReclamacionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={load}
        eventos={eventos}
      />
    </div>
  );
};

const MiHistorial = () => {
  const [subtab, setSubtab] = useState('eventos');
  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="mi-historial-page">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Mi Historial</h2>
        <p className="text-sm text-slate-600 mt-1">Consulta tu histórico de eventos, pagos y reclamaciones.</p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-6 -mb-px">
          {[
            { id: 'eventos', label: '🎵 Eventos y asistencia' },
            { id: 'pagos', label: '💰 Pagos y liquidaciones' },
            { id: 'reclamaciones', label: '📨 Reclamaciones' },
          ].map(t => (
            <button key={t.id} onClick={() => setSubtab(t.id)}
              data-testid={`subtab-${t.id}`}
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                subtab === t.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {subtab === 'eventos' && <HistorialEventos />}
      {subtab === 'pagos' && <HistorialPagos />}
      {subtab === 'reclamaciones' && <HistorialReclamaciones />}
    </div>
  );
};

export default MiHistorial;
