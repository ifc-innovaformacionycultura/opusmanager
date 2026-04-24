// Botón flotante de feedback. Funciona en gestor (POST /api/gestor/incidencias)
// y en portal de músico (POST /api/portal/incidencias). Usa el mismo
// IncidenciaModal que /admin/incidencias para garantizar una única UX.

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import IncidenciaModal from './IncidenciaModal';

const FeedbackButton = ({ mode = 'gestor' }) => {
  const auth = useAuth();
  const api = auth?.api;
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  // En modo gestor exigimos AuthContext (api del gestor).
  // En modo portal usamos la sesión Supabase directamente.
  if (mode === 'gestor' && !api) return null;

  const apiUrl = process.env.REACT_APP_BACKEND_URL || '';

  const getAuthHeaders = async () => {
    if (mode === 'portal') {
      const { data: { session } } = await supabase.auth.getSession();
      return { 'Authorization': `Bearer ${session?.access_token}` };
    }
    // En modo gestor el axios `api` ya tiene el token; aquí lo extraemos para fetch nativo.
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="btn-feedback"
        className="fixed bottom-6 right-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5"
        title="Reportar incidencia, mejora o pregunta"
      >
        💬 Feedback
      </button>
      <IncidenciaModal
        open={open}
        onClose={() => setOpen(false)}
        pagina={loc.pathname}
        send={send}
        uploadScreenshot={uploadScreenshot}
      />
    </>
  );
};

export default FeedbackButton;
