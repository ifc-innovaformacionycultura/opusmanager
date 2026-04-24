// Plantillas Definitivas — Bloque D
//
// - Acordeón por evento (sólo con músicos confirmados)
// - Dentro de cada evento, músicos agrupados por sección instrumental:
//   Cuerda → Viento Madera → Viento Metal → Percusión → Teclados → Coro
// - Cada sección es colapsable y muestra contador + subtotales
// - Tabla con columnas fijas + 2 columnas por ensayo (disponibilidad y asistencia real)
//   + columnas económicas (caché previsto, caché real, extras, transporte, alojamiento, otros, TOTAL)
// - Subida de justificantes a Supabase Storage via backend
// - Totales por sección y por evento calculados en cliente en tiempo real
// - Botón "Guardar cambios" sticky arriba con batch update
//
// Endpoints:
//   GET  /api/gestor/plantillas-definitivas
//   PUT  /api/gestor/plantillas-definitivas/guardar
//   POST /api/gestor/plantillas-definitivas/justificante (multipart)
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth as useGestorAuth } from "../contexts/AuthContext";

const fmtFecha = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); }
  catch { return iso; }
};
const fmtHora = (h) => h ? String(h).slice(0, 5) : '';
const fmtEuro = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
};

// Celda display para disponibilidad / asistencia (bool|null)
const BoolDot = ({ v }) => {
  if (v === true)  return <span title="Sí" className="inline-block w-4 h-4 rounded-full bg-green-500" />;
  if (v === false) return <span title="No" className="inline-block w-4 h-4 rounded-full bg-red-500" />;
  return <span title="Sin datos" className="inline-block w-4 h-4 rounded-full bg-slate-200" />;
};

// Select Sí / No / — para asistencia real editable
// Input numérico 0..100 para asistencia real (%). NULL = vacío.
const PctInput = ({ value, onChange, dataTestId }) => (
  <input
    type="number"
    min="0"
    max="100"
    step="1"
    value={value === null || value === undefined || value === '' ? '' : value}
    onChange={(e) => {
      const raw = e.target.value;
      if (raw === '') return onChange(null);
      let n = parseFloat(raw);
      if (Number.isNaN(n)) n = 0;
      if (n < 0) n = 0;
      if (n > 100) n = 100;
      onChange(n);
    }}
    placeholder="—"
    data-testid={dataTestId}
    className="text-[11px] px-1 py-0.5 border border-slate-300 rounded bg-white w-14 text-right"
    title="% asistencia real (0–100)"
  />
);

