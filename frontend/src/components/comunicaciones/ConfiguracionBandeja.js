import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

const ConfiguracionBandeja = () => {
  const { api } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [form, setForm] = useState({
    gmail_imap_host: "imap.gmail.com",
    gmail_imap_port: 993,
    gmail_imap_user: "",
    gmail_imap_app_password: "",
    gmail_sync_enabled: false,
    gmail_sync_folder: "INBOX",
    email_firma_html: "",
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/admin/bandeja/config");
      const data = r.data || {};
      setCfg(data);
      setForm((prev) => ({
        ...prev,
        gmail_imap_host: data.gmail_imap_host || "imap.gmail.com",
        gmail_imap_port: data.gmail_imap_port || 993,
        gmail_imap_user: data.gmail_imap_user || "",
        gmail_sync_enabled: !!data.gmail_sync_enabled,
        gmail_sync_folder: data.gmail_sync_folder || "INBOX",
        email_firma_html: data.email_firma_html || "",
        gmail_imap_app_password: "", // nunca rellenar para no enviarla vacía
      }));
    } catch (e) {
      setFeedback({ tipo: "err", txt: e?.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = { ...form };
      if (!payload.gmail_imap_app_password) delete payload.gmail_imap_app_password;
      await api.put("/api/admin/bandeja/config", payload);
      setFeedback({ tipo: "ok", txt: "✅ Configuración guardada correctamente" });
      await cargar();
    } catch (e) {
      setFeedback({ tipo: "err", txt: e?.response?.data?.detail || e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const probarConexion = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const r = await api.post("/api/admin/bandeja/test-conexion");
      if (r.data?.ok) {
        setFeedback({ tipo: "ok", txt: `✅ Conexión IMAP correcta · ${r.data.status || ""}` });
      } else {
        setFeedback({ tipo: "err", txt: `⚠️ ${r.data?.error || "Error desconocido"}` });
      }
    } catch (e) {
      setFeedback({ tipo: "err", txt: e?.response?.data?.detail || e.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-500 text-sm">Cargando configuración...</div>;

  return (
    <div className="max-w-3xl" data-testid="config-bandeja-container">
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 mb-6 text-sm">
        <div className="font-semibold mb-1">🔐 Configuración Gmail IMAP (lectura de correos)</div>
        <div>
          Para leer correos de Gmail necesitas generar una <strong>Contraseña de aplicación</strong> (no tu contraseña normal).{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-amber-900 font-semibold"
          >
            Crear contraseña de aplicación →
          </a>
          <div className="mt-1">Requisito: la verificación en dos pasos debe estar activada en la cuenta de Google.</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h3 className="text-lg font-semibold text-[#1A3A5C]">Credenciales IMAP</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Servidor IMAP</label>
            <input
              type="text"
              value={form.gmail_imap_host}
              onChange={(e) => setForm({ ...form, gmail_imap_host: e.target.value })}
              data-testid="input-imap-host"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Puerto</label>
            <input
              type="number"
              value={form.gmail_imap_port}
              onChange={(e) => setForm({ ...form, gmail_imap_port: parseInt(e.target.value, 10) || 993 })}
              data-testid="input-imap-port"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Email (usuario)</label>
          <input
            type="email"
            value={form.gmail_imap_user}
            onChange={(e) => setForm({ ...form, gmail_imap_user: e.target.value })}
            placeholder="innovaformacionyculturapruebas@gmail.com"
            data-testid="input-imap-user"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Contraseña de aplicación (16 caracteres sin espacios)
            {cfg?.gmail_imap_app_password_configurada && (
              <span className="ml-2 text-green-700 font-normal">· Ya configurada: {cfg.gmail_imap_app_password_masked}</span>
            )}
          </label>
          <input
            type="password"
            value={form.gmail_imap_app_password}
            onChange={(e) => setForm({ ...form, gmail_imap_app_password: e.target.value })}
            placeholder={cfg?.gmail_imap_app_password_configurada ? "Deja vacío para mantener la actual" : "xxxx xxxx xxxx xxxx (sin espacios)"}
            data-testid="input-imap-password"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C] font-mono"
          />
          <div className="text-xs text-slate-500 mt-1">Se almacena cifrada en la base de datos. Déjala vacía para conservar la actual.</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Carpeta a sincronizar</label>
            <input
              type="text"
              value={form.gmail_sync_folder}
              onChange={(e) => setForm({ ...form, gmail_sync_folder: e.target.value })}
              data-testid="input-imap-folder"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C]"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.gmail_sync_enabled}
                onChange={(e) => setForm({ ...form, gmail_sync_enabled: e.target.checked })}
                data-testid="checkbox-sync-enabled"
                className="w-4 h-4 rounded accent-[#C9920A]"
              />
              <span>Activar sincronización automática (cada 15 min)</span>
            </label>
          </div>
        </div>

        {cfg?.gmail_sync_last_run && (
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
            <div>Última sincronización: <strong>{new Date(cfg.gmail_sync_last_run).toLocaleString("es-ES")}</strong></div>
            {cfg.gmail_sync_last_uid && <div>Último UID procesado: <code>{cfg.gmail_sync_last_uid}</code></div>}
          </div>
        )}

        <div className="pt-4 border-t border-slate-200">
          <label className="block text-sm font-semibold text-[#1A3A5C] mb-2">✍️ Firma de email (respuestas salientes)</label>
          <p className="text-xs text-slate-500 mb-2">
            Se añade automáticamente al final de cada respuesta enviada desde la Bandeja de Entrada. Admite HTML básico (<code>&lt;br/&gt;</code>, <code>&lt;strong&gt;</code>, <code>&lt;a&gt;</code>).
            Si dejas este campo vacío, se usa la <em>firma por defecto</em> generada con los datos de la organización.
          </p>
          <textarea
            rows={6}
            value={form.email_firma_html}
            onChange={(e) => setForm({ ...form, email_firma_html: e.target.value })}
            placeholder={cfg?.email_firma_preview_default ? "Deja vacío para usar la firma por defecto (ver previsualización abajo)" : "<strong>Nombre organización</strong><br/>Dirección<br/>Teléfono · email@org.com<br/>www.mi-orquesta.com"}
            data-testid="input-email-firma"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C] font-mono"
          />
          {cfg?.email_firma_preview_default && !form.email_firma_html?.trim() && (
            <div className="mt-2 text-xs text-slate-500">
              <div className="mb-1">Previsualización firma por defecto:</div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200" dangerouslySetInnerHTML={{ __html: cfg.email_firma_preview_default }} />
            </div>
          )}
          {form.email_firma_html?.trim() && (
            <div className="mt-2 text-xs text-slate-500">
              <div className="mb-1">Previsualización:</div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200" dangerouslySetInnerHTML={{ __html: form.email_firma_html }} />
            </div>
          )}
        </div>

        {feedback && (
          <div className={`text-sm p-3 rounded-lg ${feedback.tipo === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`} data-testid="config-feedback">
            {feedback.txt}
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
          <button
            onClick={guardar}
            disabled={saving}
            data-testid="btn-guardar-config"
            className="px-4 py-2 text-sm bg-[#1A3A5C] hover:bg-[#0f2a44] text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Guardando..." : "💾 Guardar cambios"}
          </button>
          <button
            onClick={probarConexion}
            disabled={testing}
            data-testid="btn-probar-conexion"
            className="px-4 py-2 text-sm border border-[#1A3A5C] text-[#1A3A5C] hover:bg-slate-50 rounded-lg disabled:opacity-50"
          >
            {testing ? "Probando..." : "🔌 Probar conexión"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracionBandeja;
