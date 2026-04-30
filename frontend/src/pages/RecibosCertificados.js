import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

const fmtMoney = (n) => (parseFloat(n || 0)).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const fmtDate = (s) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("es-ES"); } catch { return s; }
};

// ===== Modal de edición manual ===============================================
const EditarDocumentoModal = ({ open, doc, tipo, onClose, onSaved }) => {
  const { api } = useAuth();
  const [vars, setVars] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && doc) setVars({ ...(doc.variables || {}) });
  }, [open, doc]);

  if (!open || !doc) return null;

  const camposClave = tipo === "certificado"
    ? ["nombre", "apellidos", "dni", "instrumento", "evento", "lugar", "fecha_evento", "horas_totales", "numero_certificado", "fecha_emision"]
    : ["nombre", "apellidos", "dni", "iban", "concepto", "fecha_pago", "importe_bruto", "irpf_porcentaje", "irpf_importe", "importe_neto", "numero_recibo"];

  const guardar = async () => {
    setSaving(true); setError("");
    try {
      const url = `/api/gestor/documentos/${tipo === "certificado" ? "certificados" : "recibos"}/${doc.id}`;
      const r = await api.put(url, { variables: vars });
      if (r.data?.ok) {
        onSaved && onSaved(r.data.pdf_url);
        onClose();
      } else {
        setError("Error al guardar");
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" data-testid="edit-doc-modal">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">
            Editar manualmente — {tipo === "certificado" ? "Certificado" : "Recibo"} {doc.numero}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        {error && <div className="px-5 py-2 text-xs text-rose-600 bg-rose-50">{error}</div>}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {camposClave.map((k) => (
            <div key={k} className={["concepto"].includes(k) ? "sm:col-span-2" : ""}>
              <label className="block text-[11px] uppercase text-slate-500 mb-0.5">{k.replace(/_/g, " ")}</label>
              <input value={vars[k] || ""} onChange={(e) => setVars((p) => ({ ...p, [k]: e.target.value }))}
                     className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                     data-testid={`edit-field-${k}`}/>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">Al guardar se re-renderiza el PDF y se marca como modificado manualmente.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50">Cancelar</button>
            <button onClick={guardar} disabled={saving}
                    className="px-4 py-1.5 text-sm rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                    data-testid="btn-save-edit">
              {saving ? "Guardando…" : "💾 Guardar y re-renderizar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Tabla genérica ========================================================
const DocTable = ({ tipo, items, selectedIds, onToggleSelect, onSelectAll, onRegenerar, onEditar, onTogglePublicar, regenerating }) => {
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
          <tr>
            <th className="px-3 py-2 w-8 text-left">
              <input type="checkbox" checked={allChecked} onChange={(e) => onSelectAll(e.target.checked)}
                     data-testid={`chk-all-${tipo}`}/>
            </th>
            <th className="px-3 py-2 text-left">Nº</th>
            <th className="px-3 py-2 text-left">Músico</th>
            <th className="px-3 py-2 text-left">Evento</th>
            <th className="px-3 py-2 text-left">Temporada</th>
            {tipo === "certificados"
              ? <th className="px-3 py-2 text-right">Horas</th>
              : <><th className="px-3 py-2 text-right">Bruto</th><th className="px-3 py-2 text-right">Neto</th><th className="px-3 py-2 text-left">Fecha pago</th></>
            }
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 && (
            <tr><td colSpan="9" className="px-3 py-10 text-center text-slate-400">
              No hay {tipo} en esta vista.
            </td></tr>
          )}
          {items.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50" data-testid={`row-${tipo}-${d.id}`}>
              <td className="px-3 py-2">
                <input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => onToggleSelect(d.id)}
                       data-testid={`chk-${tipo}-${d.id}`}/>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{d.numero || "—"}</td>
              <td className="px-3 py-2">
                <div className="font-medium">{d.usuario?.apellidos}, {d.usuario?.nombre}</div>
                <div className="text-[11px] text-slate-500">{d.usuario?.instrumento || "—"}</div>
              </td>
              <td className="px-3 py-2">
                <div className="font-medium">{d.evento?.nombre || "—"}</div>
                <div className="text-[11px] text-slate-500">{fmtDate(d.evento?.fecha_inicio)}</div>
              </td>
              <td className="px-3 py-2 text-slate-700">{d.temporada || "—"}</td>
              {tipo === "certificados" ? (
                <td className="px-3 py-2 text-right font-medium">{d.horas_totales || 0} h</td>
              ) : (
                <>
                  <td className="px-3 py-2 text-right">{fmtMoney(d.importe_bruto)}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmtMoney(d.importe_neto)}</td>
                  <td className="px-3 py-2">{fmtDate(d.fecha_pago)}</td>
                </>
              )}
              <td className="px-3 py-2">
                <div className="flex flex-col gap-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${d.publicado ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {d.publicado ? "✓ Publicado" : "⊘ Oculto"}
                  </span>
                  {d.modificado_manual && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">✎ Editado</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1.5 flex-wrap">
                  {d.pdf_url && (
                    <a href={d.pdf_url} target="_blank" rel="noreferrer"
                       className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                       data-testid={`btn-ver-${d.id}`}>👁️</a>
                  )}
                  <button onClick={() => onEditar(d)}
                          className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                          data-testid={`btn-editar-${d.id}`}>✎</button>
                  <button onClick={() => onRegenerar(d)} disabled={regenerating === d.id}
                          className="text-[11px] px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          data-testid={`btn-regenerar-${d.id}`}>
                    {regenerating === d.id ? "⏳" : "↻"}
                  </button>
                  <button onClick={() => onTogglePublicar(d)}
                          className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                          data-testid={`btn-togglepub-${d.id}`}>
                    {d.publicado ? "🚫" : "📤"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ===== Página principal ======================================================
const RecibosCertificados = () => {
  const { api } = useAuth();
  const [tab, setTab] = useState("recibos");  // 'recibos' | 'certificados'
  const [recibos, setRecibos] = useState([]);
  const [certificados, setCertificados] = useState([]);
  const [temporada, setTemporada] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRecibos, setSelectedRecibos] = useState([]);
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [editTarget, setEditTarget] = useState(null);  // {doc, tipo}
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [generandoEvento, setGenerandoEvento] = useState(false);

  // Eventos finalizados/cerrados para el botón "Generar certificados"
  const [eventos, setEventos] = useState([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = temporada ? `?temporada=${encodeURIComponent(temporada)}` : "";
      const [r1, r2, r3] = await Promise.allSettled([
        api.get(`/api/gestor/documentos/recibos${params}`),
        api.get(`/api/gestor/documentos/certificados${params}`),
        api.get(`/api/gestor/eventos${temporada ? `?temporada=${encodeURIComponent(temporada)}` : ""}`),
      ]);
      if (r1.status === "fulfilled") setRecibos(r1.value.data?.recibos || []);
      if (r2.status === "fulfilled") setCertificados(r2.value.data?.certificados || []);
      if (r3.status === "fulfilled") {
        const d = r3.value.data;
        setEventos(Array.isArray(d) ? d : (d?.eventos || []));
      }
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  }, [api, temporada]);

  useEffect(() => { cargar(); }, [cargar]);

  const temporadas = useMemo(() => {
    const s = new Set();
    recibos.forEach(r => r.temporada && s.add(r.temporada));
    certificados.forEach(c => c.temporada && s.add(c.temporada));
    eventos.forEach(e => e.temporada && s.add(e.temporada));
    return Array.from(s).sort();
  }, [recibos, certificados, eventos]);

  const eventosFinalizados = useMemo(
    () => (eventos || []).filter(e => ["finalizado", "cerrado", "en_curso"].includes(e.estado)),
    [eventos]
  );

  // ===== Acciones =====
  const regenerar = async (doc) => {
    const tipo = tab === "recibos" ? "recibos" : "certificados";
    setRegeneratingId(doc.id);
    try {
      await api.post(`/api/gestor/documentos/${tipo}/regenerar/${doc.id}`);
      setFeedback({ tipo: "ok", msg: "Documento regenerado" });
      await cargar();
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally { setRegeneratingId(null); }
  };

  const togglePublicar = async (doc) => {
    const tipo = tab === "recibos" ? "recibos" : "certificados";
    try {
      await api.put(`/api/gestor/documentos/${tipo}/${doc.id}/publicar`, { publicado: !doc.publicado });
      await cargar();
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };

  const generarCertificadosEvento = async (eventoId) => {
    if (!eventoId) return;
    setGenerandoEvento(true);
    try {
      const r = await api.post(`/api/gestor/documentos/certificados/generar-evento/${eventoId}`);
      setFeedback({ tipo: "ok", msg: `Generación: ${r.data.creados} creados · ${r.data.omitidos} omitidos · ${r.data.errores} errores` });
      await cargar();
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally { setGenerandoEvento(false); }
  };

  const descargarBulk = async (formato) => {
    const tipo = tab === "recibos" ? "recibos" : "certificados";
    const ids = tab === "recibos" ? selectedRecibos : selectedCerts;
    if (ids.length === 0) {
      setFeedback({ tipo: "err", msg: "Selecciona al menos un documento" });
      return;
    }
    try {
      const r = await api.post(`/api/gestor/documentos/${tipo}/descargar`, { ids, formato }, { responseType: "blob" });
      const blob = new Blob([r.data], { type: r.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo}_${new Date().toISOString().slice(0,10)}.${formato === "pdf" ? "pdf" : "zip"}`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback({ tipo: "ok", msg: `Descarga iniciada (${ids.length} documentos)` });
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };

  const items = tab === "recibos" ? recibos : certificados;
  const selectedIds = tab === "recibos" ? selectedRecibos : selectedCerts;
  const setSelected = tab === "recibos" ? setSelectedRecibos : setSelectedCerts;

  return (
    <div className="p-6 space-y-4" data-testid="recibos-certificados-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Recibos y Certificados</h1>
          <p className="text-sm text-slate-600 mt-1">
            Gestiona los documentos generados automáticamente: regenera, edita o descarga en lote.
          </p>
        </div>
        {feedback && (
          <span className={`text-xs px-3 py-1.5 rounded ${feedback.tipo === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                data-testid="feedback-msg">
            {feedback.msg}
          </span>
        )}
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6 -mb-px">
          {[
            { id: "recibos", label: `💰 Recibos (${recibos.length})` },
            { id: "certificados", label: `📜 Certificados (${certificados.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    data-testid={`tab-${t.id}`}
                    className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                      tab === t.id ? "border-amber-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">Temporada:</label>
          <select value={temporada} onChange={(e) => setTemporada(e.target.value)}
                  className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
                  data-testid="select-temporada">
            <option value="">Todas</option>
            {temporadas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {tab === "certificados" && (
          <div className="flex items-center gap-2 ml-2 border-l border-slate-200 pl-3">
            <label className="text-xs text-slate-600">Generar para evento:</label>
            <select onChange={(e) => generarCertificadosEvento(e.target.value)} value=""
                    disabled={generandoEvento}
                    className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
                    data-testid="select-generar-evento">
              <option value="">— Selecciona —</option>
              {eventosFinalizados.map(e => (
                <option key={e.id} value={e.id}>{e.nombre} ({e.estado})</option>
              ))}
            </select>
            {generandoEvento && <span className="text-xs text-slate-500">⏳</span>}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{selectedIds.length} seleccionado(s)</span>
          <button onClick={() => descargarBulk("zip")} disabled={selectedIds.length === 0}
                  className="text-xs px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                  data-testid="btn-download-zip">
            📦 Descargar ZIP
          </button>
          <button onClick={() => descargarBulk("pdf")} disabled={selectedIds.length === 0}
                  className="text-xs px-3 py-1.5 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                  data-testid="btn-download-pdf">
            📄 PDF combinado
          </button>
          <button onClick={cargar}
                  className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
                  data-testid="btn-refresh">
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="py-10 text-center text-slate-500">Cargando…</div>
      ) : (
        <DocTable
          tipo={tab}
          items={items}
          selectedIds={selectedIds}
          onToggleSelect={(id) => setSelected((p) => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          onSelectAll={(checked) => setSelected(checked ? items.map(i => i.id) : [])}
          onRegenerar={regenerar}
          onEditar={(d) => setEditTarget({ doc: d, tipo: tab === "recibos" ? "recibo" : "certificado" })}
          onTogglePublicar={togglePublicar}
          regenerating={regeneratingId}
        />
      )}

      <EditarDocumentoModal
        open={!!editTarget}
        doc={editTarget?.doc}
        tipo={editTarget?.tipo}
        onClose={() => setEditTarget(null)}
        onSaved={() => cargar()}
      />
    </div>
  );
};

export default RecibosCertificados;
