// CRM de Contactos — Bloque colapsable por evento en Seguimiento de Plantillas.
//
// Para cada evento, cuando el bloque CRM está expandido, añade 3 sub-columnas
// detrás de las existentes (ensayos / %Disp / Publicado / Acción):
//   · "Contactos" — badge con número total y color según último estado.
//   · "Último contacto" — fecha + icono de tipo.
//   · "➕"          — botón que abre un mini-modal para registrar un nuevo
//                     contacto y un panel lateral con el historial completo.
//
// La preferencia de qué eventos tienen el CRM expandido se guarda en
// localStorage bajo la clave `seguimiento_crm_expandidos`.
import React, { useState, useEffect, useCallback } from 'react';

// ============================================================
// Helpers visuales
// ============================================================

export const ESTADO_COLOR = {
  respuesta_positiva: { dot: 'bg-green-500',  text: 'text-green-800',  bg: 'bg-green-100',  border: 'border-green-300',  label: 'Respuesta positiva' },
  respuesta_negativa: { dot: 'bg-red-500',    text: 'text-red-800',    bg: 'bg-red-100',    border: 'border-red-300',    label: 'Respuesta negativa' },
  sin_respuesta:      { dot: 'bg-amber-500',  text: 'text-amber-800',  bg: 'bg-amber-100',  border: 'border-amber-300',  label: 'Sin respuesta' },
  no_contesta:        { dot: 'bg-amber-500',  text: 'text-amber-800',  bg: 'bg-amber-100',  border: 'border-amber-300',  label: 'No contesta' },
  buzon:              { dot: 'bg-violet-500', text: 'text-violet-800', bg: 'bg-violet-100', border: 'border-violet-300', label: 'Buzón' },
  no_contactado:      { dot: 'bg-slate-300',  text: 'text-slate-700',  bg: 'bg-slate-100',  border: 'border-slate-300',  label: 'No contactado' },
};

const EMOJI_ESTADO = {
  respuesta_positiva: '🟢', respuesta_negativa: '🔴',
  sin_respuesta: '🟡', no_contesta: '🟡',
  buzon: '📵', no_contactado: '⚪',
};

const ICON_TIPO = {
  email: '📧', llamada: '📞', whatsapp: '💬', otro: '📝',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return iso; }
};
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

// ============================================================
// Botón cabecera del bloque de evento (toggle)
// ============================================================

