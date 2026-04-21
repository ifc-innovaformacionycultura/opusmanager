// Panel reutilizable de comentarios internos del equipo de gestores.
// Se monta sobre una "entidad" (reclamacion, evento, ...) y muestra un hilo
// en orden cronológico inverso con formulario para añadir nuevos comentarios.
//
//   <ComentariosPanel tipo="reclamacion" entidadId={reclamacion.id} />
//
// Usa /api/gestor/comentarios (GET + POST) vía el axios autenticado de
// useGestorAuth (AuthContext).
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const formatFecha = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
};

const iniciales = (nombre) => {
  if (!nombre) return '?';
  const parts = nombre.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
};

const ComentariosPanel = ({ tipo, entidadId, title = 'Notas internas del equipo' }) => {
  const { api, user } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!entidadId) return;
    try {
      setLoading(true);
      setError(null);
      const r = await api.get('/api/gestor/comentarios', { params: { tipo, entidad_id: entidadId } });
      setComentarios(r.data?.comentarios || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  }, [api, tipo, entidadId]);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async (e) => {
    e.preventDefault();
    const contenido = nuevo.trim();
    if (!contenido) return;
    try {
      setSending(true);
      setError(null);
      await api.post('/api/gestor/comentarios', { tipo, entidad_id: entidadId, contenido });
      setNuevo('');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setSending(false); }
  };

  return (
    <div className="border border-slate-200 rounded-lg bg-white" data-testid={`comentarios-panel-${tipo}-${entidadId}`}>
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8L3 20l1.3-3.6C3.47 15.26 3 13.68 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          {title}
        </h4>
        <span className="text-xs text-slate-500">
          {comentarios.length} {comentarios.length === 1 ? 'nota' : 'notas'}
        </span>
      </div>

      {/* Formulario (arriba para visibilidad) */}
      <form onSubmit={enviar} className="p-3 border-b border-slate-200 bg-white">
        <textarea
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          rows={2}
          placeholder="Escribe una nota interna para el equipo..."
          data-testid={`comentario-nuevo-${tipo}`}
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-slate-500">
            Estas notas son visibles sólo para el equipo de gestores.
          </p>
          <button
            type="submit"
            disabled={sending || !nuevo.trim()}
            data-testid={`btn-enviar-comentario-${tipo}`}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium disabled:opacity-50"
          >
            {sending ? 'Publicando...' : 'Publicar nota'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600" data-testid="comentario-error">{error}</p>
        )}
      </form>

      {/* Listado */}
      <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto" data-testid="comentarios-list">
        {loading ? (
          <div className="p-4 text-xs text-slate-500">Cargando notas...</div>
        ) : comentarios.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 italic">Sin notas aún. Sé el primero en dejar una.</div>
        ) : (
          comentarios.map((c) => {
            const propio = user?.id && c.gestor_id === user.id;
            return (
              <div key={c.id} className="p-3 flex gap-3" data-testid={`comentario-${c.id}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                  propio ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {iniciales(c.gestor_nombre)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {c.gestor_nombre || 'Gestor'}
                      {propio && <span className="ml-1 text-[10px] text-slate-500 font-normal">(tú)</span>}
                    </p>
                    <p className="text-[11px] text-slate-500">{formatFecha(c.created_at)}</p>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap mt-0.5">{c.contenido}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ComentariosPanel;
