// /informes — Módulo de Informes (8 tipos PDF A-H).
// Layout: Panel izquierdo (1/3) configuración + Panel derecho (2/3) vista previa.
// Backend: POST /api/gestor/informes/generar (PDF) + GET /api/gestor/informes/preview/{tipo}/{evento_id}.
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// ============================================================
// CATÁLOGO DE TIPOS DE INFORME
// ============================================================
const TIPOS = [
  { k: 'A', l: 'Plantilla definitiva + plano + montaje', icon: '🎻', desc: 'Lista de músicos confirmados por sección, plano del escenario y montaje técnico.' },
  { k: 'B', l: 'Económico por evento', icon: '💰', desc: 'Resumen económico: cachés previstos y reales por músico.' },
  { k: 'C', l: 'Estadístico de asistencia', icon: '📊', desc: 'Convocados / confirmados / % asistencia por evento.' },
  { k: 'D', l: 'Configuración de eventos', icon: '⚙️', desc: 'Datos generales, fechas, ensayos y funciones.' },
  { k: 'E', l: 'Hoja servicio · Transporte material', icon: '🚚', desc: 'Datos del transportista, paradas y material a transportar.' },
  { k: 'F', l: 'Hoja servicio · Transporte músicos', icon: '🚌', desc: 'Logística por punto de recogida con confirmaciones.' },
  { k: 'G', l: 'Carta de convocatoria por músico', icon: '✉️', desc: 'Carta personalizada por cada músico confirmado.' },
  { k: 'H', l: 'Informe completo (A+B+C+D)', icon: '📚', desc: 'Combina los 4 informes principales en un único PDF.' },
];

// ============================================================
// SECCIONES INSTRUMENTALES (para agrupar y plano SVG)
// ============================================================
const SECCIONES = [
  { k: '1. Violines I',     col: '#dc2626', plano: 'cuerda' },
  { k: '2. Violines II',    col: '#ea580c', plano: 'cuerda' },
  { k: '3. Violas',         col: '#ca8a04', plano: 'cuerda' },
  { k: '4. Violonchelos',   col: '#16a34a', plano: 'cuerda' },
  { k: '5. Contrabajos',    col: '#0d9488', plano: 'cuerda' },
  { k: '6. Viento Madera',  col: '#0284c7', plano: 'viento' },
  { k: '7. Viento Metal',   col: '#7c3aed', plano: 'viento' },
  { k: '8. Percusión',      col: '#be185d', plano: 'percusion' },
  { k: '9. Teclados',       col: '#9333ea', plano: 'teclados' },
  { k: '10. Coro',          col: '#0891b2', plano: 'coro' },
];