export const CRMToggleButton = ({ expanded, onClick, total, eventoId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={`btn-crm-toggle-${eventoId}`}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
      expanded
        ? 'bg-blue-600 text-white border-blue-700'
        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
    }`}
    title={expanded ? 'Ocultar CRM' : 'Mostrar CRM'}
  >
    📞 CRM {total > 0 ? `(${total})` : ''}
  </button>
);

// ============================================================
// Hook para gestionar bloques CRM expandidos por evento (localStorage)
// ============================================================

export const useCRMExpandidos = () => {
  const [expandidos, setExpandidos] = useState(() => {
    try {
      const raw = localStorage.getItem('seguimiento_crm_expandidos');
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  });
  useEffect(() => {
    try { localStorage.setItem('seguimiento_crm_expandidos', JSON.stringify([...expandidos])); } catch {}
  }, [expandidos]);
  const toggle = (eventoId) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(eventoId)) next.delete(eventoId);
      else next.add(eventoId);
      return next;
    });
  };
  return { expandidos, toggle };
};

// ============================================================
// Celda de "Contactos" (número + badge color)
// ============================================================

export const ContactosBadge = ({ crm, onClick, dataTestId }) => {
  const total = crm?.total_contactos || 0;
  const estado = total > 0 ? (crm?.ultimo_estado || 'sin_respuesta') : 'no_contactado';
  const cfg = ESTADO_COLOR[estado] || ESTADO_COLOR.no_contactado;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={dataTestId}
      title={`${cfg.label} — ${total} contacto${total === 1 ? '' : 's'}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80`}
    >
      <span>{EMOJI_ESTADO[estado]}</span>
      <span>{total}</span>
    </button>
  );
};

// ============================================================
// Mini-modal inline: registrar nuevo contacto
// ============================================================

export const RegistrarContactoModal = ({ open, onClose, onSubmit, musicoNombre, eventoNombre }) => {
  const [tipo, setTipo] = useState('llamada');
  const [estado, setEstado] = useState('sin_respuesta');
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (open) {
      setTipo('llamada');
      setEstado('sin_respuesta');
      setNotas('');
      setFecha(new Date().toISOString().slice(0, 16));
      setErr(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      await onSubmit({
        tipo, estado_respuesta: estado, notas: notas.trim() || null,
        fecha_contacto: new Date(fecha).toISOString(),
      });
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="crm-registrar-modal" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 pb-2">
          <h3 className="font-semibold text-slate-900">Registrar nuevo contacto</h3>
          <p className="text-xs text-slate-500 mt-0.5">{musicoNombre} · {eventoNombre}</p>
        </div>

        {err && <div className="p-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded">{err}</div>}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de contacto</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            data-testid="crm-input-tipo"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
            <option value="email">📧 Email</option>
            <option value="llamada">📞 Llamada</option>
            <option value="whatsapp">💬 WhatsApp</option>
            <option value="otro">📝 Otro</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Estado de la respuesta</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}
            data-testid="crm-input-estado"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
            <option value="sin_respuesta">🟡 Sin respuesta</option>
            <option value="respuesta_positiva">🟢 Respuesta positiva</option>
            <option value="respuesta_negativa">🔴 Respuesta negativa</option>
            <option value="no_contesta">🟡 No contesta</option>
            <option value="buzon">📵 Buzón</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fecha y hora</label>
          <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)}
            data-testid="crm-input-fecha"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
            data-testid="crm-input-notas"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            data-testid="crm-btn-guardar"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar contacto'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Panel lateral: historial completo de contactos
// ============================================================

export const HistorialPanel = ({ open, onClose, contactos, loading, musicoNombre, eventoNombre, onAddNew }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" data-testid="crm-historial-panel" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div className="w-full max-w-md bg-white shadow-2xl h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900">Historial de contactos</h3>
            <p className="text-xs text-slate-500 mt-0.5">{musicoNombre} · {eventoNombre}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded" data-testid="crm-historial-close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : contactos.length === 0 ? (
            <p className="text-sm text-slate-500">Sin contactos registrados aún.</p>
          ) : (
            contactos.map(c => {
              const cfg = ESTADO_COLOR[c.estado_respuesta] || ESTADO_COLOR.no_contactado;
              return (
                <div key={c.id} className={`border rounded-lg p-3 ${cfg.bg} ${cfg.border}`} data-testid={`crm-contacto-${c.id}`}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-base">{ICON_TIPO[c.tipo] || '📝'}</span>
                    <strong className={`${cfg.text}`}>{cfg.label}</strong>
                    <span className="ml-auto text-slate-500">{fmtDateTime(c.fecha_contacto)}</span>
                  </div>
                  {c.notas && <p className="text-sm text-slate-700 mt-2">{c.notas}</p>}
                  {c.gestor_nombre && (
                    <p className="text-[10px] text-slate-500 mt-1">por {c.gestor_nombre}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-3">
          <button onClick={onAddNew}
            data-testid="crm-historial-add-new"
            className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium">
            ➕ Registrar nuevo contacto
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Celda de "Último contacto" — fecha + icono de tipo
// ============================================================

export const UltimoContactoCell = ({ crm }) => {
  if (!crm?.total_contactos || !crm?.ultima_fecha) {
    return <span className="text-slate-300 text-xs">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-700">
      <span>{ICON_TIPO[crm.ultimo_tipo] || '📝'}</span>
      <span>{fmtDate(crm.ultima_fecha)}</span>
    </span>
  );
};
