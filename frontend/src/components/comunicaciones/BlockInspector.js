import React from "react";
import { VARIABLES_DISPONIBLES } from "./blockCatalog";

// Pequeñas primitivas de UI -----------------------------------------------------

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
  </div>
);

const Input = (props) => (
  <input {...props} className={"w-full px-2 py-1.5 border border-slate-200 rounded text-sm " + (props.className || "")} />
);

const Textarea = (props) => (
  <textarea {...props} className={"w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-mono " + (props.className || "")} />
);

const Select = ({ value, onChange, options, ...rest }) => (
  <select {...rest} value={value} onChange={onChange} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-white">
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const ColorInput = ({ value, onChange, testid }) => (
  <div className="flex items-center gap-2">
    <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)}
           className="w-9 h-9 rounded cursor-pointer border border-slate-200"
           data-testid={testid}/>
    <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="#000000" />
  </div>
);

const VariablesHelp = () => (
  <details className="text-[11px] mt-2">
    <summary className="cursor-pointer text-slate-500 hover:text-slate-800">📌 Variables disponibles</summary>
    <ul className="mt-1 ml-3 space-y-0.5">
      {VARIABLES_DISPONIBLES.map((v) => (
        <li key={v.key} className="text-slate-600">
          <code className="bg-slate-100 px-1 rounded">{`{${v.key}}`}</code> — {v.desc}
        </li>
      ))}
    </ul>
  </details>
);

// Inspector ---------------------------------------------------------------------

