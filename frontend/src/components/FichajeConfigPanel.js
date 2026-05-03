import React, { useState, useEffect } from "react";
import { useAuth as useGestorAuth } from "../contexts/AuthContext";

// ============================================================
// Iter F4 — Panel de reglas de fichaje por ensayo + plantillas globales
// (Refactor F4.2 · 2026-05-03: extraído de ConfiguracionEventos.js)
// ============================================================
export const FichajeConfigPanel = ({ ensayoId, eventoId, isSuperAdmin, currentUserId }) => {
  const { api } = useGestorAuth();
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(false);
  const [plantillas, setPlantillas] = useState([]);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [savingPlantillaName, setSavingPlantillaName] = useState('');

  const fetchCfg = React.useCallback(async () => {
    if (!ensayoId) return;
    try {
      const r = await api.get(`/api/gestor/fichaje-config/${ensayoId}`);
      setCfg(r.data?.config || {});
    } catch {
      setCfg({});
    } finally {
      setLoading(false);
    }
  }, [api, ensayoId]);

  const fetchPlantillas = React.useCallback(async () => {
    try {
      const r = await api.get('/api/gestor/fichaje-plantillas');
      setPlantillas(r.data?.plantillas || []);
    } catch {
      setPlantillas([]);
    }
  }, [api]);

  useEffect(() => { fetchCfg(); }, [fetchCfg]);
  useEffect(() => { fetchPlantillas(); }, [fetchPlantillas]);

  const set = (k, v) => setCfg((p) => ({ ...(p || {}), [k]: v }));

  const guardar = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.put(`/api/gestor/fichaje-config/${ensayoId}`, {
        minutos_antes_apertura: parseInt(cfg.minutos_antes_apertura) || 30,
        minutos_despues_cierre: parseInt(cfg.minutos_despues_cierre) || 30,
        minutos_retraso_aviso: parseInt(cfg.minutos_retraso_aviso) || 5,
        computa_tiempo_extra: !!cfg.computa_tiempo_extra,
        computa_mas_alla_fin: !!cfg.computa_mas_alla_fin,
        notif_musico_push: !!cfg.notif_musico_push,
        notif_musico_email: !!cfg.notif_musico_email,
        notif_musico_whatsapp: !!cfg.notif_musico_whatsapp,
        notif_gestor_push: !!cfg.notif_gestor_push,
        notif_gestor_email: !!cfg.notif_gestor_email,
        notif_gestor_dashboard: !!cfg.notif_gestor_dashboard,
        mensaje_aviso_musico: cfg.mensaje_aviso_musico || '',
        mensaje_aviso_gestor: cfg.mensaje_aviso_gestor || '',
      });
      setMsg('✓ Guardado');
      setTimeout(() => setMsg(null), 2500);
      fetchCfg();
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const aplicarPlantilla = async (plantilla_id) => {
    if (!window.confirm('¿Aplicar esta plantilla a las reglas de este ensayo? Sobrescribe los valores actuales.')) return;
    try {
      await api.post(`/api/gestor/fichaje-config/${ensayoId}/aplicar-plantilla/${plantilla_id}`);
      fetchCfg();
      setMsg('✓ Plantilla aplicada');
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      alert('No se pudo aplicar: ' + (e.response?.data?.detail || e.message));
    }
  };

  const guardarComoPlantilla = async () => {
    const nombre = (savingPlantillaName || '').trim();
    if (!nombre) { alert('Indica un nombre para la plantilla.'); return; }
    if (!cfg) return;
    // Iter F4 — La tabla fichaje_plantillas usa columnas planas, no JSONB.
    const payload = {
      nombre,
      descripcion: null,
      minutos_antes_apertura: parseInt(cfg.minutos_antes_apertura) || 30,
      minutos_despues_cierre: parseInt(cfg.minutos_despues_cierre) || 30,
      minutos_retraso_aviso: parseInt(cfg.minutos_retraso_aviso) || 5,
      computa_tiempo_extra: !!cfg.computa_tiempo_extra,
      computa_mas_alla_fin: !!cfg.computa_mas_alla_fin,
      notif_musico_push: !!cfg.notif_musico_push,
      notif_musico_email: !!cfg.notif_musico_email,
      notif_musico_whatsapp: !!cfg.notif_musico_whatsapp,
      notif_gestor_push: !!cfg.notif_gestor_push,
      notif_gestor_email: !!cfg.notif_gestor_email,
      notif_gestor_dashboard: !!cfg.notif_gestor_dashboard,
      mensaje_aviso_musico: cfg.mensaje_aviso_musico || '',
      mensaje_aviso_gestor: cfg.mensaje_aviso_gestor || '',
    };
    try {
      await api.post('/api/gestor/fichaje-plantillas', payload);
      setSavingPlantillaName('');
      fetchPlantillas();
      alert('Plantilla guardada ✅');
    } catch (e) {
      alert('No se pudo guardar la plantilla: ' + (e.response?.data?.detail || e.message));
    }
  };

  const eliminarPlantilla = async (plantilla_id) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return;
    try {
      await api.delete(`/api/gestor/fichaje-plantillas/${plantilla_id}`);
      fetchPlantillas();
    } catch (e) {
      alert('No se pudo eliminar: ' + (e.response?.data?.detail || e.message));
    }
  };

  const puedeEditarPlantilla = (p) =>
    isSuperAdmin || (p.creado_por && p.creado_por === currentUserId);

  if (!ensayoId) return null;
  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-500" data-testid={`fichaje-panel-loading-${ensayoId}`}>
        Cargando reglas de fichaje...
      </div>
    );
  }
  const c = cfg || {};
  const resumen = `${c.minutos_antes_apertura ?? 30}′/${c.minutos_despues_cierre ?? 30}′ · aviso ${c.minutos_retraso_aviso ?? 5}′`;

  return (
    <div className="bg-blue-50/40 border border-blue-200 rounded-lg p-3 text-xs space-y-2" data-testid={`fichaje-panel-${ensayoId}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 font-semibold uppercase text-blue-900 tracking-wide hover:text-blue-700"
          data-testid={`btn-toggle-fichaje-panel-${ensayoId}`}
        >
          <span>⏱️ Reglas de fichaje</span>
          <span className="text-[10px] font-normal normal-case text-slate-500">({resumen})</span>
          {c.es_configuracion_global === false && (
            <span
              className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200"
              data-testid={`fichaje-badge-especifica-${ensayoId}`}
              title="Esta config sobrescribe los valores globales"
            >
              ⚠️ Regla específica
            </span>
          )}
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div className="flex items-center gap-2">
          {msg && <span className="text-emerald-700">{msg}</span>}
          <button
            type="button"
            onClick={() => setShowPlantillas(s => !s)}
            className="px-2 py-1 rounded border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
            data-testid={`btn-toggle-fichaje-plantillas-${ensayoId}`}
          >⭐ Plantillas {plantillas.length ? `(${plantillas.length})` : ''}</button>
          <button
            type="button"
            onClick={guardar}
            disabled={saving}
            className="px-2.5 py-1 bg-slate-900 text-white rounded inline-flex items-center gap-1 disabled:opacity-50"
            data-testid={`btn-save-fichaje-${ensayoId}`}
          >{saving ? '…' : 'Guardar'}</button>
        </div>
      </div>

      {showPlantillas && (
        <div className="border border-purple-200 rounded p-2 bg-white" data-testid={`fichaje-plantillas-panel-${ensayoId}`}>
          {plantillas.length === 0 && (
            <div className="text-slate-500 italic mb-1">No hay plantillas todavía.</div>
          )}
          {plantillas.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 py-1 border-b border-purple-100 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate">{p.nombre}</div>
                {p.descripcion && <div className="text-[10px] text-slate-500 truncate">{p.descripcion}</div>}
              </div>
              <button
                type="button"
                onClick={() => aplicarPlantilla(p.id)}
                className="px-2 py-0.5 rounded bg-purple-600 text-white hover:bg-purple-700"
                data-testid={`btn-aplicar-plantilla-fichaje-${ensayoId}-${p.id}`}
              >Aplicar</button>
              {puedeEditarPlantilla(p) && (
                <button
                  type="button"
                  onClick={() => eliminarPlantilla(p.id)}
                  className="px-1.5 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                  data-testid={`btn-eliminar-plantilla-fichaje-${p.id}`}
                  title="Eliminar plantilla"
                >🗑</button>
              )}
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-purple-100 flex items-center gap-2">
            <input
              value={savingPlantillaName}
              onChange={e => setSavingPlantillaName(e.target.value)}
              placeholder="Guardar reglas actuales como plantilla..."
              className="flex-1 px-2 py-1 border border-purple-200 rounded"
              data-testid={`input-plantilla-fichaje-name-${ensayoId}`}
            />
            <button
              type="button"
              onClick={guardarComoPlantilla}
              className="px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700"
              data-testid={`btn-guardar-plantilla-fichaje-${ensayoId}`}
            >Guardar</button>
          </div>
        </div>
      )}

      {open && (
        <div className="space-y-3 pt-2 border-t border-blue-200">
          <div>
            <div className="font-semibold text-slate-700 mb-1">Tiempos</div>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-slate-600">Min antes apertura</span>
                <input type="number" min="0" value={c.minutos_antes_apertura ?? 30}
                       onChange={(e) => set('minutos_antes_apertura', e.target.value)}
                       className="px-1.5 py-1 border border-slate-200 rounded"
                       data-testid={`fichaje-min-antes-${ensayoId}`}/>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-slate-600">Min después fin</span>
                <input type="number" min="0" value={c.minutos_despues_cierre ?? 30}
                       onChange={(e) => set('minutos_despues_cierre', e.target.value)}
                       className="px-1.5 py-1 border border-slate-200 rounded"
                       data-testid={`fichaje-min-despues-${ensayoId}`}/>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-slate-600">Min retraso aviso</span>
                <input type="number" min="0" value={c.minutos_retraso_aviso ?? 5}
                       onChange={(e) => set('minutos_retraso_aviso', e.target.value)}
                       className="px-1.5 py-1 border border-slate-200 rounded"
                       data-testid={`fichaje-min-retraso-${ensayoId}`}/>
              </label>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!c.computa_tiempo_extra}
                       onChange={(e) => set('computa_tiempo_extra', e.target.checked)}
                       data-testid={`fichaje-computa-pre-${ensayoId}`}/>
                <span>Computar antes</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!c.computa_mas_alla_fin}
                       onChange={(e) => set('computa_mas_alla_fin', e.target.checked)}
                       data-testid={`fichaje-computa-post-${ensayoId}`}/>
                <span>Computar más allá del fin</span>
              </label>
            </div>
          </div>

          <div>
            <div className="font-semibold text-slate-700 mb-1">Notificaciones al músico</div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!c.notif_musico_push}
                       onChange={(e) => set('notif_musico_push', e.target.checked)}
                       data-testid={`fichaje-notif-mus-push-${ensayoId}`}/>
                <span>Push</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!c.notif_musico_email}
                       onChange={(e) => set('notif_musico_email', e.target.checked)}
                       data-testid={`fichaje-notif-mus-email-${ensayoId}`}/>
                <span>Email</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!c.notif_musico_whatsapp}
                       onChange={(e) => set('notif_musico_whatsapp', e.target.checked)}
                       data-testid={`fichaje-notif-mus-wa-${ensayoId}`}/>
                <span>WhatsApp</span>
              </label>
            </div>
            <input
              type="text"
              value={c.mensaje_aviso_musico || ''}
              onChange={(e) => set('mensaje_aviso_musico', e.target.value)}
              placeholder="Mensaje de aviso al músico..."
              className="w-full mt-1 px-2 py-1 border border-slate-200 rounded"
              data-testid={`fichaje-msg-mus-${ensayoId}`}
            />
          </div>

          <div>
            <div className="font-semibold text-slate-700 mb-1">Notificaciones al gestor</div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!c.notif_gestor_push}
                       onChange={(e) => set('notif_gestor_push', e.target.checked)}
                       data-testid={`fichaje-notif-ges-push-${ensayoId}`}/>
                <span>Push</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!c.notif_gestor_email}
                       onChange={(e) => set('notif_gestor_email', e.target.checked)}
                       data-testid={`fichaje-notif-ges-email-${ensayoId}`}/>
                <span>Email</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!c.notif_gestor_dashboard}
                       onChange={(e) => set('notif_gestor_dashboard', e.target.checked)}
                       data-testid={`fichaje-notif-ges-dash-${ensayoId}`}/>
                <span>Dashboard</span>
              </label>
            </div>
            <input
              type="text"
              value={c.mensaje_aviso_gestor || ''}
              onChange={(e) => set('mensaje_aviso_gestor', e.target.value)}
              placeholder="Mensaje de aviso al gestor..."
              className="w-full mt-1 px-2 py-1 border border-slate-200 rounded"
              data-testid={`fichaje-msg-ges-${ensayoId}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Aplicar plantilla a TODOS los ensayos del evento (botón cabecera de sección)
export const FichajePlantillaEventoButton = ({ eventoId, isSuperAdmin: _isa, currentUserId: _cu, onApplied }) => {
  const { api } = useGestorAuth();
  const [plantillas, setPlantillas] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await api.get('/api/gestor/fichaje-plantillas');
        if (!cancel) setPlantillas(r.data?.plantillas || []);
      } catch {
        if (!cancel) setPlantillas([]);
      }
    })();
    return () => { cancel = true; };
  }, [api, open]);

  const aplicar = async (plantilla_id) => {
    if (!window.confirm('¿Aplicar esta plantilla a TODOS los ensayos del evento?')) return;
    setBusy(true);
    try {
      const r = await api.post(`/api/gestor/eventos/${eventoId}/fichaje/aplicar-plantilla/${plantilla_id}`);
      alert(`✓ Plantilla aplicada a ${r.data?.aplicados || 0} ensayo(s).`);
      setOpen(false);
      onApplied && onApplied();
    } catch (e) {
      alert('No se pudo aplicar: ' + (e.response?.data?.detail || e.message));
    } finally {
      setBusy(false);
    }
  };

  if (!eventoId) return null;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="text-xs px-3 py-1.5 rounded border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50"
        data-testid="btn-aplicar-plantilla-fichaje-evento"
      >
        ⏱️ Aplicar plantilla a todos los ensayos
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 bg-white border border-purple-200 rounded shadow-lg p-2 w-64 max-h-64 overflow-y-auto" data-testid="dropdown-plantillas-fichaje-evento">
          {plantillas.length === 0 && <div className="text-xs text-slate-500 italic px-2 py-1">No hay plantillas.</div>}
          {plantillas.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => aplicar(p.id)}
              className="w-full text-left text-xs px-2 py-1.5 hover:bg-purple-50 rounded"
              data-testid={`btn-aplicar-plantilla-fichaje-evento-${p.id}`}
            >
              <div className="font-medium text-slate-800">{p.nombre}</div>
              {p.descripcion && <div className="text-[10px] text-slate-500">{p.descripcion}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
