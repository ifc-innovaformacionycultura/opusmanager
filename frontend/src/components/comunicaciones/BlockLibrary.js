import React from "react";
import { BLOCK_TYPES } from "./blockCatalog";

const BlockLibrary = ({ onAdd }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3" data-testid="block-library">
      <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2 px-1">
        Añadir bloque
      </div>
      <div className="grid grid-cols-2 gap-2">
        {BLOCK_TYPES.map((t) => (
          <button
            key={t.tipo}
            onClick={() => onAdd(t.tipo)}
            className="p-2 rounded-md border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-left transition"
            data-testid={`add-block-${t.tipo}`}
            title={`Añadir ${t.label}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{t.icon}</span>
              <span className="text-xs font-medium text-slate-700">{t.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BlockLibrary;
