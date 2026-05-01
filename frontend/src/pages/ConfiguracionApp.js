import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Settings, Building2, UserCheck, Coins, Palette, Clock, Upload, Save, RotateCcw, UserPlus, Bell, Copy, RefreshCw, Power } from "lucide-react";

const Section = ({ icon: Icon, title, children, color = "slate" }) => (
  <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
    <header className={`px-4 py-2.5 bg-${color}-50 border-b border-${color}-200 flex items-center gap-2`}>
      <Icon className={`w-4 h-4 text-${color}-700`} />
      <h2 className="font-semibold text-sm text-slate-800 uppercase tracking-wide">{title}</h2>
    </header>
    <div className="p-4 space-y-3">{children}</div>
  </section>
);

const Field = ({ label, hint, children, span = 1 }) => (
  <div className={`md:col-span-${span}`}>
    <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
  </div>
);

const Input = ({ readOnly, ...props }) => (
  <input {...props} readOnly={readOnly}
         className={`w-full px-2 py-1.5 border border-slate-200 rounded text-sm ${readOnly ? "bg-slate-50 cursor-not-allowed" : ""}`}/>
);

const ColorInput = ({ value, onChange, readOnly, testid }) => (
  <div className="flex items-center gap-2">
    <input type="color" value={value || "#000000"} disabled={readOnly}
           onChange={(e) => onChange(e.target.value)}
           data-testid={testid}
           className="w-9 h-9 rounded cursor-pointer border border-slate-200 disabled:opacity-50"/>
    <Input value={value || ""} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} placeholder="#000000"/>
  </div>
);

const ImageUpload = ({ url, onUpload, label, readOnly, testid, accept = "image/*" }) => {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-start gap-3">
      {url ? (
        <img src={url} alt={label} className="h-16 w-auto max-w-[200px] object-contain border border-slate-200 rounded p-1 bg-white"/>
      ) : (
        <div className="h-16 w-32 border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-[10px] text-slate-400">sin imagen</div>
      )}
      {!readOnly && (
        <>
          <input ref={ref} type="file" accept={accept} className="hidden"
                 data-testid={`${testid}-file`}
                 onChange={async (e) => {
                   const f = e.target.files?.[0];
                   if (!f) return;
                   setBusy(true);
                   try { await onUpload(f); } finally { setBusy(false); e.target.value = ""; }
                 }}/>
          <button type="button" onClick={() => ref.current?.click()} disabled={busy}
                  data-testid={testid}
                  className="px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1">
            <Upload className="w-3 h-3"/> {busy ? "Subiendo…" : "Subir"}
          </button>
        </>
      )}
    </div>
  );
};

