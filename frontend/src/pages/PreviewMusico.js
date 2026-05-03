// Bloque B — Panel admin: /admin/preview-musico
// Permite a admins/director_general seleccionar un músico y abrir su portal
// en una vista previa de solo lectura (iframe con marco de smartphone).
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Eye, Search, ExternalLink, RotateCw, Smartphone, UserCircle2, Menu } from "lucide-react";

const avatarColors = [
  "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500",
  "bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-teal-500",
];

const estadoBadge = (estado) => {
  const map = {
    activo: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pendiente: "bg-amber-100 text-amber-700 border-amber-200",
    invitado: "bg-blue-100 text-blue-700 border-blue-200",
    inactivo: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const e = (estado || "activo").toLowerCase();
  return map[e] || map.activo;
};

const PreviewMusico = () => {
  const { api, user } = useAuth();
  const [musicos, setMusicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [generando, setGenerando] = useState(false);
  const [horaActual, setHoraActual] = useState(new Date());
  // Iter C · 3A — tamaño frame responsivo + sidebar colapsable en pantallas estrechas
  const [viewportW, setViewportW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => { setSidebarOpen(viewportW >= 1200); }, [viewportW]);
  const frameSize = viewportW < 1400 ? { w: 375, h: 812 } : { w: 414, h: 896 };

  const isAdmin = useMemo(() => {
    const rol = user?.rol || user?.profile?.rol;
    if (rol === "admin" || rol === "director_general") return true;
    return (user?.email || "").toLowerCase() === "admin@convocatorias.com";
  }, [user]);

  const cargarMusicos = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/gestor/musicos");
      const list = Array.isArray(r.data) ? r.data : (r.data?.musicos || []);
      setMusicos(list.filter((m) => (m.rol || "musico") === "musico"));
    } catch (e) {
      console.error("[PreviewMusico] error musicos", e);
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { cargarMusicos(); }, [cargarMusicos]);

  // Reloj
  useEffect(() => {
    const id = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Countdown
  useEffect(() => {
    if (!tokenInfo?.expira_at) { setCountdown(""); return; }
    const tick = () => {
      const exp = new Date(tokenInfo.expira_at).getTime();
      const diff = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      const mm = String(Math.floor(diff / 60)).padStart(2, "0");
      const ss = String(diff % 60).padStart(2, "0");
      setCountdown(`${mm}:${ss}`);
      if (diff === 0) { setTokenInfo(null); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tokenInfo]);

  const filtrados = useMemo(() => {
    const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const q = norm(busqueda.trim());
    if (!q) return musicos;
    return musicos.filter((m) => (
      norm(m.nombre).includes(q) ||
      norm(m.apellidos).includes(q) ||
      norm(m.instrumento).includes(q)
    ));
  }, [musicos, busqueda]);

  const generarToken = async () => {
    if (!seleccionado) return;
    setGenerando(true);
    try {
      const r = await api.post("/api/gestor/preview/generar-token", { musico_id: seleccionado.id });
      setTokenInfo(r.data);
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    } finally { setGenerando(false); }
  };

  const abrirNuevaPestana = () => {
    if (tokenInfo?.token) window.open(`/portal-preview/${tokenInfo.token}`, "_blank");
  };

  const expMinutos = useMemo(() => {
    if (!tokenInfo?.expira_at) return 0;
    return Math.max(0, Math.floor((new Date(tokenInfo.expira_at).getTime() - Date.now()) / 60000));
  }, [tokenInfo, countdown]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded">
          Esta sección solo está disponible para administradores y dirección general.
        </div>
      </div>
    );
  }

  const color = (m) => avatarColors[Math.abs((m.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % avatarColors.length];

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-100 relative" data-testid="preview-musico-page" style={{ overflow: 'hidden' }}>
      {/* Botón toggle sidebar (solo en pantallas estrechas < 1200px) */}
      {viewportW < 1200 && (
        <button
          onClick={() => setSidebarOpen(o => !o)}
          data-testid="preview-toggle-sidebar"
          className="absolute top-3 left-3 z-30 bg-slate-900 text-white px-3 py-2 rounded text-xs font-medium inline-flex items-center gap-1.5 shadow-lg hover:bg-slate-700"
        >
          <Menu className="w-4 h-4"/> {sidebarOpen ? 'Ocultar' : '☰ Músicos'}
        </button>
      )}
      {/* Panel izquierdo */}
      <aside
        className={`w-[320px] bg-slate-50 border-r border-slate-200 flex flex-col transition-all duration-200 ${sidebarOpen ? '' : 'hidden'}`}
        data-testid="preview-sidebar"
      >
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
            <Eye className="w-5 h-5"/> Vista previa portal músico
          </h1>
          <p className="text-xs text-slate-600 mt-1">Selecciona un músico para ver su portal en formato móvil.</p>
        </div>

        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2 top-2.5"/>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre, instrumento…"
              data-testid="preview-search-input"
              className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1" data-testid="preview-musico-list">
          {loading && <div className="text-xs text-slate-500 p-3">Cargando…</div>}
          {!loading && filtrados.length === 0 && <div className="text-xs text-slate-500 p-3 italic">Sin resultados.</div>}
          {filtrados.map((m) => {
            const activo = seleccionado?.id === m.id;
            const inicial = (m.nombre || "?").slice(0, 1).toUpperCase();
            return (
              <button key={m.id}
                      onClick={() => { setSeleccionado(m); setTokenInfo(null); }}
                      data-testid={`preview-musico-item-${m.id}`}
                      className={`w-full flex items-center gap-2 p-2 rounded text-left transition-colors ${activo ? "bg-blue-100 border border-blue-300" : "hover:bg-white border border-transparent"}`}>
                <div className={`w-8 h-8 rounded-full ${color(m)} text-white font-semibold text-sm flex items-center justify-center shrink-0`}>{inicial}</div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm ${activo ? "font-bold text-blue-900" : "font-medium text-slate-900"}`}>
                    {m.nombre} {m.apellidos}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{m.instrumento || "—"}</div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${estadoBadge(m.estado_invitacion || m.estado)}`}>
                  {m.estado_invitacion || m.estado || "—"}
                </span>
              </button>
            );
          })}
        </div>

        {seleccionado && (
          <div className="p-3 border-t border-slate-200 space-y-2 bg-white">
            <div className="text-xs text-slate-600">Seleccionado: <strong>{seleccionado.nombre} {seleccionado.apellidos}</strong></div>
            <button onClick={generarToken} disabled={generando}
                    data-testid="preview-generar-btn"
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50">
              <Search className="w-4 h-4"/> {generando ? "Generando…" : "Generar vista previa"}
            </button>
            {tokenInfo && (
              <div className="space-y-1.5">
                <div className="text-xs text-slate-700">Expira en: <span className="font-mono font-semibold text-slate-900" data-testid="preview-countdown">{countdown}</span></div>
                <button onClick={abrirNuevaPestana} data-testid="preview-open-tab"
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs inline-flex items-center justify-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5"/> Abrir en nueva pestaña
                </button>
                {expMinutos < 5 && (
                  <button onClick={generarToken} disabled={generando} data-testid="preview-renovar"
                          className="w-full py-1.5 border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-xs inline-flex items-center justify-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5"/> Renovar token
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Panel derecho con smartphone frame */}
      <main className="flex-1 flex items-center justify-center p-6 bg-[#1a1a1a]" style={{ overflow: 'hidden', maxHeight: 'calc(100vh - 64px)' }}>
        <div className="relative" style={{ width: frameSize.w, height: frameSize.h, maxHeight: 'calc(100vh - 120px)' }}>
          {/* Frame iPhone */}
          <div className="absolute inset-0 bg-black rounded-[48px] p-[12px] shadow-2xl border border-slate-700" style={{ overflow: 'hidden' }}>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-20 flex items-center justify-center">
              <div className="w-16 h-1.5 bg-slate-800 rounded-full"/>
            </div>
            <div className="relative w-full h-full bg-white rounded-[36px] overflow-hidden">
              {/* Barra superior decorativa */}
              <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-between px-8 text-[11px] font-semibold text-slate-900 z-10 bg-white">
                <span>{horaActual.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                <div className="flex items-center gap-1 text-slate-700">
                  <span>•••</span><span>📶</span><span>🔋</span>
                </div>
              </div>

              {/* Contenido: iframe o mensaje */}
              {tokenInfo?.token ? (
                <iframe
                  key={tokenInfo.token}
                  src={`/portal-preview/${tokenInfo.token}`}
                  title="Vista previa portal músico"
                  data-testid="preview-iframe"
                  className="w-full h-full border-0 pt-8 pb-6"/>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-8 pt-8 pb-6">
                  <Smartphone className="w-16 h-16 text-slate-300 mb-4"/>
                  <p className="text-sm text-slate-500">Selecciona un músico y pulsa <strong>“Generar vista previa”</strong> para comenzar.</p>
                </div>
              )}

              {/* Indicador home */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-900 rounded-full"/>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PreviewMusico;
