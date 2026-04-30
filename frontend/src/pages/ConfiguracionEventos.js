import React, { useState, useEffect } from "react";
import { useAuth as useGestorAuth } from "../contexts/AuthContext";
import ComentariosPanel from "../components/ComentariosPanel";
import ConvocatoriaInstrumentosPanel from "../components/ConvocatoriaInstrumentosPanel";
import LogisticaSection from "../components/LogisticaSection";
import ComidasSection from "../components/ComidasSection";
import ComentariosEquipoInline from "../components/ComentariosEquipoInline";
import MontajeRiderSection from "../components/MontajeRiderSection";

// Bloque 7 — Indicador "verificar atriles" en cada obra del programa.
// Busca en el catálogo por título y si encuentra match permite verificar copias físicas.
const ProgramaArchivoCell = ({ item, eventoId }) => {
  const { api } = useGestorAuth();
  const [match, setMatch] = useState(null);    // {id, codigo, titulo, autor, completo}
  const [verif, setVerif] = useState(null);    // resultado del cálculo
  const [openModal, setOpenModal] = useState(false);
  const [estadoMat, setEstadoMat] = useState(null); // {estado, deficit_por_seccion, ...}
  const [conflictos, setConflictos] = useState([]); // préstamos solapando fechas (B5)
  const titulo = (item.obra || '').trim();

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!titulo || titulo.length < 3) { setMatch(null); return; }
      try {
        const r = await api.get(`/api/gestor/archivo/obras?q=${encodeURIComponent(titulo)}`);
        const obras = r.data?.obras || [];
        const exacto = obras.find(o => (o.titulo || '').toLowerCase().trim() === titulo.toLowerCase());
        if (!cancel) setMatch(exacto || null);
      } catch { if (!cancel) setMatch(null); }
    })();
    return () => { cancel = true; };
  }, [titulo, api]);

  // Bloque 5 — estado de material + conflictos
  useEffect(() => {
    if (!match?.id) { setEstadoMat(null); setConflictos([]); return; }
    let cancel = false;
    (async () => {
      try {
        const r1 = await api.get(`/api/gestor/archivo/obras/${match.id}/estado-material${eventoId ? `?evento_id=${eventoId}` : ''}`);
        if (!cancel) setEstadoMat(r1.data);
      } catch {/* noop */ }
      if (eventoId) {
        try {
          const r2 = await api.get(`/api/gestor/archivo/obras/${match.id}/conflictos-evento/${eventoId}`);
          if (!cancel) setConflictos(r2.data?.conflictos || []);
        } catch {/* noop */ }
      }
    })();
    return () => { cancel = true; };
  }, [match?.id, eventoId, api]);

  if (!titulo) return null;
  if (!match) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700" title="No encontrada en el catálogo de archivo">
        ⚠ Pendiente registro archivo
      </span>
    );
  }

  const verificar = async () => {
    if (!eventoId) return alert('Guarda primero el evento.');
    const r = await api.get(`/api/gestor/archivo/obras/${match.id}/atriles-evento/${eventoId}`);
    setVerif(r.data); setOpenModal(true);
  };

  // Indicador de estado de material
  const estadoCfg = {
    completo: { l: '🟢 Completo', c: 'bg-emerald-100 text-emerald-700' },
    incompleto: { l: '🟡 Incompleto', c: 'bg-amber-100 text-amber-700' },
    necesita_revision: { l: '🔴 Revisar', c: 'bg-red-100 text-red-700' },
    sin_partes: { l: '⚪ Sin partes', c: 'bg-slate-100 text-slate-600' },
  }[estadoMat?.estado] || null;

  return (
    <span className="flex items-center gap-1 flex-wrap">
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700" title={`En catálogo: ${match.codigo}`}>🟢 archivo</span>
      {estadoCfg && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${estadoCfg.c}`}
              title={`${estadoMat.copias_total} copias · ${estadoMat.partes_count} partes`}>
          {estadoCfg.l}
        </span>
      )}
      {estadoMat?.copias_suficientes === false && (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700"
              title={`Déficit: ${(estadoMat.deficit_por_seccion || []).map(d => `${d.seccion}(-${d.deficit})`).join(', ')}`}>
          ⚠ Faltan copias
        </span>
      )}
      {conflictos.length > 0 && (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-800"
              title={`En préstamo durante el evento (${conflictos.length})`}>
          🔒 En préstamo
        </span>
      )}
      <button type="button" onClick={verificar}
        data-testid={`btn-verif-atriles-${match.id}`}
        className="text-[10px] text-blue-600 hover:underline">Ver atriles</button>
      {openModal && verif && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={() => setOpenModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Verificación de atriles — {match.titulo}</h3>
            {(verif.alertas || []).length === 0 ? (
              <p className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">✅ Material suficiente.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr><th className="px-2 py-1 text-left">Papel</th><th className="px-2 py-1">Necesarios</th><th className="px-2 py-1">Copias</th><th className="px-2 py-1 text-red-600">Déficit</th></tr>
                </thead>
                <tbody>
                  {verif.alertas.map(a => (
                    <tr key={a.papel} className="border-t border-slate-100">
                      <td className="px-2 py-1">{a.label}</td>
                      <td className="px-2 py-1 text-center">{a.necesarios}</td>
                      <td className="px-2 py-1 text-center">{a.copias}</td>
                      <td className="px-2 py-1 text-center text-red-600 font-bold">{a.deficit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button type="button" onClick={() => setOpenModal(false)} className="mt-3 px-3 py-1.5 bg-slate-100 text-sm rounded">Cerrar</button>
          </div>
        </div>
      )}
    </span>
  );
};

// Accordion Component
const Accordion = ({ title, subtitle, isOpen, onToggle, children }) => (
  <div className="border border-slate-200 rounded-lg mb-3 bg-white">
    <button
      onClick={onToggle}
      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      data-testid={`accordion-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="flex-1">
        <span className="font-medium text-slate-900">{title}</span>
        {subtitle && <span className="ml-4 text-sm text-slate-500">{subtitle}</span>}
      </div>
      <svg
        className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {isOpen && <div className="px-4 pb-4 border-t border-slate-100">{children}</div>}
  </div>
);

// Section Title
const SectionTitle = ({ children, color }) => {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
    pink: 'bg-pink-500',
    teal: 'bg-teal-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };
  return (
    <div className="flex items-center gap-2 mb-3 mt-4">
      <div className={`w-1 h-5 ${colors[color] || 'bg-slate-500'} rounded`}></div>
      <h4 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{children}</h4>
    </div>
  );
};

// Badge de verificación de sección
const ICONOS_SECCION = {
  datos_generales: '📋', ensayos: '🎼', logistica_musicos: '🚌',
  logistica_material: '🚚', programa_musical: '🎵', presupuesto: '💰',
  montaje: '🛠️', partituras: '📜', comidas: '🍽️',
};
const VerificacionBadge = ({ estado, puedeEditar, onChange, seccion, eventoId, api }) => {
  const [open, setOpen] = useState(false);
  const [notas, setNotas] = useState('');
  const [solicitando, setSolicitando] = useState(false);
  const cfg = {
    pendiente: { l: '🟡 PENDIENTE', c: 'bg-amber-400 text-amber-950 border-amber-500' },
    verificado: { l: '✅ VERIFICADO', c: 'bg-emerald-600 text-white border-emerald-700' },
    autorizado_sin_verificar: { l: '⚡ AUTORIZADO', c: 'bg-blue-600 text-white border-blue-700' },
  }[estado || 'pendiente'];
  const apply = async (nuevo) => {
    await onChange(seccion, nuevo, notas);
    setOpen(false); setNotas('');
  };
  const solicitar = async (e) => {
    e.stopPropagation();
    if (solicitando || !eventoId) return;
    setSolicitando(true);
    try {
      const r = await api.post(`/api/gestor/eventos/${eventoId}/verificaciones/${seccion}/solicitar`);
      alert(`✅ Solicitud enviada a ${r.data?.enviados?.length || 0} administradores.`);
    } catch (err) {
      alert('No se pudo enviar la solicitud: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSolicitando(false);
    }
  };
  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (!e.target.closest(`[data-verif-seccion="${seccion}"]`)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, seccion]);

  return (
    <div className="relative inline-flex items-center gap-1" data-testid={`verif-badge-${seccion}`} data-verif-seccion={seccion}>
      <button
        type="button"
        disabled={!puedeEditar}
        onClick={(e) => { e.stopPropagation(); puedeEditar && setOpen(o => !o); }}
        className={`text-xs font-bold px-2.5 py-1 rounded-md border-2 ${cfg.c} ${puedeEditar ? 'cursor-pointer hover:scale-105 hover:shadow-md transition-transform' : 'cursor-default opacity-95'}`}
        title={puedeEditar ? 'Click para cambiar el estado' : 'Solo administradores y director general pueden modificar este badge'}
        aria-label={`Estado de verificación: ${cfg.l}`}
      >
        {cfg.l}
      </button>
      {/* Botón solicitar verificación — solo visible si pendiente y NO super admin */}
      {!puedeEditar && estado === 'pendiente' && eventoId && (
        <button type="button" onClick={solicitar} disabled={solicitando}
                data-testid={`verif-solicitar-${seccion}`}
                title="Notificar al director general por email"
                className="text-[10px] px-1.5 py-1 rounded-md bg-[#1A3A5C] hover:bg-[#163050] text-white disabled:opacity-50 transition font-bold">
          {solicitando ? '…' : '📨'}
        </button>
      )}
      {open && (
        <div className="absolute z-50 right-0 top-full mt-2 bg-white border-2 border-[#1A3A5C] rounded-lg shadow-2xl p-3 w-80"
             data-testid={`verif-dropdown-${seccion}`}
             onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
            <span className="text-lg">{ICONOS_SECCION[seccion] || '📋'}</span>
            <span className="text-sm font-semibold text-slate-800">Cambiar estado de verificación</span>
          </div>
          <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
                    placeholder="Comentario sobre la verificación…"
                    className="w-full text-xs border border-slate-300 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30" rows={2} />
          <div className="space-y-1">
            <button onClick={() => apply('verificado')}
                    data-testid={`verif-btn-verificado-${seccion}`}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-emerald-50 rounded border border-emerald-200 bg-emerald-50/30 font-semibold text-emerald-800">
              ✅ Marcar como verificado
            </button>
            <button onClick={() => apply('autorizado_sin_verificar')}
                    data-testid={`verif-btn-autorizado-${seccion}`}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-blue-50 rounded border border-blue-200 bg-blue-50/30 font-semibold text-blue-800">
              ⚡ Autorizar sin verificar
            </button>
            <button onClick={() => apply('pendiente')}
                    data-testid={`verif-btn-pendiente-${seccion}`}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-amber-50 rounded border border-amber-200 bg-amber-50/30 font-semibold text-amber-800">
              🟡 Volver a pendiente
            </button>
          </div>
          <button onClick={() => setOpen(false)}
                  className="w-full text-xs px-3 py-1.5 text-slate-500 hover:bg-slate-50 rounded mt-2 border-t border-slate-200">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

// Subacordeón coloreado por sección
const SECCION_BG = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  teal: 'bg-teal-50 border-teal-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  purple: 'bg-purple-50 border-purple-200',
  orange: 'bg-orange-50 border-orange-200',
  red: 'bg-red-50 border-red-200',
  gray: 'bg-gray-50 border-gray-200',
  indigo: 'bg-indigo-50 border-indigo-200',
};
const Section = ({ titulo, icono, color = 'gray', defaultOpen = false, badge, children, sectionKey }) => {
  const [open, setOpen] = useState(defaultOpen);
  const bg = SECCION_BG[color] || SECCION_BG.gray;
  return (
    <div className={`rounded-lg border ${bg} overflow-hidden`} data-testid={`section-${sectionKey}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-black/5 transition cursor-pointer select-none"
        data-testid={`section-toggle-${sectionKey}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icono}</span>
          <span className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{titulo}</span>
          {badge}
        </div>
        <span className={`text-slate-500 transform transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
      </div>
      {open && <div className="p-4 pt-2 border-t border-black/5">{children}</div>}
    </div>
  );
};

// Input Field
const InputField = ({ label, value, onChange, type = "text", placeholder = "" }) => (
  <div className="mb-3">
    <label className="block text-sm text-slate-600 mb-1">{label}</label>
    <input
      type={type}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-300 focus:border-transparent"
    />
  </div>
);

// Number Input
const NumberInput = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm text-slate-600">{label}</span>
    <input
      type="number"
      min="0"
      value={value || 0}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
    />
  </div>
);

// Instrumentation Table
const InstrumentationSection = ({ instrumentation, onChange }) => {
  const updateSection = (section, field, value) => {
    onChange({
      ...instrumentation,
      [section]: { ...(instrumentation[section] || {}), [field]: value }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Cuerda */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">CUERDA</h5>
        <NumberInput label="Violines I" value={instrumentation?.cuerda?.violines_i} onChange={(v) => updateSection('cuerda', 'violines_i', v)} />
        <NumberInput label="Violines II" value={instrumentation?.cuerda?.violines_ii} onChange={(v) => updateSection('cuerda', 'violines_ii', v)} />
        <NumberInput label="Violas" value={instrumentation?.cuerda?.violas} onChange={(v) => updateSection('cuerda', 'violas', v)} />
        <NumberInput label="Violonchelos" value={instrumentation?.cuerda?.violonchelos} onChange={(v) => updateSection('cuerda', 'violonchelos', v)} />
        <NumberInput label="Contrabajos" value={instrumentation?.cuerda?.contrabajos} onChange={(v) => updateSection('cuerda', 'contrabajos', v)} />
      </div>

      {/* Viento Madera */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">VIENTO MADERA</h5>
        <NumberInput label="Flautas" value={instrumentation?.viento_madera?.flautas} onChange={(v) => updateSection('viento_madera', 'flautas', v)} />
        <NumberInput label="Oboes" value={instrumentation?.viento_madera?.oboes} onChange={(v) => updateSection('viento_madera', 'oboes', v)} />
        <NumberInput label="Clarinetes" value={instrumentation?.viento_madera?.clarinetes} onChange={(v) => updateSection('viento_madera', 'clarinetes', v)} />
        <NumberInput label="Fagotes" value={instrumentation?.viento_madera?.fagotes} onChange={(v) => updateSection('viento_madera', 'fagotes', v)} />
      </div>

      {/* Viento Metal */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">VIENTO METAL</h5>
        <NumberInput label="Trompetas" value={instrumentation?.viento_metal?.trompetas} onChange={(v) => updateSection('viento_metal', 'trompetas', v)} />
        <NumberInput label="Trompas" value={instrumentation?.viento_metal?.trompas} onChange={(v) => updateSection('viento_metal', 'trompas', v)} />
        <NumberInput label="Trombones" value={instrumentation?.viento_metal?.trombones} onChange={(v) => updateSection('viento_metal', 'trombones', v)} />
        <NumberInput label="Tubas" value={instrumentation?.viento_metal?.tubas} onChange={(v) => updateSection('viento_metal', 'tubas', v)} />
      </div>

      {/* Percusión */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">PERCUSIÓN</h5>
        <NumberInput label="Nº Percusionistas" value={instrumentation?.percusion?.num_percusionistas} onChange={(v) => updateSection('percusion', 'num_percusionistas', v)} />
        <div className="mt-2">
          <label className="text-sm text-slate-600">Instrumental requerido</label>
          <textarea
            value={instrumentation?.percusion?.instrumental || ''}
            onChange={(e) => updateSection('percusion', 'instrumental', e.target.value)}
            className="w-full px-2 py-1 border border-slate-200 rounded text-sm mt-1"
            rows="2"
          />
        </div>
      </div>

      {/* Coro */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">CORO</h5>
        <NumberInput label="Sopranos" value={instrumentation?.coro?.sopranos} onChange={(v) => updateSection('coro', 'sopranos', v)} />
        <NumberInput label="Contraltos" value={instrumentation?.coro?.contraltos} onChange={(v) => updateSection('coro', 'contraltos', v)} />
        <NumberInput label="Tenores" value={instrumentation?.coro?.tenores} onChange={(v) => updateSection('coro', 'tenores', v)} />
        <NumberInput label="Bajos" value={instrumentation?.coro?.bajos} onChange={(v) => updateSection('coro', 'bajos', v)} />
      </div>

      {/* Teclados */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">TECLADOS Y ARPAS</h5>
        <NumberInput label="Pianistas" value={instrumentation?.teclados?.pianistas} onChange={(v) => updateSection('teclados', 'pianistas', v)} />
        <NumberInput label="Organistas" value={instrumentation?.teclados?.organistas} onChange={(v) => updateSection('teclados', 'organistas', v)} />
        <NumberInput label="Clavecinistas" value={instrumentation?.teclados?.clavecinistas} onChange={(v) => updateSection('teclados', 'clavecinistas', v)} />
        <NumberInput label="Celestistas" value={instrumentation?.teclados?.celestistas} onChange={(v) => updateSection('teclados', 'celestistas', v)} />
        <NumberInput label="Arpistas" value={instrumentation?.teclados?.arpistas} onChange={(v) => updateSection('teclados', 'arpistas', v)} />
      </div>
    </div>
  );
};

// Event Form
const EventForm = ({ event, onChange, onSave, onDelete, canDelete }) => {
  const { api, user } = useGestorAuth();
  const [rehearsals, setRehearsals] = useState([]);
  const [rehearsalsInitial, setRehearsalsInitial] = useState([]); // snapshot para diff
  const [program, setProgram] = useState(event.program || []);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // BLOQUE 2 — Verificaciones por sección
  const [verifs, setVerifs] = useState([]);  // [{seccion, estado, ...}]
  // puedeEditar derivado del rol del usuario (sync) para evitar flash UI
  const puedeEditarSync = React.useMemo(() => {
    const rol = user?.profile?.rol || user?.rol;
    const email = (user?.profile?.email || user?.email || '').toLowerCase();
    return ['admin', 'director_general'].includes(rol) || email === 'admin@convocatorias.com';
  }, [user]);
  const [verifMeta, setVerifMeta] = useState({ verificadas: 0, total: 8, puede_publicar: false, puede_editar: puedeEditarSync });
  // Estado original del evento (para distinguir publicación nueva vs cambios en publicado)
  // Snapshot al primer render del evento.
  const estadoOriginalRef = React.useRef(event?.estado);
  useEffect(() => {
    if (event?.id && estadoOriginalRef.current === undefined) {
      estadoOriginalRef.current = event.estado;
    }
  }, [event?.id, event?.estado]);
  // Inyectamos en event para que el handler del botón Guardar lo encuentre
  if (event && event._estadoOriginal === undefined) event._estadoOriginal = estadoOriginalRef.current;
  const cargarVerifs = async () => {
    if (!event?.id) return;
    try {
      const r = await api.get(`/api/gestor/eventos/${event.id}/verificaciones`);
      setVerifs(r.data?.verificaciones || []);
      setVerifMeta({
        verificadas: r.data?.verificadas || 0,
        total: r.data?.total || 8,
        puede_publicar: !!r.data?.puede_publicar,
        puede_editar: puedeEditarSync || !!r.data?.puede_editar,
      });
    } catch { /* noop */ }
  };
  useEffect(() => { cargarVerifs(); /* eslint-disable-next-line */ }, [event?.id]);
  const estadoSeccion = (s) => verifs.find(v => v.seccion === s)?.estado || 'pendiente';
  const cambiarVerif = async (seccion, estado, notas) => {
    // Update optimista del estado local — feedback inmediato
    setVerifs(prev => {
      const idx = prev.findIndex(v => v.seccion === seccion);
      if (idx >= 0) {
        const c = [...prev]; c[idx] = { ...c[idx], estado, notas };
        return c;
      }
      return [...prev, { seccion, estado, notas }];
    });
    setVerifMeta(prev => {
      const newVerifs = [...verifs];
      const idx = newVerifs.findIndex(v => v.seccion === seccion);
      if (idx >= 0) newVerifs[idx] = { ...newVerifs[idx], estado };
      else newVerifs.push({ seccion, estado });
      const nuevasVerificadas = newVerifs.filter(v => v.estado === 'verificado' || v.estado === 'autorizado_sin_verificar').length;
      return { ...prev, verificadas: nuevasVerificadas, puede_publicar: nuevasVerificadas === prev.total };
    });
    try {
      await api.put(`/api/gestor/eventos/${event.id}/verificaciones/${seccion}`, { estado, notas: notas || null });
      cargarVerifs(); // resync con backend
    } catch (e) {
      alert('No se pudo cambiar: ' + (e.response?.data?.detail || e.message));
      cargarVerifs(); // revertir
    }
  };
  const renderBadge = (s) => (
    <VerificacionBadge
      estado={estadoSeccion(s)}
      puedeEditar={verifMeta.puede_editar}
      onChange={cambiarVerif}
      seccion={s}
      eventoId={event?.id}
      api={api}
    />
  );

  // Convierte ensayos de backend { id, fecha, hora, hora_fin, tipo, obligatorio, lugar, notas }
  // al formato del formulario { id?, date, start, end, tipo, obligatorio, lugar, notas }
  const toFormRehearsals = (ens = []) => (ens || []).map(e => ({
    id: e.id,
    date: e.fecha ? String(e.fecha).slice(0, 10) : '',
    start: e.hora ? String(e.hora).slice(0, 5) : '',
    end: e.hora_fin ? String(e.hora_fin).slice(0, 5) : '',
    tipo: e.tipo || 'ensayo',
    obligatorio: e.obligatorio !== false,
    lugar: e.lugar || '',
    notas: e.notas || '',
  }));

  useEffect(() => {
    const converted = toFormRehearsals(event.ensayos || []);
    setRehearsals(converted);
    setRehearsalsInitial(converted);
    setProgram(event.program || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, event.ensayos]);

  const addRehearsal = () => {
    const newRehearsals = [...rehearsals, { date: '', start: '', end: '', tipo: 'ensayo', obligatorio: true }];
    setRehearsals(newRehearsals);
  };

  const updateRehearsal = (index, field, value) => {
    const newRehearsals = [...rehearsals];
    newRehearsals[index] = { ...newRehearsals[index], [field]: value };
    setRehearsals(newRehearsals);
  };

  const removeRehearsal = (index) => {
    const newRehearsals = rehearsals.filter((_, i) => i !== index);
    setRehearsals(newRehearsals);
  };

  // Expone al padre los cambios de ensayos + programa vía onChange (para pasarlos al save)
  useEffect(() => {
    onChange({ ...event, rehearsals, rehearsalsInitial, program });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehearsals, program]);

  const addProgramItem = () => {
    const newProgram = [...program, { duration: '', author: '', obra: '', observaciones: '' }];
    setProgram(newProgram);
  };

  const updateProgramItem = (index, field, value) => {
    const newProgram = [...program];
    newProgram[index] = { ...newProgram[index], [field]: value };
    setProgram(newProgram);
  };

  return (
    <div className="space-y-3 pt-4">
      {/* Indicador global de verificación */}
      {event?.id && (
        <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3" data-testid="verif-progreso">
          <div className="text-2xl">{verifMeta.puede_publicar ? '✅' : '🔍'}</div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">
              {verifMeta.verificadas}/{verifMeta.total} secciones verificadas
              {verifMeta.puede_publicar && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Listo para publicar</span>}
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-1.5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${verifMeta.puede_publicar ? 'bg-emerald-500' : 'bg-amber-500'}`}
                   style={{ width: `${(verifMeta.verificadas / Math.max(1, verifMeta.total)) * 100}%` }} />
            </div>
          </div>
          {verifMeta.puede_editar && (
            <span className="text-xs text-slate-500 italic">Click en cada badge para verificar</span>
          )}
        </div>
      )}

      {/* Datos Generales */}
      <Section titulo="Datos Generales" icono={ICONOS_SECCION.datos_generales} color="blue"
               sectionKey="datos_generales" defaultOpen={true}
               badge={event?.id ? renderBadge('datos_generales') : null}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          label="Nombre del evento"
          value={event.nombre}
          onChange={(v) => onChange({ ...event, nombre: v })}
        />
        <div className="mb-3">
          <label className="block text-sm text-slate-600 mb-1">Tipo</label>
          <select
            value={event.tipo || 'concierto'}
            onChange={(e) => onChange({ ...event, tipo: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            data-testid="event-tipo"
          >
            <option value="concierto">Concierto</option>
            <option value="ensayo">Ensayo</option>
            <option value="funcion">Función</option>
            <option value="gira">Gira</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <InputField
          label="Lugar"
          value={event.lugar}
          onChange={(v) => onChange({ ...event, lugar: v })}
          placeholder="Auditorio, sala..."
        />
        <div className="mb-3">
          <label className="block text-sm text-slate-600 mb-1">Estado</label>
          <select
            value={event.estado || 'borrador'}
            onChange={(e) => onChange({ ...event, estado: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            data-testid="event-estado"
          >
            <option value="borrador">Borrador (no visible para músicos)</option>
            <option value="abierto">Público (visible para músicos)</option>
            <option value="en_curso">En curso</option>
            <option value="cerrado">Cerrado</option>
            <option value="cancelado">Cancelado</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>

        {/* Fechas agrupadas — todas en Datos Generales */}
        <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3" data-testid="fechas-bloque">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Fechas del evento</p>

          {/* Fecha principal (fecha + hora) */}
          <div className="flex items-center gap-2 mb-2" data-testid="fecha-row-principal">
            <span className="text-xs text-slate-500 w-56 shrink-0">Fecha de actuación principal</span>
            <input
              type="date"
              value={event.fecha_inicio ? String(event.fecha_inicio).slice(0, 10) : ''}
              onChange={(e) => onChange({ ...event, fecha_inicio: e.target.value })}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
              data-testid="input-fecha-principal"
            />
            <input
              type="time"
              value={event.hora_inicio ? String(event.hora_inicio).slice(0, 5) : ''}
              onChange={(e) => onChange({ ...event, hora_inicio: e.target.value })}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
              data-testid="input-hora-principal"
              placeholder="Hora"
            />
          </div>

          {/* Actuaciones 2/3/4 → fecha_secundaria_1/2/3 + hora_secundaria_1/2/3 */}
          {[1, 2, 3].map((i) => {
            const label = `Fecha de actuación ${i + 1}`;
            const fechaKey = `fecha_secundaria_${i}`;
            const horaKey = `hora_secundaria_${i}`;
            return (
              <div key={i} className="flex items-center gap-2 mb-2" data-testid={`fecha-row-actuacion-${i + 1}`}>
                <span className="text-xs text-slate-500 w-56 shrink-0">{label} <span className="text-slate-400">(opcional)</span></span>
                <input
                  type="date"
                  value={event[fechaKey] ? String(event[fechaKey]).slice(0, 10) : ''}
                  onChange={(e) => onChange({ ...event, [fechaKey]: e.target.value || null })}
                  className="px-2 py-1 border border-slate-200 rounded text-sm"
                  data-testid={`input-fecha-actuacion-${i + 1}`}
                />
                <input
                  type="time"
                  value={event[horaKey] ? String(event[horaKey]).slice(0, 5) : ''}
                  onChange={(e) => onChange({ ...event, [horaKey]: e.target.value || null })}
                  className="px-2 py-1 border border-slate-200 rounded text-sm"
                  data-testid={`input-hora-actuacion-${i + 1}`}
                  placeholder="Hora"
                />
              </div>
            );
          })}

          {/* Fecha inicio preparación (para ensayos) */}
          <div className="flex items-center gap-2 mb-2" data-testid="fecha-row-preparacion">
            <span className="text-xs text-slate-500 w-56 shrink-0">Fecha inicio preparación <span className="text-slate-400">(ensayos)</span></span>
            <input
              type="date"
              value={event.fecha_inicio_preparacion ? String(event.fecha_inicio_preparacion).slice(0, 10) : ''}
              onChange={(e) => onChange({ ...event, fecha_inicio_preparacion: e.target.value || null })}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
              data-testid="input-fecha-preparacion"
            />
          </div>

          {/* Fecha fin */}
          <div className="flex items-center gap-2" data-testid="fecha-row-fin">
            <span className="text-xs text-slate-500 w-56 shrink-0">Fecha fin</span>
            <input
              type="date"
              value={event.fecha_fin ? String(event.fecha_fin).slice(0, 10) : ''}
              onChange={(e) => onChange({ ...event, fecha_fin: e.target.value || null })}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
              data-testid="input-fecha-fin"
            />
          </div>
        </div>

        <div className="md:col-span-2 mb-3">
          <label className="block text-sm text-slate-600 mb-1">Descripción</label>
          <textarea
            value={event.descripcion || ''}
            onChange={(e) => onChange({ ...event, descripcion: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            data-testid="event-descripcion"
          />
        </div>
        <div className="md:col-span-2 mb-3">
          <label className="block text-sm text-slate-600 mb-1">Notas internas</label>
          <textarea
            value={event.notas || ''}
            onChange={(e) => onChange({ ...event, notas: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            data-testid="event-notas"
          />
        </div>
      </div>
      </Section>

      {/* Ensayos y Funciones */}
      <Section titulo="Ensayos y Funciones" icono={ICONOS_SECCION.ensayos} color="green"
               sectionKey="ensayos"
               badge={event?.id ? renderBadge('ensayos') : null}>
      <p className="text-xs text-slate-500 mb-2">
        Añade ensayos y funciones (conciertos) del evento. Los ensayos aparecerán como subcolumnas en Seguimiento de Plantillas.
      </p>
      <div className="space-y-2">
        {rehearsals.map((rehearsal, index) => (
          <div key={rehearsal.id || `new-${index}`} data-testid={`ensayo-wrapper-${index}`}>
          <div
            className="flex items-center gap-2 bg-slate-50 p-2 rounded flex-wrap"
            data-testid={`ensayo-row-${index}`}
          >
            <select
              value={rehearsal.tipo || 'ensayo'}
              onChange={(e) => updateRehearsal(index, 'tipo', e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-sm bg-white"
              data-testid={`ensayo-tipo-${index}`}
            >
              <option value="ensayo">Ensayo</option>
              <option value="concierto">Concierto</option>
              <option value="funcion">Función</option>
            </select>
            <input
              type="date"
              value={rehearsal.date || ''}
              onChange={(e) => updateRehearsal(index, 'date', e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
              data-testid={`ensayo-fecha-${index}`}
            />
            <input
              type="time"
              value={rehearsal.start || ''}
              onChange={(e) => updateRehearsal(index, 'start', e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
              data-testid={`ensayo-hora-${index}`}
              placeholder="Inicio"
              title="Hora de inicio"
            />
            <span className="text-slate-400 text-xs">—</span>
            <input
              type="time"
              value={rehearsal.end || ''}
              onChange={(e) => updateRehearsal(index, 'end', e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
              data-testid={`ensayo-hora-fin-${index}`}
              placeholder="Fin"
              title="Hora de fin"
            />
            <input
              type="text"
              value={rehearsal.lugar || ''}
              onChange={(e) => updateRehearsal(index, 'lugar', e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-sm flex-1 min-w-[140px]"
              placeholder="Lugar (opcional)"
              data-testid={`ensayo-lugar-${index}`}
            />
            <label className="inline-flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={rehearsal.obligatorio !== false}
                onChange={(e) => updateRehearsal(index, 'obligatorio', e.target.checked)}
                data-testid={`ensayo-obligatorio-${index}`}
              />
              Obligatorio
            </label>
            <button
              onClick={() => removeRehearsal(index)}
              className="p-1 text-red-500 hover:bg-red-50 rounded"
              data-testid={`ensayo-delete-${index}`}
              title="Eliminar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          {/* Panel de convocatoria visible siempre que sea ensayo (incluso sin id) */}
          {((rehearsal.tipo || 'ensayo') === 'ensayo') && (() => {
            const isPersisted = !!rehearsal.id;
            // Ensayo anterior persistido más cercano del mismo tipo
            const prev = rehearsals
              .slice(0, index)
              .reverse()
              .find(r => r.id && (r.tipo || 'ensayo') === 'ensayo');
            const prevLabel = prev ? `${prev.date || ''} ${prev.start || ''}${prev.lugar ? ' · ' + prev.lugar : ''}`.trim() : null;
            const tempKey = `new-${index}`;
            return (
              <ConvocatoriaInstrumentosPanel
                ensayoId={isPersisted ? rehearsal.id : null}
                api={api}
                ensayoAnteriorId={isPersisted ? prev?.id : undefined}
                ensayoAnteriorLabel={isPersisted ? prevLabel : undefined}
                mode={isPersisted ? 'persisted' : 'new'}
                tempKey={tempKey}
                onLocalChange={(stateMap) => {
                  // Recogemos el estado en el rehearsal mismo para luego persistirlo
                  const next = [...rehearsals];
                  next[index] = { ...next[index], pending_convocatoria: stateMap };
                  setRehearsals(next);
                }}
              />
            );
          })()}
          </div>
        ))}
        <button
          onClick={addRehearsal}
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
          data-testid="btn-add-ensayo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
          Añadir ensayo/función
        </button>
      </div>
      </Section>

      {/* Logística — Transportes y Alojamientos (Bloque 2) */}
      {event.id && (
        <Section titulo="Transportes y Alojamientos · Músicos" icono={ICONOS_SECCION.logistica_musicos}
                 color="yellow" sectionKey="logistica_musicos"
                 badge={renderBadge('logistica_musicos')}>
          <LogisticaSection eventoId={event.id} api={api} />
        </Section>
      )}

      {/* Servicio de comedor (Iter 19) */}
      {event.id && (
        <Section titulo="Servicio de comedor" icono={ICONOS_SECCION.comidas}
                 color="orange" sectionKey="comidas">
          <ComidasSection eventoId={event.id} api={api} />
        </Section>
      )}

      {/* Comentarios del equipo sobre este evento */}
      {event.id && (
        <div className="mt-2">
          <ComentariosEquipoInline
            api={api}
            entidadTipo="evento"
            entidadId={event.id}
            entidadNombre={event.nombre}
            pagina="/configuracion/eventos"
            seccion="Configuración → Eventos"
          />
        </div>
      )}

      {/* Montaje y Rider Técnico (Bloque 3) */}
      {event.id && (
        <Section titulo="Montaje y Rider Técnico" icono={ICONOS_SECCION.montaje}
                 color="orange" sectionKey="montaje"
                 badge={renderBadge('montaje')}>
          <MontajeRiderSection
            evento={event}
            api={api}
            onEventChange={(patch) => onChange({ ...event, ...patch })}
          />
        </Section>
      )}

      {/* Instrumentación */}
      <Section titulo="Propuesta de Plantilla" icono="🎻" color="teal" sectionKey="propuesta_plantilla">
        <InstrumentationSection
          instrumentation={event.instrumentation || {}}
          onChange={(inst) => onChange({ ...event, instrumentation: inst })}
        />
      </Section>

      {/* Programa Musical */}
      <Section titulo="Programa Musical" icono={ICONOS_SECCION.programa_musical}
               color="purple" sectionKey="programa_musical"
               badge={event?.id ? renderBadge('programa_musical') : null}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3 py-2 text-left font-medium text-slate-600">Duración</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Autor</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Obra</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Observaciones</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {program.map((item, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="px-3 py-2">
                  <input
                    value={item.duration || ''}
                    onChange={(e) => updateProgramItem(index, 'duration', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                    placeholder="15'"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={item.author || ''}
                    onChange={(e) => updateProgramItem(index, 'author', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={item.obra || ''}
                    onChange={(e) => updateProgramItem(index, 'obra', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={item.observaciones || ''}
                    onChange={(e) => updateProgramItem(index, 'observaciones', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2"><ProgramaArchivoCell item={item} eventoId={event?.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={addProgramItem}
          className="mt-2 text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
          Añadir obra
        </button>
      </div>
      </Section>

      {/* Partituras y materiales por sección */}
      <Section titulo="Partituras y materiales por sección" icono={ICONOS_SECCION.partituras}
               color="yellow" sectionKey="partituras"
               badge={event?.id ? renderBadge('partituras') : null}>
      <p className="text-xs text-slate-500 mb-2">Pega un enlace (Google Drive, Dropbox...) para cada sección. Cada músico verá sólo el de su instrumento.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { key: 'partitura_cuerda',        label: 'Cuerda (violines, violas, cellos, contrabajos)' },
          { key: 'partitura_viento_madera', label: 'Viento madera (flauta, oboe, clarinete, fagot)' },
          { key: 'partitura_viento_metal',  label: 'Viento metal (trompa, trompeta, trombón, tuba)' },
          { key: 'partitura_percusion',     label: 'Percusión' },
          { key: 'partitura_coro',          label: 'Coro' },
          { key: 'partitura_teclados',      label: 'Teclados y piano' },
        ].map((f) => (
          <InputField
            key={f.key}
            label={f.label}
            value={event[f.key]}
            onChange={(v) => onChange({ ...event, [f.key]: v })}
            placeholder="https://drive.google.com/..."
          />
        ))}
      </div>
      </Section>

      {/* Notas para los músicos + información adicional */}
      <Section titulo="Notas e información para músicos" icono="📝" color="gray" sectionKey="notas_musicos">
      <div className="mb-3">
        <label className="block text-sm text-slate-600 mb-1">Notas para los músicos (visibles en el portal)</label>
        <textarea
          value={event.notas_musicos || ''}
          onChange={(e) => onChange({ ...event, notas_musicos: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-300 focus:border-transparent"
          data-testid="event-notas-musicos"
          placeholder="Indicaciones sobre vestuario, puntualidad, material a traer..."
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => {
          const key = `info_adicional_url_${i}`;
          return (
            <InputField
              key={key}
              label={`Enlace información adicional ${i}`}
              value={event[key]}
              onChange={(v) => onChange({ ...event, [key]: v })}
              placeholder="https://..."
            />
          );
        })}
      </div>
      </Section>

      {/* Formulario de inscripción */}
      <Section titulo="Formulario de Inscripción" icono="📋" color="indigo" sectionKey="form_inscripcion">
      <InputField
        label="Enlace a Google Form"
        value={event.form_url}
        onChange={(v) => onChange({ ...event, form_url: v })}
        placeholder="https://docs.google.com/forms/..."
      />
      </Section>

      {/* Notas internas del equipo */}
      {event.id && !String(event.id).startsWith('temp-') && (
        <Section titulo="Notas internas del equipo" icono="🗒️" color="gray" sectionKey="notas_internas">
          <ComentariosPanel tipo="evento" entidadId={event.id} title="Notas internas del evento" />
        </Section>
      )}

      {/* Historial de verificaciones — solo super admins */}
      {event.id && !String(event.id).startsWith('temp-') && verifMeta.puede_editar && (
        <Section titulo="Historial de verificaciones" icono="📋" color="indigo" sectionKey="historial_verificaciones">
          <HistorialVerificaciones api={api} eventoId={event.id} />
        </Section>
      )}

      {/* Save Button + Eliminar evento (condicional) */}
      <div className="flex items-center justify-between pt-4 gap-3 flex-wrap">
        <div>
          {canDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
              data-testid="btn-eliminar-evento"
            >
              Eliminar evento
            </button>
          )}
        </div>
        <button
          onClick={() => {
            // Regla crítica de verificación:
            // El bloqueo SOLO aplica cuando el evento pasa de 'borrador' a 'abierto' (publicación).
            // Cambios en eventos ya publicados NO bloquean ni piden verificación.
            const estadoOriginal = (event._estadoOriginal !== undefined ? event._estadoOriginal : event.estado);
            const publicandoPorPrimeraVez = estadoOriginal === 'borrador' && event.estado === 'abierto';
            const pendientes = verifs.filter(v => v.estado === 'pendiente').map(v => v.seccion);
            if (publicandoPorPrimeraVez && pendientes.length > 0 && !verifMeta.puede_editar) {
              alert(`No se puede publicar el evento. Faltan secciones por verificar:\n\n• ${pendientes.join('\n• ')}\n\nContacta con un administrador o director general.`);
              return;
            }
            if (publicandoPorPrimeraVez && pendientes.length > 0 && verifMeta.puede_editar) {
              if (!window.confirm(`⚠️ Aún hay ${pendientes.length} secciones pendientes de verificación:\n\n• ${pendientes.join('\n• ')}\n\n¿Quieres publicar el evento de todas formas? (Solo administradores)`)) {
                return;
              }
            }
            onSave();
          }}
          className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium"
          data-testid="save-event-btn"
        >
          Guardar cambios
        </button>
      </div>

      {/* Modal confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="modal-eliminar-evento">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">¿Eliminar este evento?</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Esta acción eliminará el evento <strong>{event.nombre || ''}</strong> y TODOS sus datos asociados
                  (ensayos, asignaciones, materiales, presupuestos). Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium"
                data-testid="btn-cancelar-eliminar"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setShowDeleteModal(false);
                  if (onDelete) await onDelete(event.id);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium"
                data-testid="btn-confirmar-eliminar"
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Component
const ConfiguracionEventos = () => {
  const { api, user } = useGestorAuth();
  const [events, setEvents] = useState([]);
  const [temporadas, setTemporadas] = useState(['2024-2025', '2025-2026', '2026-2027']);
  const [selectedSeason, setSelectedSeason] = useState('2025-2026');
  const [openAccordions, setOpenAccordions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', text: string }

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  useEffect(() => {
    loadEvents(selectedSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason]);

  const loadEvents = async (temporada) => {
    try {
      setLoading(true);
      const url = temporada
        ? `/api/gestor/eventos?temporada=${encodeURIComponent(temporada)}`
        : '/api/gestor/eventos';
      console.log('[Eventos] GET', url);
      const response = await api.get(url);
      console.log('[Eventos] GET response:', response.data?.eventos?.length ?? 0, 'eventos');
      setEvents(response.data?.eventos || []);
    } catch (err) {
      console.error("[Eventos] Error loading events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccordion = (id) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateEvent = (id, data) => {
    setEvents(events.map(e => e.id === id ? { ...e, ...data } : e));
  };

  // Campos que acepta el backend (EventoUpdate / EventoCreate en routes_gestor.py).
  // Cualquier otro campo del form (rehearsals, program, instrumentation...) se
  // descarta: se gestiona en tablas independientes (ensayos, etc).
  const pickPayload = (event) => {
    const base = {
      nombre: event.nombre ?? null,
      temporada: event.temporada ?? null,
      descripcion: event.descripcion ?? null,
      fecha_inicio: event.fecha_inicio || null,
      hora_inicio: event.hora_inicio || null,
      fecha_inicio_preparacion: event.fecha_inicio_preparacion || null,
      fecha_fin: event.fecha_fin || null,
      estado: event.estado ?? null,
      tipo: event.tipo ?? null,
      lugar: event.lugar ?? null,
      notas: event.notas ?? null,
      notas_musicos: event.notas_musicos ?? null,
    };
    // Fechas secundarias (punto 2)
    for (let i = 1; i <= 4; i++) {
      base[`fecha_secundaria_${i}`] = event[`fecha_secundaria_${i}`] || null;
      base[`hora_secundaria_${i}`] = event[`hora_secundaria_${i}`] || null;
    }
    // Partituras (punto 3)
    ['cuerda','viento_madera','viento_metal','percusion','coro','teclados'].forEach(s => {
      const k = `partitura_${s}`;
      base[k] = event[k] ?? null;
    });
    // Info adicional (punto 4)
    for (let i = 1; i <= 3; i++) {
      const k = `info_adicional_url_${i}`;
      base[k] = event[k] ?? null;
    }
    return base;
  };

  // Persiste los ensayos: diff entre estado inicial vs actual → POST (nuevos)
  // + DELETE (borrados) + PUT (modificados).
  const persistEnsayos = async (eventoId, current, initial) => {
    const initialById = {};
    (initial || []).forEach(r => { if (r.id) initialById[r.id] = r; });
    const currentById = {};
    (current || []).forEach(r => { if (r.id) currentById[r.id] = r; });

    const toCreate = (current || []).filter(r => !r.id && r.date);
    const toDelete = (initial || []).filter(r => r.id && !currentById[r.id]);
    const toUpdate = (current || []).filter(r => {
      if (!r.id) return false;
      const prev = initialById[r.id];
      if (!prev) return false;
      return (
        prev.date !== r.date ||
        prev.start !== r.start ||
        (prev.end || '') !== (r.end || '') ||
        prev.tipo !== r.tipo ||
        prev.obligatorio !== r.obligatorio ||
        (prev.lugar || '') !== (r.lugar || '') ||
        (prev.notas || '') !== (r.notas || '')
      );
    });

    const results = { created: 0, updated: 0, deleted: 0 };
    for (const r of toCreate) {
      const resp = await api.post('/api/gestor/ensayos', {
        evento_id: eventoId,
        fecha: r.date,
        hora: r.start || '00:00',
        hora_fin: r.end || null,
        tipo: r.tipo || 'ensayo',
        obligatorio: r.obligatorio !== false,
        lugar: r.lugar || null,
        notas: r.notas || null,
      });
      results.created++;
      // Bloque 4: si el gestor configuró la convocatoria antes de guardar, persistirla
      const newId = resp?.data?.ensayo?.id || resp?.data?.id;
      if (newId && r.pending_convocatoria && (r.tipo || 'ensayo') === 'ensayo') {
        const payload = Object.entries(r.pending_convocatoria).map(([instrumento, convocado]) => ({
          instrumento,
          convocado: !!convocado,
        }));
        try {
          await api.put(`/api/gestor/ensayos/${newId}/instrumentos`, payload);
        } catch (e) {
          console.warn('[Eventos] No se pudo guardar convocatoria pendiente:', e?.response?.data || e?.message);
        }
      }
    }
    for (const r of toUpdate) {
      await api.put(`/api/gestor/ensayos/${r.id}`, {
        fecha: r.date,
        hora: r.start || '00:00',
        hora_fin: r.end || null,
        tipo: r.tipo || 'ensayo',
        obligatorio: r.obligatorio !== false,
        lugar: r.lugar || null,
        notas: r.notas || null,
      });
      results.updated++;
    }
    for (const r of toDelete) {
      await api.delete(`/api/gestor/ensayos/${r.id}`);
      results.deleted++;
    }
    return results;
  };

  const saveEvent = async (event) => {
    setSaving(true);
    try {
      const payload = pickPayload(event);
      // nombre es obligatorio en EventoCreate; validamos también en update
      if (!payload.nombre || !payload.nombre.trim()) {
        showFeedback('error', 'El nombre del evento es obligatorio');
        setSaving(false);
        return;
      }
      console.log('[Eventos] PUT /api/gestor/eventos/' + event.id, payload);
      const res = await api.put(`/api/gestor/eventos/${event.id}`, payload);
      console.log('[Eventos] PUT response:', res.data);

      // Persistir ensayos (diff)
      let ensayosRes = { created: 0, updated: 0, deleted: 0 };
      if (event.rehearsals) {
        ensayosRes = await persistEnsayos(event.id, event.rehearsals, event.rehearsalsInitial || []);
      }
      const ensayosMsg = (ensayosRes.created + ensayosRes.updated + ensayosRes.deleted) > 0
        ? ` · Ensayos: +${ensayosRes.created} / ±${ensayosRes.updated} / −${ensayosRes.deleted}`
        : '';
      showFeedback('success', `Evento guardado correctamente${ensayosMsg}`);
      await loadEvents(selectedSeason);
    } catch (err) {
      console.error("[Eventos] Error saving event:", err, err.response?.data);
      showFeedback('error', `Error al guardar: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const createNewEvent = async () => {
    if (!selectedSeason) {
      showFeedback('error', 'Selecciona una temporada antes de crear un evento');
      return;
    }

    try {
      const newEvent = {
        nombre: `Nuevo Evento ${events.length + 1}`,
        temporada: selectedSeason,
        descripcion: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
        tipo: 'concierto',
      };
      console.log('[Eventos] POST /api/gestor/eventos', newEvent);
      const response = await api.post('/api/gestor/eventos', newEvent);
      console.log('[Eventos] POST response:', response.data);
      await loadEvents(selectedSeason);
      const createdId = response.data?.evento?.id;
      if (createdId) setOpenAccordions(prev => ({ ...prev, [createdId]: true }));
      showFeedback('success', 'Evento creado correctamente');
    } catch (err) {
      console.error("[Eventos] Error creating event:", err, err.response?.data);
      showFeedback('error', `Error al crear evento: ${err.response?.data?.detail || err.message}`);
    }
  };

  const duplicateEvent = async (eventId) => {
    try {
      const originalEvent = events.find(e => e.id === eventId);
      if (!originalEvent) return;

      const duplicatedPayload = {
        ...pickPayload(originalEvent),
        nombre: `${originalEvent.nombre || 'Evento'} (Copia)`,
      };
      console.log('[Eventos] POST (duplicate)', duplicatedPayload);
      await api.post('/api/gestor/eventos', duplicatedPayload);
      await loadEvents(selectedSeason);
      showFeedback('success', 'Evento duplicado correctamente');
    } catch (err) {
      console.error("[Eventos] Error duplicating event:", err, err.response?.data);
      showFeedback('error', `Error al duplicar: ${err.response?.data?.detail || err.message}`);
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      console.log('[Eventos] DELETE /api/gestor/eventos/' + eventId);
      await api.delete(`/api/gestor/eventos/${eventId}`);
      setOpenAccordions(prev => {
        const next = { ...prev }; delete next[eventId]; return next;
      });
      await loadEvents(selectedSeason);
      showFeedback('success', 'Evento eliminado correctamente');
    } catch (err) {
      console.error("[Eventos] Error deleting event:", err, err.response?.data);
      showFeedback('error', `Error al eliminar: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Puede eliminar el evento si es admin o el gestor que lo creó.
  const canDeleteEvent = (event) => {
    if (!user) return false;
    if (user.rol === 'admin') return true;
    const myProfileId = user.profile?.id;
    return Boolean(myProfileId && event.gestor_id && myProfileId === event.gestor_id);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="configuracion-eventos-page">
      {feedback && (
        <div
          data-testid="eventos-feedback"
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border max-w-sm text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <strong>{feedback.type === 'success' ? '✅ ' : '❌ '}</strong>{feedback.text}
        </div>
      )}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Configuración de Eventos</h1>
          <p className="font-ibm text-slate-600 mt-1">Define los eventos de la temporada</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedSeason || ''}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-md text-sm"
            data-testid="season-selector"
          >
            {temporadas.map(temp => (
              <option key={temp} value={temp}>{temp}</option>
            ))}
          </select>
          <button
            onClick={createNewEvent}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium flex items-center gap-2"
            data-testid="create-event-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
            Nuevo evento
          </button>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No hay eventos configurados para esta temporada</p>
          <button
            onClick={createNewEvent}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm"
          >
            Crear primer evento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => (
            <div key={event.id} className="relative"
                 {...(openAccordions[event.id] ? {
                   'data-entidad-nombre': event.nombre || 'Sin nombre',
                   'data-entidad-tipo': 'evento',
                   'data-entidad-id': event.id || '',
                 } : {})}>
              <Accordion
                title={`Evento ${index + 1}`}
                subtitle={`${event.nombre || 'Sin nombre'} — ${event.temporada || 'Sin temporada'} — ${event.estado || 'abierto'}`}
                isOpen={openAccordions[event.id]}
                onToggle={() => toggleAccordion(event.id)}
              >
                <EventForm
                  event={event}
                  onChange={(data) => updateEvent(event.id, data)}
                  onSave={() => saveEvent(event)}
                  onDelete={deleteEvent}
                  canDelete={canDeleteEvent(event)}
                />
              </Accordion>
              {/* Duplicate Button */}
              <button
                onClick={() => duplicateEvent(event.id)}
                className="absolute top-3 right-12 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium flex items-center gap-1.5"
                title="Duplicar evento"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Duplicar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Historial de verificaciones por evento
// ============================================================
const ESTADO_BADGE = {
  verificado: { l: '✅ Verificado', c: 'bg-emerald-600 text-white' },
  autorizado_sin_verificar: { l: '⚡ Autorizado', c: 'bg-blue-600 text-white' },
  pendiente: { l: '🟡 Pendiente', c: 'bg-amber-400 text-amber-950' },
};
const HistorialVerificaciones = ({ api, eventoId }) => {
  const [rows, setRows] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      setCargando(true);
      try {
        const r = await api.get(`/api/gestor/eventos/${eventoId}/verificaciones-historial`);
        if (!cancel) setRows(r.data?.historial || []);
      } catch (e) {
        if (!cancel) setError(e.response?.data?.detail || e.message);
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => { cancel = true; };
  }, [api, eventoId]);
  if (cargando) return <div className="text-sm text-slate-500 py-4 text-center">Cargando historial…</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 text-sm">{error}</div>;
  if (!rows.length) return <div className="text-sm text-slate-500 py-4 text-center" data-testid="hist-verif-vacio">Aún no hay verificaciones registradas para este evento.</div>;
  return (
    <div className="overflow-x-auto" data-testid="hist-verif-tabla">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1A3A5C] text-white text-[11px] uppercase tracking-wide">
            <th className="text-left px-2.5 py-1.5">Sección</th>
            <th className="text-left px-2.5 py-1.5 w-32">Estado</th>
            <th className="text-left px-2.5 py-1.5 w-44">Verificado por</th>
            <th className="text-left px-2.5 py-1.5 w-32">Fecha y hora</th>
            <th className="text-left px-2.5 py-1.5">Notas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const e = ESTADO_BADGE[r.estado] || ESTADO_BADGE.pendiente;
            const f = r.verificado_at ? new Date(r.verificado_at) : null;
            return (
              <tr key={r.id || i} data-testid={`hist-verif-row-${i}`} className={i % 2 ? 'bg-slate-50/30' : ''}>
                <td className="px-2.5 py-1.5 font-medium text-slate-800">{r.seccion_label || r.seccion}</td>
                <td className="px-2.5 py-1.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${e.c}`}>{e.l}</span>
                </td>
                <td className="px-2.5 py-1.5 text-xs text-slate-700">{r.verificado_por_nombre || '—'}</td>
                <td className="px-2.5 py-1.5 text-xs text-slate-600">
                  {f ? <>{f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}<div className="text-slate-400">{f.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div></> : '—'}
                </td>
                <td className="px-2.5 py-1.5 text-xs text-slate-600 italic">{r.notas || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};


export default ConfiguracionEventos;
