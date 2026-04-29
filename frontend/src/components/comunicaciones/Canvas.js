import React from "react";
import { BLOCK_TYPES } from "./blockCatalog";

// Renderiza una pequeña vista textual del bloque para identificarlo en el lienzo.
function blockSummary(b) {
  const p = b.props || {};
  switch (b.tipo) {
    case "cabecera":   return p.titulo || "(cabecera)";
    case "texto":      return (p.html || "").replace(/<[^>]+>/g, "").slice(0, 60) || "(texto vacío)";
    case "imagen":     return p.url ? p.url.split("/").pop() : "(sin imagen)";
    case "imagen_texto_2col": return (p.html || "").replace(/<[^>]+>/g, "").slice(0, 40) || "(2 columnas)";
    case "boton":      return `${p.label || "(botón)"} → ${p.url || "#"}`;
    case "cita":       return `"${(p.texto || "").slice(0, 50)}" — ${p.autor || ""}`;
    case "lista":      return (p.items || []).slice(0, 3).join(" · ");
    case "galeria":    return `${(p.urls || []).length} imágenes`;
    case "video":      return p.url || "(sin URL)";
    case "redes_sociales": {
      const keys = ["instagram","facebook","twitter","youtube","linkedin","web"]
        .filter((k) => (p[k] || "").trim());
      return keys.length ? keys.join(" · ") : "(sin redes)";
    }
    case "separador":  return `Línea ${p.grosor || 1}px ${p.color || ""}`;
    case "pie":        return p.texto || "(pie vacío)";
    default:           return b.tipo;
  }
}

const Canvas = ({ bloques, selectedId, onSelect, onMove, onDuplicate, onDelete }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 min-h-[300px]" data-testid="bloques-canvas">
      <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2 px-1">
        Estructura del email · {bloques.length} bloque{bloques.length === 1 ? "" : "s"}
      </div>
      {bloques.length === 0 && (
        <div className="text-sm text-slate-500 text-center py-10 border-2 border-dashed border-slate-200 rounded-md">
          Añade bloques desde la barra lateral derecha →
        </div>
      )}
      <ul className="space-y-2">
        {bloques.map((b, i) => {
          const meta = BLOCK_TYPES.find((t) => t.tipo === b.tipo);
          const active = selectedId === b.id;
          return (
            <li key={b.id}
                onClick={() => onSelect(b.id)}
                className={`group p-3 rounded-md border cursor-pointer transition flex items-start gap-3 ${
                  active
                    ? "border-amber-500 bg-amber-50 ring-1 ring-amber-200"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
                data-testid={`bloque-${b.tipo}-${i}`}>
              <span className="text-xl shrink-0">{meta?.icon || "▣"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{meta?.label || b.tipo}</span>
                  <span className="text-[10px] text-slate-400">#{i + 1}</span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5 truncate">{blockSummary(b)}</div>
              </div>
              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                <button onClick={(e) => { e.stopPropagation(); onMove(b.id, -1); }}
                        disabled={i === 0}
                        className="text-[11px] w-6 h-6 rounded hover:bg-white border border-slate-200 disabled:opacity-30"
                        data-testid={`btn-move-up-${i}`}
                        title="Subir">↑</button>
                <button onClick={(e) => { e.stopPropagation(); onMove(b.id, +1); }}
                        disabled={i === bloques.length - 1}
                        className="text-[11px] w-6 h-6 rounded hover:bg-white border border-slate-200 disabled:opacity-30"
                        data-testid={`btn-move-down-${i}`}
                        title="Bajar">↓</button>
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(b.id); }}
                        className="text-[11px] w-6 h-6 rounded hover:bg-white border border-slate-200"
                        data-testid={`btn-duplicate-${i}`}
                        title="Duplicar">⎘</button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(b.id); }}
                        className="text-[11px] w-6 h-6 rounded hover:bg-rose-50 border border-rose-200 text-rose-600"
                        data-testid={`btn-delete-${i}`}
                        title="Eliminar">✕</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Canvas;
