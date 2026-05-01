// Bloque 1A — Página pública de auto-registro
// Ruta: /registro/:token (también /registro busca el token vigente)
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Music, CheckCircle2, AlertCircle } from "lucide-react";

const API_URL = window.location.hostname === "localhost"
  ? "http://localhost:8001/api"
  : `${process.env.REACT_APP_BACKEND_URL}/api`;

const INSTRUMENTOS = [
  "Violín", "Viola", "Violonchelo", "Contrabajo",
  "Flauta", "Oboe", "Clarinete", "Fagot", "Saxofón",
  "Trompa", "Trompeta", "Trombón", "Tuba",
  "Percusión", "Timbales", "Arpa",
  "Piano", "Órgano", "Clave",
  "Coro Soprano", "Coro Contralto", "Coro Tenor", "Coro Bajo",
  "Otros",
];

const RegistroPublico = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [form, setForm] = useState({
    nombre: "", apellidos: "", email: "", instrumento: INSTRUMENTOS[0], telefono: "",
    password: "", password2: "", mensaje: "", acepto: false,
  });
  const [errs, setErrs] = useState({});

  useEffect(() => {
    if (!token) {
      setError("Falta token de registro");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API_URL}/registro-publico/info/${token}`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.detail || `Error ${r.status}`);
        }
        setInfo(await r.json());
      } catch (e) { setError(e.message); }
    })();
  }, [token]);

  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Obligatorio";
    if (!form.apellidos.trim()) e.apellidos = "Obligatorio";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email no válido";
    if (!form.instrumento) e.instrumento = "Obligatorio";
    if ((form.password || "").length < 8) e.password = "Mínimo 8 caracteres";
    if (form.password !== form.password2) e.password2 = "Las contraseñas no coinciden";
    if (!form.acepto) e.acepto = "Debes aceptar las condiciones";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async (ev) => {
    ev.preventDefault();
    if (!validar()) return;
    setEnviando(true); setError(null);
    try {
      const r = await fetch(`${API_URL}/registro-publico/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          apellidos: form.apellidos.trim(),
          email: form.email.trim().toLowerCase(),
          instrumento: form.instrumento,
          telefono: form.telefono.trim() || null,
          password: form.password,
          mensaje: form.mensaje.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Error");
      setEnviado(true);
    } catch (e) {
      setError(e.message);
    } finally { setEnviando(false); }
  };

  if (error && !info) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-2"/>
          <h1 className="font-bold text-lg text-slate-900 mb-1">Enlace no disponible</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center p-4" data-testid="registro-confirmado">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3"/>
          <h1 className="font-bold text-xl text-slate-900 mb-2">¡Solicitud recibida!</h1>
          <p className="text-sm text-slate-600 mb-4">
            El equipo de <strong>{info?.org_nombre}</strong> revisará tu solicitud y recibirás un email cuando sea aprobada.
          </p>
          <button onClick={() => navigate("/login")} className="text-sm text-purple-700 hover:underline">Ir al login</button>
        </div>
      </div>
    );
  }

  if (!info) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Cargando…</div>;
  }

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const cls = (k) => `w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${errs[k] ? "border-rose-400" : "border-slate-300"}`;

  return (
    <div className="min-h-screen bg-purple-50 py-8 px-4" data-testid="registro-publico-page">
      <div className="max-w-xl mx-auto">
        <div className="bg-purple-700 rounded-t-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center"><Music className="w-5 h-5"/></div>
            <div>
              <div className="text-xs text-purple-200 uppercase tracking-wider">{info.org_nombre || "Orquesta"}</div>
              <h1 className="font-bold text-xl">Solicitud de acceso al portal</h1>
            </div>
          </div>
          {info.mensaje_bienvenida && (
            <p className="mt-3 text-sm text-purple-100 whitespace-pre-line">{info.mensaje_bienvenida}</p>
          )}
        </div>

        <form onSubmit={enviar} className="bg-white rounded-b-xl shadow p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} className={cls("nombre")} data-testid="reg-input-nombre"/>
              {errs.nombre && <span className="text-xs text-rose-600">{errs.nombre}</span>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Apellidos *</label>
              <input value={form.apellidos} onChange={(e) => set("apellidos", e.target.value)} className={cls("apellidos")} data-testid="reg-input-apellidos"/>
              {errs.apellidos && <span className="text-xs text-rose-600">{errs.apellidos}</span>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={cls("email")} data-testid="reg-input-email"/>
            {errs.email && <span className="text-xs text-rose-600">{errs.email}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Instrumento *</label>
              <select value={form.instrumento} onChange={(e) => set("instrumento", e.target.value)} className={cls("instrumento")} data-testid="reg-select-instrumento">
                {INSTRUMENTOS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} className={cls("telefono")}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contraseña * (8+)</label>
              <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} className={cls("password")} data-testid="reg-input-password"/>
              {errs.password && <span className="text-xs text-rose-600">{errs.password}</span>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Confirmar *</label>
              <input type="password" value={form.password2} onChange={(e) => set("password2", e.target.value)} className={cls("password2")} data-testid="reg-input-password2"/>
              {errs.password2 && <span className="text-xs text-rose-600">{errs.password2}</span>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mensaje (opcional)</label>
            <textarea rows={3} value={form.mensaje} onChange={(e) => set("mensaje", e.target.value)} className={cls("mensaje")} placeholder="Cuéntanos algo sobre ti…"/>
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.acepto} onChange={(e) => set("acepto", e.target.checked)} data-testid="reg-checkbox-acepto" className="mt-0.5"/>
            <span>Acepto las condiciones de uso de la plataforma y el tratamiento de mis datos para fines de gestión orquestal.</span>
          </label>
          {errs.acepto && <div className="text-xs text-rose-600">{errs.acepto}</div>}

          {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm p-2 rounded">{error}</div>}

          <button type="submit" disabled={enviando}
                  data-testid="reg-submit"
                  className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-md disabled:opacity-50">
            {enviando ? "Enviando…" : "Solicitar acceso"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegistroPublico;
