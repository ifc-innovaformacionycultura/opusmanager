// Modal para enviar comentarios al equipo de gestores.
// Detecta el contexto automáticamente (página, sección, entidad) y
// permite mencionar gestores específicos. Persiste en /api/gestor/comentarios-equipo.
//
// Detección de contexto:
//   - `pagina`: ruta + breadcrumb humano (p.ej. "/admin/archivo · Archivo musical").
//   - `entidad_nombre`: si la URL tiene /detalle/{id} o el DOM tiene
//     [data-entidad-nombre] dentro de la página actual.

import React, { useEffect, useMemo, useRef, useState } from 'react';

const PAGE_LABELS = [
  ['/configuracion/eventos', 'Configuración → Eventos'],
  ['/configuracion/presupuestos', 'Configuración → Presupuestos'],
  ['/configuracion/plantillas', 'Configuración → Plantillas de comunicación'],
  ['/seguimiento', 'Seguimiento de convocatorias'],
  ['/plantillas-definitivas', 'Plantillas definitivas'],
  ['/asistencia/logistica', 'Desplazamientos y Alojamientos'],
  ['/asistencia/pagos', 'Asistencia y pagos → Gestión económica'],
  ['/asistencia/analisis', 'Asistencia y pagos → Análisis económico'],
  ['/informes', 'Informes'],
  ['/admin/usuarios', 'Administración → Usuarios'],
  ['/admin/musicos', 'Administración → Base de datos músicos'],
  ['/admin/tareas', 'Administración → Planificador'],
  ['/admin/incidencias', 'Administración → Incidencias'],
  ['/admin/mensajes', 'Administración → Mensajes'],
  ['/admin/archivo', 'Administración → Archivo musical'],
  ['/admin/recordatorios', 'Administración → Recordatorios automáticos'],
  ['/admin/emails', 'Administración → Emails'],
  ['/admin/reclamaciones', 'Administración → Reclamaciones'],
  ['/admin/permisos', 'Administración → Permisos'],
  ['/admin/actividad', 'Administración → Actividad'],
  ['/manual', 'Manual de usuario'],
];

const detectarContextoPagina = (path) => {
  const m = PAGE_LABELS.find(([p]) => path.startsWith(p));
  return m ? m[1] : path;
};

const detectarEntidad = () => {
  // Busca [data-entidad-nombre] en el DOM (componentes pueden marcarlo).
  try {
    const el = document.querySelector('[data-entidad-nombre]');
    if (el) {
      return {
        entidad_nombre: el.getAttribute('data-entidad-nombre') || null,
        entidad_tipo: el.getAttribute('data-entidad-tipo') || null,
        entidad_id: el.getAttribute('data-entidad-id') || null,
      };
    }
    // Fallback: H1 visible en la página.
    const h1 = document.querySelector('main h1');
    if (h1) return { entidad_nombre: (h1.textContent || '').trim().slice(0, 80), entidad_tipo: null, entidad_id: null };
  } catch { /* noop */ }
  return { entidad_nombre: null, entidad_tipo: null, entidad_id: null };
};

