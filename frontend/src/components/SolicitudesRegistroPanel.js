// Bloque 1B — Panel de solicitudes de auto-registro (modal)
import React, { useEffect, useState, useCallback } from "react";
import { ClipboardList, CheckCircle2, XCircle, Eye, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const fmtDT = (s) => s ? new Date(s).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—";

const EstadoBadge = ({ estado }) => {
  const cfg = {
    pendiente: { label: "🟡 Pendiente", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    aprobado: { label: "✅ Aprobado", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    rechazado: { label: "❌ Rechazado", cls: "bg-rose-100 text-rose-800 border-rose-200" },
  }[estado] || { label: estado, cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return <span className={`text-[11px] px-2 py-0.5 rounded border ${cfg.cls}`}>{cfg.label}</span>;
};

const RechazoModal = ({ solicitud, onClose, onConfirm }) => {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" data-testid="rechazo-modal">
      <div className="bg-white rounded-lg max-w-md w-full p-5">
        <h3 className="font-bold text-slate-900 mb-1">Rechazar solicitud</h3>
        <p className="text-sm text-slate-600 mb-3">{solicitud.nombre} {solicitud.apellidos} — {solicitud.email}</p>
        <label className="block text-xs font-medium text-slate-700 mb-1">Motivo del rechazo *</label>
        <textarea rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  data-testid="motivo-rechazo"
                  className="w-full border border-slate-300 rounded p-2 text-sm" placeholder="Explica al músico por qué no es aprobada su solicitud…"/>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded">Cancelar</button>
          <button onClick={async () => { setLoading(true); await onConfirm(motivo); setLoading(false); }}
                  disabled={!motivo.trim() || loading}
                  data-testid="btn-confirmar-rechazo"
                  className="px-3 py-1.5 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded disabled:opacity-50">
            {loading ? "Rechazando…" : "Rechazar"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SolicitudesRegistroPanel = ({ open, onClose, api, onChange }) => {
  const navigate = useNavigate();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [rechazando, setRechazando] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/gestor/solicitudes-registro");
      setSolicitudes(r.data?.solicitudes || []);
    } catch (e) { setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message }); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { if (open) cargar(); }, [open, cargar]);

  const aprobar = async (s) => {
    if (!window.confirm(`¿Aprobar solicitud de ${s.nombre} ${s.apellidos}? Se creará el usuario y se le enviará un email.`)) return;
    setBusy(s.id);
    try {
      await api.post(`/api/gestor/solicitudes-registro/${s.id}/aprobar`);
      setFeedback({ tipo: "ok", msg: "Solicitud aprobada y usuario creado." });
      await cargar();
      if (onChange) onChange();
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally { setBusy(null); }
  };

  const rechazar = async (motivo) => {
    if (!rechazando) return;
    try {
      await api.post(`/api/gestor/solicitudes-registro/${rechazando.id}/rechazar`, { motivo });
      setFeedback({ tipo: "ok", msg: "Solicitud rechazada." });
      setRechazando(null);
      await cargar();
      if (onChange) onChange();
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start md:items-center justify-center p-2 md:p-6 overflow-y-auto" data-testid="solicitudes-modal">
      <div className="bg-white rounded-lg max-w-5xl w-full p-5 my-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg text-slate-900 inline-flex items-center gap-2">
            <ClipboardList className="w-5 h-5"/> Solicitudes de registro ({solicitudes.length})
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 text-xl">×</button>
        </div>
        {feedback && (
          <div className={`mb-2 text-sm px-3 py-1.5 rounded ${feedback.tipo === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
            {feedback.msg}
          </div>
        )}
        {loading ? <div className="text-sm text-slate-500">Cargando…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="text-left px-2 py-2">Fecha</th>
                  <th className="text-left px-2 py-2">Nombre</th>
                  <th className="text-left px-2 py-2">Email</th>
                  <th className="text-left px-2 py-2">Instrumento</th>
                  <th className="text-left px-2 py-2">Tel</th>
                  <th className="text-left px-2 py-2">Mensaje</th>
                  <th className="text-left px-2 py-2">Estado</th>
                  <th className="text-right px-2 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {solicitudes.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-6 text-slate-500 italic">Sin solicitudes.</td></tr>
                )}
                {solicitudes.map((s) => (
                  <tr key={s.id} data-testid={`sol-row-${s.id}`}>
                    <td className="px-2 py-2 text-xs text-slate-600">{fmtDT(s.created_at)}</td>
                    <td className="px-2 py-2 font-medium">{s.nombre} {s.apellidos}</td>
                    <td className="px-2 py-2 text-xs text-slate-600">{s.email}</td>
                    <td className="px-2 py-2">{s.instrumento}</td>
                    <td className="px-2 py-2 text-xs">{s.telefono || "—"}</td>
                    <td className="px-2 py-2 text-xs max-w-[220px] truncate" title={s.mensaje}>{s.mensaje || "—"}</td>
                    <td className="px-2 py-2"><EstadoBadge estado={s.estado}/></td>
                    <td className="px-2 py-2 text-right">
                      {s.estado === "pendiente" && (
                        <div className="inline-flex gap-1">
                          <button onClick={() => aprobar(s)} disabled={busy === s.id}
                                  data-testid={`btn-aprobar-${s.id}`}
                                  className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded inline-flex items-center gap-1 disabled:opacity-50">
                            <CheckCircle2 className="w-3 h-3"/> Aprobar
                          </button>
                          <button onClick={() => setRechazando(s)}
                                  data-testid={`btn-rechazar-${s.id}`}
                                  className="px-2 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3"/> Rechazar
                          </button>
                        </div>
                      )}
                      {s.estado === "aprobado" && s.usuario_id && (
                        <button onClick={() => navigate(`/admin/musicos/${s.usuario_id}`)}
                                data-testid={`btn-ver-${s.id}`}
                                className="px-2 py-1 text-xs border border-slate-300 hover:bg-slate-50 rounded inline-flex items-center gap-1">
                          <Eye className="w-3 h-3"/> Ver perfil
                        </button>
                      )}
                      {s.estado === "rechazado" && s.motivo_rechazo && (
                        <span className="text-[10px] text-slate-500" title={s.motivo_rechazo}>Motivo: {s.motivo_rechazo.slice(0, 40)}…</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {rechazando && (
        <RechazoModal solicitud={rechazando} onClose={() => setRechazando(null)} onConfirm={rechazar}/>
      )}
    </div>
  );
};

export default SolicitudesRegistroPanel;