const ConfiguracionApp = () => {
  const { api, user } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [reglas, setReglas] = useState(null);
  const [editable, setEditable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingReglas, setSavingReglas] = useState(false);
  const [precargando, setPrecargando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [registroCfg, setRegistroCfg] = useState(null);
  const [savingRegistro, setSavingRegistro] = useState(false);

  const load = async () => {
    try {
      const [c, r, rp] = await Promise.all([
        api.get("/api/admin/configuracion"),
        api.get("/api/admin/fichaje-reglas"),
        api.get("/api/admin/registro-publico/config"),
      ]);
      setCfg(c.data?.configuracion || {});
      setEditable(!!c.data?.editable);
      setReglas(r.data?.reglas || {});
      setRegistroCfg(rp.data?.config || null);
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const setR = (k, v) => setReglas((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    setSaving(true); setFeedback(null);
    try {
      await api.put("/api/admin/configuracion", {
        org_nombre: cfg.org_nombre, org_cif: cfg.org_cif, org_direccion: cfg.org_direccion,
        org_telefono: cfg.org_telefono, org_email: cfg.org_email, org_web: cfg.org_web,
        director_nombre: cfg.director_nombre, director_cargo: cfg.director_cargo,
        irpf_porcentaje: parseFloat(cfg.irpf_porcentaje) || 0,
        color_primario: cfg.color_primario, color_secundario: cfg.color_secundario,
        dias_alerta_datos_bancarios: parseInt(cfg.dias_alerta_datos_bancarios) || 30,
      });
      setFeedback({ tipo: "ok", msg: "✅ Configuración guardada" });
      setTimeout(() => setFeedback(null), 3000);
      await load();
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally { setSaving(false); }
  };

  const guardarReglas = async () => {
    setSavingReglas(true); setFeedback(null);
    try {
      await api.put("/api/admin/fichaje-reglas", {
        minutos_antes_apertura: parseInt(reglas.minutos_antes_apertura) || 30,
        minutos_despues_cierre: parseInt(reglas.minutos_despues_cierre) || 30,
        minutos_retraso_aviso: parseInt(reglas.minutos_retraso_aviso) || 5,
        computa_tiempo_extra: !!reglas.computa_tiempo_extra,
        computa_mas_alla_fin: !!reglas.computa_mas_alla_fin,
      });
      setFeedback({ tipo: "ok", msg: "✅ Reglas de fichaje guardadas" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally { setSavingReglas(false); }
  };

  const precargar = async () => {
    if (!window.confirm("Esto copiará la configuración actual a TODOS los ensayos que no la tengan. ¿Continuar?")) return;
    setPrecargando(true);
    try {
      const r = await api.post("/api/admin/fichaje-reglas/precargar");
      setFeedback({ tipo: "ok", msg: `✅ Precargado a ${r.data.creados}/${r.data.total_ensayos} ensayos` });
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally { setPrecargando(false); }
  };

  const subirImagen = (kind) => async (file) => {
    const fd = new FormData(); fd.append("file", file);
    const url = kind === "logo"
      ? `/api/admin/configuracion/logo`
      : kind === "logo-sec"
      ? `/api/admin/configuracion/logo?secundario=true`
      : `/api/admin/configuracion/firma`;
    const r = await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
    if (r.data?.url) {
      const field = kind === "logo" ? "logo_url" : kind === "logo-sec" ? "logo_secundario_url" : "director_firma_url";
      set(field, r.data.url);
      setFeedback({ tipo: "ok", msg: "Imagen subida" });
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  // Registro público
  const guardarRegistro = async (extra = {}) => {
    setSavingRegistro(true);
    try {
      const body = {
        activo: registroCfg?.activo,
        mensaje_bienvenida: registroCfg?.mensaje_bienvenida,
        ...extra,
      };
      const r = await api.put("/api/admin/registro-publico/config", body);
      setRegistroCfg(r.data?.config || registroCfg);
      setFeedback({ tipo: "ok", msg: "✅ Registro público actualizado" });
      setTimeout(() => setFeedback(null), 2500);
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally { setSavingRegistro(false); }
  };

  const enlaceRegistro = registroCfg?.token
    ? `${window.location.origin}/registro/${registroCfg.token}`
    : "";

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(enlaceRegistro);
      setFeedback({ tipo: "ok", msg: "Enlace copiado al portapapeles" });
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      window.prompt("Copia el enlace:", enlaceRegistro);
    }
  };
  const qrUrl = enlaceRegistro
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(enlaceRegistro)}&size=240x240`
    : "";
  const whatsappUrl = enlaceRegistro
    ? `https://wa.me/?text=${encodeURIComponent(`¡Únete a la plataforma de ${cfg?.org_nombre || "IFC"}! Regístrate aquí: ${enlaceRegistro}`)}`
    : "";

  if (!cfg) return <div className="p-6 text-slate-500">Cargando configuración…</div>;

  return (
    <div className="p-6 space-y-4 max-w-5xl" data-testid="configuracion-app-page">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Settings className="w-7 h-7 text-slate-700"/>
          <div>
            <h1 className="font-cabinet text-2xl font-bold text-slate-900">Configuración</h1>
            <p className="text-sm text-slate-600">Datos de la organización, dirección artística, parámetros e identidad visual.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {feedback && (
            <span className={`text-xs px-3 py-1.5 rounded ${feedback.tipo === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                  data-testid="cfg-feedback">{feedback.msg}</span>
          )}
          {!editable && <span className="text-[11px] px-2 py-1 rounded bg-amber-100 text-amber-800">Modo solo lectura — solo admin / director general puede editar</span>}
        </div>
      </header>

      <Section icon={Building2} title="Datos de la organización" color="blue">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nombre organización"><Input value={cfg.org_nombre || ""} readOnly={!editable} onChange={(e) => set("org_nombre", e.target.value)} data-testid="inp-org-nombre"/></Field>
          <Field label="CIF"><Input value={cfg.org_cif || ""} readOnly={!editable} onChange={(e) => set("org_cif", e.target.value)}/></Field>
          <Field label="Dirección" span={2}><Input value={cfg.org_direccion || ""} readOnly={!editable} onChange={(e) => set("org_direccion", e.target.value)}/></Field>
          <Field label="Teléfono"><Input value={cfg.org_telefono || ""} readOnly={!editable} onChange={(e) => set("org_telefono", e.target.value)}/></Field>
          <Field label="Email"><Input value={cfg.org_email || ""} readOnly={!editable} onChange={(e) => set("org_email", e.target.value)}/></Field>
          <Field label="Web" span={2}><Input value={cfg.org_web || ""} readOnly={!editable} onChange={(e) => set("org_web", e.target.value)}/></Field>
        </div>
      </Section>

      <Section icon={UserCheck} title="Dirección artística" color="amber">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nombre del director"><Input value={cfg.director_nombre || ""} readOnly={!editable} onChange={(e) => set("director_nombre", e.target.value)} data-testid="inp-director-nombre"/></Field>
          <Field label="Cargo"><Input value={cfg.director_cargo || ""} readOnly={!editable} onChange={(e) => set("director_cargo", e.target.value)}/></Field>
          <Field label="Firma del director" span={2}>
            <ImageUpload url={cfg.director_firma_url} label="Firma" readOnly={!editable}
                         onUpload={subirImagen("firma")} testid="btn-upload-firma"/>
          </Field>
        </div>
      </Section>

      <Section icon={Coins} title="Parámetros económicos" color="emerald">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="IRPF (%)" hint="Porcentaje de retención aplicado en los recibos"><Input type="number" step="0.01" value={cfg.irpf_porcentaje ?? 15} readOnly={!editable} onChange={(e) => set("irpf_porcentaje", e.target.value)} data-testid="inp-irpf"/></Field>
        </div>
      </Section>

      <Section icon={Palette} title="Identidad visual" color="violet">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Logo principal" span={2}>
            <ImageUpload url={cfg.logo_url} label="Logo" readOnly={!editable} onUpload={subirImagen("logo")} testid="btn-upload-logo"/>
          </Field>
          <Field label="Logo secundario" span={2}>
            <ImageUpload url={cfg.logo_secundario_url} label="Logo secundario" readOnly={!editable} onUpload={subirImagen("logo-sec")} testid="btn-upload-logo-sec"/>
          </Field>
          <Field label="Color primario"><ColorInput value={cfg.color_primario} onChange={(v) => set("color_primario", v)} readOnly={!editable} testid="inp-color-primario"/></Field>
          <Field label="Color secundario"><ColorInput value={cfg.color_secundario} onChange={(v) => set("color_secundario", v)} readOnly={!editable} testid="inp-color-secundario"/></Field>
        </div>
        <div className="flex gap-3 items-center pt-2">
          <span className="text-xs text-slate-600">Preview:</span>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded text-white text-xs" style={{ background: cfg.color_primario || "#1A3A5C" }}>Color primario</span>
            <span className="px-3 py-1 rounded text-white text-xs" style={{ background: cfg.color_secundario || "#d4af37" }}>Color secundario</span>
          </div>
        </div>
      </Section>

      {editable && (
        <div className="flex justify-end">
          <button onClick={guardar} disabled={saving}
                  data-testid="btn-guardar-config"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium inline-flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4"/> {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      )}

      {/* Reglas de fichaje */}
      {reglas && (
        <Section icon={Clock} title="Reglas de fichaje (globales)" color="orange">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Minutos antes apertura QR" hint="Cuánto antes de la hora oficial se habilita el QR">
              <Input type="number" min="0" max="240" value={reglas.minutos_antes_apertura ?? 30} readOnly={!editable} onChange={(e) => setR("minutos_antes_apertura", e.target.value)} data-testid="inp-min-antes"/>
            </Field>
            <Field label="Minutos después fin (sin QR)" hint="Margen para fichar salida sin escanear">
              <Input type="number" min="0" max="240" value={reglas.minutos_despues_cierre ?? 30} readOnly={!editable} onChange={(e) => setR("minutos_despues_cierre", e.target.value)} data-testid="inp-min-despues"/>
            </Field>
            <Field label="Minutos retraso → aviso" hint="Genera alerta al gestor si llega más tarde">
              <Input type="number" min="0" max="60" value={reglas.minutos_retraso_aviso ?? 5} readOnly={!editable} onChange={(e) => setR("minutos_retraso_aviso", e.target.value)} data-testid="inp-min-retraso"/>
            </Field>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!reglas.computa_tiempo_extra} disabled={!editable}
                     data-testid="chk-computa-extra"
                     onChange={(e) => setR("computa_tiempo_extra", e.target.checked)} className="w-4 h-4 accent-orange-600"/>
              <span>Computar tiempo si el músico llega antes</span>
              <span className="text-xs text-slate-500">(si no, se usa la hora oficial de inicio)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!reglas.computa_mas_alla_fin} disabled={!editable}
                     data-testid="chk-computa-mas-alla"
                     onChange={(e) => setR("computa_mas_alla_fin", e.target.checked)} className="w-4 h-4 accent-orange-600"/>
              <span>Computar tiempo más allá de la hora de fin</span>
            </label>
          </div>
          {editable && (
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
              <button onClick={precargar} disabled={precargando}
                      data-testid="btn-precargar"
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5"/> {precargando ? "Precargando…" : "Precargar a todos los ensayos"}
              </button>
              <button onClick={guardarReglas} disabled={savingReglas}
                      data-testid="btn-guardar-reglas"
                      className="px-4 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded font-medium inline-flex items-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5"/> {savingReglas ? "Guardando…" : "Guardar reglas"}
              </button>
            </div>
          )}
        </Section>
      )}

      {/* Bloque 1C — Registro público */}
      {registroCfg && (
        <Section icon={UserPlus} title="Registro público de músicos" color="purple">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Estado" hint="Activa o desactiva el formulario público de auto-registro.">
              <button type="button" disabled={!editable || savingRegistro}
                      onClick={() => guardarRegistro({ activo: !registroCfg.activo })}
                      data-testid="btn-toggle-registro"
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border ${registroCfg.activo ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-300"} disabled:opacity-50`}>
                <Power className="w-3.5 h-3.5"/> {registroCfg.activo ? "Activo" : "Inactivo"}
              </button>
            </Field>
            <Field label="Enlace público" hint="Comparte este enlace con personas externas para que se registren.">
              <div className="flex items-center gap-2">
                <input readOnly value={enlaceRegistro} data-testid="registro-link"
                       className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 font-mono"/>
                <button onClick={copiarEnlace} type="button"
                        data-testid="btn-copiar-link"
                        className="px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800 inline-flex items-center gap-1">
                  <Copy className="w-3 h-3"/> Copiar
                </button>
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer"
                     data-testid="btn-whatsapp-link"
                     className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">📱 WhatsApp</a>
                )}
              </div>
            </Field>
          </div>
          <Field label="Mensaje de bienvenida" hint="Aparece en la cabecera de la página pública de registro.">
            <textarea rows={3} disabled={!editable}
                      value={registroCfg.mensaje_bienvenida || ""}
                      onChange={(e) => setRegistroCfg((p) => ({ ...p, mensaje_bienvenida: e.target.value }))}
                      data-testid="registro-mensaje"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"/>
          </Field>
          <div className="flex items-center gap-3 flex-wrap">
            {qrUrl && (
              <details>
                <summary className="cursor-pointer text-xs text-slate-700 hover:text-slate-900">📱 Ver QR</summary>
                <img src={qrUrl} alt="QR registro" data-testid="registro-qr"
                     className="mt-2 border border-slate-200 rounded p-2 bg-white"/>
              </details>
            )}
            {editable && (
              <>
                <button onClick={() => guardarRegistro()}
                        disabled={savingRegistro}
                        data-testid="btn-guardar-registro"
                        className="px-4 py-1.5 text-xs bg-purple-700 hover:bg-purple-800 text-white rounded font-medium inline-flex items-center gap-1.5 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5"/> Guardar
                </button>
                <button onClick={() => {
                  if (window.confirm("Esto invalidará el enlace actual y generará uno nuevo. ¿Continuar?")) guardarRegistro({ regenerar_token: true });
                }} type="button" disabled={savingRegistro}
                        data-testid="btn-regenerar-token"
                        className="px-3 py-1.5 text-xs border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded inline-flex items-center gap-1.5 disabled:opacity-50">
                  <RefreshCw className="w-3.5 h-3.5"/> Regenerar token
                </button>
              </>
            )}
          </div>
        </Section>
      )}

      {/* Recordatorios automáticos (alerta datos bancarios) */}
      <Section icon={Bell} title="Recordatorios automáticos" color="amber">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Días antes para alerta de datos bancarios" hint="Avisar al gestor X días antes del primer evento confirmado si el músico no tiene IBAN/SWIFT.">
            <Input type="number" min={1} max={120} readOnly={!editable}
                   data-testid="dias-alerta-bancarios"
                   value={cfg.dias_alerta_datos_bancarios ?? 30}
                   onChange={(e) => set("dias_alerta_datos_bancarios", e.target.value)}/>
          </Field>
        </div>
      </Section>
    </div>
  );
};

export default ConfiguracionApp;
