import React from "react";

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
  </div>
);

const ColorInput = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)}
           className="w-9 h-9 rounded cursor-pointer border border-slate-200"/>
    <input value={value || ""} onChange={(e) => onChange(e.target.value)}
           className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm" placeholder="#000000"/>
  </div>
);

const GlobalSettings = ({ ajustes, onChange, onAssetPick }) => {
  const a = ajustes || {};
  const set = (k, v) => onChange({ ...a, [k]: v });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3" data-testid="global-settings">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">
        Ajustes globales
      </div>

      <Field label="Logo (URL)">
        <div className="flex gap-2">
          <input value={a.logo_url || ""} onChange={(e) => set("logo_url", e.target.value)}
                 className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm"
                 placeholder="https://…"
                 data-testid="inp-logo-url"/>
          <button onClick={() => onAssetPick("logo", (url) => set("logo_url", url))}
                  className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50 whitespace-nowrap"
                  data-testid="btn-pick-logo">📎</button>
        </div>
      </Field>

      {a.logo_url && <img src={a.logo_url} alt="logo" className="max-h-12 rounded border border-slate-200"/>}

      <Field label="Familia tipográfica" hint="CSS font-family — fallback recomendado para clientes de email">
        <input value={a.font_family || ""} onChange={(e) => set("font_family", e.target.value)}
               className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
               placeholder="Georgia, 'Times New Roman', serif"
               data-testid="inp-font-family"/>
      </Field>

      <Field label="URL de fuente personalizada (opcional)">
        <div className="flex gap-2">
          <input value={a.font_url || ""} onChange={(e) => set("font_url", e.target.value)}
                 className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm"
                 placeholder=".woff2"/>
          <button onClick={() => onAssetPick("font", (url) => set("font_url", url))}
                  className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50 whitespace-nowrap">📎</button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Color primario"><ColorInput value={a.color_primario} onChange={(v) => set("color_primario", v)} /></Field>
        <Field label="Color secundario"><ColorInput value={a.color_secundario} onChange={(v) => set("color_secundario", v)} /></Field>
        <Field label="Fondo"><ColorInput value={a.color_fondo} onChange={(v) => set("color_fondo", v)} /></Field>
        <Field label="Texto"><ColorInput value={a.color_texto} onChange={(v) => set("color_texto", v)} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ancho máx. (px)">
          <input type="number" min="320" max="800" step="10" value={a.ancho_max || 600}
                 onChange={(e) => set("ancho_max", parseInt(e.target.value) || 600)}
                 className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"/>
        </Field>
        <Field label="Padding (px)">
          <input type="number" min="0" max="64" value={a.padding ?? 32}
                 onChange={(e) => set("padding", parseInt(e.target.value) || 0)}
                 className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"/>
        </Field>
      </div>
    </div>
  );
};

export default GlobalSettings;
