// Bloque B — Vista previa del portal músico (iframe de /portal-preview/:token).
// Completamente independiente: NO usa AuthContext ni SupabaseAuthContext.
// Banner amarillo "VISTA PREVIA — Solo lectura". Todos los controles deshabilitados.
import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Eye, Lock, Music, User, Calendar as CalendarIcon, History, FileText, Clock3, MapPin, CheckCircle2, XCircle } from "lucide-react";

const API_URL = window.location.hostname === "localhost"
  ? "http://localhost:8001/api"
  : `${process.env.REACT_APP_BACKEND_URL}/api`;

const disabledCls = "preview-readonly";

const Badge = ({ tone = "slate", children }) => (
  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border bg-${tone}-50 border-${tone}-200 text-${tone}-700`}>{children}</span>
);

const Section = ({ title, children }) => (
  <section className="px-4 py-3">
    <h2 className="text-sm font-bold text-slate-900 mb-2">{title}</h2>
    <div>{children}</div>
  </section>
);

const NavBottom = ({ vista, setVista }) => {
  const items = [
    { id: "convocatorias", label: "Convocatorias", icon: Music },
    { id: "perfil", label: "Perfil", icon: User },
    { id: "calendario", label: "Calendario", icon: CalendarIcon },
    { id: "historial", label: "Historial", icon: History },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around z-30">
      {items.map((it) => {
        const active = vista === it.id;
        const Icon = it.icon;
        return (
          <button key={it.id} onClick={() => setVista(it.id)}
                  data-testid={`preview-nav-${it.id}`}
                  className={`flex flex-col items-center gap-0.5 py-2 px-3 flex-1 min-h-[56px] ${active ? "text-purple-700" : "text-slate-500"}`}>
            <Icon className="w-5 h-5"/>
            <span className="text-[10px] font-medium">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const DisponibilidadPill = ({ disp }) => {
  if (disp === true) return <span className="text-emerald-700 text-xs inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Sí</span>;
  if (disp === false) return <span className="text-rose-700 text-xs inline-flex items-center gap-1"><XCircle className="w-3 h-3"/> No</span>;
  return <span className="text-slate-400 text-xs">Sin responder</span>;
};

const ConvocatoriasTab = ({ eventos }) => {
  if (!eventos || eventos.length === 0) return <div className="text-sm text-slate-500 italic px-4 py-3">No hay convocatorias publicadas para este músico.</div>;
  return (
    <div className="space-y-3 pb-24">
      {eventos.map((ev) => (
        <div key={ev.asignacion_id} className="mx-4 bg-white border border-slate-200 rounded-xl p-3 shadow-sm" data-testid={`preview-evento-${ev.evento?.id}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm truncate">{ev.evento?.nombre || "—"}</h3>
              <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                {ev.evento?.fecha_inicio && <span>{(ev.evento.fecha_inicio || "").slice(0,10)}</span>}
                {ev.evento?.lugar && <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3"/> {ev.evento.lugar}</span>}
              </div>
            </div>
            <Badge tone="purple">{ev.estado_asignacion || "—"}</Badge>
          </div>

          {(ev.ensayos || []).length > 0 && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <div className="text-[11px] font-semibold text-slate-600 mb-1">Ensayos y funciones</div>
              <div className="divide-y divide-slate-100">
                {ev.ensayos.map((e) => (
                  <div key={e.id} className="py-1.5 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-800">
                      <span className="font-medium">{(e.tipo || "ensayo") === "ensayo" ? "🎼" : "🎭"} {(e.fecha || "").slice(0,10)}</span>
                      <span className="text-slate-500 ml-1">{(e.hora || e.hora_inicio || "").slice(0,5)}</span>
                    </div>
                    <DisponibilidadPill disp={e.mi_disponibilidad}/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const PerfilTab = ({ musico }) => {
  const m = musico || {};
  const inicial = (m.nombre || "?").slice(0,1).toUpperCase();
  return (
    <div className="pb-24">
      <div className="flex flex-col items-center py-4 bg-purple-50 border-b border-purple-100">
        {m.foto_url ? (
          <img src={m.foto_url} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow"/>
        ) : (
          <div className="w-20 h-20 rounded-full bg-purple-600 text-white text-2xl font-bold flex items-center justify-center">{inicial}</div>
        )}
        <h3 className="mt-2 font-bold text-slate-900 text-sm">{m.nombre} {m.apellidos}</h3>
        <div className="text-xs text-purple-800">{m.instrumento || "—"}</div>
      </div>
      <Section title="Datos personales">
        <dl className="text-xs space-y-1.5">
          <div className="flex justify-between"><dt className="text-slate-500">Teléfono</dt><dd className="text-slate-900">{m.telefono || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="text-slate-900 truncate ml-2">{m.email || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Localidad</dt><dd className="text-slate-900">{m.localidad || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Nivel</dt><dd className="text-slate-900">{m.nivel_estudios || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">IBAN</dt><dd className="text-slate-900 font-mono">{m.iban_masked || "—"}</dd></div>
        </dl>
      </Section>
      <Section title="Titulaciones">
        {Array.isArray(m.titulaciones) && m.titulaciones.length > 0 ? (
          <ul className="text-xs text-slate-800 space-y-1">
            {m.titulaciones.map((t, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <Badge tone="emerald">{t.estado || "registrada"}</Badge>
                <span className="flex-1">{typeof t === "string" ? t : (t.nombre || t.titulo || "—")}</span>
              </li>
            ))}
          </ul>
        ) : <div className="text-xs text-slate-500 italic">Sin titulaciones registradas.</div>}
      </Section>
      <Section title="Notificaciones push">
        <div className={`border border-slate-200 rounded p-2 text-xs text-slate-700 ${disabledCls}`}>
          Preferencias en modo solo lectura.
        </div>
      </Section>
    </div>
  );
};

const CalendarioTab = ({ calendario }) => {
  const porFecha = useMemo(() => {
    const map = {};
    (calendario || []).forEach((e) => {
      const k = (e.fecha || "").slice(0, 7); // YYYY-MM
      (map[k] = map[k] || []).push(e);
    });
    return map;
  }, [calendario]);
  const meses = Object.keys(porFecha).sort();
  if (meses.length === 0) return <div className="text-sm text-slate-500 italic px-4 py-3">Sin eventos en el calendario.</div>;
  const toneOf = (color) => ({ blue: "blue", green: "emerald", orange: "amber", purple: "purple" }[color] || "slate");
  return (
    <div className="pb-24">
      {meses.map((m) => (
        <div key={m}>
          <div className="sticky top-0 bg-purple-50/80 backdrop-blur border-b border-purple-100 px-4 py-1.5 text-xs font-semibold text-purple-900">{m}</div>
          <div className="space-y-2 px-4 py-2">
            {porFecha[m].sort((a,b) => (a.fecha || "").localeCompare(b.fecha || "")).map((e) => (
              <div key={e.id} className={`p-2 rounded bg-${toneOf(e.color)}-50 border border-${toneOf(e.color)}-200`}>
                <div className="text-xs text-slate-900 font-semibold">
                  {(e.fecha || "").slice(0,10)} {e.hora && <span className="text-slate-600 font-normal">· {(e.hora || "").slice(0,5)}</span>}
                </div>
                <div className="text-xs text-slate-700 capitalize">{e.tipo}{e.evento_nombre && <> · {e.evento_nombre}</>}</div>
                {e.lugar && <div className="text-[10px] text-slate-500">📍 {e.lugar}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const HistorialTab = ({ pagos, recibos, certificados, reclamaciones }) => {
  const [sub, setSub] = useState("pagos");
  const tabs = [
    { id: "pagos", label: "Pagos" },
    { id: "certificados", label: "Certificados" },
    { id: "reclamaciones", label: "Reclamaciones" },
  ];
  return (
    <div className="pb-24">
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setSub(t.id)}
                  data-testid={`preview-histtab-${t.id}`}
                  className={`flex-1 py-2 text-xs font-medium ${sub === t.id ? "text-purple-700 border-b-2 border-purple-600" : "text-slate-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === "pagos" && (
        <div className="divide-y divide-slate-100">
          {(pagos || []).length === 0 && <div className="text-xs text-slate-500 italic px-4 py-3">Sin pagos.</div>}
          {(pagos || []).map((p) => (
            <div key={p.id} className="px-4 py-2 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm text-slate-900 truncate">{p.evento?.nombre || "—"}</div>
                <div className="text-[11px] text-slate-500">{(p.fecha_pago || "").slice(0,10)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{p.importe_neto ? `${p.importe_neto} €` : "—"}</div>
                <Badge tone={p.estado === "pagado" ? "emerald" : "amber"}>{p.estado || "pendiente"}</Badge>
              </div>
            </div>
          ))}
          {(recibos || []).length > 0 && (
            <div className="px-4 py-2 text-[11px] text-slate-500">Recibos disponibles: {recibos.length} (descarga deshabilitada en vista previa)</div>
          )}
        </div>
      )}

      {sub === "certificados" && (
        <div className="divide-y divide-slate-100">
          {(certificados || []).length === 0 && <div className="text-xs text-slate-500 italic px-4 py-3">Sin certificados.</div>}
          {(certificados || []).map((c) => (
            <div key={c.id} className="px-4 py-2">
              <div className="text-sm text-slate-900">{c.evento?.nombre || "—"}</div>
              <div className="text-[11px] text-slate-500 flex gap-3">
                <span>{c.evento?.temporada || "—"}</span>
                <span>{c.horas_totales ? `${c.horas_totales} h` : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === "reclamaciones" && (
        <div className="divide-y divide-slate-100">
          {(reclamaciones || []).length === 0 && <div className="text-xs text-slate-500 italic px-4 py-3">Sin reclamaciones.</div>}
          {(reclamaciones || []).map((r) => (
            <div key={r.id} className="px-4 py-2">
              <div className="text-sm text-slate-900 truncate">{r.asunto || r.titulo || "—"}</div>
              <Badge tone={r.estado === "resuelta" ? "emerald" : "amber"}>{r.estado || "abierta"}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PortalPreviewFrame = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState("convocatorias");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_URL}/preview/${token}`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.detail || `Error ${r.status}`);
        }
        setData(await r.json());
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <Lock className="w-10 h-10 text-rose-500 mb-2"/>
        <h1 className="text-lg font-bold text-slate-900">Vista previa no disponible</h1>
        <p className="text-sm text-slate-600 mt-1 text-center">{error}</p>
        <button onClick={() => window.close()} className="mt-4 px-3 py-1.5 bg-slate-900 text-white text-sm rounded">Cerrar</button>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Cargando vista previa…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800" data-testid="portal-preview-frame">
      {/* Banner VISTA PREVIA */}
      <div className="bg-amber-100 text-amber-900 text-[11px] font-semibold flex items-center justify-center gap-1 py-1 border-b border-amber-200">
        <Eye className="w-3 h-3"/> VISTA PREVIA — Solo lectura
      </div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-purple-600 text-white font-bold text-sm flex items-center justify-center">I</div>
          <div className="text-xs font-semibold text-purple-800">IFC OPUS</div>
        </div>
        <div className="text-[11px] text-slate-600 truncate max-w-[160px]">
          {data.musico?.nombre} {data.musico?.apellidos}
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1">
        {vista === "convocatorias" && <ConvocatoriasTab eventos={data.eventos}/>}
        {vista === "perfil" && <PerfilTab musico={data.musico}/>}
        {vista === "calendario" && <CalendarioTab calendario={data.calendario}/>}
        {vista === "historial" && <HistorialTab pagos={data.pagos} recibos={data.recibos} certificados={data.certificados} reclamaciones={data.reclamaciones}/>}
      </main>

      <NavBottom vista={vista} setVista={setVista}/>
    </div>
  );
};

export default PortalPreviewFrame;
