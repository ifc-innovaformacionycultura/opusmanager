import React from "react";
import { PRESET_THEMES } from "./blockCatalog";

const ThemeSelector = ({ value, onChange, onApplyPreset }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="theme-selector">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-800">Tema estético</span>
        <button
          onClick={onApplyPreset}
          className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
          title="Restaurar bloques y ajustes del tema seleccionado"
          data-testid="btn-aplicar-preset"
        >🔄 Restaurar tema</button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {PRESET_THEMES.map((t) => {
          const active = value === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`text-left p-3 rounded-md border transition ${
                active
                  ? "border-amber-500 bg-amber-50 ring-1 ring-amber-200"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
              data-testid={`theme-option-${t.key}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{t.icon}</span>
                <span className="font-medium text-sm text-slate-900">{t.label}</span>
                {active && <span className="ml-auto text-[10px] uppercase font-bold text-amber-700">activo</span>}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 ml-7">{t.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