const BlockInspector = ({ block, onChange, onAssetPick }) => {
  if (!block) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4 text-center text-sm text-slate-500">
        Selecciona un bloque del lienzo para editar sus propiedades.
      </div>
    );
  }

  const p = block.props || {};
  const set = (k, v) => onChange({ ...block, props: { ...p, [k]: v } });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3" data-testid={`inspector-${block.tipo}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Propiedades</span>
        <span className="text-[10px] text-slate-400">{block.tipo}</span>
      </div>

      {block.tipo === "cabecera" && (
        <>
          <Field label="Título"><Input value={p.titulo || ""} onChange={(e) => set("titulo", e.target.value)} data-testid="inp-titulo"/></Field>
          <Field label="Subtítulo"><Input value={p.subtitulo || ""} onChange={(e) => set("subtitulo", e.target.value)} /></Field>
          <Field label="Alineación">
            <Select value={p.alineacion || "left"} onChange={(e) => set("alineacion", e.target.value)} options={[
              { value: "left", label: "Izquierda" }, { value: "center", label: "Centrada" }, { value: "right", label: "Derecha" }
            ]} />
          </Field>
          <Field label="Estilo de cabecera">
            <Select value={p.estilo || "navy_gold"} onChange={(e) => set("estilo", e.target.value)} options={[
              { value: "navy_gold", label: "Navy + dorado" },
              { value: "minimal", label: "Minimal" },
              { value: "festival", label: "Festival cálido" },
            ]} />
          </Field>
          <VariablesHelp/>
        </>
      )}

      {block.tipo === "texto" && (
        <>
          <Field label="HTML del párrafo" hint="Tags básicos: <p>, <strong>, <em>, <a>, <h2>, <br/>">
            <Textarea rows={8} value={p.html || ""} onChange={(e) => set("html", e.target.value)} data-testid="inp-html"/>
          </Field>
          <VariablesHelp/>
        </>
      )}

      {block.tipo === "imagen" && (
        <>
          <Field label="URL de la imagen">
            <div className="flex gap-2">
              <Input value={p.url || ""} onChange={(e) => set("url", e.target.value)} placeholder="https://…" data-testid="inp-img-url"/>
              <button onClick={() => onAssetPick("imagen", (url) => set("url", url))}
                      className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50 whitespace-nowrap"
                      data-testid="btn-pick-img">📎 Elegir</button>
            </div>
          </Field>
          {p.url && <img src={p.url} alt="" className="max-h-32 rounded border border-slate-200 mx-auto"/>}
          <Field label="Texto alternativo"><Input value={p.alt || ""} onChange={(e) => set("alt", e.target.value)} /></Field>
        </>
      )}

      {block.tipo === "imagen_texto_2col" && (
        <>
          <Field label="URL imagen">
            <div className="flex gap-2">
              <Input value={p.url || ""} onChange={(e) => set("url", e.target.value)} />
              <button onClick={() => onAssetPick("imagen", (url) => set("url", url))}
                      className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50 whitespace-nowrap">📎</button>
            </div>
          </Field>
          <Field label="Texto HTML">
            <Textarea rows={5} value={p.html || ""} onChange={(e) => set("html", e.target.value)} />
          </Field>
          <Field label="Disposición">
            <Select value={p.invertir ? "1" : "0"} onChange={(e) => set("invertir", e.target.value === "1")} options={[
              { value: "0", label: "Imagen izquierda · Texto derecha" },
              { value: "1", label: "Texto izquierda · Imagen derecha" },
            ]}/>
          </Field>
        </>
      )}

      {block.tipo === "boton" && (
        <>
          <Field label="Etiqueta"><Input value={p.label || ""} onChange={(e) => set("label", e.target.value)} data-testid="inp-btn-label"/></Field>
          <Field label="URL destino" hint="Puedes usar {portal_url}">
            <Input value={p.url || ""} onChange={(e) => set("url", e.target.value)} data-testid="inp-btn-url"/>
          </Field>
          <Field label="Color de fondo"><ColorInput value={p.color} onChange={(v) => set("color", v)} testid="inp-btn-bg"/></Field>
          <Field label="Color texto"><ColorInput value={p.texto_color} onChange={(v) => set("texto_color", v)} /></Field>
        </>
      )}

      {block.tipo === "cita" && (
        <>
          <Field label="Texto de la cita"><Textarea rows={3} value={p.texto || ""} onChange={(e) => set("texto", e.target.value)} /></Field>
          <Field label="Autor"><Input value={p.autor || ""} onChange={(e) => set("autor", e.target.value)} /></Field>
        </>
      )}

      {block.tipo === "lista" && (
        <>
          <Field label="Items (uno por línea)">
            <Textarea rows={6} value={(p.items || []).join("\n")}
                      onChange={(e) => set("items", e.target.value.split("\n").filter((x) => x !== ""))}/>
          </Field>
          <Field label="Tipo de lista">
            <Select value={p.ordenada ? "1" : "0"} onChange={(e) => set("ordenada", e.target.value === "1")} options={[
              { value: "0", label: "Sin numerar (•)" }, { value: "1", label: "Numerada (1, 2, 3…)" }
            ]} />
          </Field>
        </>
      )}

      {block.tipo === "galeria" && (
        <>
          <Field label="URLs (1 por línea, máx 6)">
            <Textarea rows={5} value={(p.urls || []).join("\n")}
                      onChange={(e) => set("urls", e.target.value.split("\n").filter((x) => x.trim()).slice(0, 6))}/>
          </Field>
          <button
            onClick={() => onAssetPick("imagen", (url) => set("urls", [...(p.urls || []), url].slice(0, 6)))}
            className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50">
            📎 Añadir desde biblioteca
          </button>
        </>
      )}

      {block.tipo === "video" && (
        <>
          <Field label="URL del vídeo (YouTube, Vimeo, etc.)"><Input value={p.url || ""} onChange={(e) => set("url", e.target.value)} /></Field>
          <Field label="URL de la miniatura (opcional)">
            <div className="flex gap-2">
              <Input value={p.thumbnail || ""} onChange={(e) => set("thumbnail", e.target.value)} />
              <button onClick={() => onAssetPick("imagen", (url) => set("thumbnail", url))}
                      className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50 whitespace-nowrap">📎</button>
            </div>
          </Field>
        </>
      )}

      {block.tipo === "redes_sociales" && (
        <>
          {["instagram","facebook","twitter","youtube","linkedin","web"].map((k) => (
            <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
              <Input value={p[k] || ""} onChange={(e) => set(k, e.target.value)} placeholder={`https://${k === "web" ? "tu-orquesta.com" : k + ".com/usuario"}`} />
            </Field>
          ))}
        </>
      )}

      {block.tipo === "separador" && (
        <>
          <Field label="Color"><ColorInput value={p.color} onChange={(v) => set("color", v)} /></Field>
          <Field label="Grosor (px)"><Input type="number" min="1" max="10" value={p.grosor || 1} onChange={(e) => set("grosor", parseInt(e.target.value) || 1)} /></Field>
        </>
      )}

      {block.tipo === "pie" && (
        <>
          <Field label="Texto"><Textarea rows={3} value={p.texto || ""} onChange={(e) => set("texto", e.target.value)} /></Field>
          <Field label="Estilo">
            <Select value={p.estilo || "navy_gold"} onChange={(e) => set("estilo", e.target.value)} options={[
              { value: "navy_gold", label: "Navy + dorado" },
              { value: "minimal", label: "Minimal" },
              { value: "festival", label: "Festival" },
            ]} />
          </Field>
        </>
      )}
    </div>
  );
};

export default BlockInspector;