const ComentariosEquipoModal = ({ open, onClose, api, pagina, prefill }) => {
  const [contenido, setContenido] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [menciones, setMenciones] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [loadingGestores, setLoadingGestores] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  const textareaRef = useRef(null);

  const contexto = useMemo(() => {
    // Si el componente recibe `prefill` (p.ej. desde ComentariosEquipoInline en
    // una ficha), ignoramos la detección DOM y usamos los valores dados.
    if (prefill && prefill.entidad_nombre) {
      const pageLabel = prefill.seccion || detectarContextoPagina(pagina || '');
      const full = `${pageLabel} → ${prefill.entidad_nombre}`;
      return {
        full,
        entidad_nombre: prefill.entidad_nombre,
        entidad_tipo: prefill.entidad_tipo || null,
        entidad_id: prefill.entidad_id || null,
        pageLabel,
      };
    }
    const pageLabel = detectarContextoPagina(pagina || '');
    const ent = detectarEntidad();
    const full = ent.entidad_nombre ? `${pageLabel} → ${ent.entidad_nombre}` : pageLabel;
    return { full, ...ent, pageLabel };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, open, prefill]);

  useEffect(() => {
    if (!open) return;
    setContenido(''); setUrgente(false); setMenciones([]); setError(null); setOk(false);
    (async () => {
      try {
        setLoadingGestores(true);
        const r = await api.get('/api/gestor/comentarios-equipo/_meta/gestores');
        setGestores(r.data?.gestores || []);
      } catch (e) {
        // Silencioso: no bloquea el envío sin mención
      } finally { setLoadingGestores(false); }
    })();
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open, api]);

  const toggleMencion = (id) => {
    setMenciones(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const enviar = async () => {
    setError(null);
    if ((contenido || '').trim().length < 10) {
      setError('El mensaje debe tener al menos 10 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/gestor/comentarios-equipo', {
        pagina: pagina || '/',
        seccion: contexto.pageLabel,
        entidad_tipo: contexto.entidad_tipo || null,
        entidad_id: contexto.entidad_id || null,
        entidad_nombre: contexto.entidad_nombre || null,
        contenido: contenido.trim(),
        menciones,
        urgente,
      });
      setOk(true);
      setTimeout(() => { onClose(); }, 900);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Error al enviar');
    } finally { setSubmitting(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} data-testid="ce-modal">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">💬 Comentar con el equipo</h2>
            <p className="text-xs text-slate-500 mt-0.5" data-testid="ce-contexto">
              <span className="font-medium">Contexto:</span> {contexto.full}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        {ok ? (
          <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3 text-sm" data-testid="ce-ok">
            ✅ Comentario enviado al equipo.
          </div>
        ) : (
          <>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mensaje (mínimo 10 caracteres)</label>
            <textarea
              ref={textareaRef}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              rows={4}
              data-testid="ce-textarea"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="¿Qué quieres comentar al equipo?"
            />

            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Mencionar a (opcional)</label>
              <div className="border border-slate-200 rounded-md max-h-32 overflow-y-auto p-1 bg-slate-50" data-testid="ce-mention-list">
                {loadingGestores && <div className="text-xs text-slate-400 p-2">Cargando…</div>}
                {!loadingGestores && gestores.length === 0 && <div className="text-xs text-slate-400 p-2">Sin gestores disponibles.</div>}
                {gestores.map(g => {
                  const checked = menciones.includes(g.id);
                  const label = `${g.apellidos || ''}, ${g.nombre || ''}`.trim() || g.email;
                  return (
                    <label key={g.id} className={`flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer hover:bg-white ${checked ? 'bg-blue-50' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleMencion(g.id)}
                             data-testid={`ce-mencion-${g.id}`}
                             className="w-3.5 h-3.5 accent-blue-600" />
                      <span>{label}</span>
                      <span className="ml-auto text-[10px] text-slate-400 uppercase">{g.rol}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Si no mencionas a nadie, se notifica a todos los gestores y archiveros.</p>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="radio" name="ce-urg" checked={!urgente} onChange={() => setUrgente(false)}
                       data-testid="ce-urg-normal" className="w-4 h-4 accent-blue-600" />
                <span>Normal</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="radio" name="ce-urg" checked={urgente} onChange={() => setUrgente(true)}
                       data-testid="ce-urg-urgente" className="w-4 h-4 accent-red-600" />
                <span className="text-red-700 font-medium">🔴 Urgente</span>
              </label>
            </div>

            {error && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2" data-testid="ce-error">{error}</div>}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose}
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" onClick={enviar} disabled={submitting}
                      data-testid="ce-submit"
                      className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50">
                {submitting ? 'Enviando…' : 'Enviar comentario'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComentariosEquipoModal;
