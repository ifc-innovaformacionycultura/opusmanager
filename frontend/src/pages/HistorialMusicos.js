// Bloque 3 — /admin/historial-musicos: Timeline + Gantt de un músico
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Clock, Search, Filter, Download, User, Calendar as CalIcon, Phone, Mail, MessageCircle, Coins, FileText as FileIcon, AlertTriangle, ChevronLeft, ChevronRight, GitBranch, ListOrdered } from "lucide-react";

const fmtFecha = (s) => s ? new Date(s).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtSolo = (s) => s ? new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const tipoCfg = {
  evento_confirmado: { color: "bg-emerald-500", icon: CalIcon, label: "Evento confirmado" },
  evento_pendiente: { color: "bg-blue-500", icon: CalIcon, label: "Evento pendiente" },
  contacto_email: { color: "bg-amber-400", icon: Mail, label: "Email" },
  contacto_llamada: { color: "bg-amber-500", icon: Phone, label: "Llamada" },
  contacto_whatsapp: { color: "bg-amber-500", icon: MessageCircle, label: "WhatsApp" },
  contacto_otro: { color: "bg-amber-300", icon: FileIcon, label: "Contacto" },
  pago: { color: "bg-purple-500", icon: Coins, label: "Pago" },
  certificado: { color: "bg-indigo-500", icon: FileIcon, label: "Certificado" },
  reclamacion: { color: "bg-rose-500", icon: AlertTriangle, label: "Reclamación" },
};

