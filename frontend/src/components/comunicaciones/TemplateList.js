import React from "react";

const ESTADO_BADGE = {
  borrador: { cls: "bg-slate-100 text-slate-600", label: "Borrador" },
  publicada: { cls: "bg-emerald-100 text-emerald-700", label: "Publicada" },
  archivada: { cls: "bg-amber-100 text-amber-700", label: "Archivada" },
};

const TemplateList = ({ plantillas, plantillaActivaId, onSelect, onCreate, onDuplicate, onDelete, loading }) => {
  return (
    <aside className="w-72 shrink-0 bg-white border border-slate-200 rounded-lg flex flex-col" data-testid="template-list-pane">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="font-semibold text-slate-800 text-sm">Plantillas</span>
        <button
          onClick={onCreate}
          className="text-xs px-2.5 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800"
          data-testid="btn-nueva-plantilla"
        >+ Nueva</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-xs text-slate-500">Cargando…</div>}
        {!loading && plantillas.length === 0 && (
          <div className="p-4 text-xs text-slate-500">
            No hay plantillas todavía.<br/>Crea la primera con <strong>+ Nueva</strong>.
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {plantillas.map((p) => {
            const isActive = plantillaActivaId === p.id;
            const badge = ESTADO_BADGE[p.estado] || ESTADO_BADGE.borrador;
            return (
              <li key={p.id}
                  className={`group px-3 py-2.5 cursor-pointer ${isActive ? "bg-amber-50 border-l-4 border-amber-500" : "hover:bg-slate-50 border-l-4 border-transparent"}`}
                  onClick={() => onSelect(p.id)}
                  data-testid={`template-item-${p.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">{p.nombre || "(sin nombre)"}</div>
                    <div className="text-[11px] text-slate-500 truncate">{p.tema_preset?.replace('_', ' · ')}</div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                </div>
                {isActive && (
                  <div className="mt-2 flex gap-2 opacity-90">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDuplicate(p.id); }}
                      className="text-[11px] px-2 py-0.5 rounded border border-slate-300 hover:bg-white"
                      data-testid={`btn-duplicar-${p.id}`}
                    >Duplicar</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                      className="text-[11px] px-2 py-0.5 rounded border border-rose-300 text-rose-600 hover:bg-rose-50"
                      data-testid={`btn-eliminar-${p.id}`}
                    >Eliminar</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};

export default TemplateList;
