import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { QrCode, Download, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

const fmtH = (s) => s ? new Date(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—";


// Iter F4 — Badge read-only de las reglas de fichaje aplicadas al ensayo.
// Las reglas se editan desde Configuración de Eventos (subpanel por ensayo).
const FichajeReglasBadge = ({ cfg }) => {
  if (!cfg) return null;
  const ant = cfg.minutos_antes_apertura ?? 30;
  const desp = cfg.minutos_despues_cierre ?? 30;
  const ret = cfg.minutos_retraso_aviso ?? 5;
  const computaPre = !!cfg.computa_tiempo_extra;
  const computaPost = !!cfg.computa_mas_alla_fin;
  const notifMusico = [
    cfg.notif_musico_push && "push",
    cfg.notif_musico_email && "email",
    cfg.notif_musico_whatsapp && "whatsapp",
  ].filter(Boolean);
  const notifGestor = [
    cfg.notif_gestor_push && "push",
    cfg.notif_gestor_email && "email",
    cfg.notif_gestor_dashboard && "dashboard",
  ].filter(Boolean);
  return (
    <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs text-slate-700 flex items-center gap-3 flex-wrap"
         data-testid="fichaje-reglas-badge"
         title="Reglas read-only. Edita desde Configuración de Eventos.">
      <span className="font-semibold uppercase tracking-wide text-slate-500">Reglas:</span>
      <span><b>{ant}</b>′ antes · <b>{desp}</b>′ después · aviso si retraso ≥ <b>{ret}</b>′</span>
      <span className="text-slate-400">|</span>
      <span>Computa pre: <b>{computaPre ? "✓" : "✗"}</b></span>
      <span>Computa post: <b>{computaPost ? "✓" : "✗"}</b></span>
      <span className="text-slate-400">|</span>
      <span>Músico → <b>{notifMusico.length ? notifMusico.join(", ") : "ninguna"}</b></span>
      <span>Gestor → <b>{notifGestor.length ? notifGestor.join(", ") : "ninguna"}</b></span>
    </div>
  );
};


const EnsayoBlock = ({ ensayo, api, onRefresh }) => {
  const [busy, setBusy] = useState(false);

  const descargarQR = async () => {
    setBusy(true);
    try {
      const host = window.location.origin;
      const r = await api.get(`/api/gestor/ensayo-qr/${ensayo.id}/png?host=${encodeURIComponent(host)}`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `qr_${ensayo.id.slice(0,8)}.png`; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };

  const regenerar = async () => {
    if (!window.confirm("Esto invalidará el QR anterior y generará uno nuevo. ¿Continuar?")) return;
    setBusy(true);
    try {
      await api.post(`/api/gestor/ensayo-qr/${ensayo.id}/regenerar`);
      onRefresh && onRefresh();
    } finally { setBusy(false); }
  };

  const fichajes = ensayo.fichajes || [];
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-3" data-testid={`ensayo-block-${ensayo.id}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-semibold text-sm text-slate-900">
            {ensayo.tipo === "funcion" ? "🎭" : "🎼"} {ensayo.fecha} · {(ensayo.hora_inicio || "").slice(0,5)}–{(ensayo.hora_fin || "").slice(0,5)}
          </div>
          <div className="text-xs text-slate-500">{ensayo.lugar || "—"} · {ensayo.tipo}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={descargarQR} disabled={busy}
                  data-testid={`btn-download-qr-${ensayo.id}`}
                  className="px-2.5 py-1.5 text-xs bg-slate-900 text-white rounded inline-flex items-center gap-1.5 disabled:opacity-50">
            <Download className="w-3.5 h-3.5"/> Descargar QR
          </button>
          <button onClick={regenerar} disabled={busy}
                  data-testid={`btn-regen-qr-${ensayo.id}`}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw className="w-3.5 h-3.5"/> Regenerar QR
          </button>
        </div>
      </div>

      <FichajeReglasBadge cfg={ensayo.config_fichaje}/>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-[10px] uppercase text-slate-700">
            <tr>
              <th className="px-2 py-1.5 text-left">Músico</th>
              <th className="px-2 py-1.5 text-left">Entrada real</th>
              <th className="px-2 py-1.5 text-left">Entrada computada</th>
              <th className="px-2 py-1.5 text-left">Salida real</th>
              <th className="px-2 py-1.5 text-left">Salida computada</th>
              <th className="px-2 py-1.5 text-right">Duración</th>
              <th className="px-2 py-1.5 text-right">% QR</th>
              <th className="px-2 py-1.5 text-left">Alertas</th>
              <th className="px-2 py-1.5 text-left">Vía</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fichajes.length === 0 && (
              <tr><td colSpan="9" className="px-2 py-4 text-center text-slate-400">Sin fichajes registrados todavía</td></tr>
            )}
            {fichajes.map((f) => {
              const dur = f.minutos_totales != null ? `${Math.floor(f.minutos_totales/60)}:${String(f.minutos_totales%60).padStart(2,"0")}` : "—";
              const alertas = [
                f.alerta_retraso && "🕐 Tarde",
                f.alerta_no_asistencia && "❌ No asistió",
                f.alerta_salida_pendiente && "⚠️ Salida pendiente",
              ].filter(Boolean).join(" · ");
              return (
                <tr key={f.id} className="hover:bg-slate-50" data-testid={`fichaje-row-${f.id}`}>
                  <td className="px-2 py-1.5">{f.usuario?.apellidos}, {f.usuario?.nombre} <span className="text-slate-400">({f.usuario?.instrumento || "—"})</span></td>
                  <td className="px-2 py-1.5">{fmtH(f.hora_entrada_real)}</td>
                  <td className="px-2 py-1.5 font-medium">{fmtH(f.hora_entrada_computada)}</td>
                  <td className="px-2 py-1.5">{fmtH(f.hora_salida_real)}</td>
                  <td className="px-2 py-1.5 font-medium">{fmtH(f.hora_salida_computada)}</td>
                  <td className="px-2 py-1.5 text-right">{dur}</td>
                  <td className="px-2 py-1.5 text-right font-bold">{f.porcentaje_asistencia != null ? `${f.porcentaje_asistencia}%` : "—"}</td>
                  <td className="px-2 py-1.5">{alertas || <span className="text-slate-400">—</span>}</td>
                  <td className="px-2 py-1.5 uppercase text-[10px]">{f.via_entrada || "—"}/{f.via_salida || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};


const EventoAccordion = ({ evento, api, onRefresh }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
              data-testid={`accordion-evento-${evento.id}`}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
          <div className="text-left">
            <div className="font-semibold text-sm">{evento.nombre}</div>
            <div className="text-xs text-slate-500">{evento.temporada || "—"} · {evento.lugar || "—"} · {(evento.fecha_inicio || "").slice(0,10)}</div>
          </div>
        </div>
        <span className="text-xs text-slate-500">{(evento.ensayos || []).length} ensayo(s)/función(es)</span>
      </button>
      {open && (
        <div className="p-3 space-y-3 border-t border-slate-100">
          {(evento.ensayos || []).length === 0 && <div className="text-xs text-slate-500 italic">Sin ensayos configurados.</div>}
          {(evento.ensayos || []).map((e) => (
            <EnsayoBlock key={e.id} ensayo={e} api={api} onRefresh={onRefresh}/>
          ))}
        </div>
      )}
    </div>
  );
};


const RegistroAsistencia = () => {
  const { api } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [temporada, setTemporada] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = temporada ? `?temporada=${encodeURIComponent(temporada)}` : "";
      const r = await api.get(`/api/gestor/registro-asistencia${params}`);
      setEventos(r.data?.eventos || []);
    } finally { setLoading(false); }
  }, [api, temporada]);

  useEffect(() => { cargar(); }, [cargar]);

  const temporadas = useMemo(() => {
    const s = new Set();
    eventos.forEach(e => e.temporada && s.add(e.temporada));
    return Array.from(s).sort();
  }, [eventos]);

  return (
    <div className="p-6 space-y-4" data-testid="registro-asistencia-page">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <QrCode className="w-7 h-7 text-slate-700"/>
          <div>
            <h1 className="font-cabinet text-2xl font-bold text-slate-900">Registro de Asistencia</h1>
            <p className="text-sm text-slate-600">QR por ensayo y función · fichajes con cálculo automático de horas computadas. Las reglas se editan desde Configuración de Eventos.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">Temporada:</label>
          <select value={temporada} onChange={(e) => setTemporada(e.target.value)}
                  data-testid="select-temporada-fichaje"
                  className="text-sm border border-slate-200 rounded px-2 py-1 bg-white">
            <option value="">Todas</option>
            {temporadas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="text-slate-500 text-sm">Cargando…</div>
      ) : (
        <div className="space-y-3">
          {eventos.length === 0 && <div className="text-sm text-slate-500 italic">No hay eventos.</div>}
          {eventos.map(ev => <EventoAccordion key={ev.id} evento={ev} api={api} onRefresh={cargar}/>)}
        </div>
      )}
    </div>
  );
};

export default RegistroAsistencia;
