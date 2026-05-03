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

// Iter E1 — Helpers de fecha y permisos.
const eventoYaPasado = (ev) => {
  // Toma fecha_inicio del evento, devuelve true si esa fecha < hoy (00:00).
  const raw = ev?.fecha_inicio;
  if (!raw) return false;
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return d < hoy;
  } catch {
    return false;
  }
};
const isSuperAdminUser = (user) => {
  if (!user) return false;
  const rol = user.rol || user.profile?.rol;
  if (rol === 'admin' || rol === 'director_general') return true;
  const email = (user.email || user.profile?.email || '').toLowerCase();
  return email === 'admin@convocatorias.com';
};
const fmtFechaCierre = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

// Badge para ensayos a los que el instrumento del músico NO está convocado
const NoConvBadge = () => (
  <span
    title="El instrumento de este músico no está convocado a este ensayo"
    className="inline-block px-1.5 py-0.5 text-[9px] rounded bg-slate-300 text-slate-600 font-medium">
    No conv.
  </span>
);

// Select Sí / No / — para asistencia real editable
// Input numérico 0..100 para asistencia real (%). NULL = vacío.
const PctInput = ({ value, onChange, dataTestId, disabled }) => (
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
    disabled={disabled}
    className="text-[11px] px-1 py-0.5 border border-slate-300 rounded bg-white w-14 text-right disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
    title="% asistencia real (0–100)"
  />
);

