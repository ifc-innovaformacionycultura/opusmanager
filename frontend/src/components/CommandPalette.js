// Buscador rápido estilo Notion/Linear — Cmd/Ctrl+K
// Se abre con atajo de teclado o desde el icono Search del sidebar.
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";

const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const flattenNavItems = (items) => {
  const out = [];
  (items || []).forEach((it) => {
    if (!it) return;
    if (Array.isArray(it.children) && it.children.length > 0) {
      it.children.forEach((c) => {
        out.push({ id: c.id, label: c.label, path: c.path, grupo: it.label });
      });
    } else if (it.path) {
      out.push({ id: it.id, label: it.label, path: it.path, grupo: null });
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
    if (!q) return allPages;
    return allPages.filter((p) =>
      norm(p.label).includes(q) ||
      norm(p.grupo || "").includes(q) ||
      norm(p.path).includes(q)
    );
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

  const go = useCallback((path) => {
    onClose();
    navigate(path);
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
      if (sel) go(sel.path);
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
              return (
                <li key={`${p.id}-${p.path}`} data-idx={idx}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedIdx(idx)}
                    onClick={() => go(p.path)}
                    data-testid={`command-palette-item-${p.id}`}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p.label}</div>
                      <div className={`text-xs truncate ${active ? "text-slate-300" : "text-slate-500"}`}>
                        {p.grupo ? `${p.grupo} · ${p.path}` : p.path}
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
