// Lightbox simple para previsualizar capturas de incidencias en grande.
// Cierra con Escape, click en backdrop o en la X.

import React, { useEffect } from 'react';

export default function ImageLightbox({ src, alt = 'Captura', onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-6"
      data-testid="image-lightbox"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center"
        aria-label="Cerrar"
        data-testid="lightbox-close"
      >×</button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] max-w-[92vw] object-contain rounded-md shadow-2xl"
        data-testid="lightbox-image"
      />
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs"
        data-testid="lightbox-open-newtab"
      >
        Abrir en pestaña nueva ↗
      </a>
    </div>
  );
}
