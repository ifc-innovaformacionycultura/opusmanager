// Gestor: Base de datos de Músicos con búsqueda, filtros y export Excel
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const CrearMusicoModal = ({ isOpen, onClose, onCreated, api }) => {
  const [form, setForm] = useState({ nombre: '', apellidos: '', email: '', instrumento: '', telefono: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!form.nombre || !form.apellidos || !form.email) {
      setError('Nombre, apellidos y email son obligatorios');
      return;
    }
    try {
      setSaving(true);
      const res = await api.post('/api/gestor/musicos/crear', form);
      setResult(res.data);
      onCreated && onCreated();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm({ nombre: '', apellidos: '', email: '', instrumento: '', telefono: '' });
    setError(null);
    setResult(null);
    onClose();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="crear-musico-modal">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
          <h3 className="font-semibold text-lg">Crear nuevo músico</h3>
          <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded" data-testid="close-modal">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-4">
          {result ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-semibold text-green-900">✅ Músico creado correctamente</p>
                <p className="text-sm text-green-800 mt-1">{result.message}</p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <p className="text-sm font-semibold text-amber-900">
                  {result.email_enviado ? 'Credenciales enviadas por email' : 'Credenciales temporales (compartir manualmente)'}
                </p>
                <div>
                  <p className="text-xs text-amber-700 uppercase tracking-wide">Email</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="px-2 py-1 bg-white border border-amber-300 rounded text-sm flex-1" data-testid="result-email">{result.musico?.email}</code>
                    <button onClick={() => copyToClipboard(result.musico?.email)} className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded">Copiar</button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-amber-700 uppercase tracking-wide">Contraseña temporal</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="px-2 py-1 bg-white border border-amber-300 rounded text-sm font-mono flex-1" data-testid="result-password">{result.password_temporal}</code>
                    <button onClick={() => copyToClipboard(result.password_temporal)} className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded">Copiar</button>
                  </div>
                </div>
                {!result.email_enviado && result.email_error && (
                  <p className="text-xs text-amber-700">
                    ⚠ Email no enviado: {result.email_error}
                  </p>
                )}
              </div>

              <button
                onClick={handleClose}
                data-testid="close-result"
                className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nombre *</label>
                  <input type="text" required value={form.nombre} onChange={(e) => handleChange('nombre', e.target.value)}
                    data-testid="input-nombre"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Apellidos *</label>
                  <input type="text" required value={form.apellidos} onChange={(e) => handleChange('apellidos', e.target.value)}
                    data-testid="input-apellidos"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
                <input type="email" required value={form.email} onChange={(e) => handleChange('email', e.target.value)}
                  data-testid="input-email"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Instrumento</label>
                  <input type="text" value={form.instrumento} onChange={(e) => handleChange('instrumento', e.target.value)}
                    data-testid="input-instrumento"
                    placeholder="Ej: Violín, Piano..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono</label>
                  <input type="tel" value={form.telefono} onChange={(e) => handleChange('telefono', e.target.value)}
                    data-testid="input-telefono"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm" data-testid="modal-error">
                  {error}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-md font-medium hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  data-testid="submit-crear-musico"
                  className="flex-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium disabled:opacity-60">
                  {saving ? 'Creando...' : 'Crear músico'}
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Se enviará un email con las credenciales temporales. El músico deberá cambiar su contraseña en el primer acceso.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const ImportarMusicosModal = ({ isOpen, onClose, onImported, api }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const reset = () => {
    setFile(null); setPreview(null); setError(null); setResult(null); setLoading(false);
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null); setPreview(null); setResult(null);
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append('archivo', f);
      const r = await api.post('/api/gestor/musicos-import/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  const confirmar = async () => {
    if (!file) return;
    try {
      setLoading(true); setError(null);
      const fd = new FormData();
      fd.append('archivo', file);
      const r = await api.post('/api/gestor/musicos-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(r.data);
      onImported && onImported();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally { setLoading(false); }
  };

  const descargarInforme = () => {
    if (!result) return;
    const lines = [];
    lines.push('tipo,fila,email,motivo');
    (result.creados || []).forEach(x => lines.push(`creado,${x.fila},${x.email},`));
    (result.existentes || []).forEach(x => lines.push(`ya_existente,${x.fila},${x.email},`));
    (result.errores || []).forEach(x => lines.push(`error,${x.fila},${x.email || ''},"${(x.motivo || '').replace(/"/g,'""')}"`));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_importacion_musicos_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const cerrar = () => { reset(); onClose(); };

  const headersPreview = preview && preview.preview?.length ? Object.keys(preview.preview[0]) : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="importar-musicos-modal">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
          <h3 className="font-semibold text-lg">Importar músicos desde Excel/CSV</h3>
          <button onClick={cerrar} className="p-1 hover:bg-slate-100 rounded" data-testid="close-importar-modal">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!result && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Selecciona un archivo <code>.xlsx</code> o <code>.csv</code>
                </label>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFile}
                  data-testid="input-archivo-importar"
                  className="block w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Columnas requeridas: <strong>nombre, apellidos, email</strong>. Si no tienes plantilla,
                  ciérralo y pulsa <em>Descargar plantilla Excel</em>.
                </p>
              </div>

              {loading && <div className="text-sm text-slate-500">Procesando archivo...</div>}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm" data-testid="importar-error">{error}</div>
              )}

              {preview && (
                <div className="space-y-3" data-testid="importar-preview">
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm">
                    <span>Total filas detectadas: <strong>{preview.total_filas}</strong></span>
                    {preview.missing_required_headers?.length > 0 && (
                      <span className="text-red-700">
                        ⚠ Faltan columnas: {preview.missing_required_headers.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100">
                        <tr>
                          {headersPreview.map(h => (
                            <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-700 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((r, idx) => (
                          <tr key={idx} className="border-t border-slate-100">
                            {headersPreview.map(h => (
                              <td key={h} className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{String(r[h] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={cerrar} className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-md text-sm">Cancelar</button>
                    <button
                      onClick={confirmar}
                      disabled={loading || preview.missing_required_headers?.length > 0}
                      data-testid="btn-confirmar-importar"
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium disabled:opacity-60"
                    >
                      {loading ? 'Importando...' : `Confirmar importación de ${preview.total_filas} filas`}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-4" data-testid="importar-resultado">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-semibold text-green-900">✅ Importación completada</p>
                <p className="text-sm text-green-800 mt-1">
                  <strong>{result.resumen.creados}</strong> músicos importados,{' '}
                  <strong>{result.resumen.ya_existentes}</strong> ya existían,{' '}
                  <strong>{result.resumen.errores}</strong> errores.
                </p>
              </div>
              {(result.errores?.length || 0) > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs space-y-1 max-h-40 overflow-auto">
                  <p className="font-semibold text-red-900">Errores:</p>
                  {result.errores.map((e, idx) => (
                    <p key={idx} className="text-red-800">· Fila {e.fila} ({e.email}): {e.motivo}</p>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={descargarInforme} data-testid="btn-descargar-informe"
                  className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-md text-sm font-medium">
                  Descargar informe (CSV)
                </button>
                <button onClick={cerrar} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium">
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const GestorMusicos = () => {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [musicos, setMusicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [instrumentoFiltro, setInstrumentoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [instrumentos, setInstrumentos] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const cargarMusicos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (search.trim()) params.q = search.trim();
      if (instrumentoFiltro) params.instrumento = instrumentoFiltro;
      if (estadoFiltro) params.estado = estadoFiltro;

      const res = await api.get('/api/gestor/musicos', { params });
      setMusicos(res.data?.musicos || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, [api, search, instrumentoFiltro, estadoFiltro]);

  const cargarInstrumentos = useCallback(async () => {
    try {
      const res = await api.get('/api/gestor/instrumentos');
      setInstrumentos(res.data?.instrumentos || []);
    } catch (err) {
      console.error('Error instrumentos:', err);
    }
  }, [api]);

  useEffect(() => {
    cargarInstrumentos();
  }, [cargarInstrumentos]);

  // Debounce de 300ms para búsqueda
  useEffect(() => {
    const t = setTimeout(cargarMusicos, 300);
    return () => clearTimeout(t);
  }, [cargarMusicos]);

  const limpiarFiltros = () => {
    setSearch('');
    setInstrumentoFiltro('');
    setEstadoFiltro('');
  };

  const exportarExcel = async () => {
    try {
      setExporting(true);
      const res = await api.get('/api/gestor/export/xlsx', { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      link.download = match ? match[1] : `opus_manager_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error al exportar: ${err.response?.data?.detail || err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const descargarPlantilla = async () => {
    try {
      const res = await api.get('/api/gestor/musicos-import/plantilla', { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla_musicos.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error al descargar plantilla: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <div className="p-6" data-testid="gestor-musicos-page">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Base de datos de músicos</h1>
          <p className="font-ibm text-slate-600 mt-1">
            Búsqueda y gestión del directorio de músicos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={descargarPlantilla}
            data-testid="btn-descargar-plantilla"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Descargar plantilla
          </button>
          <button
            onClick={() => setImportOpen(true)}
            data-testid="btn-importar-musicos"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importar músicos
          </button>
          <button
            onClick={() => setModalOpen(true)}
            data-testid="btn-crear-musico"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Crear músico
          </button>
          <button
            onClick={exportarExcel}
            disabled={exporting}
            data-testid="btn-exportar-excel"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium shadow-sm disabled:opacity-60"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                  <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Exportar a Excel
              </>
            )}
          </button>
        </div>
      </header>

      <CrearMusicoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => cargarMusicos()}
        api={api}
      />

      <ImportarMusicosModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => cargarMusicos()}
        api={api}
      />

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="musicos-search"
              placeholder="Nombre, apellidos o email..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Instrumento</label>
            <select
              value={instrumentoFiltro}
              onChange={(e) => setInstrumentoFiltro(e.target.value)}
              data-testid="musicos-filter-instrumento"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="">Todos</option>
              {instrumentos.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              data-testid="musicos-filter-estado"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
        </div>
        {(search || instrumentoFiltro || estadoFiltro) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={limpiarFiltros}
              data-testid="musicos-clear-filters"
              className="text-xs text-slate-600 hover:text-slate-900 underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="musicos-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs uppercase text-slate-600 font-semibold">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Instrumento</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fecha alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Cargando...</td></tr>
              ) : musicos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500" data-testid="musicos-empty">
                    No se encontraron músicos con los criterios actuales
                  </td>
                </tr>
              ) : (
                musicos.map(m => {
                  const recientemente = m.ultima_actualizacion_perfil &&
                    (new Date() - new Date(m.ultima_actualizacion_perfil)) < 24 * 60 * 60 * 1000;
                  return (
                  <tr key={m.id}
                    onClick={() => navigate(`/admin/musicos/${m.id}`)}
                    className="hover:bg-slate-50 cursor-pointer" data-testid={`musico-row-${m.id}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {m.nombre} {m.apellidos}
                        {recientemente && <span className="inline-flex px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-medium" data-testid={`badge-actualizado-${m.id}`}>Actualizado</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{m.email}</td>
                    <td className="px-4 py-3 text-slate-700">{m.instrumento || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{m.telefono || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.estado === 'activo'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {m.estado || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {m.fecha_alta ? new Date(m.fecha_alta).toLocaleDateString('es-ES') : (m.created_at ? new Date(m.created_at).toLocaleDateString('es-ES') : '—')}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-600 bg-slate-50">
          Total: <span className="font-semibold text-slate-900" data-testid="musicos-total">{musicos.length}</span> {musicos.length === 1 ? 'músico' : 'músicos'}
        </div>
      </div>
    </div>
  );
};

export default GestorMusicos;
