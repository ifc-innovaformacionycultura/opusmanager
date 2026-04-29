import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";

const AssetPicker = ({ open, onClose, tipo = "imagen", onSelect }) => {
  const { api } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef();

  useEffect(() => {
    if (!open) return;
    setError("");
    setLoading(true);
    api.get(`/api/comunicaciones/assets?tipo=${tipo}`)
      .then((r) => setAssets(r.data?.assets || []))
      .catch((e) => setError(e?.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  }, [open, tipo, api]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tipo", tipo);
      const r = await api.post("/api/comunicaciones/assets/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const a = r.data?.asset;
      if (a) {
        setAssets((prev) => [a, ...prev]);
        onSelect(a.url);
        onClose();
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleExternal = async () => {
    const url = window.prompt("Pega la URL pública del " + tipo + ":");
    if (!url) return;
    try {
      const r = await api.post("/api/comunicaciones/assets/external", { url, tipo });
      const a = r.data?.asset;
      if (a) {
        setAssets((prev) => [a, ...prev]);
        onSelect(a.url);
        onClose();
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-6" data-testid="asset-picker-modal">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Seleccionar {tipo}</h3>
          <div className="flex items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept={tipo === "font" ? ".woff,.woff2,.ttf,.otf" : "image/*"}
              onChange={(e) => handleUpload(e.target.files?.[0])}
              data-testid="asset-file-input"
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              data-testid="btn-upload-asset"
            >{uploading ? "Subiendo…" : "⬆ Subir archivo"}</button>
            <button
              onClick={handleExternal}
              className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
              data-testid="btn-external-asset"
            >🔗 URL externa</button>
            <button
              onClick={onClose}
              className="text-xs px-2 py-1.5 rounded text-slate-500 hover:bg-slate-100"
              data-testid="btn-close-picker"
            >✕</button>
          </div>
        </div>
        {error && <div className="px-5 py-2 text-xs text-rose-600 bg-rose-50 border-b border-rose-200">{error}</div>}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="text-sm text-slate-500">Cargando…</div>}
          {!loading && assets.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-10">
              No hay {tipo}s subidos. Sube uno o registra una URL externa.
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {assets.map((a) => (
              <button
                key={a.id}
                onClick={() => { onSelect(a.url); onClose(); }}
                className="border border-slate-200 rounded-md overflow-hidden hover:ring-2 hover:ring-amber-400 group text-left"
                data-testid={`asset-card-${a.id}`}
              >
                {tipo === "font" ? (
                  <div className="h-24 flex items-center justify-center bg-slate-50 text-2xl">𝐀𝐚</div>
                ) : (
                  <div className="h-24 bg-slate-100 flex items-center justify-center overflow-hidden">
                    <img src={a.url} alt={a.filename || ""} className="max-h-full max-w-full object-contain" />
                  </div>
                )}
                <div className="px-2 py-1.5 text-[11px] text-slate-600 truncate" title={a.filename}>
                  {a.filename || a.url.split('/').pop()}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetPicker;
