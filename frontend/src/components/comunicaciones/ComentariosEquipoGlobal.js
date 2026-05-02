import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

const fmt = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
};

const ESTADOS = [
  { key: "", label: "Todos" },
  { key: "abierto", label: "Abiertos" },
  { key: "en_progreso", label: "En progreso" },
  { key: "resuelto", label: "Resueltos" },
];

const badgeEstado = (e) => {
  if (e === "resuelto") return "bg-green-100 text-green-800";
  if (e === "en_progreso") return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
};

const ComentariosEquipoGlobal = () => {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState("");
  const [q, setQ] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200, incluye_resueltos: estado !== "abierto" };
      if (estado) params.estado = estado;
      const r = await api.get("/api/gestor/comentarios-equipo", { params });
      let arr = r.data?.comentarios || [];
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        arr = arr.filter((c) => (c.contenido || "").toLowerCase().includes(s) || (c.pagina || "").toLowerCase().includes(s));
      }
      setItems(arr);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api, estado, q]);

  useEffect(() => { cargar(); }, [cargar]);

  const resolver = async (id) => {
    try {
      await api.put(`/api/gestor/comentarios-equipo/${id}/estado`, { estado: "resuelto" });
      setItems((p) => p.map((x) => (x.id === id ? { ...x, estado: "resuelto" } : x)));
    } catch (e) {
      alert("No se pudo resolver: " + (e?.response?.data?.detail || e.message));
    }
  };

  return (
    <div className="space-y-4" data-testid="comentarios-equipo-global">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {ESTADOS.map((e) => (
            <button
              key={e.key}
              onClick={() => setEstado(e.key)}
              data-testid={`filtro-estado-${e.key || "todos"}`}
              className={`px-3 py-1 text-xs rounded transition ${estado === e.key ? "bg-[#1A3A5C] text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >{e.label}</button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar contenido o página..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="comentarios-buscador"
          className="flex-1 max-w-md px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#1A3A5C]"
        />
        <span className="text-xs text-slate-500 ml-auto">{items.length} resultados</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {loading && <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>}
        {!loading && items.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">No hay comentarios para los filtros seleccionados.</div>
        )}
        {!loading && items.map((c) => (
          <div key={c.id} className="p-4 hover:bg-slate-50" data-testid={`comentario-item-${c.id}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#1A3A5C]">{c.autor_nombre || "Usuario"}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${badgeEstado(c.estado)}`}>{c.estado || "abierto"}</span>
                  {c.pagina && <span className="text-xs text-slate-500 font-mono">{c.pagina}</span>}
                  <span className="text-xs text-slate-400 ml-auto">{fmt(c.created_at)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{c.contenido}</div>
                {Array.isArray(c.menciones) && c.menciones.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {c.menciones.map((m, i) => (
                      <span key={i} className="text-xs bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">@{m.nombre || m.email}</span>
                    ))}
                  </div>
                )}
              </div>
              {c.estado !== "resuelto" && (
                <button
                  onClick={() => resolver(c.id)}
                  data-testid={`btn-resolver-${c.id}`}
                  className="text-xs text-green-700 border border-green-300 px-2 py-1 rounded hover:bg-green-50"
                >Resolver ✓</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComentariosEquipoGlobal;
