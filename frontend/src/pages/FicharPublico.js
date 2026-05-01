import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { QrCode, CheckCircle2, Clock } from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

const FicharPublico = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user: gestor } = useAuth();   // gestor (JWT) — opcional
  const [musicoSession, setMusicoSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [info, setInfo] = useState(null);
  const [estado, setEstado] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  // Detectar sesión Supabase (músico)
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setMusicoSession(session);
      } catch { /* ignore */ }
      setAuthChecked(true);
    })();
  }, []);

  // Construye headers con el token apropiado (gestor o músico)
  const _bearerHeaders = async () => {
    const sess = musicoSession || (await supabase.auth.getSession()).data?.session;
    let bearer = "";
    if (sess?.access_token) bearer = sess.access_token;
    else {
      bearer = localStorage.getItem("token") || "";
    }
    return { "Authorization": `Bearer ${bearer}`, "Content-Type": "application/json" };
  };

  // Devuelve user_id (uuid de tabla usuarios) según el rol
  const _userId = async () => {
    if (gestor?.id) return gestor.id;
    if (gestor?.profile?.id) return gestor.profile.id;
    if (musicoSession?.user?.id) {
      // Buscar el id en `usuarios` por user_id
      try {
        const r = await fetch(`${API_URL}/portal/me`, { headers: await _bearerHeaders() });
        if (r.ok) {
          const j = await r.json();
          return j.profile?.id || j.id || musicoSession.user.id;
        }
      } catch { /* ignore */ }
      return musicoSession.user.id;
    }
    return null;
  };

  const _isAuthed = !!gestor || !!musicoSession;

  useEffect(() => {
    if (!authChecked) return;
    if (!_isAuthed) {
      navigate(`/login?redirect=/fichar/${token}`, { replace: true });
      return;
    }
    (async () => {
      try {
        const headers = await _bearerHeaders();
        const r = await fetch(`${API_URL}/fichaje/info/${token}`, { headers });
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail || "Error");
        setInfo(j.ensayo);
        const uid = await _userId();
        if (uid && j.ensayo?.id) {
          const s = await fetch(`${API_URL}/fichaje/estado/${j.ensayo.id}/${uid}`, { headers });
          if (s.ok) setEstado(await s.json());
        }
      } catch (e) {
        setError(e.message);
      }
    })();
    // eslint-disable-next-line
  }, [authChecked, token]);

  const fichar = async () => {
    setBusy(true); setError(null);
    try {
      const headers = await _bearerHeaders();
      const uid = await _userId();
      const endpoint = estado?.estado === "entrada_registrada" ? "salida" : "entrada";
      const r = await fetch(`${API_URL}/fichaje/${endpoint}/${token}`, {
        method: "POST", headers,
        body: JSON.stringify({ usuario_id: uid, timestamp: new Date().toISOString() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Error");
      setResultado({ tipo: endpoint, ...j });
      if (info?.id) {
        const s = await fetch(`${API_URL}/fichaje/estado/${info.id}/${uid}`, { headers });
        if (s.ok) setEstado(await s.json());
      }
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  if (!authChecked) return <div className="p-6 text-center text-slate-500">Cargando…</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4" data-testid="fichar-publico">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
          <QrCode className="w-8 h-8 text-amber-500"/>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Fichaje QR</h1>
            <p className="text-xs text-slate-500">Sistema de registro de asistencia</p>
          </div>
        </div>

        {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded text-sm">{error}</div>}

        {info ? (
          <>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="font-semibold text-slate-900">{info.evento_nombre || "—"}</div>
              <div className="text-slate-700 capitalize">{info.tipo} · {info.fecha} · {(info.hora_inicio || "").slice(0,5)}–{(info.hora_fin || "").slice(0,5)}</div>
              {info.lugar && <div className="text-xs text-slate-500 mt-0.5">📍 {info.lugar}</div>}
            </div>

            {resultado ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center" data-testid="fichar-success">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2"/>
                <div className="font-bold text-emerald-800">{resultado.mensaje}</div>
                <div className="text-xs text-emerald-700 mt-1">
                  Hora computada: <strong>{new Date(resultado.hora_computada).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</strong>
                </div>
                {resultado.alerta_retraso && <div className="text-xs text-amber-700 mt-1">🕐 Marcado como retraso</div>}
                {resultado.minutos_totales != null && (
                  <div className="text-xs text-emerald-700 mt-1">
                    Duración: <strong>{Math.floor(resultado.minutos_totales/60)}h {resultado.minutos_totales%60}min</strong>
                    {" · "}<strong>{resultado.porcentaje_asistencia}%</strong>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={fichar} disabled={busy}
                      data-testid="btn-fichar"
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                <Clock className="w-6 h-6"/>
                {busy ? "Registrando…" : (estado?.estado === "entrada_registrada" ? "✅ Registrar mi salida" : "✅ Registrar mi entrada")}
              </button>
            )}

            {estado?.estado === "completo" && !resultado && (
              <div className="text-xs text-slate-500 text-center">Ya has registrado entrada y salida en este ensayo.</div>
            )}
          </>
        ) : !error && <div className="text-sm text-slate-500 text-center py-6">Cargando información del ensayo…</div>}
      </div>
    </div>
  );
};

export default FicharPublico;
