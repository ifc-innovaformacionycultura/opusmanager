// Mini-sección embebible en fichas (obra, evento, músico).
// Muestra contador de hilos abiertos, últimos 3 y 2 botones de acción.
//
// Props:
//   api              — cliente axios autenticado
//   entidadTipo      — 'obra' | 'evento' | 'musico'
//   entidadId        — UUID de la entidad
//   entidadNombre    — para precargar en el modal "Nuevo comentario"
//   pagina           — ruta actual (p.ej. '/admin/archivo')
//   seccion          — breadcrumb humano (p.ej. 'Administración → Archivo musical')

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ComentariosEquipoModal from './ComentariosEquipoModal';

const ESTADO_BADGE = {
  pendiente:  { txt: '🟡 Pendiente',  cls: 'bg-yellow-100 text-yellow-800' },
  en_proceso: { txt: '🔵 En proceso', cls: 'bg-blue-100 text-blue-800' },
  resuelto:   { txt: '✅ Resuelto',   cls: 'bg-emerald-100 text-emerald-800' },
};

const fmtFecha = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const t = new Date();
    if (d.toDateString() === t.toDateString())
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } catch { return iso; }
};

const ComentariosEquipoInline = ({ api, entidadTipo, entidadId, entidadNombre, pagina, seccion }) => {
  const navigate = useNavigate();
  const [hilos, setHilos] = useState([]);
  const [abiertos, setAbiertos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const cargar = useCallback(async () => {
    if (!entidadId || !entidadTipo || !api) return;
    setLoading(true);
    try {
      const r = await api.get('/api/gestor/comentarios-equipo', {
        params: { entidad_tipo: entidadTipo, entidad_id: entidadId, limit: 50 },
      });
      const lista = r.data?.comentarios || [];
      setHilos(lista);
      setAbiertos(lista.filter(c => c.estado !== 'resuelto').length);
    } catch {
      setHilos([]); setAbiertos(0);
    } finally { setLoading(false); }
  }, [api, entidadTipo, entidadId]);

  useEffect(() => { cargar(); }, [cargar]);

  const verTodos = () => {
    // Llevar a /admin/mensajes con pestaña comentarios y filtro preseleccionado
    navigate(`/admin/mensajes?tab=comentarios&entidad_tipo=${entidadTipo}&entidad_id=${entidadId}`);
  };

  if (!entidadId) return null;
  const top3 = hilos.slice(0, 3);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="comentarios-inline">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
          💬 Comentarios del equipo
          {abiertos > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[11px] font-bold rounded-full bg-blue-500 text-white" data-testid="ce-inline-count">
              {abiertos}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {hilos.length > 0 && (
            <button type="button" onClick={verTodos}
                    data-testid="btn-ver-todos"
                    className="text-xs text-blue-700 hover:underline">
              Ver todos →
            </button>
          )}
          <button type="button" onClick={() => setModalOpen(true)}
                  data-testid="btn-nuevo-comentario-inline"
                  className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
            💬 Nuevo
          </button>
        </div>
      </div>

      {loading && <div className="text-xs text-slate-400">Cargando…</div>}

      {!loading && top3.length === 0 && (
        <p className="text-xs text-slate-400 italic">Sin comentarios sobre esta ficha.</p>
      )}

      {!loading && top3.length > 0 && (
        <ul className="space-y-2">
          {top3.map(c => (
            <li key={c.id}
                onClick={verTodos}
                data-testid={`ce-inline-row-${c.id}`}
                className="flex items-start gap-2 text-xs border border-slate-100 rounded p-2 hover:bg-slate-50 cursor-pointer">
              <span className={`shrink-0 inline-block px-1.5 py-0.5 text-[10px] uppercase font-mono rounded ${ESTADO_BADGE[c.estado]?.cls || 'bg-slate-100'}`}>
                {ESTADO_BADGE[c.estado]?.txt || c.estado}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-slate-800 truncate">{(c.contenido || '').slice(0, 60)}{(c.contenido || '').length > 60 ? '…' : ''}</div>
                <div className="text-[10px] text-slate-500">
                  {c.autor_nombre || '?'} · {fmtFecha(c.created_at)}
                  {c.urgente && <span className="ml-1 text-red-600 font-bold">🔴</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hilos.length > 3 && (
        <p className="text-[10px] text-slate-400 mt-2">Y {hilos.length - 3} más…</p>
      )}

      <ComentariosEquipoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); cargar(); }}
        api={api}
        pagina={pagina}
        // Pre-contexto: evita que ComentariosEquipoModal re-detecte desde DOM,
        // forzando siempre la entidad de esta ficha.
        prefill={{
          seccion,
          entidad_tipo: entidadTipo,
          entidad_id: entidadId,
          entidad_nombre: entidadNombre,
        }}
      />
    </div>
  );
};

export default ComentariosEquipoInline;
