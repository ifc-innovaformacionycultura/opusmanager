// Panel del músico para confirmar el servicio de comedor del evento.
// Mismo patrón que LogisticaMusicoPanel.js
import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const fmtFecha = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};
const fmtHora = (h) => h ? h.slice(0, 5) : '';
const fmtMoney = (n) => `${parseFloat(n || 0).toFixed(2)} €`;

const ComidaItem = ({ item, apiUrl, onRefresh }) => {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const enviar = async ({ confirmado, toma_cafe, opcion_menu_seleccionada }) => {
    setSaving(true); setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const body = { confirmado, toma_cafe };
      if (opcion_menu_seleccionada !== undefined) body.opcion_menu_seleccionada = opcion_menu_seleccionada;
      const res = await fetch(`${apiUrl}/portal/comidas/${item.id}/confirmar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || 'Error');
      }
      if (onRefresh) onRefresh();
    } catch (e) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  const estado = item.mi_confirmacion;          // true / false / null
  const tomaCafe = item.mi_toma_cafe;            // true / false / null
  const miOpcion = item.mi_opcion_menu || null;
  const opciones = Array.isArray(item.opciones_menu) ? item.opciones_menu : [];

  return (
    <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/40" data-testid={`comida-item-${item.id}`}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍽️</span>
          <span className="font-semibold text-slate-800 text-sm">
            {fmtFecha(item.fecha)}
            {item.hora_inicio && <span className="text-slate-500 ml-1">· {fmtHora(item.hora_inicio)}{item.hora_fin ? `–${fmtHora(item.hora_fin)}` : ''}</span>}
          </span>
          {item.lugar && <span className="text-xs text-slate-600">📍 {item.lugar}</span>}
        </div>
        {item.fecha_limite_confirmacion && (
          <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            Confirmar antes del {fmtFecha(item.fecha_limite_confirmacion)}
          </span>
        )}
      </div>

      {item.menu && (
        <div className="text-sm text-slate-700 whitespace-pre-line bg-white rounded p-2 border border-slate-100 mb-2">
          {item.menu}
        </div>
      )}

      <div className="flex items-center gap-3 text-sm text-slate-700 mb-2 flex-wrap">
        <span><span className="text-slate-500">Precio:</span> <strong>{fmtMoney(item.precio_menu)}</strong></span>
        {item.incluye_cafe && (
          <span>☕ <span className="text-slate-500">Café:</span> <strong>{fmtMoney(item.precio_cafe)}</strong></span>
        )}
      </div>

      {item.notas && <div className="text-xs text-slate-600 italic mb-2">📝 {item.notas}</div>}

      {/* Selector de opción de menú (D1) */}
      {opciones.length > 0 && estado === true && (
        <div className="mb-2 bg-white border border-orange-200 rounded p-2">
          <div className="text-xs font-semibold text-orange-800 mb-1">Elige tu opción de menú:</div>
          <div className="space-y-1">
            {opciones.map((op) => (
              <label key={op.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name={`opc-${item.id}`}
                       checked={miOpcion === op.id}
                       disabled={saving}
                       onChange={() => enviar({ confirmado: true, toma_cafe: tomaCafe, opcion_menu_seleccionada: op.id })}
                       data-testid={`radio-opcion-${item.id}-${op.id}`}
                       className="w-4 h-4 accent-orange-600"/>
                <span>{op.nombre || op.id}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => enviar({ confirmado: true, toma_cafe: tomaCafe })} disabled={saving}
                data-testid={`btn-comida-yes-${item.id}`}
                className={`px-3 py-1.5 text-xs rounded font-medium ${estado === true ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}>
          ✓ Asistiré
        </button>
        <button type="button" onClick={() => enviar({ confirmado: false, toma_cafe: null })} disabled={saving}
                data-testid={`btn-comida-no-${item.id}`}
                className={`px-3 py-1.5 text-xs rounded font-medium ${estado === false ? 'bg-red-600 text-white' : 'bg-white border border-red-300 text-red-700 hover:bg-red-50'}`}>
          ✗ No asistiré
        </button>

        {estado === true && item.incluye_cafe && (
          <label className="ml-2 flex items-center gap-1 text-xs cursor-pointer">
            <input type="checkbox" checked={!!tomaCafe} disabled={saving}
                   onChange={(e) => enviar({ confirmado: true, toma_cafe: e.target.checked })}
                   data-testid={`chk-comida-cafe-${item.id}`}
                   className="w-4 h-4 accent-orange-600"/>
            <span>Tomaré café (+ {fmtMoney(item.precio_cafe)})</span>
          </label>
        )}

        {estado !== null && estado !== undefined && (
          <span className="text-xs text-slate-500 ml-auto">
            Tu respuesta: <strong>{estado ? `Asistiré${tomaCafe ? ' · con café' : ''}` : 'No asistiré'}</strong>
          </span>
        )}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
};

const ComidasMusicoPanel = ({ comidas, apiUrl, onRefresh }) => {
  if (!comidas || comidas.length === 0) return null;
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200" data-testid="portal-comidas-section">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">🍽️ Servicio de comedor</h3>
      <div className="space-y-3">
        {comidas.map(item => (
          <ComidaItem key={item.id} item={item} apiUrl={apiUrl} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
};

export default ComidasMusicoPanel;
