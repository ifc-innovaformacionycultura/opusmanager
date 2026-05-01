// Bloque 2A — Sección "Historial de contactos" para GestorMusicoDetalle
import React, { useEffect, useState, useCallback } from "react";
import { Phone, Mail, MessageCircle, FileText, Plus } from "lucide-react";

const TIPO_ICON = { email: Mail, llamada: Phone, whatsapp: MessageCircle, otro: FileText };
const ESTADO_BADGE = {
  sin_respuesta: { label: "Sin respuesta", cls: "bg-slate-100 text-slate-700" },
  respuesta_positiva: { label: "Positiva", cls: "bg-emerald-100 text-emerald-800" },
  respuesta_negativa: { label: "Negativa", cls: "bg-rose-100 text-rose-800" },
  no_contactado: { label: "No contactado", cls: "bg-slate-100 text-slate-700" },
  buzon: { label: "Buzón", cls: "bg-amber-100 text-amber-800" },
  no_contesta: { label: "No contesta", cls: "bg-amber-100 text-amber-800" },
};

const fmt = (s) => s ? new Date(s).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "—";

const HistorialContactosMusico = ({ api, usuarioId }) => {
  const [contactos, setContactos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState({ tipo: "email", evento_id: "", estado_respuesta: "sin_respuesta", notas: "", fecha_contacto: "" });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/gestor/contactos/musico/${usuarioId}`);
      setContactos(r.data?.contactos || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [api, usuarioId]);

  const cargarEventosMusico = useCallback(async () => {
    try {
      const r = await api.get(`/api/gestor/musicos/${usuarioId}/eventos`);
      const list = Array.isArray(r.data) ? r.data : (r.data?.eventos || []);
      setEventos(list);
    } catch { /* ignore */ }
  }, [api, usuarioId]);

  useEffect(() => { cargar(); cargarEventosMusico(); }, [cargar, cargarEventosMusico]);

  const guardar = async () => {
    setSaving(true);
    try {
      const body = {
        usuario_id: usuarioId,
        tipo: form.tipo,
        estado_respuesta: form.estado_respuesta || "sin_respuesta",
        notas: form.notas || null,
      };
      if (form.evento_id) body.evento_id = form.evento_id;
      if (form.fecha_contacto) body.fecha_contacto = form.fecha_contacto;
      await api.post("/api/gestor/contactos", body);
      setOpenModal(false);
      setForm({ tipo: "email", evento_id: "", estado_respuesta: "sin_respuesta", notas: "", fecha_contacto: "" });
      await cargar();
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    } finally { setSaving(false); }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-4" data-testid="historial-contactos-musico">
      <header className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-slate-800 uppercase tracking-wide inline-flex items-center gap-2">
          <Phone className="w-4 h-4"/> Historial de contactos ({contactos.length})
        </h2>
        <button onClick={() => setOpenModal(true)}
                data-testid="btn-nuevo-contacto"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded">
          <Plus className="w-3.5 h-3.5"/> Registrar contacto
        </button>
      </header>
      <div className="p-3">
        {loading ? <div className="text-sm text-slate-500">Cargando…</div> : (
          contactos.length === 0 ? (
            <div className="text-sm text-slate-500 italic">Sin contactos registrados.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {contactos.map((c) => {
                const Icon = TIPO_ICON[c.tipo] || FileText;
                const eb = ESTADO_BADGE[c.estado_respuesta] || ESTADO_BADGE.sin_respuesta;
                return (
                  <li key={c.id} data-testid={`contacto-${c.id}`} className="py-2 flex items-start gap-3">
                    <Icon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 capitalize">{c.tipo}</span>
                        <span className="text-xs text-slate-500">· {fmt(c.fecha_contacto || c.created_at)}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${eb.cls}`}>{eb.label}</span>
                        <span className="text-[10px] text-slate-500">
                          {c.evento ? `📌 ${c.evento.nombre}` : "📭 General"}
                        </span>
                      </div>
                      {c.notas && <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line">{c.notas}</p>}
                      {c.gestor_nombre && <p className="text-[10px] text-slate-400 mt-0.5">por {c.gestor_nombre}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
            <h3 className="font-bold text-slate-900 mb-3">Registrar contacto</h3>
            <div className="space-y-2 text-sm">
              <label className="block">
                <span className="block text-xs text-slate-600">Tipo</span>
                <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                        data-testid="ct-tipo" className="w-full border border-slate-300 rounded px-2 py-1">
                  <option value="email">📧 Email</option>
                  <option value="llamada">📞 Llamada</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="otro">📝 Otro</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs text-slate-600">Evento asociado</span>
                <select value={form.evento_id} onChange={(e) => setForm((p) => ({ ...p, evento_id: e.target.value }))}
                        data-testid="ct-evento" className="w-full border border-slate-300 rounded px-2 py-1">
                  <option value="">Sin evento — contacto general</option>
                  {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nombre || ev.titulo}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs text-slate-600">Estado respuesta</span>
                <select value={form.estado_respuesta} onChange={(e) => setForm((p) => ({ ...p, estado_respuesta: e.target.value }))}
                        data-testid="ct-estado" className="w-full border border-slate-300 rounded px-2 py-1">
                  {Object.entries(ESTADO_BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs text-slate-600">Notas</span>
                <textarea rows={3} value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                          data-testid="ct-notas" className="w-full border border-slate-300 rounded px-2 py-1"/>
              </label>
              <label className="block">
                <span className="block text-xs text-slate-600">Fecha (opcional, default ahora)</span>
                <input type="datetime-local" value={form.fecha_contacto}
                       onChange={(e) => setForm((p) => ({ ...p, fecha_contacto: e.target.value }))}
                       className="w-full border border-slate-300 rounded px-2 py-1"/>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setOpenModal(false)} className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded">Cancelar</button>
              <button onClick={guardar} disabled={saving} data-testid="ct-guardar"
                      className="px-3 py-1.5 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HistorialContactosMusico;