const HistorialMusicos = () => {
  const { api } = useAuth();
  const [musicos, setMusicos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vista, setVista] = useState("timeline"); // timeline | gantt
  const [filtroTipo, setFiltroTipo] = useState("todos"); // todos | eventos | pagos | contactos
  const [showSecciones, setShowSecciones] = useState({ eventos: true, pagos: true, contactos: true, certificados: true, reclamaciones: true });
  const [yearOffset, setYearOffset] = useState(0); // gantt navegación

  // Cargar lista de músicos
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/api/gestor/musicos");
        const list = Array.isArray(r.data) ? r.data : (r.data?.musicos || []);
        setMusicos(list.filter((m) => (m.rol || "musico") === "musico"));
      } catch { /* ignore */ }
    })();
  }, [api]);

  const cargarHistorial = useCallback(async (m) => {
    if (!m) return;
    setLoading(true);
    try {
      const [det, contactos, certs] = await Promise.all([
        api.get(`/api/gestor/musicos/${m.id}`).catch(() => ({ data: { musico: m, asignaciones: [], reclamaciones: [] } })),
        api.get(`/api/gestor/contactos/musico/${m.id}`).catch(() => ({ data: { contactos: [] } })),
        api.get(`/api/gestor/certificados?usuario_id=${m.id}`).catch(() => ({ data: { certificados: [] } })),
      ]);
      const asignaciones = det.data?.asignaciones || [];
      // Eventos = una entrada por asignación (trae 'evento' embebido + estado)
      const eventos = asignaciones.map((a) => ({
        id: a.evento?.id || a.id,
        nombre: a.evento?.nombre,
        fecha_inicio: a.evento?.fecha_inicio,
        temporada: a.evento?.temporada,
        estado: a.estado,
      }));
      // Pagos = derivados de asignaciones con estado_pago/importe
      const pagos = asignaciones
        .filter((a) => a.estado_pago || a.importe)
        .map((a) => ({
          id: `as-pago-${a.id}`,
          fecha_pago: a.fecha_pago || a.updated_at,
          evento_nombre: a.evento?.nombre,
          importe_neto: a.importe,
          estado: a.estado_pago || "pendiente",
        }));
      setData({
        musico: det.data?.musico || m,
        contactos: contactos.data?.contactos || [],
        eventos,
        pagos,
        certificados: certs.data?.certificados || [],
        reclamaciones: det.data?.reclamaciones || [],
      });
    } finally { setLoading(false); }
  }, [api]);

  // Construir feed unificado para timeline
  const feed = useMemo(() => {
    if (!data) return [];
    const items = [];
    if (showSecciones.eventos) {
      (data.eventos || []).forEach((e) => {
        const estado = (e.estado || e.estado_asignacion || "").toLowerCase();
        items.push({
          id: `ev-${e.id || e.evento_id}`,
          tipo: estado === "confirmado" || estado === "completado" ? "evento_confirmado" : "evento_pendiente",
          fecha: e.fecha_inicio || e.fecha,
          titulo: e.nombre || e.evento_nombre || "Evento",
          subtitulo: `${e.temporada || ""} · Estado: ${estado || "—"}`,
          extra: e,
        });
      });
    }
    if (showSecciones.pagos) {
      (data.pagos || []).forEach((p) => items.push({
        id: `pag-${p.id}`, tipo: "pago", fecha: p.fecha_pago || p.created_at,
        titulo: p.evento?.nombre || p.evento_nombre || "Pago",
        subtitulo: `${p.importe_neto ?? p.importe_bruto ?? 0} € · ${p.estado || "—"}`,
        extra: p,
      }));
    }
    if (showSecciones.certificados) {
      (data.certificados || []).forEach((c) => items.push({
        id: `cert-${c.id}`, tipo: "certificado", fecha: c.created_at || c.fecha,
        titulo: c.evento?.nombre || c.evento_nombre || "Certificado",
        subtitulo: `${c.evento?.temporada || ""} · ${c.horas_totales || 0} h`,
        extra: c,
      }));
    }
    if (showSecciones.contactos) {
      (data.contactos || []).forEach((c) => items.push({
        id: `ct-${c.id}`, tipo: `contacto_${c.tipo || "otro"}`, fecha: c.fecha_contacto || c.created_at,
        titulo: (tipoCfg[`contacto_${c.tipo}`]?.label || "Contacto"),
        subtitulo: `${c.evento?.nombre ? `📌 ${c.evento.nombre}` : "📭 General"} · ${c.estado_respuesta || "—"}`,
        extra: c,
      }));
    }
    if (showSecciones.reclamaciones) {
      (data.reclamaciones || []).forEach((r) => items.push({
        id: `rec-${r.id}`, tipo: "reclamacion", fecha: r.fecha_creacion || r.created_at,
        titulo: r.tipo || "Reclamación", subtitulo: r.descripcion?.slice(0, 80),
        extra: r,
      }));
    }
    // Filtro por tipo
    let filtered = items;
    if (filtroTipo === "eventos") filtered = items.filter((i) => i.tipo.startsWith("evento_"));
    else if (filtroTipo === "pagos") filtered = items.filter((i) => i.tipo === "pago");
    else if (filtroTipo === "contactos") filtered = items.filter((i) => i.tipo.startsWith("contacto_"));
    return filtered.sort((a, b) => (new Date(b.fecha || 0)) - (new Date(a.fecha || 0)));
  }, [data, showSecciones, filtroTipo]);

  // Filtrado de la lista lateral
  const musicosFiltrados = useMemo(() => {
    const q = (busqueda || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!q) return musicos;
    const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return musicos.filter((m) => norm(m.nombre).includes(q) || norm(m.apellidos).includes(q) || norm(m.email).includes(q) || norm(m.instrumento).includes(q));
  }, [musicos, busqueda]);

  const exportar = () => {
    if (!seleccionado || !data) return;
    const rows = [["Tipo", "Fecha", "Título", "Detalle"]];
    feed.forEach((it) => rows.push([tipoCfg[it.tipo]?.label || it.tipo, fmtFecha(it.fecha), it.titulo, it.subtitulo || ""]));
    const csv = rows.map((r) => r.map((c) => `"${(c || "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `historial-${seleccionado.nombre}-${seleccionado.apellidos}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Vista Gantt — agrupar por mes del año actual + offset
  const ganttData = useMemo(() => {
    if (!data) return null;
    const baseYear = new Date().getFullYear() + yearOffset;
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const filas = { Eventos: [], Contactos: [], Pagos: [] };
    feed.forEach((it) => {
      const d = it.fecha ? new Date(it.fecha) : null;
      if (!d || d.getFullYear() !== baseYear) return;
      const m = d.getMonth();
      if (it.tipo.startsWith("evento_")) filas.Eventos.push({ m, color: tipoCfg[it.tipo]?.color, item: it });
      else if (it.tipo === "pago") filas.Pagos.push({ m, color: tipoCfg.pago.color, item: it });
      else if (it.tipo.startsWith("contacto_")) filas.Contactos.push({ m, color: tipoCfg[it.tipo]?.color, item: it });
    });
    return { baseYear, meses, filas };
  }, [data, feed, yearOffset]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-100" data-testid="historial-musicos-page">
      {/* Sidebar */}
      <aside className="w-[300px] bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
            <Clock className="w-5 h-5"/> Historial y CRM
          </h1>
          <p className="text-xs text-slate-600 mt-1">Busca un músico para ver su historial completo.</p>
        </div>
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2 top-2.5"/>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                   placeholder="Buscar músico…"
                   data-testid="hist-search-input"
                   className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded bg-white"/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1" data-testid="hist-musicos-list">
          {musicosFiltrados.map((m) => {
            const activo = seleccionado?.id === m.id;
            const inicial = (m.nombre || "?").slice(0, 1).toUpperCase();
            return (
              <button key={m.id}
                      onClick={() => { setSeleccionado(m); cargarHistorial(m); }}
                      data-testid={`hist-musico-${m.id}`}
                      className={`w-full flex items-center gap-2 p-2 rounded text-left transition-colors ${activo ? "bg-blue-100 border border-blue-300" : "hover:bg-white border border-transparent"}`}>
                <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-semibold text-sm flex items-center justify-center shrink-0">{inicial}</div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm ${activo ? "font-bold text-blue-900" : "font-medium text-slate-900"}`}>
                    {m.nombre} {m.apellidos}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{m.instrumento || "—"}</div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4">
        {!seleccionado ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
            <User className="w-16 h-16 text-slate-300 mb-3"/>
            <p>Busca un músico para ver su historial completo de eventos, pagos y contactos.</p>
          </div>
        ) : loading ? (
          <div className="text-slate-500">Cargando historial…</div>
        ) : !data ? (
          <div className="text-slate-500">Sin datos.</div>
        ) : (
          <div className="space-y-4">
            <header className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between flex-wrap gap-3" data-testid="hist-cabecera">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-700 text-white font-bold text-lg flex items-center justify-center">{(data.musico.nombre || "?").slice(0,1).toUpperCase()}</div>
                <div>
                  <h2 className="font-bold text-slate-900">{data.musico.nombre} {data.musico.apellidos}</h2>
                  <p className="text-xs text-slate-600">{data.musico.instrumento} · {data.musico.nivel_estudios || "—"} · {data.musico.estado || "activo"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`/admin/musicos/${data.musico.id}`} className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50">Ver ficha completa →</a>
                <div className="inline-flex border border-slate-200 rounded overflow-hidden">
                  <button onClick={() => setVista("timeline")}
                          data-testid="vista-timeline"
                          className={`px-2.5 py-1.5 text-xs inline-flex items-center gap-1 ${vista === "timeline" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}>
                    <ListOrdered className="w-3.5 h-3.5"/> Timeline
                  </button>
                  <button onClick={() => setVista("gantt")}
                          data-testid="vista-gantt"
                          className={`px-2.5 py-1.5 text-xs inline-flex items-center gap-1 ${vista === "gantt" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}>
                    <GitBranch className="w-3.5 h-3.5"/> Gantt
                  </button>
                </div>
                <button onClick={exportar} data-testid="btn-export-historial"
                        className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded inline-flex items-center gap-1">
                  <Download className="w-3.5 h-3.5"/> Exportar CSV
                </button>
              </div>
            </header>

            {/* Filtros */}
            <div className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3 flex-wrap text-xs">
              <Filter className="w-4 h-4 text-slate-500"/>
              <div className="inline-flex border border-slate-200 rounded overflow-hidden">
                {["todos", "eventos", "pagos", "contactos"].map((t) => (
                  <button key={t} onClick={() => setFiltroTipo(t)}
                          data-testid={`filtro-${t}`}
                          className={`px-2 py-1 capitalize ${filtroTipo === t ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{t}</button>
                ))}
              </div>
              <details>
                <summary className="cursor-pointer text-slate-600">Secciones</summary>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {Object.keys(showSecciones).map((k) => (
                    <label key={k} className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={showSecciones[k]} onChange={(e) => setShowSecciones((p) => ({ ...p, [k]: e.target.checked }))}/>
                      <span>{k}</span>
                    </label>
                  ))}
                </div>
              </details>
              <span className="text-slate-500 ml-auto">{feed.length} elementos</span>
            </div>

            {/* Vista Timeline */}
            {vista === "timeline" && (
              <div className="bg-white rounded-lg border border-slate-200 p-4" data-testid="hist-timeline">
                {feed.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">Sin eventos en el historial.</div>
                ) : (
                  <ol className="relative border-l-2 border-slate-200 ml-3 space-y-4">
                    {feed.map((it) => {
                      const cfg = tipoCfg[it.tipo] || tipoCfg.contacto_otro;
                      const Icon = cfg.icon;
                      return (
                        <li key={it.id} className="ml-3" data-testid={`hist-item-${it.id}`}>
                          <span className={`absolute -left-[9px] w-4 h-4 rounded-full ${cfg.color} ring-2 ring-white`}/>
                          <div className="flex items-start gap-2">
                            <Icon className="w-4 h-4 text-slate-500 mt-0.5"/>
                            <div className="flex-1">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-medium text-sm text-slate-900">{it.titulo}</span>
                                <span className="text-[11px] text-slate-500">{fmtFecha(it.fecha)}</span>
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">{cfg.label}</span>
                              </div>
                              {it.subtitulo && <div className="text-xs text-slate-600 mt-0.5">{it.subtitulo}</div>}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}

            {/* Vista Gantt */}
            {vista === "gantt" && ganttData && (
              <div className="bg-white rounded-lg border border-slate-200 p-4" data-testid="hist-gantt">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setYearOffset((y) => y - 1)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1">
                    <ChevronLeft className="w-3 h-3"/> Año anterior
                  </button>
                  <h3 className="font-bold text-slate-900">{ganttData.baseYear}</h3>
                  <button onClick={() => setYearOffset((y) => y + 1)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1">
                    Siguiente año <ChevronRight className="w-3 h-3"/>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left p-1.5 w-32 text-slate-600">Categoría</th>
                        {ganttData.meses.map((m) => <th key={m} className="p-1 text-slate-500 font-normal">{m}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(ganttData.filas).map(([cat, items]) => (
                        <tr key={cat} className="border-t border-slate-100">
                          <td className="p-1.5 text-slate-700 font-medium">{cat}</td>
                          {ganttData.meses.map((_, mi) => {
                            const cell = items.filter((it) => it.m === mi);
                            return (
                              <td key={mi} className="p-1 text-center">
                                {cell.length > 0 && (
                                  <span title={cell.map((c) => `${c.item.titulo} (${fmtSolo(c.item.fecha)})`).join("\n")}
                                        className={`inline-block w-5 h-5 rounded ${cell[0].color}`} data-testid={`gantt-cell-${cat}-${mi}`}/>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default HistorialMusicos;
