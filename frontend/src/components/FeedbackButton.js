// Botón flotante de feedback. Funciona en gestor (POST /api/gestor/incidencias)
// y en portal de músico (POST /api/portal/incidencias). Usa el mismo
// IncidenciaModal que /admin/incidencias para garantizar una única UX.
//
// Atajo de teclado: Ctrl/Cmd+Shift+I abre el modal y precarga una captura
// del DOM actual (con html2canvas). Ojo: en algunos navegadores este atajo
// está reservado para DevTools y nuestro preventDefault NO siempre lo bloquea
// — por eso también soportamos Ctrl/Cmd+Shift+B como atajo alternativo.

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import IncidenciaModal from './IncidenciaModal';

const FeedbackButton = ({ mode = 'gestor' }) => {
  const auth = useAuth();
  const api = auth?.api;
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [preloadedFile, setPreloadedFile] = useState(null);
  const [capturing, setCapturing] = useState(false);

  const apiUrl = process.env.REACT_APP_BACKEND_URL || '';

  // En modo gestor exigimos AuthContext.
  const enabled = mode === 'portal' || !!api;

  const getAuthHeaders = async () => {
    if (mode === 'portal') {
      const { data: { session } } = await supabase.auth.getSession();
      return { 'Authorization': `Bearer ${session?.access_token}` };
    }
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const send = async (payload) => {
    if (mode === 'portal') {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${apiUrl}/api/portal/incidencias`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || 'Error al enviar');
      }
      return (await res.json()).incidencia;
    }
    const r = await api.post('/api/gestor/incidencias', payload);
    return r.data?.incidencia;
  };

  const uploadScreenshot = async (file) => {
    const headers = await getAuthHeaders();
    const fd = new FormData();
    fd.append('archivo', file);
    const path = mode === 'portal'
      ? '/api/portal/incidencias/upload-screenshot'
      : '/api/gestor/incidencias/upload-screenshot';
    const res = await fetch(`${apiUrl}${path}`, { method: 'POST', headers, body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || 'No se pudo subir la imagen');
    }
    return res.json();
  };

  // Captura el DOM actual (sin el modal) y lo devuelve como File PNG.
  const captureViewport = async () => {
    setCapturing(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(document.body, {
        backgroundColor: '#ffffff',
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        ignoreElements: (el) =>
          el.dataset?.testid === 'incidencia-modal' ||
          el.dataset?.testid === 'btn-feedback' ||
          el.id === 'feedback-keyboard-hint',
        // Limitar al viewport visible para no capturar páginas larguísimas
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
        x: window.scrollX,
        y: window.scrollY,
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      });
      return await new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) return resolve(null);
          resolve(new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' }));
        }, 'image/png', 0.92);
      });
    } catch (err) {
      console.error('[Feedback] captura DOM falló', err);
      return null;
    } finally {
      setCapturing(false);
    }
  };

  // Atajo: Ctrl/Cmd+Shift+I (principal) o Ctrl/Cmd+Shift+B (alternativo si DevTools intercepta).
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = async (e) => {
      const meta = e.ctrlKey || e.metaKey;
      const isPrincipal = meta && e.shiftKey && (e.key === 'I' || e.key === 'i');
      const isAlternativo = meta && e.shiftKey && (e.key === 'B' || e.key === 'b');
      if (!isPrincipal && !isAlternativo) return;
      // Ignora el atajo si el modal ya está abierto para no pisar la captura precargada.
      if (open || capturing) return;
      e.preventDefault();
      // Captura primero, abre después con el blob ya cargado.
      const file = await captureViewport();
      if (file) setPreloadedFile(file);
      setOpen(true);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, open, capturing]);

  const handleClose = () => {
    setOpen(false);
    setPreloadedFile(null);
  };

  if (!enabled) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="btn-feedback"
        className="fixed bottom-6 right-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5"
        title="Reportar incidencia, mejora o pregunta · atajo Ctrl/⌘+Shift+B"
      >
        💬 Feedback
      </button>
      {capturing && (
        <div
          className="fixed bottom-20 right-6 z-40 bg-slate-900 text-white text-xs px-3 py-2 rounded-md shadow-lg"
          data-testid="feedback-capturing-toast"
        >
          📸 Capturando pantalla…
        </div>
      )}
      <IncidenciaModal
        open={open}
        onClose={handleClose}
        pagina={loc.pathname}
        send={send}
        uploadScreenshot={uploadScreenshot}
        preloadedFile={preloadedFile}
      />
    </>
  );
};

export default FeedbackButton;
