// Botón prominente de fichaje QR para cada ensayo en portal del músico.
// Consulta estado vía GET /api/fichaje/estado/{ensayoId}/{usuarioId}
// Renderiza: verde (entrada pendiente) · azul (salida pendiente) · oculto (completo) · gris si margen expirado.
// Botón "⌨️ Fichar sin QR" llama a POST /api/fichaje/salida-manual/{ensayoId}
// Alerta naranja si la salida está pendiente (>= 30 min tras fin del ensayo sin haberla marcado).
//
// Props: ensayo { id, fecha, hora_inicio, hora_fin }, musicoId
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import EscanerQRModal from "./EscanerQRModal";
import { Camera, Keyboard, AlertTriangle } from "lucide-react";

const MIN_ALERTA_SALIDA_PENDIENTE = 30; // minutos tras fin del ensayo

const combinarFechaHora = (fecha, hora) => {
  if (!fecha) return null;
  const h = (hora || "00:00:00").slice(0, 8);
  const d = new Date(`${fecha.slice(0,10)}T${h.length === 5 ? h + ':00' : h}`);
  return isNaN(d.getTime()) ? null : d;
};

const BotonFichajeQR = ({ ensayo, musicoId }) => {
  const { api } = useAuth();
  const [estado, setEstado] = useState(null); // "sin_fichar" | "entrada_registrada" | "completo"
  const [loading, setLoading] = useState(true);
  const [scannerAccion, setScannerAccion] = useState(null); // 'entrada' | 'salida' | null
  const [manualEnviando, setManualEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const cargar = useCallback(async () => {
    if (!ensayo?.id || !musicoId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/fichaje/estado/${ensayo.id}/${musicoId}`);
      setEstado(r.data?.estado || "sin_fichar");
    } catch {
      setEstado("sin_fichar");
    } finally {
      setLoading(false);
    }
  }, [api, ensayo?.id, musicoId]);

  useEffect(() => { cargar(); }, [cargar]);

  // ¿Salida pendiente? — entrada registrada y han pasado >= 30 min desde fin
  const ahora = new Date();
  const fin = combinarFechaHora(ensayo?.fecha, ensayo?.hora_fin);
  const salidaPendiente = estado === "entrada_registrada" && fin && (ahora - fin) > MIN_ALERTA_SALIDA_PENDIENTE * 60 * 1000;

  const ficharManual = async () => {
    if (!window.confirm("¿Confirmar el fichaje manual de salida? Quedará registrado con la hora actual.")) return;
    setManualEnviando(true);
    setMensaje(null);
    try {
      const r = await api.post(`/api/fichaje/salida-manual/${ensayo.id}`);
      setMensaje({ tipo: "ok", txt: `✅ Salida registrada a las ${r.data?.hora_salida_real || "ahora"}` });
      await cargar();
    } catch (e) {
      setMensaje({ tipo: "err", txt: e?.response?.data?.detail || "Error al fichar manualmente" });
    } finally {
      setManualEnviando(false);
      setTimeout(() => setMensaje(null), 5000);
    }
  };

  const onSuccessEscaner = async () => {
    setScannerAccion(null);
    await cargar();
  };

  if (loading) {
    return <div className="h-14 bg-slate-100 rounded-xl animate-pulse" data-testid={`fichaje-loading-${ensayo?.id}`}/>;
  }

  // Fichaje completo: no mostramos el botón
  if (estado === "completo") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-sm text-center font-medium" data-testid={`fichaje-completo-${ensayo?.id}`}>
        ✅ Asistencia registrada completamente
      </div>
    );
  }

  const accionQR = estado === "entrada_registrada" ? "salida" : "entrada";
  const btnCls = accionQR === "entrada"
    ? "bg-emerald-500 hover:bg-emerald-600"
    : "bg-blue-500 hover:bg-blue-600";
  const btnLabel = accionQR === "entrada"
    ? "📷 Escanear QR de asistencia"
    : "📷 Registrar salida";

  return (
    <div className="space-y-2" data-testid={`fichaje-botones-${ensayo?.id}`}>
      {salidaPendiente && (
        <div className="bg-orange-50 border border-orange-300 text-orange-900 rounded-lg px-3 py-2 text-sm flex items-start gap-2" data-testid={`fichaje-alerta-salida-${ensayo?.id}`}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0"/>
          <div className="flex-1">
            <div className="font-semibold">Tienes una salida pendiente de registrar</div>
            <button
              onClick={ficharManual}
              disabled={manualEnviando}
              className="mt-1 text-xs font-semibold underline text-orange-900 hover:text-orange-700 disabled:opacity-50"
              data-testid={`fichaje-alerta-btn-salida-${ensayo?.id}`}
            >
              {manualEnviando ? "Registrando…" : "Fichar salida ahora"}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setScannerAccion(accionQR)}
        className={`w-full ${btnCls} text-white font-semibold text-base rounded-xl shadow transition flex items-center justify-center gap-2`}
        style={{ minHeight: 56 }}
        data-testid={`btn-fichaje-qr-${accionQR}-${ensayo?.id}`}
      >
        <Camera className="w-5 h-5"/>
        {btnLabel}
      </button>

      {/* Enlace alternativo "Fichar sin QR" — solo si hay entrada registrada (para salida manual) */}
      {estado === "entrada_registrada" && (
        <button
          type="button"
          onClick={ficharManual}
          disabled={manualEnviando}
          className="w-full text-xs text-slate-500 hover:text-slate-700 underline inline-flex items-center justify-center gap-1 py-1 disabled:opacity-50"
          data-testid={`btn-fichaje-manual-${ensayo?.id}`}
        >
          <Keyboard className="w-3.5 h-3.5"/>
          {manualEnviando ? "Enviando…" : "⌨️ Fichar sin QR"}
        </button>
      )}

      {mensaje && (
        <div className={`text-xs rounded px-2 py-1 ${mensaje.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`} data-testid={`fichaje-msg-${ensayo?.id}`}>
          {mensaje.txt}
        </div>
      )}

      {scannerAccion && (
        <EscanerQRModal
          accion={scannerAccion}
          onClose={() => setScannerAccion(null)}
          onSuccess={onSuccessEscaner}
        />
      )}
    </div>
  );
};

export default BotonFichajeQR;
