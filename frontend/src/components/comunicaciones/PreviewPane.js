import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { VARIABLES_DISPONIBLES } from "./blockCatalog";

const PreviewPane = ({ plantillaId, dirty, autoRefreshKey }) => {
  const { api } = useAuth();
  const [html, setHtml] = useState("");
  const [variables, setVariables] = useState(() => {
    const init = {};
    VARIABLES_DISPONIBLES.forEach((v) => { init[v.key] = ""; });
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const iframeRef = useRef();

  const refresh = async () => {
    if (!plantillaId) return;
    setLoading(true);
    setError("");
    try {
      // Solo enviar overrides no vacíos
      const overrides = {};
      Object.entries(variables).forEach(([k, v]) => { if (v) overrides[k] = v; });
      const r = await api.post(`/api/comunicaciones/plantillas/${plantillaId}/preview`, {
        variables: overrides,
      });
      setHtml(r.data?.html || "");
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  // Refresh automático cuando cambia plantilla o se guarda
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [plantillaId, autoRefreshKey]);

  // Inyectar HTML en iframe
  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html || "<p style='font-family:sans-serif;color:#94a3b8;padding:24px'>Sin contenido. Añade bloques y guarda.</p>");
      doc.close();
    }
  }, [html]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg flex flex-col h-full" data-testid="preview-pane">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Vista previa</span>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[10px] text-amber-600">⚠ Cambios sin guardar</span>}
          {loading && <span className="text-[10px] text-slate-400">⏳</span>}
          <button onClick={refresh} disabled={!plantillaId}
                  className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  data-testid="btn-refresh-preview">↻ Refrescar</button>
        </div>
      </div>

      <details className="px-3 py-2 border-b border-slate-100 bg-slate-50">
        <summary className="text-[11px] cursor-pointer text-slate-600 hover:text-slate-900">
          🧪 Variables de prueba ({Object.values(variables).filter(Boolean).length})
        </summary>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VARIABLES_DISPONIBLES.map((v) => (
            <div key={v.key}>
              <label className="block text-[10px] text-slate-500">{v.key}</label>
              <input value={variables[v.key]} onChange={(e) => setVariables((p) => ({ ...p, [v.key]: e.target.value }))}
                     onBlur={refresh}
                     placeholder={v.desc}
                     className="w-full px-2 py-1 border border-slate-200 rounded text-xs"/>
            </div>
          ))}
        </div>
      </details>

      {error && (
        <div className="px-3 py-2 text-xs text-rose-700 bg-rose-50 border-b border-rose-200">{error}</div>
      )}

      <div className="flex-1 bg-slate-100 overflow-hidden">
        {!plantillaId ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500 p-6 text-center">
            Crea o selecciona una plantilla para ver la vista previa.
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title="preview-email"
            className="w-full h-full border-0"
            sandbox="allow-same-origin"
            data-testid="preview-iframe"
          />
        )}
      </div>
    </div>
  );
};

export default PreviewPane;
