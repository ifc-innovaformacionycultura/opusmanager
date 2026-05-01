// Bloque 1D/1E — Banner persistente y modal de bienvenida (primer login)
// Banner amarillo: si faltan IBAN/SWIFT o campos mínimos.
// Modal bloqueante: si faltan campos mínimos (instrumento, teléfono, nivel_estudios).
import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X, Save } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API_URL = window.location.hostname === "localhost"
  ? "http://localhost:8001/api"
  : `${process.env.REACT_APP_BACKEND_URL}/api`;

const NIVELES = ["Estudiante", "Profesional", "Amateur", "Profesor", "Otro"];

const PerfilCompletitudAlerts = ({ onPerfilTab }) => {
  const [estado, setEstado] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [bannerCerrado, setBannerCerrado] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const fetchEstado = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const tk = session?.access_token;
      if (!tk) return;
      const r = await fetch(`${API_URL}/portal/mi-perfil-completitud`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (!r.ok) return;
      const j = await r.json();
      setEstado(j);
      // Modal bloqueante: si faltan mínimos
      if (j.primer_login_completar) {
        // Recuperar perfil actual para precargar form
        const r2 = await fetch(`${API_URL}/portal/mi-perfil`, { headers: { Authorization: `Bearer ${tk}` } });
        if (r2.ok) {
          const p = await r2.json();
          setPerfil(p);
          setForm({
            instrumento: p?.instrumento || "",
            telefono: p?.telefono || "",
            nivel_estudios: p?.nivel_estudios || "",
          });
        }
        setModalAbierto(true);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchEstado(); }, [fetchEstado]);

  const validar = () => {
    if (!form.instrumento?.trim()) return "Indica tu instrumento";
    if (!form.telefono?.trim()) return "Indica tu teléfono";
    if (!form.nivel_estudios?.trim()) return "Selecciona tu nivel";
    return null;
  };

  const guardar = async () => {
    const v = validar();
    if (v) { setErr(v); return; }
    setSaving(true); setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const tk = session?.access_token;
      const r = await fetch(`${API_URL}/portal/mi-perfil`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumento: form.instrumento,
          telefono: form.telefono,
          nivel_estudios: form.nivel_estudios,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || "Error guardando perfil");
      }
      setModalAbierto(false);
      await fetchEstado();
    } catch (e) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  if (!estado) return null;

  // Banner persistente — visible si el perfil no está 100% completo
  const showBanner = estado.banner_persistente && !bannerCerrado;
  const faltanBancarios = !estado.bancarios_ok;

  return (
    <>
      {showBanner && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-3 py-2 flex items-center justify-between gap-2 text-sm" data-testid="banner-perfil-incompleto">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0"/>
            <span className="truncate">
              {faltanBancarios
                ? "⚠️ Completa tus datos bancarios (IBAN/SWIFT) para recibir tus pagos."
                : "Tu perfil está incompleto. Por favor, complétalo."}
            </span>
            <button onClick={() => onPerfilTab && onPerfilTab()}
                    data-testid="banner-ir-perfil"
                    className="ml-2 underline font-semibold hover:text-amber-700">
              Ir a Mi Perfil →
            </button>
          </div>
          <button onClick={() => setBannerCerrado(true)} aria-label="Cerrar"
                  className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4"/>
          </button>
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" data-testid="modal-primer-login">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-lg">👋</div>
              <h2 className="font-bold text-slate-900 text-lg">¡Bienvenido/a!</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Antes de continuar, completa estos campos básicos. <strong>Solo te lo pediremos una vez</strong>.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Instrumento *</label>
                <input value={form.instrumento || ""}
                       onChange={(e) => setForm((p) => ({ ...p, instrumento: e.target.value }))}
                       data-testid="modal-input-instrumento"
                       className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono *</label>
                <input value={form.telefono || ""}
                       onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                       data-testid="modal-input-telefono"
                       className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nivel de estudios *</label>
                <select value={form.nivel_estudios || ""}
                        onChange={(e) => setForm((p) => ({ ...p, nivel_estudios: e.target.value }))}
                        data-testid="modal-select-nivel"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="">— Selecciona —</option>
                  {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {err && <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded">{err}</div>}
              <button onClick={guardar} disabled={saving}
                      data-testid="modal-guardar"
                      className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded inline-flex items-center justify-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4"/> {saving ? "Guardando…" : "Continuar al portal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PerfilCompletitudAlerts;
