// Panel de fichaje QR para el músico — botones de entrada/salida según ventana de tiempo
import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const fmtH = (s) => s ? new Date(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—";

// Combina fecha + hora (string) en Date local
const combinarFechaHora = (fecha, hora) => {
  if (!fecha || !hora) return null;
  try {
    const f = String(fecha).slice(0, 10);
    const h = String(hora).slice(0, 8);
    return new Date(`${f}T${h.length === 5 ? h + ":00" : h}`);
  } catch { return null; }
};

const FichajeMusicoPanel = ({ ensayos, apiUrl, usuarioId, fichajeReglas }) => {
  const [estados, setEstados] = useState({});  // ensayo_id -> {estado, fichaje}
  const [busyEnsayo, setBusyEnsayo] = useState(null);
  const [feedback, setFeedback] = useState({});

  const reglas = fichajeReglas || { minutos_antes_apertura: 30, minutos_despues_cierre: 30 };
  const ahora = new Date();

  useEffect(() => {
    if (!ensayos || !usuarioId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = {};
      for (const e of ensayos) {
        try {
          const r = await fetch(`${apiUrl}/fichaje/estado/${e.id}/${usuarioId}`, {
            headers: { "Authorization": `Bearer ${token}` },
          });
          if (r.ok) res[e.id] = await r.json();
        } catch { /* ignore */ }
      }
      setEstados(res);
    })();
  }, [ensayos, usuarioId, apiUrl]);

  const dentroDeVentana = (e) => {
    const ini = combinarFechaHora(e.fecha, e.hora_inicio);
    const fin = combinarFechaHora(e.fecha, e.hora_fin);
    if (!ini) return false;
    const apertura = new Date(ini.getTime() - (reglas.minutos_antes_apertura || 30) * 60000);
    const cierre = new Date(((fin || ini)).getTime() + (reglas.minutos_despues_cierre || 30) * 60000);
    return apertura <= ahora && ahora <= cierre;
  };

  const tieneSalidaPendiente = (e) => {
    const est = estados[e.id];
    if (!est || est.estado !== "entrada_registrada") return false;
    const fin = combinarFechaHora(e.fecha, e.hora_fin) || combinarFechaHora(e.fecha, e.hora_inicio);
    if (!fin) return false;
    const limit = new Date(fin.getTime() + (reglas.minutos_despues_cierre || 30) * 60000);
    return ahora > limit;
  };

  const fichar = async (ensayo, accion, manual = false) => {
    setBusyEnsayo(ensayo.id);
    setFeedback((p) => ({ ...p, [ensayo.id]: null }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      // Buscar token QR vigente del ensayo via endpoint privado del gestor — para músico no disponible.
      // En su lugar, usamos endpoints sin token (entrada/salida desde el portal: el músico ya está autenticado).
      // El token QR no es estrictamente necesario para fichar desde el portal autenticado.
      // Endpoint: si manual=true → /fichaje/salida-manual/{ensayo_id}
      // Si no, usamos un token "portal" especial: NO existe, así que reutilizamos salida-manual y entrada-manual.
      // Para mantener compatibilidad con el backend implementado, hacemos:
      //   entrada → POST a /fichaje/salida-manual style: NO disponible para entrada
      // → simplemente avisar al usuario que use el QR para entrada.
      if (accion === "entrada" && !manual) {
        // Sin QR no podemos: prompt para usar QR
        setFeedback((p) => ({ ...p, [ensayo.id]: { tipo: "info", msg: "Escanea el QR colgado en sala para registrar la entrada." } }));
        return;
      }
      // Salida desde portal (manual permitido)
      const url = `${apiUrl}/fichaje/salida-manual/${ensayo.id}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: usuarioId, timestamp: new Date().toISOString() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Error");
      setFeedback((p) => ({ ...p, [ensayo.id]: { tipo: "ok", msg: j.mensaje || "OK" } }));
      // refresh estado
      const r2 = await fetch(`${apiUrl}/fichaje/estado/${ensayo.id}/${usuarioId}`, { headers: { "Authorization": `Bearer ${token}` } });
      if (r2.ok) {
        const j2 = await r2.json();
        setEstados((p) => ({ ...p, [ensayo.id]: j2 }));
      }
    } catch (e) {
      setFeedback((p) => ({ ...p, [ensayo.id]: { tipo: "err", msg: e.message } }));
    } finally { setBusyEnsayo(null); }
  };

  const mostrables = (ensayos || []).filter((e) => dentroDeVentana(e) || tieneSalidaPendiente(e));
  if (mostrables.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-emerald-200" data-testid="portal-fichaje-section">
      <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-emerald-600"/> Fichaje
      </h3>
      <div className="space-y-2">
        {mostrables.map((e) => {
          const est = estados[e.id];
          const pendiente = tieneSalidaPendiente(e);
          const fb = feedback[e.id];
          return (
            <div key={e.id} className={`p-3 rounded border ${pendiente ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
                 data-testid={`fichaje-musico-${e.id}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <div className="font-semibold">{e.tipo === "funcion" ? "🎭 Función" : "🎼 Ensayo"} · {e.fecha} · {(e.hora_inicio||"").slice(0,5)}–{(e.hora_fin||"").slice(0,5)}</div>
                  {e.lugar && <div className="text-xs text-slate-600">📍 {e.lugar}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {est?.estado === "completo" ? (
                    <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Completado</span>
                  ) : pendiente ? (
                    <button onClick={() => fichar(e, "salida", true)} disabled={busyEnsayo === e.id}
                            data-testid={`btn-fichar-salida-pend-${e.id}`}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded font-medium inline-flex items-center gap-1 disabled:opacity-50">
                      <AlertTriangle className="w-4 h-4"/> Fichar salida
                    </button>
                  ) : est?.estado === "entrada_registrada" ? (
                    <button onClick={() => fichar(e, "salida", true)} disabled={busyEnsayo === e.id}
                            data-testid={`btn-fichar-salida-${e.id}`}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded font-medium inline-flex items-center gap-1 disabled:opacity-50">
                      📱 Fichar salida
                    </button>
                  ) : (
                    <button onClick={() => fichar(e, "entrada", false)} disabled={busyEnsayo === e.id}
                            data-testid={`btn-fichar-entrada-${e.id}`}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded font-medium inline-flex items-center gap-1 disabled:opacity-50">
                      📱 Fichar entrada
                    </button>
                  )}
                </div>
              </div>
              {pendiente && est?.estado === "entrada_registrada" && (
                <div className="mt-2 text-xs text-amber-700 inline-flex items-center gap-1">
                  ⚠️ Tienes una salida pendiente. Pulsa para fichar ahora.
                </div>
              )}
              {est?.fichaje && (
                <div className="mt-1.5 text-[11px] text-slate-600">
                  Entrada: <strong>{fmtH(est.fichaje.hora_entrada_computada)}</strong>
                  {est.fichaje.hora_salida_computada && <> · Salida: <strong>{fmtH(est.fichaje.hora_salida_computada)}</strong></>}
                  {est.fichaje.porcentaje_asistencia != null && <> · % QR: <strong>{est.fichaje.porcentaje_asistencia}%</strong></>}
                </div>
              )}
              {fb && (
                <div className={`mt-1.5 text-xs ${fb.tipo === "ok" ? "text-emerald-700" : fb.tipo === "info" ? "text-blue-700" : "text-rose-700"}`}>{fb.msg}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FichajeMusicoPanel;
