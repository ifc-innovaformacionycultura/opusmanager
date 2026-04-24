// Panel del músico para ver y confirmar la logística (transportes + alojamientos)
// del evento. Se importa desde PortalDashboard.
import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const fmtFecha = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

const fmtHora = (h) => h ? h.slice(0,5) : '';

const Recogida = ({ lugar, hora }) => (
  lugar ? (
    <div className="text-xs text-slate-700 flex items-center gap-2">
      <span className="text-slate-500">🚏</span>
      <span>{lugar}</span>
      {hora && <span className="text-slate-500 tabular-nums">{fmtHora(hora)}</span>}
    </div>
  ) : null
);

const LogisticaItem = ({ item, apiUrl, onRefresh }) => {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const confirmar = async (val) => {
    setSaving(true); setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${apiUrl}/portal/logistica/${item.id}/confirmar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmado: val }),
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

  const estado = item.mi_confirmacion;
  const esTransporte = item.tipo !== 'alojamiento';
  const tipoLabel = item.tipo === 'transporte_ida' ? 'Ida' : item.tipo === 'transporte_vuelta' ? 'Vuelta' : 'Alojamiento';

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/40" data-testid={`logistica-item-${item.id}`}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{esTransporte ? '🚌' : '🏨'}</span>
          <span className="font-semibold text-slate-800 text-sm">{tipoLabel}</span>
          {item.fecha && esTransporte && (
            <span className="text-xs text-slate-500">{fmtFecha(item.fecha)}</span>
          )}
        </div>
        {item.fecha_limite_confirmacion && (
          <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            Confirmar antes del {fmtFecha(item.fecha_limite_confirmacion)}
          </span>
        )}
      </div>

      {esTransporte ? (
        <div className="space-y-1 text-sm">
          {(item.lugar_salida || item.hora_salida) && (
            <div><span className="text-slate-500">Salida:</span> <span className="font-medium">{fmtHora(item.hora_salida)} {item.lugar_salida || ''}</span></div>
          )}
          {(item.lugar_llegada || item.hora_llegada) && (
            <div><span className="text-slate-500">Llegada:</span> <span className="font-medium">{fmtHora(item.hora_llegada)} {item.lugar_llegada || ''}</span></div>
          )}
          {(item.recogida_1_lugar || item.recogida_2_lugar || item.recogida_3_lugar) && (
            <div className="mt-1 pl-2 border-l-2 border-slate-200">
              <div className="text-xs text-slate-500 mb-0.5">Puntos de recogida:</div>
              <Recogida lugar={item.recogida_1_lugar} hora={item.recogida_1_hora} />
              <Recogida lugar={item.recogida_2_lugar} hora={item.recogida_2_hora} />
              <Recogida lugar={item.recogida_3_lugar} hora={item.recogida_3_hora} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <div><span className="font-semibold">{item.hotel_nombre || '—'}</span></div>
          {item.hotel_direccion && <div className="text-slate-700">{item.hotel_direccion}</div>}
          <div className="flex items-center gap-3 text-xs text-slate-600">
            {item.fecha_checkin && <span>Check-in: <strong>{fmtFecha(item.fecha_checkin)}</strong></span>}
            {item.fecha_checkout && <span>Check-out: <strong>{fmtFecha(item.fecha_checkout)}</strong></span>}
          </div>
        </div>
      )}

      {item.notas && (
        <div className="mt-2 text-xs text-slate-600 italic">📝 {item.notas}</div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => confirmar(true)} disabled={saving}
                data-testid={`btn-conf-yes-${item.id}`}
                className={`px-3 py-1.5 text-xs rounded font-medium ${estado === true ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}>
          {esTransporte ? '✓ Confirmo este transporte' : '✓ Necesito alojamiento'}
        </button>
        <button type="button" onClick={() => confirmar(false)} disabled={saving}
                data-testid={`btn-conf-no-${item.id}`}
                className={`px-3 py-1.5 text-xs rounded font-medium ${estado === false ? 'bg-red-600 text-white' : 'bg-white border border-red-300 text-red-700 hover:bg-red-50'}`}>
          {esTransporte ? '✗ No necesito transporte' : '✗ No necesito alojamiento'}
        </button>
        {estado !== null && estado !== undefined && (
          <span className="text-xs text-slate-500 ml-1">
            Tu respuesta: <strong>{estado ? 'Confirmado' : 'Rechazado'}</strong>
          </span>
        )}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
};

const LogisticaMusicoPanel = ({ logistica, apiUrl, onRefresh }) => {
  if (!logistica || logistica.length === 0) return null;
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200" data-testid="portal-logistica-section">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">🚌🏨 Transporte y Alojamiento</h3>
      <div className="space-y-3">
        {logistica.map(item => (
          <LogisticaItem key={item.id} item={item} apiUrl={apiUrl} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
};

export default LogisticaMusicoPanel;
