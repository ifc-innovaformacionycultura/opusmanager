// Modal único para crear incidencias/mejoras/preguntas.
// Reutilizado por:
//   - FeedbackButton (botón flotante en todas las páginas, gestor + portal)
//   - GestorIncidencias (botón "+ Crear incidencia" en /admin/incidencias)
//
// Soporta adjuntar captura de pantalla por:
//   1) Click en input file
//   2) Drag & drop sobre la zona de adjunto
//   3) Pegar (Ctrl/Cmd+V) cualquier imagen del portapapeles cuando el modal está abierto
//
// La captura se sube a Supabase Storage vía `/api/{gestor|portal}/incidencias/upload-screenshot`
// y la URL pública resultante se incluye en `screenshot_url` al crear la incidencia.

import React, { useEffect, useRef, useState } from 'react';

const MIN_DESC = 20;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const TIPO_OPTIONS = [
  { v: 'incidencia', label: '🐞 Incidencia' },
  { v: 'mejora',     label: '✨ Mejora' },
  { v: 'pregunta',   label: '❓ Pregunta' },
];
const PRIO_OPTIONS = [
  { v: 'alta',  label: '🔴 Alta',  cls: 'bg-red-600 text-white' },
  { v: 'media', label: '🟡 Media', cls: 'bg-amber-500 text-white' },
  { v: 'baja',  label: '🟢 Baja',  cls: 'bg-emerald-600 text-white' },
];

/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onSubmitted: (incidencia) => void (callback cuando la incidencia se ha creado con éxito)
 *  - pagina: string  (ruta actual pre-rellenada en el campo)
 *  - send: async (payload) => incidencia   (función inyectada que hace el POST /incidencias)
 *  - uploadScreenshot: async (file) => { url, path }  (función inyectada que sube al backend)
 */