// ==========================================================================
// Tabla de una sección de un evento
// ==========================================================================
const SeccionTable = ({ evento, seccion, state, onChange, onUploadJust, fichajesByUser, mostrarQR, cerrado, isSuperAdmin, onValidarImporte }) => {
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
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[80px]" title="Caché previsto calculado desde cachets_config (instrumento + nivel)">Caché Previsto</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[72px]">Caché Real</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[70px]">Extra</th>
            <th className="px-1 py-1 text-left  text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[110px]">Motivo</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[80px]">Transporte</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[80px]">Alojam.</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[80px]">Otros</th>
            <th className="px-1 py-1 text-right text-[10px] text-amber-900 border-b border-slate-200 bg-amber-50 min-w-[80px]" title="Descuento por servicio de comedor confirmado por el músico desde su portal">🍽️ Comedor</th>
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
            const comida = +m.comida_importe || 0;
            const total = +(cacheReal + extra + transp + aloj + otros - comida).toFixed(2);

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
                    disabled={cerrado}
                    className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text" maxLength={2}
                    value={letra ?? ''}
                    onChange={(e) => onChange(m, evento.id, { letra: e.target.value.toUpperCase() || null })}
                    data-testid={`letra-${m.usuario_id}-${evento.id}`}
                    disabled={cerrado}
                    className="w-10 px-1 py-0.5 border border-slate-300 rounded text-xs uppercase disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-1 py-1 border-r-2 border-slate-300">
                  <input
                    type="text"
                    value={comentario ?? ''}
                    onChange={(e) => onChange(m, evento.id, { comentario: e.target.value })}
                    data-testid={`comentario-${m.usuario_id}-${evento.id}`}
                    disabled={cerrado}
                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </td>
                {ensayos.map(e => {
                  const disp = m.disponibilidad.find(x => x.ensayo_id === e.id) || {};
                  const asist = m.asistencia.find(x => x.ensayo_id === e.id) || {};
                  const convocado = disp.convocado !== false; // default true si no viene
                  const asistFallback = asist.asistencia_real;
                  const asistActual = asistenciasEditadas[e.id] !== undefined ? asistenciasEditadas[e.id] : asistFallback;
                  if (!convocado) {
                    return (
                      <React.Fragment key={e.id}>
                        <td className="px-1 py-1 text-center bg-slate-100/60"><NoConvBadge /></td>
                        <td className="px-1 py-1 text-center bg-slate-100/60 text-slate-400 text-[10px]">—</td>
                      </React.Fragment>
                    );
                  }
                  return (
                    <React.Fragment key={e.id}>
                      <td className="px-1 py-1 text-center"><BoolDot v={disp.asiste} /></td>
                      <td className="px-1 py-1 text-center">
                        <PctInput
                          value={asistActual}
                          onChange={(v) => onChange(m, evento.id, { asistenciaEnsayoId: e.id, asistenciaValor: v })}
                          dataTestId={`asist-${m.usuario_id}-${e.id}`}
                          disabled={cerrado}
                        />
                        {mostrarQR && (() => {
                          const f = (fichajesByUser || {})[m.usuario_id]?.[e.id];
                          if (!f) return <div className="text-[9px] text-slate-300 mt-0.5" data-testid={`qr-empty-${m.usuario_id}-${e.id}`}>❌ sin fichaje</div>;
                          const pctQR = f.porcentaje_asistencia;
                          const manual = typeof asistActual === 'number' ? asistActual : parseFloat(asistActual) || 0;
                          let color = 'text-slate-500';
                          if (pctQR != null && manual > 0) {
                            const ratio = pctQR / manual;
                            if (pctQR >= manual) color = 'text-emerald-600';
                            else if (ratio >= 0.8) color = 'text-amber-600';
                            else color = 'text-rose-600';
                          }
                          const dur = f.minutos_totales != null ? `${Math.floor(f.minutos_totales/60)}:${String(f.minutos_totales%60).padStart(2,'0')}` : '—';
                          const ent = f.hora_entrada_computada ? new Date(f.hora_entrada_computada).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '—';
                          const sal = f.hora_salida_computada ? new Date(f.hora_salida_computada).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '—';
                          return (
                            <div className="text-[9px] mt-0.5 leading-tight" data-testid={`qr-data-${m.usuario_id}-${e.id}`}>
                              <div className={`font-bold ${color}`}>📊 {pctQR != null ? `${pctQR}%` : '—'}</div>
                              <div className="text-slate-500">⏱ {ent}–{sal} ({dur})</div>
                              {f.alerta_retraso && <div className="text-amber-600">🕐 Tarde</div>}
                              {f.alerta_salida_pendiente && <div className="text-rose-600">⚠️ Salida pendiente</div>}
                            </div>
                          );
                        })()}
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
                <td className={`px-1 py-1 text-right ${m.cache_fuente && (m.cache_fuente.startsWith('base') || m.cache_fuente === 'asignacion') ? 'text-orange-600 font-semibold' : 'text-amber-900'} bg-amber-50/40`} title={`Fuente: ${m.cache_fuente || '—'}`} data-testid={`cache-prev-${m.usuario_id}-${evento.id}`}>{fmtEuro(cachePrev)}</td>
                <td className="px-1 py-1 text-right text-amber-900 bg-amber-50/40 font-medium" data-testid={`cache-real-${m.usuario_id}-${evento.id}`}>{fmtEuro(cacheReal)}</td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.01" min="0"
                      value={extra || ''}
                      onChange={(e) => onChange(m, evento.id, { cache_extra: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      data-testid={`extra-${m.usuario_id}-${evento.id}`}
                      disabled={cerrado}
                      className={`w-16 px-1 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
                        m.cache_extra_provisional ? 'border-orange-400 bg-orange-50 text-orange-900'
                        : (extra > 0 ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-300')
                      }`}
                      title={m.cache_extra_provisional
                        ? '⏳ Pendiente de validación'
                        : (m.cache_extra_validado_at ? `✓ Validado por ${m.cache_extra_validado_por_nombre || '—'} · ${fmtFechaCierre(m.cache_extra_validado_at)}` : '')}
                    />
                    {m.cache_extra_provisional && isSuperAdmin && !cerrado && m.gasto_id && (
                      <button
                        type="button"
                        onClick={() => onValidarImporte(m.gasto_id, 'cache_extra')}
                        data-testid={`btn-validar-extra-${m.usuario_id}-${evento.id}`}
                        className="px-1 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold whitespace-nowrap"
                        title="Validar importe"
                      >✓</button>
                    )}
                    {!m.cache_extra_provisional && extra > 0 && (
                      <span className="text-emerald-600 text-xs leading-none" title="Importe validado" aria-hidden>✓</span>
                    )}
                  </div>
                  {m.cache_extra_provisional && (
                    <div data-testid={`badge-extra-prov-${m.usuario_id}-${evento.id}`} className="text-[9px] text-orange-700 font-semibold mt-0.5">
                      ⏳ Pendiente validación
                    </div>
                  )}
                </td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <input
                    type="text"
                    value={motivo || ''}
                    onChange={(e) => onChange(m, evento.id, { motivo_extra: e.target.value })}
                    disabled={cerrado}
                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.01" min="0"
                      value={transp || ''}
                      onChange={(e) => onChange(m, evento.id, { transporte_importe: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      disabled={cerrado}
                      className={`w-14 px-1 py-0.5 border rounded text-xs text-right disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
                        m.transporte_provisional ? 'border-orange-400 bg-orange-50 text-orange-900'
                        : (transp > 0 ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-300')
                      }`}
                      title={m.transporte_provisional
                        ? '⏳ Pendiente de validación'
                        : (m.transporte_validado_at ? `✓ Validado por ${m.transporte_validado_por_nombre || '—'} · ${fmtFechaCierre(m.transporte_validado_at)}` : '')}
                    />
                    {m.transporte_provisional && isSuperAdmin && !cerrado && m.gasto_id && (
                      <button
                        type="button"
                        onClick={() => onValidarImporte(m.gasto_id, 'transporte')}
                        data-testid={`btn-validar-transp-${m.usuario_id}-${evento.id}`}
                        className="px-1 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold whitespace-nowrap"
                        title="Validar importe"
                      >✓</button>
                    )}
                    {!m.transporte_provisional && transp > 0 && (
                      <span className="text-emerald-600 text-xs leading-none" title="Importe validado" aria-hidden>✓</span>
                    )}
                    <FileButton
                      url={transpUrl}
                      onFile={(f) => onUploadJust(m.usuario_id, evento.id, 'transporte', f)}
                      testId={`file-transp-${m.usuario_id}-${evento.id}`}
                      disabled={cerrado}
                    />
                  </div>
                  {m.transporte_provisional && (
                    <div data-testid={`badge-transp-prov-${m.usuario_id}-${evento.id}`} className="text-[9px] text-orange-700 font-semibold mt-0.5">
                      ⏳ Pendiente validación
                    </div>
                  )}
                </td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.01" min="0"
                      value={aloj || ''}
                      onChange={(e) => onChange(m, evento.id, { alojamiento_importe: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      disabled={cerrado}
                      className="w-14 px-1 py-0.5 border border-slate-300 rounded text-xs text-right disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    <FileButton
                      url={alojUrl}
                      onFile={(f) => onUploadJust(m.usuario_id, evento.id, 'alojamiento', f)}
                      testId={`file-aloj-${m.usuario_id}-${evento.id}`}
                      disabled={cerrado}
                    />
                  </div>
                </td>
                <td className="px-1 py-1 bg-amber-50/40">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.01" min="0"
                      value={otros || ''}
                      onChange={(e) => onChange(m, evento.id, { otros_importe: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      disabled={cerrado}
                      className="w-14 px-1 py-0.5 border border-slate-300 rounded text-xs text-right disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    <FileButton
                      url={otrosUrl}
                      onFile={(f) => onUploadJust(m.usuario_id, evento.id, 'otros', f)}
                      testId={`file-otros-${m.usuario_id}-${evento.id}`}
                      disabled={cerrado}
                    />
                  </div>
                </td>
                <td className="px-1 py-1 text-right bg-amber-50/40 text-xs text-slate-700" title="Descuento por servicio de comedor confirmado por el músico" data-testid={`comida-${m.usuario_id}-${evento.id}`}>
                  {comida > 0 ? <span className="text-rose-700 font-medium">−{fmtEuro(comida)}</span> : <span className="text-slate-300">—</span>}
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
const FileButton = ({ url, onFile, testId, disabled }) => {
  const inputRef = useRef();
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => { if (!disabled) inputRef.current?.click(); }}
        data-testid={testId}
        disabled={disabled}
        className="px-1 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[10px] whitespace-nowrap disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
        title={disabled ? 'Plantilla concluida — solo lectura' : (url ? 'Reemplazar justificante' : 'Subir justificante')}
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
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && !disabled) onFile(f);
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
  const { api, user } = useGestorAuth();
  const isSuperAdmin = isSuperAdminUser(user);
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
  const [mostrarQR, setMostrarQR] = useState(false);
  const [fichajesPorEvento, setFichajesPorEvento] = useState({});
  // Iter E1 — modales de cierre / reapertura
  const [concluirModal, setConcluirModal] = useState(null); // {ev}
  const [reabrirModal, setReabrirModal] = useState(null);   // {ev}
  const [cierreBusy, setCierreBusy] = useState(false);
  // Iter E1.1 — modal historial de cierres/reaperturas
  const [historialModal, setHistorialModal] = useState(null); // {ev, loading, entries, error}

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
    const t = { cache_previsto: 0, cache_real: 0, extras: 0, transporte: 0, alojamiento: 0, otros: 0, comida: 0, total: 0 };
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
      const comida = +m.comida_importe || 0;
      const total = +(cacheReal + extra + transp + aloj + otros - comida).toFixed(2);
      t.cache_previsto += cachePrev; t.cache_real += cacheReal; t.extras += extra;
      t.transporte += transp; t.alojamiento += aloj; t.otros += otros; t.comida += comida; t.total += total;
    });
    return t;
  };

  const totalesEvento = useMemo(() => {
    const out = {};
    data.eventos.forEach(ev => {
      const tot = { cache_previsto: 0, cache_real: 0, extras: 0, transporte: 0, alojamiento: 0, otros: 0, comida: 0, total: 0, musicos: 0 };
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

  // ============================================================
  // Iter E1 — Concluir / Reabrir plantilla del evento
  // ============================================================
  const concluirEvento = async (ev) => {
    try {
      setCierreBusy(true);
      const r = await api.post(`/api/gestor/eventos/${ev.id}/concluir-plantilla`);
      const regenerados = r.data?.recibos_regenerados || 0;
      showFeedback(
        'success',
        regenerados > 0
          ? `Evento "${ev.nombre}" concluido. ${regenerados} recibo${regenerados !== 1 ? 's' : ''} regenerado${regenerados !== 1 ? 's' : ''}.`
          : `Evento "${ev.nombre}" concluido. Equipo económico notificado.`,
      );
      setConcluirModal(null);
      await cargar();
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    } finally {
      setCierreBusy(false);
    }
  };

  const reabrirEvento = async (ev) => {
    try {
      setCierreBusy(true);
      await api.post(`/api/gestor/eventos/${ev.id}/reabrir-plantilla`);
      showFeedback('success', `Plantilla de "${ev.nombre}" reabierta. Ya puedes editar de nuevo.`);
      setReabrirModal(null);
      await cargar();
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    } finally {
      setCierreBusy(false);
    }
  };

  // Iter E1.1 — Cargar historial de cierres/reaperturas (lazy al abrir).
  const abrirHistorial = async (ev) => {
    setHistorialModal({ ev, loading: true, entries: [], error: null });
    try {
      const r = await api.get(`/api/gestor/eventos/${ev.id}/historial-cierres`);
      setHistorialModal({ ev, loading: false, entries: r.data?.entries || [], error: null });
    } catch (err) {
      setHistorialModal({
        ev,
        loading: false,
        entries: [],
        error: err.response?.data?.detail || err.message,
      });
    }
  };

  // Iter F1 — Validar importe provisional (solo super admins).
  const validarImporte = async (gastoId, campo) => {
    try {
      await api.post(`/api/gestor/gastos/${gastoId}/validar`, { campo });
      const tipoLabel = campo === 'cache_extra' ? 'caché extra' : 'transporte';
      showFeedback('success', `Importe de ${tipoLabel} validado.`);
      await cargar();
    } catch (err) {
      showFeedback('error', err.response?.data?.detail || err.message);
    }
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
        <div className="flex items-start gap-2">
          <div className="flex flex-col">
            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer px-2 py-1 border border-slate-200 rounded hover:bg-slate-50">
              <input type="checkbox" checked={mostrarQR}
                     onChange={async (e) => {
                       const on = e.target.checked;
                       setMostrarQR(on);
                       if (on) {
                         const evIds = (data.eventos || []).map(ev => ev.id).filter(id => !fichajesPorEvento[id]);
                         const news = {};
                         for (const id of evIds) {
                           try {
                             const r = await api.get(`/api/gestor/fichajes-evento/${id}`);
                             news[id] = r.data?.fichajes || {};
                           } catch { news[id] = {}; }
                         }
                         setFichajesPorEvento(prev => ({ ...prev, ...news }));
                       }
                     }}
                     data-testid="toggle-mostrar-qr"
                     className="w-3.5 h-3.5 accent-emerald-600"/>
              📊 Mostrar datos de fichaje QR
            </label>
            <p className="text-xs text-gray-500 mt-1 max-w-[320px]" data-testid="qr-toggle-help">
              Los datos de fichaje QR muestran la asistencia registrada por los músicos al escanear el código QR. Son datos informativos — el caché se calcula con el porcentaje manual del gestor.
            </p>
          </div>
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
            const fichajesByUser = fichajesPorEvento[ev.id] || {};
            // Iter E1 — estado de cierre del evento
            const eventoCerrado = (ev.estado_cierre || 'abierto') !== 'abierto';
            const yaPasado = eventoYaPasado(ev);
            const puedeConcluir = !eventoCerrado && yaPasado;
            const puedeReabrir = eventoCerrado && isSuperAdmin;
            return (
              <div key={ev.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid={`evento-acordeon-${ev.id}`}
                   {...(open ? {
                     'data-entidad-nombre': ev.nombre || '',
                     'data-entidad-tipo': 'evento',
                     'data-entidad-id': ev.id || '',
                   } : {})}>
                {/* Cabecera del acordeón de evento */}
                <div className="w-full px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between gap-3 hover:from-slate-800 hover:to-slate-700">
                  <button
                    onClick={() => setOpenEvents(p => ({ ...p, [ev.id]: !p[ev.id] }))}
                    className="flex-1 text-left flex items-start gap-3"
                    data-testid={`toggle-evento-${ev.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-semibold">{ev.nombre}</h2>
                        {eventoCerrado && (
                          <span
                            data-testid={`badge-cerrado-${ev.id}`}
                            title={ev.cerrado_plantilla_at
                              ? `Concluido por ${ev.cerrado_plantilla_por_nombre || '—'} el ${fmtFechaCierre(ev.cerrado_plantilla_at)}`
                              : 'Plantilla concluida'}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
                          >
                            🏁 Concluido
                          </span>
                        )}
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
                        {eventoCerrado && ev.cerrado_plantilla_at && (
                          <span className="text-emerald-200">
                            🏁 Concluido por {ev.cerrado_plantilla_por_nombre || '—'} · {fmtFechaCierre(ev.cerrado_plantilla_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg className={`w-5 h-5 transition-transform mt-0.5 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  {/* Iter E1 — Botones de cierre/reapertura */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ev.tiene_historial_cierre && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); abrirHistorial(ev); }}
                        data-testid={`btn-historial-${ev.id}`}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-xs font-semibold whitespace-nowrap shadow border border-slate-500"
                        title="Ver historial de cierres y reaperturas"
                      >
                        🕒 Historial
                      </button>
                    )}
                    {puedeConcluir && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConcluirModal({ ev }); }}
                        data-testid={`btn-concluir-${ev.id}`}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold whitespace-nowrap shadow"
                        title="Marcar el evento como concluido y notificar al equipo económico"
                      >
                        🏁 Concluir Evento
                      </button>
                    )}
                    {puedeReabrir && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setReabrirModal({ ev }); }}
                        data-testid={`btn-reabrir-${ev.id}`}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-xs font-semibold whitespace-nowrap shadow"
                        title="Reabrir la plantilla para volver a editar (solo administradores)"
                      >
                        🔓 Reabrir plantilla
                      </button>
                    )}
                  </div>
                </div>

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
                            fichajesByUser={fichajesByUser}
                            mostrarQR={mostrarQR}
                            cerrado={eventoCerrado}
                            isSuperAdmin={isSuperAdmin}
                            onValidarImporte={validarImporte}
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
                            <span>Comedor: <strong className="text-rose-700">{secTot.comida > 0 ? `−${fmtEuro(secTot.comida)}` : fmtEuro(0)}</strong></span>
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

      {/* Iter E1 — Modal: Concluir evento */}
      {concluirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-concluir-evento">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">🏁 Concluir evento</h3>
            <p className="text-sm text-slate-700 mb-5 leading-relaxed">
              ¿Dar por concluido el evento <strong>{concluirModal.ev.nombre}</strong>?
              Los datos de asistencia quedarán bloqueados y el equipo económico será
              notificado para procesar los pagos.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConcluirModal(null)}
                disabled={cierreBusy}
                data-testid="btn-cancelar-concluir"
                className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => concluirEvento(concluirModal.ev)}
                disabled={cierreBusy}
                data-testid="btn-confirmar-concluir"
                className="px-3 py-1.5 text-sm font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                {cierreBusy ? 'Concluyendo…' : '🏁 Sí, concluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Iter E1 — Modal: Reabrir plantilla (solo super admins) */}
      {reabrirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-reabrir-evento">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">🔓 Reabrir plantilla</h3>
            <p className="text-sm text-slate-700 mb-5 leading-relaxed">
              ¿Reabrir la plantilla de <strong>{reabrirModal.ev.nombre}</strong>?
              Podrás volver a editar los datos de asistencia. Si existen recibos
              emitidos para este evento, se regenerarán automáticamente al volver a concluirlo.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReabrirModal(null)}
                disabled={cierreBusy}
                data-testid="btn-cancelar-reabrir"
                className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => reabrirEvento(reabrirModal.ev)}
                disabled={cierreBusy}
                data-testid="btn-confirmar-reabrir"
                className="px-3 py-1.5 text-sm font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
              >
                {cierreBusy ? 'Reabriendo…' : '🔓 Sí, reabrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Iter E1.1 — Modal: Historial de cierres/reaperturas */}
      {historialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-historial-cierres">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-5 border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">🕒 Historial de cierres</h3>
                <p className="text-xs text-slate-500 mt-0.5">{historialModal.ev.nombre}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistorialModal(null)}
                data-testid="btn-cerrar-historial"
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 -mx-5 px-5">
              {historialModal.loading && (
                <p className="text-sm text-slate-500 py-4 text-center" data-testid="historial-loading">Cargando historial…</p>
              )}
              {!historialModal.loading && historialModal.error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3" data-testid="historial-error">
                  {historialModal.error}
                </p>
              )}
              {!historialModal.loading && !historialModal.error && historialModal.entries.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center" data-testid="historial-empty">
                  Sin actividad de cierre/reapertura registrada.
                </p>
              )}
              {!historialModal.loading && !historialModal.error && historialModal.entries.length > 0 && (
                <ol className="relative border-l-2 border-slate-200 ml-2 pl-5 space-y-4 py-1" data-testid="historial-timeline">
                  {historialModal.entries.map((entry) => {
                    const concluido = entry.tipo === 'evento_concluido';
                    return (
                      <li key={entry.id} className="relative" data-testid={`historial-entry-${entry.id}`}>
                        <span
                          className={`absolute -left-[1.7rem] top-0.5 flex items-center justify-center w-6 h-6 rounded-full text-xs ring-4 ring-white ${
                            concluido ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                          }`}
                          aria-hidden
                        >
                          {concluido ? '🏁' : '🔓'}
                        </span>
                        <div className="text-sm">
                          <div className={`font-semibold ${concluido ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {concluido ? 'Concluido' : 'Reabierto'}
                          </div>
                          <div className="text-slate-700">
                            por <strong>{entry.usuario_nombre || '—'}</strong>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{fmtFechaCierre(entry.created_at)}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setHistorialModal(null)}
                data-testid="btn-cerrar-historial-footer"
                className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantillasDefinitivas;