const colorSeccion = (sec) => SECCIONES.find(s => s.k === sec)?.col || '#64748b';

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function Informes() {
  const { api } = useAuth();
  const [tipoActivo, setTipoActivo] = useState('A');
  const [eventos, setEventos] = useState([]);
  const [eventosSel, setEventosSel] = useState([]);
  const [cargandoEventos, setCargandoEventos] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [planoMode, setPlanoMode] = useState('herradura'); // herradura | filas
  // Datos para vista previa
  const [previewData, setPreviewData] = useState(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);

  // 1) Cargar lista de eventos
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/gestor/eventos');
        const evs = r.data?.eventos || r.data || [];
        const evsOrden = [...evs].sort((a, b) => (a.fecha_inicio || '').localeCompare(b.fecha_inicio || ''));
        setEventos(evsOrden);
        if (evsOrden.length && !eventosSel.length) setEventosSel([evsOrden[0].id]);
      } catch (e) {
        setError('No se pudieron cargar los eventos.');
      } finally {
        setCargandoEventos(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // 2) Cargar preview cuando cambian tipo o evento principal
  const evPrincipal = eventosSel[0];
  useEffect(() => {
    if (!evPrincipal) { setPreviewData(null); return; }
    let cancel = false;
    (async () => {
      setCargandoPreview(true);
      try {
        // El backend solo enriquece A/E/F; para B/C/D/G/H usamos el preview de A (musicos+montaje)
        // y enriquecemos con endpoints existentes en frontend.
        const tipoBackend = ['A', 'E', 'F'].includes(tipoActivo) ? tipoActivo : 'A';
        const r = await api.get(`/api/gestor/informes/preview/${tipoBackend}/${evPrincipal}`);
        if (!cancel) setPreviewData(r.data || {});
      } catch (e) {
        if (!cancel) setPreviewData({ error: 'No se pudo cargar la vista previa.' });
      } finally {
        if (!cancel) setCargandoPreview(false);
      }
    })();
    return () => { cancel = true; };
  }, [api, tipoActivo, evPrincipal]);

  const toggleEvento = (id) => {
    setEventosSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const generarPDF = async () => {
    if (!eventosSel.length) { setError('Selecciona al menos un evento.'); return; }
    setGenerando(true); setError(null);
    try {
      const res = await api.post('/api/gestor/informes/generar',
        { tipo: tipoActivo, evento_ids: eventosSel, opciones: { plano_mode: planoMode } },
        { responseType: 'blob', timeout: 90000 }
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe_${tipoActivo}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Error al generar el PDF: ' + (e.response?.data?.detail || e.message));
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50" data-testid="page-informes">
      {/* Cabecera */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="font-cabinet text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="text-3xl">📑</span> Informes
          </h1>
          <p className="text-sm text-slate-500">Genera 8 tipos de informes PDF profesionales en colores corporativos.</p>
        </div>
        <button onClick={generarPDF} disabled={generando || !eventosSel.length}
                data-testid="btn-generar-informe"
                className="bg-[#1A3A5C] hover:bg-[#163050] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition">
          {generando ? (
            <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />Generando…</>
          ) : (
            <><span>⬇️</span> Exportar PDF · Tipo {tipoActivo}</>
          )}
        </button>
      </div>

      {/* Layout 2 paneles */}
      <div className="flex-1 flex min-h-0">
        {/* Panel izquierdo (1/3) */}
        <aside className="w-[33%] min-w-[320px] max-w-[480px] border-r border-slate-200 bg-white overflow-y-auto" data-testid="panel-config">
          <div className="p-4 space-y-5">
            {/* Tipo de informe */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">1 · Tipo de informe</h2>
              <div className="space-y-1.5">
                {TIPOS.map(t => (
                  <button key={t.k}
                          onClick={() => setTipoActivo(t.k)}
                          data-testid={`tipo-${t.k}`}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition ${tipoActivo === t.k ? 'bg-[#1A3A5C]/5 border-[#1A3A5C] ring-1 ring-[#1A3A5C]/30' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded font-bold text-sm ${tipoActivo === t.k ? 'bg-[#1A3A5C] text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {t.k}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 flex items-center gap-1.5"><span>{t.icon}</span><span className="truncate">{t.l}</span></div>
                      </div>
                    </div>
                    {tipoActivo === t.k && <p className="text-xs text-slate-600 mt-1.5 ml-9">{t.desc}</p>}
                  </button>
                ))}
              </div>
            </section>

            {/* Eventos */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">2 · Eventos ({eventosSel.length})</h2>
                <div className="flex gap-1">
                  <button onClick={() => setEventosSel(eventos.map(e => e.id))}
                          data-testid="btn-todos-eventos"
                          className="text-xs text-[#1A3A5C] hover:underline">Todos</button>
                  <span className="text-slate-300">·</span>
                  <button onClick={() => setEventosSel([])}
                          className="text-xs text-slate-500 hover:underline">Ninguno</button>
                </div>
              </div>
              {cargandoEventos ? (
                <div className="text-sm text-slate-400 py-6 text-center">Cargando eventos…</div>
              ) : eventos.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">Sin eventos.</div>
              ) : (
                <div className="border border-slate-200 rounded-lg max-h-[320px] overflow-y-auto divide-y divide-slate-100" data-testid="lista-eventos">
                  {eventos.map(ev => {
                    const sel = eventosSel.includes(ev.id);
                    const principal = sel && eventosSel[0] === ev.id;
                    return (
                      <label key={ev.id}
                             className={`flex items-start gap-2 px-2.5 py-2 cursor-pointer hover:bg-slate-50 ${sel ? 'bg-[#1A3A5C]/5' : ''}`}>
                        <input type="checkbox" checked={sel}
                               onChange={() => toggleEvento(ev.id)}
                               data-testid={`evento-${ev.id}`}
                               className="mt-0.5 accent-[#1A3A5C]" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {ev.nombre || '(Sin nombre)'}
                            {principal && <span className="ml-1.5 text-[10px] bg-[#C9920A] text-white px-1 py-0.5 rounded uppercase">vista previa</span>}
                          </div>
                          <div className="text-xs text-slate-500 flex gap-2">
                            <span>{(ev.fecha_inicio || '').slice(0, 10) || '—'}</span>
                            <span>·</span>
                            <span className="capitalize">{ev.estado || '—'}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Opciones específicas por tipo */}
            {tipoActivo === 'A' && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">3 · Opciones plano</h2>
                <div className="flex gap-1.5">
                  <button onClick={() => setPlanoMode('herradura')}
                          data-testid="btn-plano-herradura"
                          className={`flex-1 px-3 py-2 text-xs rounded-lg border transition ${planoMode === 'herradura' ? 'bg-[#1A3A5C] text-white border-[#1A3A5C]' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                    🎭 Herradura
                  </button>
                  <button onClick={() => setPlanoMode('filas')}
                          data-testid="btn-plano-filas"
                          className={`flex-1 px-3 py-2 text-xs rounded-lg border transition ${planoMode === 'filas' ? 'bg-[#1A3A5C] text-white border-[#1A3A5C]' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                    🪑 Filas
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">La disposición elegida se reflejará en la vista previa y en el PDF.</p>
              </section>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2" data-testid="informes-error">
                {error}
              </div>
            )}
          </div>
        </aside>

        {/* Panel derecho (2/3) — Vista previa */}
        <main className="flex-1 overflow-y-auto" data-testid="panel-preview">
          <div className="p-6 max-w-5xl mx-auto">
            {!evPrincipal ? (
              <EmptyState />
            ) : cargandoPreview ? (
              <LoadingPreview />
            ) : previewData?.error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{previewData.error}</div>
            ) : (
              <PreviewDoc tipo={tipoActivo} data={previewData} planoMode={planoMode} eventoIds={eventosSel} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// VISTA PREVIA — Documento HTML/CSS estilo PDF (A4)
// ============================================================
function PreviewDoc({ tipo, data, planoMode, eventoIds }) {
  const ev = data?.evento || {};
  const tInfo = TIPOS.find(t => t.k === tipo);
  return (
    <div className="bg-white shadow-lg border border-slate-200 mx-auto" style={{ minHeight: '297mm', maxWidth: '210mm', padding: '20mm 18mm' }} data-testid="preview-doc">
      {/* Cabecera corporativa */}
      <header className="border-b-[3px] border-[#C9920A] pb-3 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">IFC · Innovación, Formación y Cultura</div>
            <h2 className="text-xl font-bold text-[#1A3A5C] mt-0.5">{tInfo?.l}</h2>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <div>Generado: {new Date().toLocaleDateString('es-ES')}</div>
            <div>Tipo: {tipo} · Eventos: {eventoIds.length}</div>
          </div>
        </div>
      </header>

      {/* Datos generales del evento */}
      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Evento</div>
        <h3 className="text-lg font-bold text-slate-900">{ev.nombre || '—'}</h3>
        <div className="grid grid-cols-3 gap-3 mt-2 text-xs text-slate-600">
          <div><span className="font-semibold text-slate-700">Fecha:</span> {(ev.fecha_inicio || '').slice(0, 10) || '—'}</div>
          <div><span className="font-semibold text-slate-700">Lugar:</span> {ev.lugar || '—'}</div>
          <div><span className="font-semibold text-slate-700">Estado:</span> <span className="capitalize">{ev.estado || '—'}</span></div>
        </div>
      </section>

      {/* Bloques específicos por tipo */}
      {tipo === 'A' && <BloqueA data={data} planoMode={planoMode} />}
      {tipo === 'B' && <BloqueB data={data} />}
      {tipo === 'C' && <BloqueC data={data} eventoIds={eventoIds} />}
      {tipo === 'D' && <BloqueD data={data} />}
      {tipo === 'E' && <BloqueE data={data} />}
      {tipo === 'F' && <BloqueF data={data} />}
      {tipo === 'G' && <BloqueG data={data} />}
      {tipo === 'H' && <BloqueH data={data} planoMode={planoMode} />}

      {/* Pie corporativo */}
      <footer className="mt-8 pt-3 border-t border-slate-200 text-[9px] text-slate-400 flex justify-between">
        <span>OPUS MANAGER · {tInfo?.l}</span>
        <span>Página 1 / N</span>
      </footer>
    </div>
  );
}

// ============================================================
// BLOQUE A — Plantilla + plano + montaje
// ============================================================
function BloqueA({ data, planoMode }) {
  const musicos = data?.musicos || [];
  const montaje = data?.montaje || [];
  const porSeccion = useMemo(() => {
    const map = {};
    musicos.forEach(m => {
      const k = m._seccion || 'Z. Otros';
      if (!map[k]) map[k] = [];
      map[k].push(m);
    });
    return map;
  }, [musicos]);
  const seccionesOrdenadas = Object.keys(porSeccion).sort((a, b) => {
    const oa = SECCIONES.findIndex(s => s.k === a);
    const ob = SECCIONES.findIndex(s => s.k === b);
    return (oa < 0 ? 99 : oa) - (ob < 0 ? 99 : ob);
  });

  return (
    <>
      <SectionTitle num="1" titulo={`Lista de músicos confirmados (${musicos.length})`} />
      {musicos.length === 0 ? (
        <EmptyMsg>Sin músicos confirmados.</EmptyMsg>
      ) : (
        <div className="space-y-3">
          {seccionesOrdenadas.map(sec => (
            <div key={sec}>
              <div className="text-xs font-bold mb-0.5 px-2 py-0.5 rounded inline-block text-white"
                   style={{ background: colorSeccion(sec) }}>{sec} ({porSeccion[sec].length})</div>
              <table className="w-full text-[10px] border border-slate-300 mt-1">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="text-left px-1.5 py-1 border-b border-slate-300 w-7">#</th>
                    <th className="text-left px-1.5 py-1 border-b border-slate-300 w-10">Atril</th>
                    <th className="text-left px-1.5 py-1 border-b border-slate-300">Apellidos, Nombre</th>
                    <th className="text-left px-1.5 py-1 border-b border-slate-300">Instrumento</th>
                    <th className="text-left px-1.5 py-1 border-b border-slate-300 w-24">Nivel</th>
                    <th className="text-left px-1.5 py-1 border-b border-slate-300 w-20">Tel.</th>
                  </tr>
                </thead>
                <tbody>
                  {porSeccion[sec].map((m, i) => (
                    <tr key={m.id} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="px-1.5 py-1 border-b border-slate-200">{i + 1}</td>
                      <td className="px-1.5 py-1 border-b border-slate-200">{m.numero_atril ?? '—'}{m.letra_atril ? '·' + m.letra_atril : ''}</td>
                      <td className="px-1.5 py-1 border-b border-slate-200 font-medium">{m.apellidos || ''}, {m.nombre || ''}</td>
                      <td className="px-1.5 py-1 border-b border-slate-200">{m.instrumento || '—'}</td>
                      <td className="px-1.5 py-1 border-b border-slate-200">{(m.nivel_estudios || '—').slice(0, 14)}</td>
                      <td className="px-1.5 py-1 border-b border-slate-200">{m.telefono || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Plano */}
      <div className="mt-6">
        <SectionTitle num="2" titulo={`Plano del escenario · disposición ${planoMode === 'herradura' ? 'herradura' : 'filas'}`} />
        <div className="border-2 border-slate-300 rounded-lg p-3 bg-gradient-to-b from-slate-50 to-slate-100 relative">
          <PlanoOrquesta porSeccion={porSeccion} mode={planoMode} />
          {Object.keys(porSeccion).length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" data-testid="plano-vacio">
              <div className="bg-white/90 border border-slate-300 rounded px-3 py-1.5 text-[11px] text-slate-600 font-medium shadow-sm">
                ℹ️ Sin músicos asignados — el plano se completará al confirmar la plantilla.
              </div>
            </div>
          )}
          <LeyendaPlano porSeccion={porSeccion} />
        </div>
      </div>

      {/* Montaje */}
      <div className="mt-6">
        <SectionTitle num="3" titulo={`Lista de montaje (${montaje.length})`} />
        {montaje.length === 0 ? (
          <EmptyMsg>Sin montaje configurado.</EmptyMsg>
        ) : (
          <table className="w-full text-[10px] border border-slate-300">
            <thead>
              <tr className="bg-[#1A3A5C] text-white">
                <th className="text-left px-1.5 py-1">Material</th>
                <th className="text-left px-1.5 py-1 w-20">Grupo</th>
                <th className="text-left px-1.5 py-1 w-12">Cant.</th>
                <th className="text-left px-1.5 py-1 w-20">Origen</th>
                <th className="text-left px-1.5 py-1">Sección</th>
                <th className="text-left px-1.5 py-1 w-10">✓</th>
              </tr>
            </thead>
            <tbody>
              {montaje.map((m, i) => (
                <tr key={m.id || i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="px-1.5 py-1 border-b border-slate-200 font-medium">{m.material?.nombre || m.nombre_material || '—'}</td>
                  <td className="px-1.5 py-1 border-b border-slate-200 uppercase text-[9px]">{m.material?.grupo || '—'}</td>
                  <td className="px-1.5 py-1 border-b border-slate-200">{m.cantidad_necesaria || 0}</td>
                  <td className="px-1.5 py-1 border-b border-slate-200 capitalize">{m.origen || 'propio'}</td>
                  <td className="px-1.5 py-1 border-b border-slate-200">{m.seccion_escenario || '—'}</td>
                  <td className="px-1.5 py-1 border-b border-slate-200">{m.confirmado ? '✓' : '·'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ============================================================
// PLANO SVG — Herradura o Filas
// ============================================================
function PlanoOrquesta({ porSeccion, mode }) {
  const W = 700, H = 360;
  // Posiciones por sección (proporciones)
  const slotsHerradura = {
    '1. Violines I':   { cx: 0.22, cy: 0.62, r: 0.10, sweep: -65, angle: 25 },
    '2. Violines II':  { cx: 0.36, cy: 0.40, r: 0.13, sweep: -90, angle: 35 },
    '3. Violas':       { cx: 0.64, cy: 0.40, r: 0.13, sweep:  90, angle: 35 },
    '4. Violonchelos': { cx: 0.78, cy: 0.62, r: 0.10, sweep:  65, angle: 25 },
    '5. Contrabajos':  { cx: 0.86, cy: 0.78, r: 0.04, sweep:  90, angle: 0 },
    '6. Viento Madera':{ cx: 0.42, cy: 0.28, r: 0.07, sweep:  0,  angle: 0 },
    '7. Viento Metal': { cx: 0.62, cy: 0.20, r: 0.07, sweep:  0,  angle: 0 },
    '8. Percusión':    { cx: 0.50, cy: 0.10, r: 0.08, sweep:  0,  angle: 0 },
    '9. Teclados':     { cx: 0.12, cy: 0.30, r: 0.04, sweep:  0,  angle: 0 },
    '10. Coro':        { cx: 0.50, cy: 0.04, r: 0.20, sweep:  0,  angle: 0 },
  };
  const filasOrden = ['8. Percusión', '7. Viento Metal', '6. Viento Madera', '9. Teclados',
                       '2. Violines II', '3. Violas', '1. Violines I', '4. Violonchelos', '5. Contrabajos', '10. Coro'];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" data-testid={`plano-${mode}`}>
      {/* Fondo escenario */}
      <defs>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#floor)" rx="12" />
      {/* Director */}
      <g>
        <circle cx={W * 0.5} cy={H * 0.92} r="14" fill="#1A3A5C" />
        <text x={W * 0.5} y={H * 0.92 + 4} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">DIR</text>
      </g>
      <text x={W * 0.5} y={H * 0.985} textAnchor="middle" fill="#94a3b8" fontSize="9">PÚBLICO</text>

      {mode === 'herradura' ? (
        // Disposición en herradura
        Object.keys(porSeccion).map((sec) => {
          const slot = slotsHerradura[sec];
          if (!slot) return null;
          const cnt = porSeccion[sec].length;
          return <GrupoArc key={sec} W={W} H={H} slot={slot} count={cnt} sec={sec} />;
        })
      ) : (
        // Disposición en filas
        <FilasOrquesta W={W} H={H} porSeccion={porSeccion} orden={filasOrden} />
      )}
    </svg>
  );
}

// Renderizado de un grupo en arco (herradura)
function GrupoArc({ W, H, slot, count, sec }) {
  const cx = slot.cx * W, cy = slot.cy * H;
  const r = slot.r * W;
  const color = colorSeccion(sec);
  // Distribuir puntos en arco
  const pts = [];
  const n = Math.min(count, 16);
  const sweep = (slot.sweep * Math.PI) / 180;
  const span = (slot.angle * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const a = sweep + (n > 1 ? span * (i / (n - 1) - 0.5) : 0);
    pts.push({ x: cx + r * Math.cos(a + Math.PI / 2), y: cy + r * Math.sin(a + Math.PI / 2) });
  }
  // Si más de 16, hacer 2 filas
  const extra = [];
  if (count > 16) {
    const r2 = r * 0.72;
    for (let i = 0; i < count - 16 && i < 16; i++) {
      const a = sweep + (span * (i / (Math.min(count - 16, 16) - 1 || 1) - 0.5));
      extra.push({ x: cx + r2 * Math.cos(a + Math.PI / 2), y: cy + r2 * Math.sin(a + Math.PI / 2) });
    }
  }
  return (
    <g>
      {pts.map((p, i) => <circle key={'p' + i} cx={p.x} cy={p.y} r="6" fill={color} stroke="white" strokeWidth="1.5" />)}
      {extra.map((p, i) => <circle key={'e' + i} cx={p.x} cy={p.y} r="6" fill={color} stroke="white" strokeWidth="1.5" />)}
      <text x={cx} y={cy} textAnchor="middle" fill="#1e293b" fontSize="9" fontWeight="bold">{sec.split('. ')[1]}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fill="#475569" fontSize="8">({count})</text>
    </g>
  );
}

// Disposición en filas
function FilasOrquesta({ W, H, porSeccion, orden }) {
  const filaH = (H * 0.78) / Math.max(1, orden.filter(s => porSeccion[s]).length);
  const padTop = H * 0.05;
  const filas = orden.filter(s => porSeccion[s] && porSeccion[s].length);
  return (
    <>
      {filas.map((sec, idx) => {
        const cnt = porSeccion[sec].length;
        const y = padTop + idx * filaH + filaH / 2;
        const color = colorSeccion(sec);
        const pts = [];
        const usableW = W * 0.78;
        const startX = W * 0.13;
        for (let i = 0; i < cnt; i++) {
          const x = startX + (cnt > 1 ? usableW * (i / (cnt - 1)) : usableW / 2);
          pts.push({ x, y });
        }
        return (
          <g key={sec}>
            <text x={W * 0.10} y={y + 3} textAnchor="end" fill="#1e293b" fontSize="9" fontWeight="bold">{sec.split('. ')[1]}</text>
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="6" fill={color} stroke="white" strokeWidth="1.5" />)}
            <text x={W * 0.93} y={y + 3} fill="#475569" fontSize="9">{cnt}</text>
          </g>
        );
      })}
    </>
  );
}

function LeyendaPlano({ porSeccion }) {
  const secs = Object.keys(porSeccion).sort((a, b) => {
    const oa = SECCIONES.findIndex(s => s.k === a);
    const ob = SECCIONES.findIndex(s => s.k === b);
    return (oa < 0 ? 99 : oa) - (ob < 0 ? 99 : ob);
  });
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[9px] text-slate-700">
      {secs.map(s => (
        <div key={s} className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorSeccion(s) }} />
          <span className="font-medium">{s}</span>
          <span className="text-slate-500">({porSeccion[s].length})</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// BLOQUE B — Económico
// ============================================================
function BloqueB({ data }) {
  const musicos = data?.musicos || [];
  let totalPrev = 0, totalReal = 0;
  musicos.forEach(m => {
    totalPrev += parseFloat(m.cache_previsto) || 0;
    totalReal += parseFloat(m.cache_real) || 0;
  });
  return (
    <>
      <SectionTitle num="1" titulo="Resumen económico por músico" />
      {musicos.length === 0 ? (
        <EmptyMsg>Sin músicos confirmados.</EmptyMsg>
      ) : (
        <table className="w-full text-[10px] border border-slate-300">
          <thead>
            <tr className="bg-[#1A3A5C] text-white">
              <th className="text-left px-1.5 py-1">Apellidos, Nombre</th>
              <th className="text-left px-1.5 py-1">Instrumento</th>
              <th className="text-left px-1.5 py-1 w-20">Nivel</th>
              <th className="text-right px-1.5 py-1 w-20">Caché Prev.</th>
              <th className="text-right px-1.5 py-1 w-20">Caché Real</th>
              <th className="text-right px-1.5 py-1 w-20">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {musicos.map((m, i) => {
              const cp = parseFloat(m.cache_previsto) || 0;
              const cr = parseFloat(m.cache_real) || 0;
              return (
                <tr key={m.id} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="px-1.5 py-1 border-b border-slate-200 font-medium">{m.apellidos}, {m.nombre}</td>
                  <td className="px-1.5 py-1 border-b border-slate-200">{m.instrumento || '—'}</td>
                  <td className="px-1.5 py-1 border-b border-slate-200">{(m.nivel_estudios || '—').slice(0, 12)}</td>
                  <td className="px-1.5 py-1 border-b border-slate-200 text-right">{cp.toFixed(2)}€</td>
                  <td className="px-1.5 py-1 border-b border-slate-200 text-right">{cr.toFixed(2)}€</td>
                  <td className="px-1.5 py-1 border-b border-slate-200 text-right font-semibold">{(cr || cp).toFixed(2)}€</td>
                </tr>
              );
            })}
            <tr className="bg-[#C9920A] text-white font-bold">
              <td colSpan="3" className="px-1.5 py-1.5">TOTAL ({musicos.length} músicos)</td>
              <td className="px-1.5 py-1.5 text-right">{totalPrev.toFixed(2)}€</td>
              <td className="px-1.5 py-1.5 text-right">{totalReal.toFixed(2)}€</td>
              <td className="px-1.5 py-1.5 text-right">{(totalReal || totalPrev).toFixed(2)}€</td>
            </tr>
          </tbody>
        </table>
      )}
    </>
  );
}

// ============================================================
// BLOQUE C — Estadístico de asistencia
// ============================================================
function BloqueC({ data, eventoIds }) {
  const total = (data?.musicos || []).length;
  const conf = total; // _musicos_confirmados ya filtra
  return (
    <>
      <SectionTitle num="1" titulo="Estadístico de asistencia" />
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Eventos seleccionados" value={eventoIds.length} color="#1A3A5C" />
        <KPI label="Confirmados (evento principal)" value={conf} color="#16a34a" />
        <KPI label="% asistencia (estimada)" value={total ? '100%' : '—'} color="#C9920A" />
      </div>
      <p className="text-[10px] text-slate-500 mt-3 italic">El PDF generado calcula el detalle por cada evento seleccionado.</p>
    </>
  );
}

// ============================================================
// BLOQUE D — Configuración del evento
// ============================================================
function BloqueD({ data }) {
  const ev = data?.evento || {};
  return (
    <>
      <SectionTitle num="1" titulo="Datos generales" />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Campo label="Nombre" valor={ev.nombre} />
        <Campo label="Estado" valor={ev.estado} />
        <Campo label="Fecha inicio" valor={(ev.fecha_inicio || '').slice(0, 10)} />
        <Campo label="Fecha fin" valor={(ev.fecha_fin || '').slice(0, 10)} />
        <Campo label="Lugar" valor={ev.lugar} />
        <Campo label="Hora" valor={ev.hora_inicio} />
      </div>
      {ev.descripcion && (
        <div className="mt-3">
          <div className="text-[10px] uppercase font-bold text-slate-500">Descripción</div>
          <p className="text-xs text-slate-700 mt-0.5">{ev.descripcion}</p>
        </div>
      )}
      <p className="text-[10px] text-slate-500 mt-3 italic">El PDF incluye la lista completa de ensayos y funciones de cada evento.</p>
    </>
  );
}

// ============================================================
// BLOQUE E — Hoja servicio transporte material
// ============================================================
function BloqueE({ data }) {
  const tr = data?.transporte || {};
  const montaje = data?.montaje || [];
  return (
    <>
      <SectionTitle num="1" titulo="Datos del transportista" />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Campo label="Empresa" valor={tr.empresa} />
        <Campo label="Contacto" valor={tr.contacto_empresa} />
        <Campo label="Teléfono" valor={tr.telefono_empresa} />
        <Campo label="Estado" valor={tr.estado?.toUpperCase()} />
        <Campo label="Presupuesto" valor={tr.presupuesto_euros ? `${tr.presupuesto_euros}€` : null} />
      </div>
      <SectionTitle num="2" titulo="Servicio" />
      <table className="w-full text-[10px] border border-slate-300">
        <thead>
          <tr className="bg-[#1A3A5C] text-white">
            <th className="text-left px-1.5 py-1 w-20">Tipo</th>
            <th className="text-left px-1.5 py-1 w-24">Fecha</th>
            <th className="text-left px-1.5 py-1 w-16">Hora</th>
            <th className="text-left px-1.5 py-1">Dirección</th>
          </tr>
        </thead>
        <tbody>
          <FilaServicio l="Recogida" f={tr.fecha_carga} h={tr.hora_carga} d={tr.direccion_carga} />
          {[1, 2, 3].map(n => tr[`parada_${n}_direccion`] && (
            <FilaServicio key={n} l={`Parada ${n}`} h={tr[`parada_${n}_hora`]} d={tr[`parada_${n}_direccion`]} />
          ))}
          <FilaServicio l="Entrega" f={tr.fecha_descarga} h={tr.hora_descarga} d={tr.direccion_descarga} />
          {tr.fecha_devolucion && <FilaServicio l="Devolución" f={tr.fecha_devolucion} h={tr.hora_devolucion} d={tr.direccion_carga} />}
        </tbody>
      </table>
      <SectionTitle num="3" titulo={`Material a transportar (${montaje.length})`} />
      {montaje.length === 0 ? (
        <EmptyMsg>Sin material configurado.</EmptyMsg>
      ) : (
        <table className="w-full text-[10px] border border-slate-300">
          <thead>
            <tr className="bg-[#1A3A5C] text-white">
              <th className="text-left px-1.5 py-1 w-12">Cant</th>
              <th className="text-left px-1.5 py-1">Material</th>
              <th className="text-left px-1.5 py-1 w-24">Grupo</th>
              <th className="text-left px-1.5 py-1">Sección</th>
            </tr>
          </thead>
          <tbody>
            {montaje.map((m, i) => (
              <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                <td className="px-1.5 py-1 border-b border-slate-200">{m.cantidad_necesaria}</td>
                <td className="px-1.5 py-1 border-b border-slate-200 font-medium">{m.material?.nombre || m.nombre_material}</td>
                <td className="px-1.5 py-1 border-b border-slate-200 uppercase text-[9px]">{m.material?.grupo || '—'}</td>
                <td className="px-1.5 py-1 border-b border-slate-200">{m.seccion_escenario || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function FilaServicio({ l, f, h, d }) {
  return (
    <tr>
      <td className="px-1.5 py-1 border-b border-slate-200 font-semibold">{l}</td>
      <td className="px-1.5 py-1 border-b border-slate-200">{f || '—'}</td>
      <td className="px-1.5 py-1 border-b border-slate-200">{h ? h.slice(0, 5) : '—'}</td>
      <td className="px-1.5 py-1 border-b border-slate-200">{d || '—'}</td>
    </tr>
  );
}

// ============================================================
// BLOQUE F — Transporte músicos
// ============================================================
function BloqueF({ data }) {
  const logs = data?.logistica || [];
  return (
    <>
      <SectionTitle num="1" titulo="Logística del evento" />
      {logs.length === 0 ? (
        <EmptyMsg>Sin logística configurada.</EmptyMsg>
      ) : (
        <div className="space-y-3">
          {logs.map(l => (
            <div key={l.id} className="border border-slate-300 rounded p-2">
              <div className="text-xs font-bold text-[#1A3A5C] uppercase mb-1">
                {l.tipo === 'transporte_ida' && '🚌 IDA'}
                {l.tipo === 'transporte_vuelta' && '🚌 VUELTA'}
                {l.tipo === 'alojamiento' && '🏨 ALOJAMIENTO'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <Campo label="Fecha" valor={l.fecha} />
                <Campo label="Hora salida" valor={l.hora_salida} />
                <Campo label="Lugar salida" valor={l.lugar_salida} />
                <Campo label="Hora llegada" valor={l.hora_llegada} />
                <Campo label="Lugar llegada" valor={l.lugar_llegada} />
                <Campo label="Lím. confirmación" valor={l.fecha_limite_confirmacion} />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-500 mt-3 italic">El PDF incluye la lista de músicos confirmados agrupados por punto de recogida.</p>
    </>
  );
}

// ============================================================
// BLOQUE G — Carta de convocatoria
// ============================================================
function BloqueG({ data }) {
  const ev = data?.evento || {};
  const m = (data?.musicos || [])[0];
  return (
    <>
      <SectionTitle num="1" titulo="Carta de convocatoria (vista de muestra)" />
      {!m ? (
        <EmptyMsg>Sin músicos confirmados para mostrar muestra.</EmptyMsg>
      ) : (
        <div className="text-xs leading-relaxed space-y-2">
          <p>Estimado/a <b>{m.nombre} {m.apellidos}</b>:</p>
          <p>Le convocamos al evento <b>«{ev.nombre}»</b> en calidad de <b>{m.instrumento}</b>.</p>
          <p>Fecha del evento: <b>{(ev.fecha_inicio || '').slice(0, 10)}</b>.<br />
             Lugar principal: {ev.lugar || '—'}.</p>
          <div className="mt-3 italic text-slate-500">El PDF generado incluye una carta personalizada por cada músico confirmado ({(data?.musicos || []).length} en total) con la lista completa de ensayos.</div>
        </div>
      )}
    </>
  );
}

// ============================================================
// BLOQUE H — Combinado
// ============================================================
function BloqueH({ data, planoMode }) {
  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3 text-[10px] text-amber-800">
        <b>📚 Informe combinado:</b> incluye los apartados A (plantilla + plano + montaje), B (económico), C (asistencia) y D (configuración).
      </div>
      <BloqueA data={data} planoMode={planoMode} />
    </>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================
function SectionTitle({ num, titulo }) {
  return (
    <h4 className="text-sm font-bold text-[#1A3A5C] mt-4 mb-2 flex items-center gap-2">
      <span className="bg-[#1A3A5C] text-white w-5 h-5 rounded flex items-center justify-center text-xs">{num}</span>
      {titulo}
    </h4>
  );
}

function Campo({ label, valor }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-slate-500">{label}</div>
      <div className="text-xs text-slate-800">{valor || '—'}</div>
    </div>
  );
}

function KPI({ label, value, color }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 text-center bg-white">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function EmptyMsg({ children }) {
  return <div className="bg-slate-50 border border-dashed border-slate-300 rounded text-xs text-slate-500 py-3 text-center">{children}</div>;
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-3">📑</div>
        <h2 className="text-lg font-bold text-slate-700 mb-2">Selecciona al menos un evento</h2>
        <p className="text-sm text-slate-500">La vista previa se generará automáticamente para el primer evento marcado.</p>
      </div>
    </div>
  );
}

function LoadingPreview() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <span className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full" />
        Cargando vista previa…
      </div>
    </div>
  );
}
