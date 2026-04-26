// /admin/archivo — Módulo de archivo musical (Bloque 4).
// 4 pestañas: Catálogo, Préstamos, Programa de eventos, Alertas.

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PAPELES_ARCHIVO, PAPELES_POR_SECCION, SECCIONES_LABEL } from '../lib/papelesArchivo';

const GENEROS = ['SINF.', 'SINF.COR.', 'ESC.', 'COR.'];
const PROCEDENCIAS = ['PROPIO', 'COMPRADO', 'ALQUILER', 'INTERNET', 'INTERNET-LIBRE', 'CESIÓN'];
const ESTADO_PARTE_BADGE = {
  completo: 'bg-emerald-100 text-emerald-700',
  incompleto: 'bg-amber-100 text-amber-700',
  necesita_revision: 'bg-red-100 text-red-700',
  pendiente: 'bg-slate-100 text-slate-600',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');

export default function GestorArchivo() {
  const { api } = useAuth();
  const [tab, setTab] = useState('catalogo');
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ q: '', genero: '', procedencia: '', estado: '' });
  const [ficha, setFicha] = useState(null);          // obra abierta en el modal
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showPrestamoNew, setShowPrestamoNew] = useState(false);
  const [showEtiquetas, setShowEtiquetas] = useState(null); // obra para etiquetas
  const [prestamos, setPrestamos] = useState([]);
  const [alertas, setAlertas] = useState({});
  const [eventoVerif, setEventoVerif] = useState(null); // {obra, evento_id, resultado}

  const cargarObras = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtros.q) params.set('q', filtros.q);
      if (filtros.genero) params.set('genero', filtros.genero);
      if (filtros.procedencia) params.set('procedencia', filtros.procedencia);
      if (filtros.estado) params.set('estado', filtros.estado);
      const r = await api.get(`/api/gestor/archivo/obras?${params.toString()}`);
      setObras(r.data?.obras || []);
    } finally { setLoading(false); }
  }, [api, filtros]);

  const cargarPrestamos = useCallback(async () => {
    const r = await api.get('/api/gestor/archivo/prestamos');
    setPrestamos(r.data?.prestamos || []);
  }, [api]);

  const cargarAlertas = useCallback(async () => {
    const r = await api.get('/api/gestor/archivo/alertas');
    setAlertas(r.data || {});
  }, [api]);

  useEffect(() => { cargarObras(); }, [cargarObras]);
  useEffect(() => { if (tab === 'prestamos') cargarPrestamos(); }, [tab, cargarPrestamos]);
  useEffect(() => { if (tab === 'alertas') cargarAlertas(); }, [tab, cargarAlertas]);

  const abrirFicha = async (id) => {
    const r = await api.get(`/api/gestor/archivo/obras/${id}`);
    setFicha(r.data);
  };

  const guardarObra = async (data, id) => {
    if (id) await api.put(`/api/gestor/archivo/obras/${id}`, data);
    else await api.post('/api/gestor/archivo/obras', data);
    setShowCreate(false);
    await cargarObras();
  };

  const descargarPlantilla = async () => {
    const res = await api.get('/api/gestor/archivo/plantilla-obras', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla_obras.xlsx';
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4" data-testid="archivo-page">
      <header className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-cabinet text-2xl font-bold text-slate-900">📚 Archivo musical</h1>
          <p className="text-xs text-slate-500">Catálogo de obras, préstamos y verificación de material por evento.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-4 flex gap-1 flex-wrap" data-testid="archivo-tabs">
        {[
          { id: 'catalogo',  label: '📚 Catálogo' },
          { id: 'prestamos', label: '🔄 Préstamos' },
          { id: 'programa',  label: '🎼 Programa de eventos' },
          { id: 'alertas',   label: '⚠️ Alertas y pendientes' },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'catalogo' && (
        <CatalogoTab
          obras={obras} loading={loading} filtros={filtros} setFiltros={setFiltros}
          onCargar={cargarObras} onAbrirFicha={abrirFicha}
          onNuevo={() => setShowCreate(true)} onImportar={() => setShowImport(true)}
          onPlantilla={descargarPlantilla}
        />
      )}
      {tab === 'prestamos' && (
        <PrestamosTab
          prestamos={prestamos} api={api} obras={obras}
          onNuevo={() => setShowPrestamoNew(true)} onCargar={cargarPrestamos}
        />
      )}
      {tab === 'programa' && (
        <ProgramaTab api={api} obras={obras} setEventoVerif={setEventoVerif} />
      )}
      {tab === 'alertas' && <AlertasTab alertas={alertas} />}

      {/* Modales */}
      {showCreate && (
        <ObraFormModal onClose={() => setShowCreate(false)} onSave={(d) => guardarObra(d)} />
      )}
      {ficha && (
        <FichaObraModal
          ficha={ficha} api={api}
          onClose={() => setFicha(null)}
          onRecargar={async () => {
            await cargarObras();
            await abrirFicha(ficha.obra.id);
          }}
          onEtiquetas={(o) => setShowEtiquetas(o)}
        />
      )}
      {showImport && (
        <ImportModal api={api} onClose={() => setShowImport(false)} onDone={cargarObras} />
      )}
      {showPrestamoNew && (
        <PrestamoFormModal api={api} obras={obras} onClose={() => setShowPrestamoNew(false)} onSave={cargarPrestamos} />
      )}
      {showEtiquetas && (
        <EtiquetasModal api={api} obra={showEtiquetas} onClose={() => setShowEtiquetas(null)} />
      )}
      {eventoVerif && (
        <VerifAtrilesModal data={eventoVerif} onClose={() => setEventoVerif(null)} />
      )}
    </div>
  );
}

// =====================================================================
// CATALOGO
// =====================================================================
function CatalogoTab({ obras, loading, filtros, setFiltros, onAbrirFicha, onNuevo, onImportar, onPlantilla }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
          placeholder="Buscar por título, autor o código…"
          data-testid="archivo-search"
          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-slate-300 rounded-md"
        />
        <select value={filtros.genero} onChange={(e) => setFiltros({ ...filtros, genero: e.target.value })} className="px-2 py-1.5 text-sm border border-slate-300 rounded-md">
          <option value="">Género</option>
          {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filtros.procedencia} onChange={(e) => setFiltros({ ...filtros, procedencia: e.target.value })} className="px-2 py-1.5 text-sm border border-slate-300 rounded-md">
          <option value="">Procedencia</option>
          {PROCEDENCIAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })} className="px-2 py-1.5 text-sm border border-slate-300 rounded-md">
          <option value="">Estado</option>
          <option value="activo">Activo</option>
          <option value="archivado">Archivado</option>
        </select>
        <button type="button" onClick={onNuevo} data-testid="btn-nueva-obra"
          className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700">+ Nueva obra</button>
        <button type="button" onClick={onImportar} data-testid="btn-importar"
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">📥 Importar Excel</button>
        <button type="button" onClick={onPlantilla} data-testid="btn-plantilla"
          className="px-3 py-1.5 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700">📄 Plantilla</button>
      </div>

      {loading ? <div className="text-slate-500 text-sm">Cargando…</div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Autor</th>
                <th className="px-3 py-2 text-left">Título</th>
                <th className="px-3 py-2 text-left">Género</th>
                <th className="px-3 py-2 text-left">Subgénero</th>
                <th className="px-3 py-2 text-left">Procedencia</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {obras.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Sin obras.</td></tr>
              )}
              {obras.map(o => (
                <tr key={o.id} className="hover:bg-slate-50" data-testid={`obra-row-${o.id}`}>
                  <td className="px-3 py-2 font-mono text-xs">{o.codigo || '—'}</td>
                  <td className="px-3 py-2">{o.autor}</td>
                  <td className="px-3 py-2 font-medium">{o.titulo}</td>
                  <td className="px-3 py-2 text-xs">{o.genero || '—'}</td>
                  <td className="px-3 py-2 text-xs">{o.subgenero || '—'}</td>
                  <td className="px-3 py-2 text-xs">{o.procedencia || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 text-[10px] rounded ${o.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {o.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => onAbrirFicha(o.id)} data-testid={`btn-ver-${o.id}`}
                      className="text-blue-600 hover:underline text-xs">Ver ficha →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// FICHA OBRA (modal)
// =====================================================================
function FichaObraModal({ ficha, api, onClose, onRecargar, onEtiquetas }) {
  const o = ficha.obra || {};
  const [tab, setTab] = useState('datos');
  const [originales, setOriginales] = useState(ficha.originales || []);
  const [partes, setPartes] = useState(() => {
    const map = {};
    (ficha.partes || []).forEach(p => { map[p.papel] = p; });
    return map;
  });

  const setOriginal = (tipo, estado) => {
    setOriginales(prev => {
      const found = prev.find(p => p.tipo === tipo);
      if (found) return prev.map(p => p.tipo === tipo ? { ...p, estado } : p);
      return [...prev, { tipo, estado }];
    });
  };

  const guardarOriginales = async () => {
    await api.put(`/api/gestor/archivo/obras/${o.id}/originales`,
      ['general', 'partes', 'arcos'].map(tipo => ({
        tipo, estado: (originales.find(x => x.tipo === tipo)?.estado || 'no'),
      }))
    );
    await onRecargar();
  };

  const setParte = (papel, key, value) => {
    setPartes(prev => ({
      ...prev,
      [papel]: { ...(prev[papel] || { papel }), [key]: value },
    }));
  };

  const guardarPartes = async () => {
    const list = Object.values(partes).map(p => ({
      papel: p.papel,
      copias_fisicas: parseInt(p.copias_fisicas || 0, 10),
      copia_digital: !!p.copia_digital,
      enlace_drive: p.enlace_drive || null,
      estado: p.estado || 'pendiente',
      notas: p.notas || null,
    }));
    await api.put(`/api/gestor/archivo/obras/${o.id}/partes`, list);
    await onRecargar();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="font-cabinet text-lg font-bold text-slate-900">{o.titulo}</h2>
            <p className="text-xs text-slate-500 font-mono">{o.codigo} · {o.autor}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onEtiquetas(o)} data-testid="btn-etiquetas-obra"
              className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded hover:bg-amber-600">🏷️ Etiquetas</button>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
          </div>
        </header>

        <div className="border-b border-slate-200 px-6 flex gap-1">
          {[['datos', 'Datos'], ['originales', 'Originales'], ['partes', 'Inventario partes'], ['historial', 'Préstamos / Eventos']].map(([id, lbl]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${tab === id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'}`}>
              {lbl}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'datos' && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Autor"      value={o.autor} />
              <Info label="Arreglista" value={o.arreglista} />
              <Info label="Co-autor"   value={o.co_autor} />
              <Info label="Título"     value={o.titulo} />
              <Info label="Movimiento" value={o.movimiento} />
              <Info label="Género"     value={o.genero} />
              <Info label="Subgénero"  value={o.subgenero} />
              <Info label="Procedencia" value={o.procedencia} />
              <Info label="Fecha registro" value={fmtDate(o.fecha_registro)} />
              <Info label="Estado"     value={o.estado} />
              <div className="col-span-2"><Info label="Observaciones" value={o.observaciones} /></div>
            </div>
          )}

          {tab === 'originales' && (
            <div>
              <p className="text-xs text-slate-500 mb-3">Estado de las copias originales (los toggles persisten al pulsar guardar).</p>
              <div className="space-y-2">
                {['general', 'partes', 'arcos'].map(tipo => {
                  const cur = originales.find(p => p.tipo === tipo)?.estado || 'no';
                  return (
                    <div key={tipo} className="flex items-center gap-3 border border-slate-200 rounded p-2">
                      <span className="font-medium text-sm capitalize w-24">{tipo}</span>
                      <div className="flex gap-1">
                        {[['si', 'Sí', 'bg-emerald-600'], ['no', 'No', 'bg-slate-500'], ['necesita_revision', 'Revisar', 'bg-amber-500']].map(([val, lbl, cls]) => (
                          <button key={val} type="button" onClick={() => setOriginal(tipo, val)}
                            className={`px-3 py-1 text-xs rounded ${cur === val ? `${cls} text-white` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            data-testid={`orig-${tipo}-${val}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={guardarOriginales} data-testid="btn-save-originales"
                className="mt-3 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700">Guardar originales</button>
            </div>
          )}

          {tab === 'partes' && (
            <div className="space-y-4">
              {Object.entries(PAPELES_POR_SECCION).map(([secKey, papeles]) => (
                <div key={secKey}>
                  <h3 className="text-xs uppercase font-bold text-slate-500 mb-1">{SECCIONES_LABEL[secKey]}</h3>
                  <table className="w-full text-xs border border-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1 text-left">Papel</th>
                        <th className="px-2 py-1">Copias físicas</th>
                        <th className="px-2 py-1">Digital</th>
                        <th className="px-2 py-1 text-left">Enlace Drive</th>
                        <th className="px-2 py-1">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {papeles.map(p => {
                        const v = partes[p] || {};
                        return (
                          <tr key={p} className="border-t border-slate-100">
                            <td className="px-2 py-1 font-medium">{PAPELES_ARCHIVO[p].label}</td>
                            <td className="px-2 py-1 text-center">
                              <input type="number" min="0" value={v.copias_fisicas || ''}
                                onChange={(e) => setParte(p, 'copias_fisicas', e.target.value)}
                                className="w-16 px-1 py-0.5 border border-slate-300 rounded text-center" />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <input type="checkbox" checked={!!v.copia_digital}
                                onChange={(e) => setParte(p, 'copia_digital', e.target.checked)} />
                            </td>
                            <td className="px-2 py-1">
                              <input type="text" value={v.enlace_drive || ''}
                                onChange={(e) => setParte(p, 'enlace_drive', e.target.value)}
                                placeholder="https://drive.google.com/..."
                                className="w-full px-1 py-0.5 border border-slate-300 rounded font-mono text-[11px]" />
                            </td>
                            <td className="px-2 py-1">
                              <select value={v.estado || 'pendiente'} onChange={(e) => setParte(p, 'estado', e.target.value)}
                                className={`px-1 py-0.5 rounded text-[10px] ${ESTADO_PARTE_BADGE[v.estado || 'pendiente']}`}>
                                <option value="pendiente">Pendiente</option>
                                <option value="completo">Completo</option>
                                <option value="incompleto">Incompleto</option>
                                <option value="necesita_revision">Necesita revisión</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
              <button type="button" onClick={guardarPartes} data-testid="btn-save-partes"
                className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700">Guardar partes</button>
            </div>
          )}

          {tab === 'historial' && (
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-500 mb-2">Préstamos</h3>
              {(ficha.prestamos || []).length === 0 ? (
                <p className="text-slate-400 text-sm mb-4">Sin préstamos.</p>
              ) : (
                <ul className="space-y-1 mb-4 text-xs">
                  {ficha.prestamos.map(p => (
                    <li key={p.id} className="border border-slate-200 rounded p-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.estado === 'activo' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{p.estado}</span>
                      {' '}<span className="font-medium">{p.tipo}</span> · salida {fmtDate(p.fecha_salida)} {p.entidad_externa && `· ${p.entidad_externa}`}
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="text-xs uppercase font-bold text-slate-500 mb-2">Eventos donde se ha programado</h3>
              {(ficha.eventos || []).length === 0 ? (
                <p className="text-slate-400 text-sm">Sin programar.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {ficha.eventos.map(e => (
                    <li key={e.id} className="border border-slate-200 rounded p-2">
                      <span className="font-medium">{e.evento?.nombre}</span> · {fmtDate(e.evento?.fecha_inicio)} ·
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${e.estado === 'confirmada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{e.estado}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
    <div className="text-sm text-slate-800">{value || '—'}</div>
  </div>
);

// =====================================================================
// FORMULARIO obra (creación)
// =====================================================================
function ObraFormModal({ onClose, onSave }) {
  const [form, setForm] = useState({ autor: '', titulo: '', genero: '', procedencia: '' });
  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-cabinet text-lg font-bold mb-3">+ Nueva obra</h2>
        <div className="space-y-2">
          <input className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Autor *"
            value={form.autor} onChange={(e) => upd('autor', e.target.value)} data-testid="form-obra-autor" />
          <input className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Título *"
            value={form.titulo} onChange={(e) => upd('titulo', e.target.value)} data-testid="form-obra-titulo" />
          <input className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Arreglista"
            value={form.arreglista || ''} onChange={(e) => upd('arreglista', e.target.value)} />
          <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            value={form.genero} onChange={(e) => upd('genero', e.target.value)}>
            <option value="">Género</option>
            {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            value={form.procedencia} onChange={(e) => upd('procedencia', e.target.value)}>
            <option value="">Procedencia</option>
            {PROCEDENCIAS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Subgénero"
            value={form.subgenero || ''} onChange={(e) => upd('subgenero', e.target.value)} />
          <textarea rows={2} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Observaciones"
            value={form.observaciones || ''} onChange={(e) => upd('observaciones', e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">Cancelar</button>
          <button type="button" onClick={() => onSave(form)} disabled={!form.autor || !form.titulo}
            data-testid="form-obra-submit"
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded disabled:opacity-50">Crear</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// IMPORTAR Excel
// =====================================================================
function ImportModal({ api, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const sendPreview = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const r = await api.post('/api/gestor/archivo/obras/importar?confirmar=false', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(r.data);
    } finally { setBusy(false); }
  };
  const sendConfirmar = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const r = await api.post('/api/gestor/archivo/obras/importar?confirmar=true', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert(`✅ Importadas: ${r.data?.importadas} · Ya existentes: ${r.data?.ya_existentes} · Errores: ${(r.data?.errores || []).length}`);
      onDone(); onClose();
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-cabinet text-lg font-bold mb-3">📥 Importar obras desde Excel</h2>
        <input ref={fileRef} type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0]); setPreview(null); }}
          className="mb-2 text-sm" data-testid="import-file" />
        {file && !preview && (
          <button type="button" onClick={sendPreview} disabled={busy}
            data-testid="import-preview-btn"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded">{busy ? '…' : 'Previsualizar'}</button>
        )}
        {preview && (
          <div className="mt-3">
            <p className="text-sm">Total a importar: <b>{preview.total}</b> · Errores: <b>{(preview.errores || []).length}</b> · Ya existen: <b>{preview.ya_existentes}</b></p>
            {(preview.errores || []).length > 0 && (
              <ul className="text-xs text-red-600 mt-2">
                {preview.errores.slice(0, 5).map((e, i) => <li key={i}>fila {e.fila}: {e.error}</li>)}
              </ul>
            )}
            {(preview.preview || []).length > 0 && (
              <table className="w-full text-xs mt-2 border border-slate-200">
                <thead className="bg-slate-50">
                  <tr><th className="px-2 py-1">Autor</th><th className="px-2 py-1">Título</th><th className="px-2 py-1">Género</th></tr>
                </thead>
                <tbody>
                  {preview.preview.map((p, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1">{p.autor}</td>
                      <td className="px-2 py-1">{p.titulo}</td>
                      <td className="px-2 py-1">{p.genero || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button type="button" onClick={sendConfirmar} disabled={busy}
              data-testid="import-confirm-btn"
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded">{busy ? '…' : 'Confirmar importación'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// PRÉSTAMOS
// =====================================================================
function PrestamosTab({ prestamos, api, obras, onNuevo, onCargar }) {
  const today = new Date();
  const enrich = useMemo(() => prestamos.map(p => {
    const fp = p.fecha_prevista_devolucion ? new Date(p.fecha_prevista_devolucion) : null;
    const dias = fp ? Math.floor((fp - today) / (24 * 3600 * 1000)) : null;
    let alerta = '';
    if (p.estado === 'activo' && dias !== null) {
      if (dias < 0) alerta = 'vencido';
      else if (dias <= 7) alerta = 'proximo';
    }
    return { ...p, _dias: dias, _alerta: alerta };
  }), [prestamos, today]);

  const registrarDevolucion = async (id) => {
    if (!window.confirm('¿Registrar devolución hoy?')) return;
    await api.put(`/api/gestor/archivo/prestamos/${id}`, {
      estado: 'devuelto',
      fecha_devolucion_real: new Date().toISOString().slice(0, 10),
    });
    await onCargar();
  };

  return (
    <div>
      <div className="flex justify-between mb-3">
        <p className="text-xs text-slate-500">Total: {prestamos.length}</p>
        <button type="button" onClick={onNuevo} data-testid="btn-nuevo-prestamo"
          className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700">+ Nuevo préstamo</button>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Obra</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Destinatario</th>
              <th className="px-3 py-2 text-left">Salida</th>
              <th className="px-3 py-2 text-left">Devolución prevista</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {enrich.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Sin préstamos.</td></tr>}
            {enrich.map(p => (
              <tr key={p.id} className={p._alerta === 'vencido' ? 'bg-red-50' : p._alerta === 'proximo' ? 'bg-amber-50' : ''}>
                <td className="px-3 py-2">{p.obra?.codigo || '—'} · <span className="font-medium">{p.obra?.titulo}</span></td>
                <td className="px-3 py-2 text-xs">{p.tipo}</td>
                <td className="px-3 py-2 text-xs">{p.tipo === 'externo' ? p.entidad_externa : (p.evento?.nombre || '—')}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(p.fecha_salida)}</td>
                <td className="px-3 py-2 text-xs">
                  {fmtDate(p.fecha_prevista_devolucion)}
                  {p._alerta === 'vencido' && <span className="ml-1 text-red-600 font-bold">⚠ vencido</span>}
                  {p._alerta === 'proximo' && <span className="ml-1 text-amber-600 font-bold">⚠ vence pronto</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 text-[10px] rounded ${p.estado === 'activo' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{p.estado}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {p.estado === 'activo' && (
                    <button type="button" onClick={() => registrarDevolucion(p.id)}
                      data-testid={`btn-devolver-${p.id}`}
                      className="text-xs text-emerald-600 hover:underline">Registrar devolución</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrestamoFormModal({ api, obras, onClose, onSave }) {
  const [form, setForm] = useState({ tipo: 'interno', fecha_salida: new Date().toISOString().slice(0, 10) });
  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const enviar = async () => {
    if (!form.obra_id || !form.fecha_salida) return alert('Obra y fecha de salida son obligatorios');
    await api.post('/api/gestor/archivo/prestamos', form);
    await onSave(); onClose();
  };
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-cabinet text-lg font-bold mb-3">+ Nuevo préstamo</h2>
        <div className="space-y-2">
          <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" value={form.obra_id || ''}
            onChange={(e) => upd('obra_id', e.target.value)} data-testid="prest-obra">
            <option value="">— Obra —</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.codigo || ''} {o.titulo}</option>)}
          </select>
          <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" value={form.tipo} onChange={(e) => upd('tipo', e.target.value)}>
            <option value="interno">Interno</option>
            <option value="externo">Externo</option>
          </select>
          {form.tipo === 'externo' && (
            <>
              <input className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Entidad externa"
                value={form.entidad_externa || ''} onChange={(e) => upd('entidad_externa', e.target.value)} />
              <input className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Contacto"
                value={form.contacto_externo || ''} onChange={(e) => upd('contacto_externo', e.target.value)} />
            </>
          )}
          <label className="text-xs text-slate-600">Fecha salida<input type="date" value={form.fecha_salida}
            onChange={(e) => upd('fecha_salida', e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" /></label>
          <label className="text-xs text-slate-600">Devolución prevista<input type="date" value={form.fecha_prevista_devolucion || ''}
            onChange={(e) => upd('fecha_prevista_devolucion', e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" /></label>
          <textarea rows={2} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Notas"
            value={form.notas || ''} onChange={(e) => upd('notas', e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">Cancelar</button>
          <button type="button" onClick={enviar} data-testid="prest-submit"
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded">Crear</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// PROGRAMA DE EVENTOS
// =====================================================================
function ProgramaTab({ api, obras, setEventoVerif }) {
  const [eventos, setEventos] = useState([]);
  const [programas, setProgramas] = useState({}); // {evento_id: [evento_obras]}

  useEffect(() => {
    (async () => {
      const r = await api.get('/api/gestor/eventos');
      const evs = (r.data?.eventos || []).filter(e => e.estado === 'abierto');
      setEventos(evs);
      const map = {};
      for (const e of evs) {
        try {
          const pr = await api.get(`/api/gestor/archivo/evento/${e.id}/programa`);
          map[e.id] = pr.data?.programa || [];
        } catch { map[e.id] = []; }
      }
      setProgramas(map);
    })();
  }, [api]);

  const verificar = async (eo, evento_id) => {
    if (!eo.obra_id) return alert('Esta obra es provisional, vincúlala primero al catálogo.');
    const r = await api.get(`/api/gestor/archivo/obras/${eo.obra_id}/atriles-evento/${evento_id}`);
    setEventoVerif({ obra: eo.obra, evento_id, resultado: r.data });
  };

  const vincular = async (eo, evento_id) => {
    const obraId = window.prompt('ID de la obra del catálogo a vincular (cópialo de la pestaña Catálogo):');
    if (!obraId) return;
    await api.post(`/api/gestor/archivo/evento/${evento_id}/obras`, {
      obra_id: obraId,
      estado: 'confirmada',
    });
    alert('Vinculada. Recarga la pestaña.');
  };

  return (
    <div>
      {eventos.length === 0 && <p className="text-slate-400">Sin eventos abiertos.</p>}
      {eventos.map(ev => (
        <div key={ev.id} className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
          <header className="bg-slate-50 px-4 py-2 flex justify-between items-center">
            <h3 className="font-medium text-slate-800">{ev.nombre}</h3>
            <span className="text-xs text-slate-500">{fmtDate(ev.fecha_inicio)}</span>
          </header>
          <div className="p-3">
            {(programas[ev.id] || []).length === 0 ? (
              <p className="text-xs text-slate-400">Sin obras programadas.</p>
            ) : (
              <ul className="space-y-1">
                {(programas[ev.id] || []).map(eo => (
                  <li key={eo.id} className="flex items-center justify-between text-sm border border-slate-100 rounded p-2">
                    <span>
                      {eo.obra ? (
                        <><span className="font-mono text-xs text-slate-400">{eo.obra.codigo}</span> · <b>{eo.obra.titulo}</b> · <span className="text-xs">{eo.obra.autor}</span></>
                      ) : (
                        <><i>{eo.titulo_provisional}</i> <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700">⚠ Pendiente registro archivo</span></>
                      )}
                    </span>
                    <span className="flex gap-1">
                      {!eo.obra_id && (
                        <button type="button" onClick={() => vincular(eo, ev.id)} className="text-xs text-blue-600 hover:underline">Vincular a catálogo</button>
                      )}
                      {eo.obra_id && (
                        <button type="button" onClick={() => verificar(eo, ev.id)}
                          data-testid={`btn-verificar-${eo.id}`}
                          className="text-xs text-emerald-600 hover:underline">Verificar atriles</button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function VerifAtrilesModal({ data, onClose }) {
  const r = data.resultado || {};
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-cabinet text-lg font-bold mb-1">Verificación de atriles</h2>
        <p className="text-xs text-slate-500 mb-3">{data.obra?.codigo} · {data.obra?.titulo}</p>
        {(r.alertas || []).length === 0 ? (
          <p className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">✅ Material suficiente para todos los papeles activos.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr><th className="px-2 py-1 text-left">Papel</th><th className="px-2 py-1">Necesarios</th><th className="px-2 py-1">Copias</th><th className="px-2 py-1">Déficit</th></tr>
            </thead>
            <tbody>
              {r.alertas.map(a => (
                <tr key={a.papel} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-medium">{a.label}</td>
                  <td className="px-2 py-1 text-center">{a.necesarios}</td>
                  <td className="px-2 py-1 text-center">{a.copias}</td>
                  <td className="px-2 py-1 text-center text-red-600 font-bold">{a.deficit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="text-right mt-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-100 text-sm rounded">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// ALERTAS
// =====================================================================
function AlertasTab({ alertas }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card title="🟡 Obras pendientes de registro" count={(alertas.obras_pendientes_registro || []).length} cls="border-amber-300 bg-amber-50">
        {(alertas.obras_pendientes_registro || []).map(o => (
          <li key={o.id} className="text-xs"><i>{o.titulo_provisional}</i> · {o.evento?.nombre}</li>
        ))}
      </Card>
      <Card title="🔴 Préstamos vencidos" count={(alertas.prestamos_vencidos || []).length} cls="border-red-300 bg-red-50">
        {(alertas.prestamos_vencidos || []).map(p => (
          <li key={p.id} className="text-xs">{p.obra?.titulo} · prevista {fmtDate(p.fecha_prevista_devolucion)}</li>
        ))}
      </Card>
      <Card title="🟠 Préstamos próximos (≤7d)" count={(alertas.prestamos_proximos || []).length} cls="border-orange-300 bg-orange-50">
        {(alertas.prestamos_proximos || []).map(p => (
          <li key={p.id} className="text-xs">{p.obra?.titulo} · {fmtDate(p.fecha_prevista_devolucion)}</li>
        ))}
      </Card>
      <Card title="🟡 Material incompleto" count={(alertas.partes_incompletas || []).length} cls="border-amber-300 bg-amber-50">
        {(alertas.partes_incompletas || []).map((p, i) => (
          <li key={i} className="text-xs">obra {p.obra_id?.slice(0, 8)} · {p.papel} · copias {p.copias_fisicas}</li>
        ))}
      </Card>
    </div>
  );
}

const Card = ({ title, count, cls, children }) => (
  <div className={`border ${cls || 'border-slate-200'} rounded-lg p-3`}>
    <h3 className="text-sm font-semibold mb-1">{title} <span className="ml-1 text-xs text-slate-500">({count})</span></h3>
    <ul className="space-y-0.5 mt-1">{children}</ul>
  </div>
);

// =====================================================================
// ETIQUETAS PDF
// =====================================================================
function EtiquetasModal({ api, obra, onClose }) {
  const [opts, setOpts] = useState({
    incluye_general: true, incluye_partes: false, incluye_arcos: false,
    incluye_documentacion: true, incluye_atriles: true,
    incluye_atril_coro: false, incluye_atril_cuerda: false,
    incluye_atril_viento: false, incluye_atril_percusion: false,
  });
  const upd = (k) => setOpts(prev => ({ ...prev, [k]: !prev[k] }));
  const generar = async () => {
    const res = await api.post(`/api/gestor/archivo/obras/${obra.id}/etiquetas`, opts, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url;
    a.download = `etiquetas_${(obra.codigo || 'obra').replace('/', '_')}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  };
  const opciones = [
    ['incluye_general', 'Copia original general'],
    ['incluye_partes', 'Copia original — todas las partes'],
    ['incluye_arcos', 'Copia original — arcos'],
    ['incluye_documentacion', 'Documentación de registro'],
    ['incluye_atriles', 'Copias de atril por papel'],
    ['incluye_atril_coro', 'Atril — Coro'],
    ['incluye_atril_cuerda', 'Atril — Cuerda'],
    ['incluye_atril_viento', 'Atril — Viento'],
    ['incluye_atril_percusion', 'Atril — Percusión'],
  ];
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-cabinet text-lg font-bold mb-1">🏷️ Generar etiquetas</h2>
        <p className="text-xs text-slate-500 mb-3">{obra.codigo} · {obra.titulo}</p>
        <div className="space-y-1.5">
          {opciones.map(([k, lbl]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!opts[k]} onChange={() => upd(k)} data-testid={`et-${k}`} />
              {lbl}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">Cancelar</button>
          <button type="button" onClick={generar} data-testid="et-submit"
            className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded hover:bg-amber-600">Generar PDF</button>
        </div>
      </div>
    </div>
  );
}
