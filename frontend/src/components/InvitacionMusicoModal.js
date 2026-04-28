// Modal: Enviar invitación al músico (Bloque 2).
// 4 opciones: enviar email (Resend), copiar enlace, mostrar QR, WhatsApp.
import React, { useState } from 'react';

const QR_API = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=';

// Normaliza un teléfono a formato sólo dígitos para wa.me (acepta +34, 600 11 22 33, etc.)
const normalizarTelefono = (tel) => (tel || '').replace(/[^\d]/g, '');

export default function InvitacionMusicoModal({ isOpen, onClose, musico, api, onInvited }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waPhone, setWaPhone] = useState('');

  if (!isOpen || !musico) return null;

  const generar = async (enviarEmail) => {
    try {
      setLoading(true); setError(null); setEmailSent(false);
      const r = await api.post(`/api/gestor/musicos/${musico.id}/invitar`, { enviar_email: enviarEmail });
      setResult(r.data);
      if (enviarEmail) setEmailSent(Boolean(r.data?.email?.sent));
      onInvited && onInvited();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Error');
    } finally { setLoading(false); }
  };

  const url = result?.url_activacion;

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleClose = () => {
    setResult(null); setError(null); setEmailSent(false); setCopied(false); setWaPhone('');
    onClose();
  };

  // WhatsApp: usa el teléfono guardado del músico o el introducido manualmente.
  const phoneFromMusico = normalizarTelefono(musico.telefono);
  const phoneFromInput = normalizarTelefono(waPhone);
  const waPhoneFinal = phoneFromMusico || phoneFromInput;

  const buildWhatsAppHref = () => {
    if (!waPhoneFinal || !url) return null;
    const nombre = musico.nombre || 'músico';
    const text = `Hola ${nombre}, te invitamos al portal de músicos de IFC. Para activar tu cuenta y configurar tu contraseña, abre este enlace: ${url}`;
    return `https://wa.me/${waPhoneFinal}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="invitacion-modal" onClick={handleClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 pb-2">
          <h3 className="font-semibold text-slate-900">Enviar invitación al portal</h3>
          <p className="text-xs text-slate-500 mt-0.5">{musico.nombre} {musico.apellidos} · {musico.email}</p>
        </div>

        {error && <div className="p-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded" data-testid="invitacion-error">{error}</div>}

        {!result && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Se generará un enlace único de activación para que el músico configure su contraseña y acceda al portal.
            </p>
            <div className="flex gap-2">
              <button onClick={() => generar(true)} disabled={loading}
                data-testid="btn-enviar-email"
                className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium disabled:opacity-60">
                {loading ? 'Enviando…' : '📧 Enviar por email'}
              </button>
              <button onClick={() => generar(false)} disabled={loading}
                data-testid="btn-generar-enlace"
                className="flex-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-sm font-medium disabled:opacity-60">
                Solo generar enlace
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {emailSent && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md" data-testid="invitacion-email-ok">
                <p className="text-sm font-semibold text-green-900">✅ Email enviado correctamente</p>
                <p className="text-xs text-green-700 mt-1">El músico ha recibido las instrucciones en {musico.email}.</p>
              </div>
            )}
            {!emailSent && result.email?.reason && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                Email no enviado: {result.email.reason}
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Enlace de activación</p>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs flex-1 break-all" data-testid="invitacion-url">{url}</code>
                <button onClick={handleCopy} data-testid="btn-copiar-enlace"
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-medium whitespace-nowrap">
                  {copied ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Código QR</p>
              <div className="flex items-center justify-center bg-white border border-slate-200 rounded-md p-3" data-testid="invitacion-qr-wrap">
                <img src={QR_API + encodeURIComponent(url)} alt="QR de activación" className="w-44 h-44" data-testid="invitacion-qr" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1 text-center">Escanea el código para abrir la página de activación.</p>
            </div>

            {/* WhatsApp */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Enviar por WhatsApp</p>
              {phoneFromMusico ? (
                <p className="text-xs text-slate-600 mb-2">
                  Teléfono del músico: <strong>{musico.telefono}</strong>
                </p>
              ) : (
                <div className="mb-2">
                  <p className="text-xs text-amber-700 mb-1">El músico no tiene teléfono registrado. Introdúcelo manualmente:</p>
                  <input
                    type="tel"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="+34 600 11 22 33"
                    data-testid="invitacion-wa-phone"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Incluye el prefijo internacional. Solo se usará para abrir WhatsApp.</p>
                </div>
              )}
              <a
                href={buildWhatsAppHref() || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!buildWhatsAppHref()}
                onClick={(e) => { if (!buildWhatsAppHref()) e.preventDefault(); }}
                data-testid="btn-whatsapp"
                className={`block w-full text-center px-3 py-2 rounded-md text-sm font-medium ${
                  buildWhatsAppHref()
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                📱 Enviar por WhatsApp
              </a>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={handleClose}
                data-testid="invitacion-cerrar"
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
