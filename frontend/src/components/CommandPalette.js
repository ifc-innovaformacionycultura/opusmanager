// Buscador rápido estilo Notion/Linear — Cmd/Ctrl+K
// Se abre con atajo de teclado o desde el icono Search del sidebar.
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Zap } from "lucide-react";

const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Acciones rápidas — se ejecutan navegando a la ruta (si es distinta de la actual) y emitiendo un CustomEvent
// que las páginas escuchan para abrir modales sin acoplar directamente los componentes.
const QUICK_ACTIONS = [
  {
    id: "accion-nuevo-evento",
    label: "Crear evento",
    hint: "Abre el formulario de nuevo evento",
    aliases: ["crear evento", "nuevo evento", "new event", "add event"],
    path: "/configuracion/eventos",
    event: "opus:nuevo-evento",
  },
  {
    id: "accion-invitar-musico",
    label: "Invitar músico",
    hint: "Ir a la base de datos para invitar",
    aliases: ["invitar musico", "invitar músico", "invite"],
    path: "/admin/musicos",
    event: "opus:invitar-musico",
  },
  {
    id: "accion-nueva-tarea",
    label: "Nueva tarea",
    hint: "Abre el modal de nueva tarea en el planificador",
    aliases: ["nueva tarea", "crear tarea", "task", "add task"],
    path: "/admin/tareas",
    event: "opus:nueva-tarea",
  },
  {
    id: "accion-nuevo-contacto-crm",
    label: "Nuevo contacto CRM",
    hint: "Comentar con el equipo",
    aliases: ["contacto crm", "nuevo contacto", "comentarios equipo", "crm"],
    event: "opus:open-comentarios-equipo",
  },
  {
    id: "accion-ver-solicitudes",
    label: "Ver solicitudes",
    hint: "Abrir panel de solicitudes de registro",
    aliases: ["solicitudes", "solicitudes registro", "peticiones", "aprobar"],
    path: "/admin/musicos",
    event: "opus:solicitudes-registro",
  },
];

const flattenNavItems = (items) => {
  const out = [];
  (items || []).forEach((it) => {
    if (!it) return;
    if (Array.isArray(it.children) && it.children.length > 0) {
      it.children.forEach((c) => {
        out.push({ id: c.id, label: c.label, path: c.path, grupo: it.label, kind: "page" });
      });
    } else if (it.path) {
      out.push({ id: it.id, label: it.label, path: it.path, grupo: null, kind: "page" });
    }
  });
  return out;
};

const CommandPalette = ({ open, onClose, navItems }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const allPages = useMemo(() => flattenNavItems(navItems), [navItems]);

  const resultados = useMemo(() => {
    const q = norm(query.trim());
    // Acciones marcadas con kind='action'
    const acciones = QUICK_ACTIONS.map((a) => ({ ...a, kind: "action" }));
    const combinado = [...acciones, ...allPages];
    if (!q) return combinado;

    // Ranking: acciones con match en alias > páginas con match en label > resto
    const scored = combinado.map((it) => {
      let score = 0;
      const label = norm(it.label);
      const grupo = norm(it.grupo || "");
      const path = norm(it.path || "");
      if (it.kind === "action") {
        const aliases = (it.aliases || []).map(norm);
        if (aliases.some((a) => a === q)) score = 100;
        else if (aliases.some((a) => a.startsWith(q))) score = 90;
        else if (aliases.some((a) => a.includes(q))) score = 80;
        else if (label.includes(q)) score = 70;
      } else {
        if (label === q) score = 95;
        else if (label.startsWith(q)) score = 75;
        else if (label.includes(q)) score = 60;
        else if (grupo.includes(q)) score = 50;
        else if (path.includes(q)) score = 40;
      }
      return { it, score };
    }).filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it);
    return scored;
  }, [query, allPages]);

  // Auto-focus y reset al abrir
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset índice cuando cambian los resultados
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Auto-scroll al item seleccionado
  useEffect(() => {
    const active = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const go = useCallback((item) => {
    onClose();
    if (item.kind === "action") {
      const needsNavigate = item.path && typeof window !== "undefined" && window.location.pathname !== item.path;
      if (needsNavigate) {
        navigate(item.path);
        // Delay para esperar que la página se monte y su listener esté registrado
        setTimeout(() => window.dispatchEvent(new CustomEvent(item.event)), 800);
      } else if (item.event) {
        window.dispatchEvent(new CustomEvent(item.event));
      }
    } else {
      navigate(item.path);
    }
  }, [navigate, onClose]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = resultados[selectedIdx];
      if (sel) go(sel);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
         onClick={onClose}
         data-testid="command-palette">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400"/>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar páginas, grupos o rutas…"
            data-testid="command-palette-input"
            className="flex-1 bg-transparent border-0 outline-none text-sm text-slate-900 placeholder-slate-400"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">ESC</kbd>
        </div>

        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1" data-testid="command-palette-results">
          {resultados.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500 italic">
              Sin resultados para “{query}”
            </li>
          ) : (
            resultados.map((p, idx) => {
              const active = idx === selectedIdx;
              const isAction = p.kind === "action";
              return (
                <li key={`${p.id}-${p.path || p.event}`} data-idx={idx}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedIdx(idx)}
                    onClick={() => go(p)}
                    data-testid={`command-palette-item-${p.id}`}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${active ? (isAction ? "bg-amber-500 text-white" : "bg-slate-900 text-white") : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isAction && (
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-white/20" : "bg-amber-100"}`}>
                          <Zap className={`w-3.5 h-3.5 ${active ? "text-white" : "text-amber-600"}`}/>
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{p.label}</span>
                          {isAction && !active && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">acción</span>
                          )}
                        </div>
                        <div className={`text-xs truncate ${active ? (isAction ? "text-amber-50" : "text-slate-300") : "text-slate-500"}`}>
                          {isAction ? p.hint : (p.grupo ? `${p.grupo} · ${p.path}` : p.path)}
                        </div>
                      </div>
                    </div>
                    {active && <CornerDownLeft className="w-3.5 h-3.5 shrink-0"/>}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <footer className="flex items-center justify-between px-4 py-2 text-[11px] text-slate-500 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><ArrowUp className="w-3 h-3"/><ArrowDown className="w-3 h-3"/> navegar</span>
            <span className="inline-flex items-center gap-1"><CornerDownLeft className="w-3 h-3"/> abrir</span>
          </div>
          <span>{resultados.length} resultados</span>
        </footer>
      </div>
    </div>
  );
};

export default CommandPalette;