// ==========================================================================
// Tabla de una sección de un evento
// ==========================================================================
const SeccionTable = ({ evento, seccion, state, onChange, onUploadJust }) => {
  const ensayos = evento.ensayos || [];
  return (
    <div className="overflow-x-auto border-t border-slate-200" data-testid={`seccion-${evento.id}-${seccion.key}`}>
      <table className="w-full text-xs border-collapse">
        <thead className="bg-slate-50">
          {/* Fila 1 de cabecera: grupos */}
          <tr>
            <th rowSpan={2} className="px-2 py-1.5 text-left font-semibold text-slate-700 border-b border-slate-200 min-w-[180px]">Músico</th>
            <th rowSpan={2} className="px-2 py-1.5 text-left font-normal text-slate-600 border-b border-slate-200 min-w-[100px]">Instrumento</th>
            <th rowSpan={2} className="px-2 py-1.5 text-left font-normal text-slate-600 border-b border-slate-200 min-w-[90px]">Especialidad</th>
            <th rowSpan={2} className="px-2 py-1.5 text-center font-normal text-slate-600 border-b border-slate-200 min-w-[40px]" title="Nº atril">Nº</th>
            <th rowSpan={2} className="px-2 py-1.5 text-center font-normal text-slate-600 border-b border-slate-200 min-w-[40px]" title="Letra">Let.</th>
            <th rowSpan={2} className="px-2 py-1.5 text-left font-normal text-slate-600 border-b border-r-2 border-slate-400 min-w-[120px]">Comentario</th>
            {ensayos.length > 0 && (
              <th colSpan={ensayos.length * 2 + 2} className="px-2 py-1.5 text-center font-semibold text-slate-700 border-b border-r-2 border-slate-400 bg-slate-100">
                Disponibilidad y asistencia
              </th>
            )}
            <th colSpan={9} className="px-2 py-1.5 text-center font-semibold text-amber-900 border-b border-slate-200 bg-amber-50">
              Económico (€)
            </th>
          </tr>
          <tr>
            {ensayos.map(e => (
              <React.Fragment key={e.id}>
                <th className="px-1 py-1 text-center text-[10px] text-slate-600 border-b border-slate-200 min-w-[48px]" title={`Disp. ${e.tipo}`}>
                  <div className="font-semibold capitalize">{e.tipo || 'Ensayo'}</div>
                  <div className="text-slate-500">{fmtFecha(e.fecha)}</div>
                  <div className="text-[9px] text-slate-400 normal-case font-normal">Disp.</div>
                </th>
                <th className="px-1 py-1 text-center text-[10px] text-slate-600 border-b border-slate-200 min-w-[56px]" title={`Asistencia ${e.tipo}`}>
                  <div className="font-semibold capitalize">{e.tipo || 'Ensayo'}</div>
                  <div className="text-slate-500">{fmtFecha(e.fecha)}</div>
                  <div className="text-[9px] text-slate-400 normal-case font-normal">Asist.</div>
                </th>
              </React.Fragment>
            ))}
            {ensayos.length > 0 && (
              <>
                <th className="px-1 py-1 text-center text-[10px] text-slate-600 border-b border-slate-200">% Prev.</th>
                <th className="px-1 py-1 text-center text-[10px] text-slate-600 border-b border-r-2 border-slate-400">% Real</th>
              </>
            )}
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[72px]">Caché Prev.</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[72px]">Caché Real</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[70px]">Extra</th>
            <th className="px-1 py-1 text-left  text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[110px]">Motivo</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[80px]">Transporte</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[80px]">Alojam.</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[80px]">Otros</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-100 min-w-[90px]">TOTAL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {seccion.musicos.map(m => {
            const key = m.usuario_id + '_' + evento.id;
            const st = state[key] || {};
            const asistenciasEditadas = st.asistencias || {};
            const pctReal = (() => {
              if (!ensayos.length) return 0;
              const vals = [];
              for (const e of ensayos) {
                const v = asistenciasEditadas[e.id];
                const fallback = (m.asistencia.find(x => x.ensayo_id === e.id) || {}).asistencia_real;
                const efectivo = v !== undefined ? v : fallback;
                if (efectivo !== null && efectivo !== undefined && efectivo !== '') {
                  const n = typeof efectivo === 'number' ? efectivo : parseFloat(efectivo);
                  if (!Number.isNaN(n)) vals.push(n);
                }
              }
              if (vals.length === 0) return 0;
              return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
            })();
            const cachePrev = m.cache_previsto;
            const cacheReal = +(cachePrev * (pctReal / 100)).toFixed(2);
            const extra = st.cache_extra !== undefined ? +st.cache_extra || 0 : +m.cache_extra || 0;
            const transp = st.transporte_importe !== undefined ? +st.transporte_importe || 0 : +m.transporte_importe || 0;
            const aloj = st.alojamiento_importe !== undefined ? +st.alojamiento_importe || 0 : +m.alojamiento_importe || 0;
            const otros = st.otros_importe !== undefined ? +st.otros_importe || 0 : +m.otros_importe || 0;
            const total = +(cacheReal + extra + transp + aloj + otros).toFixed(2);

            const transpUrl = st.transporte_justificante_url ?? m.transporte_justificante_url;
            const alojUrl   = st.alojamiento_justificante_url ?? m.alojamiento_justificante_url;
            const otrosUrl  = st.otros_justificante_url ?? m.otros_justificante_url;

            const motivo = st.motivo_extra !== undefined ? st.motivo_extra : m.motivo_extra;
            const nAtril = st.numero_atril !== undefined ? st.numero_atril : m.numero_atril;
            const letra = st.letra !== undefined ? st.letra : m.letra;
            const comentario = st.comentario !== undefined ? st.comentario : m.comentario;

            return (
              <tr key={m.asignacion_id} className="hover:bg-slate-50" data-testid={`row-plantilla-${m.usuario_id}-${evento.id}`}>
                <td className="px-2 py-1 font-medium text-slate-900 whitespace-nowrap">
                  {m.apellidos}, {m.nombre}
                </td>
                <td className="px-2 py-1 text-slate-700">{m.instrumento || '—'}</td>
                <td className="px-2 py-1 text-slate-700">{m.especialidad || '—'}</td>
                <td className="px-1 py-1">
                  <input
                    type="number" min="0"
                    value={nAtril ?? ''}
                    onChange={(e) => onChange(m, evento.id, { numero_atril: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                    data-testid={`numero-atril-${m.usuario_id}-${evento.id}`}
                    className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text" maxLength={2}
                    value={letra ?? ''}
                    onChange={(e) => onChange(m, evento.id, { letra: e.target.value.toUpperCase() || null })}
                    data-testid={`letra-${m.usuario_id}-${evento.id}`}
                    className="w-10 px-1 py-0.5 border border-slate-300 rounded text-xs uppercase"
                  />
                </td>
                <td className="px-1 py-1 border-r-2 border-slate-300">
                  <input
                    type="text"
                    value={comentario ?? ''}
                    onChange={(e) => onChange(m, evento.id, { comentario: e.target.value })}
                    data-testid={`comentario-${m.usuario_id}-${evento.id}`}
                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-xs"
                  />
                </td>
                {ensayos.map(e => {
                  const disp = m.disponibilidad.find(x => x.ensayo_id === e.id) || {};
                  const asistFallback = (m.asistencia.find(x => x.ensayo_id === e.id) || {}).asistencia_real;
                  const asistActual = asistenciasEditadas[e.id] !== undefined ? asistenciasEditadas[e.id] : asistFallback;
                  return (
                    <React.Fragment key={e.id}>
                      <td className="px-1 py-1 text-center"><BoolDot v={disp.asiste} /></td>
                      <td className="px-1 py-1 text-center">
                        <PctInput
                          value={asistActual}
                          onChange={(v) => onChange(m, evento.id, { asistenciaEnsayoId: e.id, asistenciaValor: v })}
                          dataTestId={`asist-${m.usuario_id}-${e.id}`}
                        />
                      </td>
                    </React.Fragment>
                  );
                })}
                {ensayos.length > 0 && (
                  <>
                    <td className="px-1 py-1 text-center text-slate-600 font-medium">{m.porcentaje_disponibilidad}%</td>
                    <td className="px-1 py-1 text-center text-slate-900 font-semibold border-r-2 border-slate-300" data-testid={`pct-real-${m.usuario_id}-${evento.id}`}>{pctReal}%</td>
                  </>
                )}
                <td className="px-1 py-1 text-right text-amber-900 bg-amber-50/40">{fmtEuro(cachePrev)}</td>
                <td className="px-1 py-1 text-right text-amber-900 bg-amber-50/40 font-medium" data-testid={`cache-real-${m.usuario_id}-${evento.id}`}>{fmtEuro(cacheReal)}</td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <input
                    type="number" step="0.01" min="0"
                    value={extra || ''}
                    onChange={(e) => onChange(m, evento.id, { cache_extra: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    data-testid={`extra-${m.usuario_id}-${evento.id}`}
                    className="w-16 px-1 py-0.5 border border-slate-300 rounded text-xs text-right"
                  />
                </td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <input
                    type="text"
                    value={motivo || ''}
                    onChange={(e) => onChange(m, evento.id, { motivo_extra: e.target.value })}
                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-xs"
                  />
                </td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.01" min="0"
                      value={transp || ''}
                      onChange={(e) => onChange(m, evento.id, { transporte_importe: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      className="w-14 px-1 py-0.5 border border-slate-300 rounded text-xs text-right"
                    />
                    <FileButton
                      url={transpUrl}
                      onFile={(f) => onUploadJust(m.usuario_id, evento.id, 'transporte', f)}
                      testId={`file-transp-${m.usuario_id}-${evento.id}`}
                    />
                  </div>
                </td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.01" min="0"
                      value={aloj || ''}
                      onChange={(e) => onChange(m, evento.id, { alojamiento_importe: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      className="w-14 px-1 py-0.5 border border-slate-300 rounded text-xs text-right"
                    />
                    <FileButton
                      url={alojUrl}
                      onFile={(f) => onUploadJust(m.usuario_id, evento.id, 'alojamiento', f)}
                      testId={`file-aloj-${m.usuario_id}-${evento.id}`}
                    />
                  </div>
                </td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.01" min="0"
                      value={otros || ''}
                      onChange={(e) => onChange(m, evento.id, { otros_importe: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      className="w-14 px-1 py-0.5 border border-slate-300 rounded text-xs text-right"
                    />
                    <FileButton
                      url={otrosUrl}
                      onFile={(f) => onUploadJust(m.usuario_id, evento.id, 'otros', f)}
                      testId={`file-otros-${m.usuario_id}-${evento.id}`}
                    />
                  </div>
                </td>
                <td className="px-1 py-1 text-right bg-amber-100 font-bold text-amber-900" data-testid={`total-${m.usuario_id}-${evento.id}`}>{fmtEuro(total)}</td>
              </tr>
            );
          })}
          {/* Fila de totales por sección (calculada client-side para incluir edits pendientes) */}
        </tbody>
      </table>
    </div>
  );
};

// ==========================================================================
// Botón de subida + enlace "Ver"
// ==========================================================================
const FileButton = ({ url, onFile, testId }) => {
  const inputRef = useRef();
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        data-testid={testId}
        className="px-1 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[10px] whitespace-nowrap"
        title={url ? 'Reemplazar justificante' : 'Subir justificante'}
      >
        📎
      </button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-blue-600 hover:text-blue-800 underline">
          Ver
        </a>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
};

// ==========================================================================
// Componente principal
// ==========================================================================
const PlantillasDefinitivas = () => {
  const { api } = useGestorAuth();
  const [data, setData] = useState({ eventos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Estado de edición (diffs pendientes de guardar)
  // state[usuario_id + '_' + evento_id] = { numero_atril?, letra?, comentario?,
  //   asistencias: {ensayo_id: bool|null}, cache_extra?, motivo_extra?,
  //   transporte_importe?, transporte_justificante_url?, alojamiento_importe?, ... }
  const [state, setState] = useState({});
  const [openEvents, setOpenEvents] = useState({}); // {evento_id: bool}
  const [openSections, setOpenSections] = useState({}); // {evento_id_seckey: bool}
  const [saving, setSaving] = useState(false);

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  const cargar = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const r = await api.get('/api/gestor/plantillas-definitivas');
      setData(r.data || { eventos: [] });
      // Al cargar, abrimos todos los eventos y secciones por defecto
      const e0 = {}; const s0 = {};
      (r.data?.eventos || []).forEach(ev => {
        e0[ev.id] = true;
        (ev.secciones || []).forEach(sec => { s0[ev.id + '_' + sec.key] = true; });
      });
      setOpenEvents(e0);
      setOpenSections(s0);
      setState({});
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { cargar(); }, [cargar]);

  const onChange = (m, eventoId, patch) => {
    const key = m.usuario_id + '_' + eventoId;
    setState(prev => {
      const prevEntry = prev[key] || {};
      let nextEntry = { ...prevEntry };
      if (patch.asistenciaEnsayoId !== undefined) {
        nextEntry.asistencias = {
          ...(prevEntry.asistencias || {}),
          [patch.asistenciaEnsayoId]: patch.asistenciaValor,
        };
      } else {
        nextEntry = { ...nextEntry, ...patch };
      }
      return { ...prev, [key]: nextEntry };
    });
  };

  const onUploadJust = async (usuarioId, eventoId, tipo, file) => {
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const url = `/api/gestor/plantillas-definitivas/justificante?usuario_id=${usuarioId}&evento_id=${eventoId}&tipo=${tipo}`;
      const r = await api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const key = usuarioId + '_' + eventoId;
      setState(prev => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          [`${tipo}_justificante_url`]: r.data?.url,
        }
      }));
      showFeedback('success', `Justificante (${tipo}) subido`);
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    }
  };

  // Totales por sección/evento con edits aplicados
  const calcularTotalesSeccion = (evento, seccion) => {
    const t = { cache_previsto: 0, cache_real: 0, extras: 0, transporte: 0, alojamiento: 0, otros: 0, total: 0 };
    const ensayos = evento.ensayos || [];
    seccion.musicos.forEach(m => {
      const key = m.usuario_id + '_' + evento.id;
      const st = state[key] || {};
      const asistenciasEditadas = st.asistencias || {};
      const vals = [];
      for (const e of ensayos) {
        const v = asistenciasEditadas[e.id];
        const fallback = (m.asistencia.find(x => x.ensayo_id === e.id) || {}).asistencia_real;
        const efectivo = v !== undefined ? v : fallback;
        if (efectivo !== null && efectivo !== undefined && efectivo !== '') {
          const n = typeof efectivo === 'number' ? efectivo : parseFloat(efectivo);
          if (!Number.isNaN(n)) vals.push(n);
        }
      }
      const pctReal = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
      const cachePrev = +m.cache_previsto || 0;
      const cacheReal = +(cachePrev * (pctReal / 100)).toFixed(2);
      const extra = st.cache_extra !== undefined ? +st.cache_extra || 0 : +m.cache_extra || 0;
      const transp = st.transporte_importe !== undefined ? +st.transporte_importe || 0 : +m.transporte_importe || 0;
      const aloj = st.alojamiento_importe !== undefined ? +st.alojamiento_importe || 0 : +m.alojamiento_importe || 0;
      const otros = st.otros_importe !== undefined ? +st.otros_importe || 0 : +m.otros_importe || 0;
      const total = +(cacheReal + extra + transp + aloj + otros).toFixed(2);
      t.cache_previsto += cachePrev; t.cache_real += cacheReal; t.extras += extra;
      t.transporte += transp; t.alojamiento += aloj; t.otros += otros; t.total += total;
    });
    return t;
  };

  const totalesEvento = useMemo(() => {
    const out = {};
    data.eventos.forEach(ev => {
      const tot = { cache_previsto: 0, cache_real: 0, extras: 0, transporte: 0, alojamiento: 0, otros: 0, total: 0, musicos: 0 };
      ev.secciones.forEach(sec => {
        tot.musicos += sec.musicos.length;
        const st = calcularTotalesSeccion(ev, sec);
        for (const k of Object.keys(st)) tot[k] = (tot[k] || 0) + st[k];
      });
      out[ev.id] = tot;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.eventos, state]);

  const dirty = Object.keys(state).length > 0;

  const guardar = async () => {
    try {
      setSaving(true);
      const asistencias = [];
      const gastos = [];
      const anotaciones = [];
      Object.entries(state).forEach(([key, st]) => {
        const [usuario_id, evento_id] = key.split('_');
        // asistencias
        Object.entries(st.asistencias || {}).forEach(([ensayo_id, asistencia_real]) => {
          asistencias.push({ usuario_id, ensayo_id, asistencia_real });
        });
        // gastos (siempre que haya alguna columna tocada)
        const gastoKeys = ['transporte_importe', 'transporte_justificante_url',
                           'alojamiento_importe', 'alojamiento_justificante_url',
                           'otros_importe', 'otros_justificante_url',
                           'cache_extra', 'motivo_extra'];
        const hasG = gastoKeys.some(k => st[k] !== undefined);
        if (hasG) {
          gastos.push({
            usuario_id, evento_id,
            ...(st.transporte_importe !== undefined && { transporte_importe: +st.transporte_importe || 0 }),
            ...(st.transporte_justificante_url !== undefined && { transporte_justificante_url: st.transporte_justificante_url }),
            ...(st.alojamiento_importe !== undefined && { alojamiento_importe: +st.alojamiento_importe || 0 }),
            ...(st.alojamiento_justificante_url !== undefined && { alojamiento_justificante_url: st.alojamiento_justificante_url }),
            ...(st.otros_importe !== undefined && { otros_importe: +st.otros_importe || 0 }),
            ...(st.otros_justificante_url !== undefined && { otros_justificante_url: st.otros_justificante_url }),
            ...(st.cache_extra !== undefined && { cache_extra: +st.cache_extra || 0 }),
            ...(st.motivo_extra !== undefined && { notas: st.motivo_extra }),
          });
        }
        // anotaciones (num atril, letra, comentario): necesitamos asignacion_id
        const asigIdMap = {};
        data.eventos.forEach(ev => ev.secciones.forEach(sec => sec.musicos.forEach(m => {
          asigIdMap[m.usuario_id + '_' + ev.id] = m.asignacion_id;
        })));
        const asigId = asigIdMap[key];
        if (asigId && (st.numero_atril !== undefined || st.letra !== undefined || st.comentario !== undefined)) {
          anotaciones.push({
            asignacion_id: asigId,
            numero_atril: st.numero_atril ?? null,
            letra: st.letra ?? null,
            comentario: st.comentario ?? null,
          });
        }
      });

      const r = await api.put('/api/gestor/plantillas-definitivas/guardar', { asistencias, gastos, anotaciones });
      showFeedback('success', `Guardado: ${r.data.resumen.asistencias} asistencias, ${r.data.resumen.gastos} gastos, ${r.data.resumen.anotaciones} anotaciones`);
      await cargar();
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-6" data-testid="plantillas-page"><p className="text-slate-500">Cargando...</p></div>;

  return (
    <div className="p-6 pb-20" data-testid="plantillas-page">
      {/* Barra sticky superior con Guardar */}
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-cabinet text-2xl font-bold text-slate-900">Plantillas definitivas</h1>
          <p className="text-xs text-slate-600">Confirmados por evento, con asistencia real, cachés y gastos adicionales.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-700 font-medium">● Cambios sin guardar</span>}
          <button
            onClick={guardar}
            disabled={saving || !dirty}
            data-testid="btn-guardar-plantillas"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          data-testid="plantillas-feedback"
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border max-w-sm text-sm ${
            feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-800'
                                         : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <strong>{feedback.type === 'success' ? '✅ ' : '❌ '}</strong>{feedback.text}
        </div>
      )}

      {error && <div className="p-3 mb-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded">{error}</div>}

      {data.eventos.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200 rounded-lg text-center text-slate-500" data-testid="plantillas-empty">
          No hay eventos con músicos confirmados todavía. Confirma músicos desde <strong>Seguimiento de plantillas</strong>.
        </div>
      ) : (
        <div className="space-y-4">
          {data.eventos.map(ev => {
            const totEv = totalesEvento[ev.id] || { musicos: 0 };
            const open = !!openEvents[ev.id];
            return (
              <div key={ev.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid={`evento-acordeon-${ev.id}`}>
                {/* Cabecera del acordeón de evento */}
                <button
                  onClick={() => setOpenEvents(p => ({ ...p, [ev.id]: !p[ev.id] }))}
                  className="w-full px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between gap-3 hover:from-slate-800 hover:to-slate-700"
                  data-testid={`toggle-evento-${ev.id}`}
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold">{ev.nombre}</h2>
                      {ev.fechas.map((f, idx) => (
                        <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-100">
                          {fmtFecha(f.fecha)}{f.hora ? ` ${fmtHora(f.hora)}` : ''}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-slate-300 mt-1 flex items-center gap-4 flex-wrap">
                      <span>👥 {totEv.musicos} confirmados</span>
                      <span>💶 Previsto: <strong className="text-white">{fmtEuro(totEv.cache_previsto)}</strong></span>
                      <span>💶 Real: <strong className="text-white">{fmtEuro(totEv.cache_real)}</strong></span>
                      <span>➕ Extras: <strong className="text-white">{fmtEuro(totEv.extras + totEv.transporte + totEv.alojamiento + totEv.otros)}</strong></span>
                      <span>💰 TOTAL: <strong className="text-amber-300">{fmtEuro(totEv.total)}</strong></span>
                    </div>
                  </div>
                  <svg className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>

                {open && ev.secciones.map(sec => {
                  const secKey = ev.id + '_' + sec.key;
                  const secOpen = !!openSections[secKey];
                  const secTot = calcularTotalesSeccion(ev, sec);
                  return (
                    <div key={secKey} className="border-t border-slate-200" data-testid={`evento-seccion-${ev.id}-${sec.key}`}>
                      <button
                        onClick={() => setOpenSections(p => ({ ...p, [secKey]: !p[secKey] }))}
                        className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 flex items-center justify-between gap-3"
                        data-testid={`toggle-seccion-${ev.id}-${sec.key}`}
                      >
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <svg className={`w-4 h-4 transition-transform ${secOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                          {sec.label}
                          <span className="text-xs font-normal text-slate-600">({sec.count} músicos)</span>
                        </div>
                        <div className="text-xs text-slate-700 flex items-center gap-3 flex-wrap">
                          <span>Prev: <strong>{fmtEuro(secTot.cache_previsto)}</strong></span>
                          <span>Real: <strong>{fmtEuro(secTot.cache_real)}</strong></span>
                          <span>TOTAL: <strong className="text-amber-800">{fmtEuro(secTot.total)}</strong></span>
                        </div>
                      </button>
                      {secOpen && (
                        <>
                          <SeccionTable
                            evento={ev}
                            seccion={sec}
                            state={state}
                            onChange={onChange}
                            onUploadJust={onUploadJust}
                          />
                          {/* Fila de totales por sección */}
                          <div className="bg-slate-100 border-t border-slate-300 px-4 py-2 flex items-center justify-end gap-6 flex-wrap text-xs">
                            <span className="font-semibold text-slate-700 mr-auto">Total {sec.label} ({sec.count})</span>
                            <span>Prev: <strong>{fmtEuro(secTot.cache_previsto)}</strong></span>
                            <span>Real: <strong>{fmtEuro(secTot.cache_real)}</strong></span>
                            <span>Extras: <strong>{fmtEuro(secTot.extras)}</strong></span>
                            <span>Transp: <strong>{fmtEuro(secTot.transporte)}</strong></span>
                            <span>Aloj: <strong>{fmtEuro(secTot.alojamiento)}</strong></span>
                            <span>Otros: <strong>{fmtEuro(secTot.otros)}</strong></span>
                            <span>TOTAL: <strong className="text-amber-800">{fmtEuro(secTot.total)}</strong></span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Totales del evento (fila en azul oscuro) */}
                {open && (
                  <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-end gap-6 flex-wrap text-xs" data-testid={`totales-evento-${ev.id}`}>
                    <span className="font-semibold mr-auto">📊 TOTAL EVENTO ({totEv.musicos} confirmados)</span>
                    <span>Prev: <strong>{fmtEuro(totEv.cache_previsto)}</strong></span>
                    <span>Real: <strong>{fmtEuro(totEv.cache_real)}</strong></span>
                    <span>Extras: <strong>{fmtEuro(totEv.extras)}</strong></span>
                    <span>Transp: <strong>{fmtEuro(totEv.transporte)}</strong></span>
                    <span>Aloj: <strong>{fmtEuro(totEv.alojamiento)}</strong></span>
                    <span>Otros: <strong>{fmtEuro(totEv.otros)}</strong></span>
                    <span className="text-amber-300 text-sm">TOTAL: <strong>{fmtEuro(totEv.total)}</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlantillasDefinitivas;
