// Botón flotante 💬 azul, separado del FeedbackButton de incidencias.
// Se posiciona ENCIMA del botón de feedback (bottom-20 para no solaparse).
// Solo visible en gestor (requiere AuthContext con `api`).

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ComentariosEquipoModal from './ComentariosEquipoModal';

const ComentariosEquipoButton = () => {
  const auth = useAuth();
  const api = auth?.api;
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  if (!api) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="btn-comentarios-equipo"
        className="fixed bottom-20 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5"
        title="Comentar con el equipo"
      >
        💬 Comentar con el equipo
      </button>
      <ComentariosEquipoModal
        open={open}
        onClose={() => setOpen(false)}
        api={api}
        pagina={loc.pathname}
      />
    </>
  );
};

export default ComentariosEquipoButton;
