import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

const fmtFecha = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const hoy = new Date();
    const same = d.toDateString() === hoy.toDateString();
    return same
      ? d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
};

const IconStar = ({ filled }) => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill={filled ? "#C9920A" : "none"} stroke={filled ? "#C9920A" : "#64748b"} strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
  </svg>
);

const IconRefresh = ({ spin }) => (
  <svg className={`w-4 h-4 ${spin ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconReply = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);

const IconArchive = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

const IconPaperclip = () => (
  <svg className="w-3.5 h-3.5 inline -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const CARPETAS = [
  { key: "INBOX", label: "Bandeja de entrada", countKey: "no_leidos" },
  { key: "DESTACADOS", label: "Destacados", countKey: "destacados" },
  { key: "SENT", label: "Enviados", countKey: "enviados" },
  { key: "ARCHIVED", label: "Archivados", countKey: null },
];

const BandejaEntrada = () => {
  const { api } = useAuth();
  const [carpeta, setCarpeta] = useState("INBOX");
  const [emails, setEmails] = useState([]);
  const [contadores, setContadores] = useState({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [hilo, setHilo] = useState([]);
  const [q, setQ] = useState("");
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);

  const cargarEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ carpeta });
      if (q.trim()) params.set("q", q.trim());
      const r = await api.get(`/api/gestor/bandeja/emails?${params.toString()}`);
      setEmails(r.data?.emails || []);
      setContadores(r.data?.contadores || {});
    } catch (e) {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [api, carpeta, q]);

  useEffect(() => { cargarEmails(); }, [cargarEmails]);

  const abrirEmail = useCallback(async (id) => {
    setSelectedId(id);
    setDetalle(null);
    setHilo([]);
    try {
      const r = await api.get(`/api/gestor/bandeja/emails/${id}`);
      setDetalle(r.data?.email || null);
      setHilo(r.data?.hilo || []);
      // Actualizar el estado leído en la lista
      setEmails((prev) => prev.map((em) => (em.id === id ? { ...em, leido: true } : em)));
    } catch (e) {
      setDetalle(null);
    }
  }, [api]);

  const toggleDestacado = useCallback(async (id, current) => {
    try {
      await api.put(`/api/gestor/bandeja/emails/${id}/destacar`, { destacado: !current });
      setEmails((prev) => prev.map((em) => (em.id === id ? { ...em, destacado: !current } : em)));
      if (detalle?.id === id) setDetalle({ ...detalle, destacado: !current });
    } catch {}
  }, [api, detalle]);

  const archivar = useCallback(async (id) => {
    if (!window.confirm("¿Archivar este correo?")) return;
    try {
      await api.delete(`/api/gestor/bandeja/emails/${id}`);
      setEmails((prev) => prev.filter((em) => em.id !== id));
      if (detalle?.id === id) { setDetalle(null); setSelectedId(null); }
    } catch {}
  }, [api, detalle]);

  const marcarLeido = useCallback(async (id, leido) => {
    try {
      await api.put(`/api/gestor/bandeja/emails/${id}/leido`, { leido });
      setEmails((prev) => prev.map((em) => (em.id === id ? { ...em, leido } : em)));
    } catch {}
  }, [api]);

  const sincronizar = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await api.post("/api/gestor/bandeja/sincronizar");
      if (r.data?.ok) {
        setSyncMsg({ tipo: "ok", txt: `✅ Sincronizado · ${r.data.nuevos || 0} correos nuevos` });
        await cargarEmails();
      } else {
        setSyncMsg({ tipo: "err", txt: `⚠️ ${r.data?.error || "Error al sincronizar"}` });
      }
    } catch (e) {
      setSyncMsg({ tipo: "err", txt: `⚠️ ${e?.response?.data?.detail || e.message}` });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  }, [api, cargarEmails]);

  const abrirRespuesta = () => {
    if (!detalle) return;
    setReplyTo(detalle);
    setShowReplyModal(true);
  };

  const abrirNuevo = () => {
    setReplyTo(null);
    setShowReplyModal(true);
  };

  const tituloCarpeta = useMemo(() => CARPETAS.find((c) => c.key === carpeta)?.label || "Correos", [carpeta]);

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[560px] bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="bandeja-entrada-container">
      {/* Sidebar interno con carpetas */}
      <aside className="w-56 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-3 border-b border-slate-200">
          <button
            onClick={abrirNuevo}
            data-testid="btn-nuevo-correo"
            className="w-full bg-[#1A3A5C] hover:bg-[#0f2a44] text-white font-medium text-sm py-2 rounded-lg transition"
          >
            ✉️ Redactar
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {CARPETAS.map((c) => {
            const count = c.countKey ? (contadores[c.countKey] || 0) : 0;
            const active = carpeta === c.key;
            return (
              <button
                key={c.key}
                onClick={() => { setCarpeta(c.key); setSelectedId(null); setDetalle(null); }}
                data-testid={`carpeta-${c.key.toLowerCase()}`}
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition ${active ? "bg-white text-[#1A3A5C] font-semibold border-l-4 border-[#C9920A]" : "text-slate-700 hover:bg-slate-100"}`}
              >
                <span>{c.label}</span>
                {count > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${active ? "bg-[#C9920A] text-white" : "bg-slate-200 text-slate-700"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200 space-y-2">
          <button
            onClick={sincronizar}
            disabled={syncing}
            data-testid="btn-sincronizar-ahora"
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-600 hover:text-[#1A3A5C] py-1.5 rounded border border-slate-300 hover:border-[#1A3A5C] disabled:opacity-50"
          >
            <IconRefresh spin={syncing} />
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
          {syncMsg && (
            <div className={`text-xs ${syncMsg.tipo === "ok" ? "text-green-700" : "text-red-700"}`}>{syncMsg.txt}</div>
          )}
        </div>
      </aside>

      {/* Panel izquierdo (40%): lista */}
      <div className="w-[40%] border-r border-slate-200 flex flex-col">
        <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar por asunto o remitente..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") cargarEmails(); }}
            data-testid="bandeja-buscador"
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C]"
          />
          <button onClick={cargarEmails} className="text-xs text-slate-600 hover:text-[#1A3A5C]" title="Actualizar">
            <IconRefresh spin={loading} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>}
          {!loading && emails.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500" data-testid="bandeja-vacia">
              No hay correos en <strong>{tituloCarpeta}</strong>.
              {carpeta === "INBOX" && (
                <div className="mt-2 text-xs">Pulsa <em>Sincronizar ahora</em> para traer los últimos correos desde Gmail.</div>
              )}
            </div>
          )}
          {!loading && emails.map((em) => (
            <div
              key={em.id}
              onClick={() => abrirEmail(em.id)}
              data-testid={`email-item-${em.id}`}
              className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition ${selectedId === em.id ? "bg-amber-50 border-l-4 border-l-[#C9920A]" : em.leido ? "hover:bg-slate-50" : "bg-blue-50/40 hover:bg-blue-50 font-semibold"}`}
            >
              <div className="flex items-start gap-2">
                <button onClick={(e) => { e.stopPropagation(); toggleDestacado(em.id, em.destacado); }} className="mt-0.5" data-testid={`btn-destacar-${em.id}`}>
                  <IconStar filled={em.destacado} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${em.leido ? "text-slate-700" : "text-[#0f172a]"}`}>
                      {em.direccion === "saliente" ? `→ ${em.destinatario}` : (em.remitente_nombre || em.remitente_email)}
                    </span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{fmtFecha(em.fecha_envio)}</span>
                  </div>
                  <div className={`text-sm truncate ${em.leido ? "text-slate-600" : "text-[#1A3A5C]"}`}>
                    {em.asunto || "(sin asunto)"} {em.tiene_adjuntos && <IconPaperclip />}
                  </div>
                  {em.musico_id && (
                    <div className="text-[10px] uppercase tracking-wide text-[#C9920A] font-semibold mt-0.5">🎻 Músico vinculado</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho (60%): lector */}
      <div className="flex-1 flex flex-col bg-white">
        {!detalle && (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm" data-testid="bandeja-sin-seleccion">
            Selecciona un correo para verlo aquí
          </div>
        )}
        {detalle && (
          <>
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-[#1A3A5C] truncate" data-testid="email-detalle-asunto">{detalle.asunto || "(sin asunto)"}</h2>
                  <div className="text-xs text-slate-600 mt-1">
                    <div><strong>De:</strong> {detalle.remitente_nombre ? `${detalle.remitente_nombre} <${detalle.remitente_email}>` : detalle.remitente_email}</div>
                    <div><strong>Para:</strong> {detalle.destinatario}</div>
                    {detalle.cc && <div><strong>CC:</strong> {detalle.cc}</div>}
                    <div className="text-slate-500">{new Date(detalle.fecha_envio).toLocaleString("es-ES")}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleDestacado(detalle.id, detalle.destacado)} className="p-2 rounded hover:bg-slate-200" title="Destacar" data-testid="btn-detalle-destacar">
                    <IconStar filled={detalle.destacado} />
                  </button>
                  <button onClick={() => marcarLeido(detalle.id, !detalle.leido)} className="p-2 rounded hover:bg-slate-200 text-xs text-slate-600" title={detalle.leido ? "Marcar no leído" : "Marcar leído"}>
                    {detalle.leido ? "○" : "●"}
                  </button>
                  <button onClick={abrirRespuesta} className="px-3 py-1.5 text-sm bg-[#1A3A5C] hover:bg-[#0f2a44] text-white rounded-lg flex items-center gap-1.5" data-testid="btn-responder">
                    <IconReply /> Responder
                  </button>
                  <button onClick={() => archivar(detalle.id)} className="p-2 rounded hover:bg-slate-200 text-slate-600" title="Archivar" data-testid="btn-archivar">
                    <IconArchive />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detalle.cuerpo_html ? (
                <div
                  className="prose prose-sm max-w-none text-slate-800"
                  dangerouslySetInnerHTML={{ __html: detalle.cuerpo_html }}
                  data-testid="email-detalle-html"
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans" data-testid="email-detalle-texto">
                  {detalle.cuerpo_texto || "(sin contenido)"}
                </pre>
              )}

              {Array.isArray(detalle.adjuntos_meta) && detalle.adjuntos_meta.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-600 mb-2">Adjuntos ({detalle.adjuntos_meta.length})</div>
                  <ul className="space-y-1">
                    {detalle.adjuntos_meta.map((a, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                        <IconPaperclip /> {a.nombre} <span className="text-xs text-slate-400">({Math.round((a.tamano || 0) / 1024)} KB)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hilo.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-600 mb-2">Conversación ({hilo.length} mensajes previos)</div>
                  <ul className="space-y-2">
                    {hilo.map((h) => (
                      <li key={h.id} onClick={() => abrirEmail(h.id)} className="text-sm text-slate-700 hover:text-[#1A3A5C] cursor-pointer border-l-2 border-slate-300 pl-3">
                        <span className={h.direccion === "saliente" ? "text-[#C9920A]" : ""}>{h.direccion === "saliente" ? "→" : "←"}</span> {h.asunto} · <span className="text-xs text-slate-500">{fmtFecha(h.fecha_envio)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showReplyModal && (
        <ReplyModal
          api={api}
          replyTo={replyTo}
          onClose={() => setShowReplyModal(false)}
          onSent={() => { setShowReplyModal(false); cargarEmails(); }}
        />
      )}
    </div>
  );
};

// ============================================================================
// Modal: Responder / Redactar
// ============================================================================
const ReplyModal = ({ api, replyTo, onClose, onSent }) => {
  const [destinatario, setDestinatario] = useState(replyTo?.remitente_email || "");
  const [asunto, setAsunto] = useState(replyTo?.asunto ? `Re: ${replyTo.asunto.replace(/^Re:\s*/i, "")}` : "");
  const [cuerpo, setCuerpo] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);

  const enviar = async () => {
    if (!destinatario || !asunto || !cuerpo) {
      setErr("Destinatario, asunto y cuerpo son obligatorios");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      // Quoted reply
      const cuerpoHtml = replyTo
        ? `<div>${cuerpo.replace(/\n/g, "<br/>")}</div>
           <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0"/>
           <blockquote style="border-left:3px solid #1A3A5C;padding-left:12px;color:#64748b;font-size:13px">
             <div><strong>De:</strong> ${replyTo.remitente_email}</div>
             <div><strong>Fecha:</strong> ${new Date(replyTo.fecha_envio).toLocaleString("es-ES")}</div>
             <div><strong>Asunto:</strong> ${replyTo.asunto || "(sin asunto)"}</div>
             <br/>
             ${replyTo.cuerpo_html || replyTo.cuerpo_texto || ""}
           </blockquote>`
        : `<div>${cuerpo.replace(/\n/g, "<br/>")}</div>`;

      const r = await api.post("/api/gestor/bandeja/responder", {
        destinatario,
        asunto,
        cuerpo_html: cuerpoHtml,
        en_respuesta_a: replyTo?.id || null,
        musico_id: replyTo?.musico_id || null,
      });
      if (r.data?.ok) {
        onSent();
      } else {
        setErr(r.data?.detalle?.reason || "No se pudo enviar");
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="modal-responder">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-[#1A3A5C] text-white px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold">{replyTo ? "Responder correo" : "Nuevo correo"}</h3>
          <button onClick={onClose} className="text-white hover:text-slate-300 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Destinatario</label>
            <input
              type="email"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              data-testid="input-destinatario"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Asunto</label>
            <input
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              data-testid="input-asunto"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Mensaje</label>
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={8}
              data-testid="input-cuerpo"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C] font-sans"
              placeholder="Escribe tu respuesta..."
            />
          </div>
          {err && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{err}</div>}
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Cancelar</button>
          <button
            onClick={enviar}
            disabled={sending}
            data-testid="btn-enviar-respuesta"
            className="px-4 py-1.5 text-sm bg-[#C9920A] hover:bg-[#a57807] text-white rounded-lg disabled:opacity-50"
          >
            {sending ? "Enviando..." : "📤 Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BandejaEntrada;