export default function IncidenciaModal({ open, onClose, onSubmitted, pagina = '', send, uploadScreenshot }) {
  const [tipo, setTipo] = useState('incidencia');
  const [prioridad, setPrioridad] = useState('media');
  const [descripcion, setDescripcion] = useState('');
  const [paginaInput, setPaginaInput] = useState(pagina);
  const [shotPreview, setShotPreview] = useState(null);   // URL local del preview (object URL)
  const [shotUrl, setShotUrl] = useState(null);           // URL pública subida
  const [shotFile, setShotFile] = useState(null);
  const [shotUploading, setShotUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileInputRef = useRef(null);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (open) {
      setPaginaInput(pagina || '');
      setMsg(null);
    } else {
      // Liberar object URL si existe
      if (shotPreview && shotPreview.startsWith('blob:')) {
        URL.revokeObjectURL(shotPreview);
      }
      setTipo('incidencia');
      setPrioridad('media');
      setDescripcion('');
      setShotPreview(null);
      setShotUrl(null);
      setShotFile(null);
      setShotUploading(false);
      setDragOver(false);
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pegar desde portapapeles cuando el modal está abierto
  useEffect(() => {
    if (!open) return;
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'error', text: 'El archivo debe ser una imagen (PNG, JPEG, WEBP o GIF).' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMsg({ type: 'error', text: `La imagen excede el tamaño máximo (5 MB). Pesa ${(file.size / 1024 / 1024).toFixed(1)} MB.` });
      return;
    }
    setShotFile(file);
    setShotPreview(URL.createObjectURL(file));
    setShotUrl(null);
    setMsg(null);

    try {
      setShotUploading(true);
      const { url } = await uploadScreenshot(file);
      setShotUrl(url);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'No se pudo subir la imagen';
      setMsg({ type: 'error', text: detail });
      setShotUrl(null);
    } finally {
      setShotUploading(false);
    }
  };

  const onFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const removeShot = () => {
    if (shotPreview && shotPreview.startsWith('blob:')) {
      URL.revokeObjectURL(shotPreview);
    }
    setShotFile(null);
    setShotPreview(null);
    setShotUrl(null);
  };

  const charsLeft = Math.max(0, MIN_DESC - descripcion.trim().length);
  const canSubmit = !sending && !shotUploading && charsLeft === 0;

  const enviar = async () => {
    if (!canSubmit) return;
    try {
      setSending(true);
      setMsg(null);
      const payload = {
        tipo,
        descripcion: descripcion.trim(),
        pagina: paginaInput || null,
        prioridad,
      };
      if (shotUrl) payload.screenshot_url = shotUrl;
      const inc = await send(payload);
      setMsg({ type: 'success', text: '✅ Gracias, hemos recibido tu reporte.' });
      if (onSubmitted) onSubmitted(inc);
      setTimeout(() => { onClose(); }, 1200);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Error al enviar';
      setMsg({ type: 'error', text: typeof detail === 'string' ? detail : 'Error al enviar' });
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
      data-testid="incidencia-modal"
      onClick={() => !sending && !shotUploading && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="font-cabinet text-xl font-bold text-slate-900">Reportar feedback</h2>
            <p className="text-xs text-slate-500">Incidencia, mejora o pregunta — el equipo lo revisará pronto.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Cerrar"
          >×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo</label>
            <div className="inline-flex border border-slate-300 rounded-md overflow-hidden text-sm">
              {TIPO_OPTIONS.map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setTipo(o.v)}
                  data-testid={`inc-tipo-${o.v}`}
                  className={`px-3 py-1.5 ${tipo === o.v ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prioridad */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Prioridad</label>
            <div className="inline-flex border border-slate-300 rounded-md overflow-hidden text-sm">
              {PRIO_OPTIONS.map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setPrioridad(o.v)}
                  data-testid={`inc-prio-${o.v}`}
                  className={`px-3 py-1.5 ${prioridad === o.v ? o.cls : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Página */}
          <label className="block text-xs font-medium text-slate-600">
            Página relacionada
            <input
              type="text"
              value={paginaInput}
              onChange={(e) => setPaginaInput(e.target.value)}
              data-testid="inc-pagina"
              className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm font-mono"
            />
          </label>

          {/* Descripción */}
          <label className="block text-xs font-medium text-slate-600">
            Descripción <span className="text-slate-400">(mín. {MIN_DESC} caracteres)</span>
            <textarea
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              data-testid="inc-desc"
              placeholder="Describe lo que ocurre, qué esperabas, y cualquier detalle útil…"
              className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm"
            />
            <span className={`text-[11px] ${charsLeft > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {charsLeft > 0 ? `Faltan ${charsLeft} caracteres` : '✓ Suficientemente detallado'}
            </span>
          </label>

          {/* Captura de pantalla */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Captura de pantalla <span className="text-slate-400">(opcional · arrastra, pega con Ctrl+V o pulsa para seleccionar · máx 5 MB)</span>
            </label>
            {shotPreview ? (
              <div className="relative inline-block" data-testid="inc-shot-preview-wrap">
                <img
                  src={shotPreview}
                  alt="Captura adjunta"
                  data-testid="inc-shot-preview"
                  className="max-h-48 rounded-md border border-slate-300"
                />
                {shotUploading && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-medium text-slate-700 rounded-md">
                    Subiendo…
                  </div>
                )}
                {!shotUploading && shotUrl && (
                  <span
                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold"
                    data-testid="inc-shot-uploaded"
                  >
                    ✓ Subida
                  </span>
                )}
                <button
                  type="button"
                  onClick={removeShot}
                  data-testid="inc-shot-remove"
                  disabled={shotUploading}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs hover:bg-red-600 disabled:opacity-50"
                  title="Quitar imagen"
                >×</button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="inc-shot-dropzone"
                className={`cursor-pointer border-2 border-dashed rounded-lg px-4 py-6 text-center transition-colors ${
                  dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                }`}
              >
                <div className="text-slate-500 text-sm">
                  <span className="text-2xl block mb-1">📎</span>
                  Arrastra una imagen aquí, pega con <kbd className="px-1 bg-white border border-slate-300 rounded text-[10px]">Ctrl/⌘+V</kbd> o haz clic
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              data-testid="inc-shot-input"
              onChange={onFileInput}
              className="hidden"
            />
          </div>

          {msg && (
            <div
              className={`text-sm p-2 rounded ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
              data-testid="inc-msg"
            >
              {msg.text}
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            data-testid="inc-cancel"
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
          >Cancelar</button>
          <button
            type="button"
            onClick={enviar}
            disabled={!canSubmit}
            data-testid="inc-submit"
            className="ml-auto px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Enviando…' : (shotUploading ? 'Esperando captura…' : 'Enviar reporte')}
          </button>
        </div>
      </div>
    </div>
  );
}
