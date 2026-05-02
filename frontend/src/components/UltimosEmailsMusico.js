// Widget: últimos 3 emails del músico (entrantes + salientes) — ficha del músico
import React, { useCallback, useEffect, useState } from "react";
import { Mail, Inbox, Send } from "lucide-react";

const fmtFecha = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

const UltimosEmailsMusico = ({ api, usuarioId }) => {
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rIn, rOut] = await Promise.all([
        api.get(`/api/gestor/bandeja/emails?carpeta=INBOX&musico_id=${usuarioId}&limit=3`),
        api.get(`/api/gestor/bandeja/emails?carpeta=SENT&musico_id=${usuarioId}&limit=3`),
      ]);
      setInbox(rIn.data?.emails || []);
      setSent(rOut.data?.emails || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [api, usuarioId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Merge y ordenar por fecha — tope 3
  const combinados = [...inbox, ...sent]
    .sort((a, b) => new Date(b.fecha_envio) - new Date(a.fecha_envio))
    .slice(0, 3);

  const abrirEnBandeja = (id) => {
    window.location.href = `/admin/comunicaciones#email=${id}`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6" data-testid="widget-ultimos-emails-musico">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#1A3A5C] flex items-center gap-2">
          <Mail size={16} className="text-[#C9920A]" />
          Últimos emails del músico
        </h3>
        <a
          href="/admin/comunicaciones"
          className="text-xs text-slate-500 hover:text-[#1A3A5C]"
          data-testid="link-ver-bandeja"
        >
          Ver bandeja →
        </a>
      </div>

      {loading && <div className="text-sm text-slate-500 py-2">Cargando...</div>}
      {!loading && combinados.length === 0 && (
        <div className="text-sm text-slate-500 py-2">No hay correos vinculados a este músico todavía.</div>
      )}

      {!loading && combinados.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {combinados.map((em) => (
            <li
              key={em.id}
              onClick={() => abrirEnBandeja(em.id)}
              data-testid={`widget-email-${em.id}`}
              className="py-2.5 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded transition"
            >
              <div className="flex items-start gap-2">
                {em.direccion === "saliente" ? (
                  <Send size={14} className="mt-1 text-[#C9920A] shrink-0" />
                ) : (
                  <Inbox size={14} className="mt-1 text-[#1A3A5C] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-medium truncate ${em.leido ? "text-slate-700" : "text-[#0f172a] font-semibold"}`}>
                      {em.asunto || "(sin asunto)"}
                    </span>
                    <span className="text-xs text-slate-400 whitespace-nowrap ml-auto">{fmtFecha(em.fecha_envio)}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {em.direccion === "saliente" ? `→ ${em.destinatario}` : `← ${em.remitente_nombre || em.remitente_email}`}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UltimosEmailsMusico;
