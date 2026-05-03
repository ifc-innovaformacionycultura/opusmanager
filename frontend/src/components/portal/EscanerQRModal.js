// Escáner QR para portal del músico — usa cámara trasera + jsQR.
// Props:
//   accion: 'entrada' | 'salida'
//   onClose(): cierra el modal sin fichar
//   onSuccess({mensaje, hora}): cuando fichaje OK
//
// Extrae el token del texto del QR. Admite:
//   - URL con ?token=XYZ o /fichar/XYZ
//   - Token raw (string sin / ni ?)
// Llama POST /api/fichaje/entrada/{token} o /salida/{token}
import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useAuth } from "../../contexts/AuthContext";
import { X, Camera, CheckCircle2, AlertTriangle } from "lucide-react";

const extractToken = (text) => {
  if (!text) return null;
  try {
    const u = new URL(text);
    const tok = u.searchParams.get("token");
    if (tok) return tok;
    // último segmento del path
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  } catch {
    // no era URL → token raw
  }
  return text.trim();
};

const EscanerQRModal = ({ accion = "entrada", onClose, onSuccess }) => {
  const { api } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const procesadoRef = useRef(false);
  const [estado, setEstado] = useState("inicializando"); // inicializando | escaneando | enviando | ok | error
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setEstado("escaneando");
          tick();
        }
      } catch (e) {
        setEstado("error");
        setError("No se pudo acceder a la cámara. Comprueba los permisos del navegador.");
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = () => {
    if (procesadoRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.readyState !== 4) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
    if (code && code.data) {
      procesadoRef.current = true;
      enviarFichaje(code.data);
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const enviarFichaje = async (qrText) => {
    const token = extractToken(qrText);
    if (!token) {
      procesadoRef.current = false;
      return;
    }
    setEstado("enviando");
    try {
      const r = await api.post(`/api/fichaje/${accion}/${token}`);
      setResultado(r.data);
      setEstado("ok");
      // Detener cámara
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setTimeout(() => onSuccess && onSuccess(r.data), 1500);
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Error al fichar";
      setError(msg);
      setEstado("error");
      procesadoRef.current = false;
      // Permitir reintentar tras 2s
      setTimeout(() => {
        if (estado !== "ok") {
          procesadoRef.current = false;
          setEstado("escaneando");
          setError(null);
          tick();
        }
      }, 2500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4" data-testid="escaner-qr-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`${accion === 'entrada' ? 'bg-emerald-600' : 'bg-blue-600'} text-white px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5"/>
            <h3 className="font-semibold">{accion === 'entrada' ? 'Fichar entrada' : 'Fichar salida'}</h3>
          </div>
          <button onClick={onClose} className="text-white hover:text-slate-200" data-testid="escaner-cerrar">
            <X className="w-5 h-5"/>
          </button>
        </div>
        <div className="p-3">
          {estado !== 'ok' && (
            <>
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
                <video ref={videoRef} muted playsInline className="w-full h-full object-cover" data-testid="escaner-video"/>
                {/* Frame de detección */}
                <div className="absolute inset-8 border-4 border-white/70 rounded-lg pointer-events-none">
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl"/>
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr"/>
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl"/>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br"/>
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden"/>
              <div className="mt-3 text-center text-sm text-slate-600" data-testid="escaner-estado">
                {estado === 'inicializando' && 'Solicitando acceso a la cámara…'}
                {estado === 'escaneando' && 'Apunta al código QR del ensayo'}
                {estado === 'enviando' && 'Enviando fichaje…'}
              </div>
              {error && (
                <div className="mt-2 bg-red-50 border border-red-200 text-red-800 rounded p-2 text-xs flex items-start gap-2" data-testid="escaner-error">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0"/>
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
          {estado === 'ok' && resultado && (
            <div className="py-6 text-center" data-testid="escaner-ok">
              <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto mb-3"/>
              <h4 className="text-lg font-bold text-slate-900">{accion === 'entrada' ? '¡Entrada registrada!' : '¡Salida registrada!'}</h4>
              <p className="text-sm text-slate-600 mt-1">
                {resultado.hora_entrada_real && `Entrada: ${resultado.hora_entrada_real}`}
                {resultado.hora_salida_real && `Salida: ${resultado.hora_salida_real}`}
              </p>
            </div>
          )}
        </div>
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex justify-end">
          <button onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5" data-testid="escaner-cancelar-btn">Cancelar</button>
        </div>
      </div>
    </div>
  );
};

export default EscanerQRModal;
