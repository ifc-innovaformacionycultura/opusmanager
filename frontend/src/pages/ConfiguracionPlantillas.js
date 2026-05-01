import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import TemplateList from "../components/comunicaciones/TemplateList";
import ThemeSelector from "../components/comunicaciones/ThemeSelector";
import GlobalSettings from "../components/comunicaciones/GlobalSettings";
import BlockLibrary from "../components/comunicaciones/BlockLibrary";
import BlockInspector from "../components/comunicaciones/BlockInspector";
import Canvas from "../components/comunicaciones/Canvas";
import PreviewPane from "../components/comunicaciones/PreviewPane";
import AssetPicker from "../components/comunicaciones/AssetPicker";
import { BLOCK_TYPES, uid } from "../components/comunicaciones/blockCatalog";

const ConfiguracionPlantillas = () => {
  const { api } = useAuth();

  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activaId, setActivaId] = useState(null);
  const [activa, setActiva] = useState(null);  // objeto plantilla cargado
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);  // {tipo:'ok'|'err', msg}
  const [previewVersion, setPreviewVersion] = useState(0);

  // Asset picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTipo, setPickerTipo] = useState("imagen");
  const [pickerCallback, setPickerCallback] = useState(() => () => {});

  const openAssetPicker = (tipo, cb) => {
    setPickerTipo(tipo);
    setPickerCallback(() => cb);
    setPickerOpen(true);
  };

  // ---------- Cargar lista ----------
  const cargarPlantillas = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/comunicaciones/plantillas");
      setPlantillas(r.data?.plantillas || []);
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { cargarPlantillas(); }, [cargarPlantillas]);

  // ---------- Cargar plantilla activa (con guard anti-race) ----------
  useEffect(() => {
    if (!activaId) { setActiva(null); setSelectedBlockId(null); return; }
    let cancelled = false;
    api.get(`/api/comunicaciones/plantillas/${activaId}`)
       .then((r) => {
         if (cancelled) return;
         setActiva(r.data?.plantilla);
         setDirty(false);
         setSelectedBlockId(null);
       })
       .catch((e) => { if (!cancelled) setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message }); });
    return () => { cancelled = true; };
  }, [activaId, api]);

  // ---------- Crear ----------
  const crearPlantilla = async () => {
    const nombre = window.prompt("Nombre de la plantilla:");
    if (!nombre) return;
    try {
      const r = await api.post("/api/comunicaciones/plantillas", {
        nombre,
        tema_preset: "ifc_corporate",
        desde_preset: true,
      });
      const nueva = r.data?.plantilla;
      if (nueva) {
        await cargarPlantillas();
        setActivaId(nueva.id);
        setFeedback({ tipo: "ok", msg: "Plantilla creada" });
      }
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };

  // ---------- D3: Catálogo de plantillas predefinidas ----------
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const abrirCatalogo = async () => {
    try {
      const r = await api.get("/api/comunicaciones/catalogo");
      setCatalogo(r.data?.catalogo || []);
      setCatalogoOpen(true);
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };
  const crearDesdeCatalogo = async (key) => {
    try {
      const r = await api.post(`/api/comunicaciones/catalogo/${key}/crear`);
      const nueva = r.data?.plantilla;
      setCatalogoOpen(false);
      if (nueva) {
        await cargarPlantillas();
        setActivaId(nueva.id);
        setFeedback({ tipo: "ok", msg: "Plantilla creada desde catálogo" });
      }
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };

  // ---------- Duplicar ----------
  const duplicarPlantilla = async (id) => {
    const orig = plantillas.find((p) => p.id === id);
    if (!orig) return;
    try {
      // Cargar completo + crear copia
      const full = (await api.get(`/api/comunicaciones/plantillas/${id}`)).data?.plantilla;
      const r = await api.post("/api/comunicaciones/plantillas", {
        nombre: `${orig.nombre} (copia)`,
        descripcion: full.descripcion || "",
        asunto_default: full.asunto_default || "",
        tema_preset: full.tema_preset,
        desde_preset: false,
        ajustes_globales: full.ajustes_globales,
        bloques: full.bloques,
      });
      const nueva = r.data?.plantilla;
      if (nueva) {
        await cargarPlantillas();
        setActivaId(nueva.id);
        setFeedback({ tipo: "ok", msg: "Plantilla duplicada" });
      }
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };

  // ---------- Eliminar ----------
  const eliminarPlantilla = async (id) => {
    if (!window.confirm("¿Eliminar esta plantilla? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/api/comunicaciones/plantillas/${id}`);
      if (activaId === id) setActivaId(null);
      await cargarPlantillas();
      setFeedback({ tipo: "ok", msg: "Plantilla eliminada" });
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };

  // ---------- Guardar ----------
  const guardar = async () => {
    if (!activa) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api.put(`/api/comunicaciones/plantillas/${activa.id}`, {
        nombre: activa.nombre,
        descripcion: activa.descripcion,
        asunto_default: activa.asunto_default,
        tema_preset: activa.tema_preset,
        ajustes_globales: activa.ajustes_globales,
        bloques: activa.bloques,
        estado: activa.estado,
      });
      setDirty(false);
      setPreviewVersion((v) => v + 1);
      await cargarPlantillas();
      setFeedback({ tipo: "ok", msg: "Cambios guardados" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    } finally {
      setSaving(false);
    }
  };

  // ---------- Aplicar tema (resetea bloques+ajustes desde preset) ----------
  const aplicarPresetTema = async () => {
    if (!activa) return;
    if (!window.confirm("¿Restaurar los bloques y los ajustes globales al preset elegido? Se perderán los cambios actuales del lienzo.")) return;
    try {
      // Crear plantilla efímera vía endpoint preview no nos sirve — pedimos al backend que cree una temporal
      // Truco simple: POST temporal y leer su contenido.
      const r = await api.post("/api/comunicaciones/plantillas", {
        nombre: "__tmp__" + Date.now(),
        tema_preset: activa.tema_preset,
        desde_preset: true,
      });
      const temp = r.data?.plantilla;
      if (temp) {
        setActiva((prev) => ({
          ...prev,
          ajustes_globales: temp.ajustes_globales,
          bloques: temp.bloques,
        }));
        setDirty(true);
        // Borrar la temporal
        await api.delete(`/api/comunicaciones/plantillas/${temp.id}`);
      }
    } catch (e) {
      setFeedback({ tipo: "err", msg: e?.response?.data?.detail || e.message });
    }
  };

  // ---------- Manipulación de bloques ----------
  const updateActiva = (patch) => {
    setActiva((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const updateBloques = (mut) => {
    setActiva((prev) => {
      const next = { ...prev, bloques: mut(prev.bloques || []) };
      return next;
    });
    setDirty(true);
  };

  const addBloque = (tipo) => {
    const meta = BLOCK_TYPES.find((t) => t.tipo === tipo);
    const nuevo = { id: uid(), tipo, props: { ...(meta?.defaults || {}) } };
    updateBloques((bs) => [...bs, nuevo]);
    setSelectedBlockId(nuevo.id);
  };

  const moveBloque = (id, delta) => {
    updateBloques((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const j = i + delta;
      if (j < 0 || j >= bs.length) return bs;
      const copy = bs.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const duplicateBloque = (id) => {
    updateBloques((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const copy = { ...bs[i], id: uid(), props: JSON.parse(JSON.stringify(bs[i].props || {})) };
      const out = bs.slice();
      out.splice(i + 1, 0, copy);
      return out;
    });
  };

  const deleteBloque = (id) => {
    updateBloques((bs) => bs.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const updateBloque = (next) => {
    updateBloques((bs) => bs.map((b) => (b.id === next.id ? next : b)));
  };

  const updateAjustes = (next) => updateActiva({ ajustes_globales: next });

  // Bloque seleccionado
  const selectedBlock = useMemo(
    () => (activa?.bloques || []).find((b) => b.id === selectedBlockId) || null,
    [activa, selectedBlockId]
  );

  // ---------------- Render ----------------
  return (
    <div className="p-6 h-full flex flex-col" data-testid="centro-comunicaciones-page">
      <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Centro de Comunicaciones</h1>
          <p className="font-ibm text-slate-600 mt-1 text-sm">
            Constructor visual de correos por bloques con 3 temas estéticos predefinidos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={abrirCatalogo}
                  data-testid="btn-abrir-catalogo"
                  className="text-xs px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 font-medium">
            ✨ Del catálogo
          </button>
        </div>
        {activa && (
          <div className="flex items-center gap-3">
            {feedback && (
              <span className={`text-xs px-3 py-1.5 rounded ${feedback.tipo === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                    data-testid="feedback-msg">
                {feedback.msg}
              </span>
            )}
            <select
              value={activa.estado || "borrador"}
              onChange={(e) => updateActiva({ estado: e.target.value })}
              className="text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
              data-testid="select-estado"
            >
              <option value="borrador">Borrador</option>
              <option value="publicada">Publicada</option>
              <option value="archivada">Archivada</option>
            </select>
            <button
              onClick={guardar}
              disabled={saving || !dirty}
              className="text-sm px-4 py-1.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-medium"
              data-testid="btn-guardar-plantilla"
            >
              {saving ? "Guardando…" : dirty ? "💾 Guardar cambios" : "✓ Guardado"}
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Columna izquierda: Lista de plantillas */}
        <div className="col-span-12 lg:col-span-3 xl:col-span-2 min-h-0 flex flex-col">
          <TemplateList
            plantillas={plantillas}
            plantillaActivaId={activaId}
            onSelect={setActivaId}
            onCreate={crearPlantilla}
            onDuplicate={duplicarPlantilla}
            onDelete={eliminarPlantilla}
            loading={loading}
          />
        </div>

        {/* Columna central: Editor + Canvas */}
        <div className="col-span-12 lg:col-span-5 xl:col-span-5 min-h-0 overflow-y-auto pr-1 space-y-4">
          {!activa ? (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-500">
              <div className="text-4xl mb-3">📬</div>
              <p className="text-sm">Selecciona una plantilla a la izquierda o crea una nueva.</p>
            </div>
          ) : (
            <>
              {/* Datos básicos */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3" data-testid="datos-basicos">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre interno</label>
                  <input value={activa.nombre || ""} onChange={(e) => updateActiva({ nombre: e.target.value })}
                         className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                         data-testid="inp-nombre"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Asunto del email</label>
                  <input value={activa.asunto_default || ""} onChange={(e) => updateActiva({ asunto_default: e.target.value })}
                         placeholder="Hola {nombre_destinatario}, novedades sobre {evento}"
                         className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                         data-testid="inp-asunto"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descripción interna (opcional)</label>
                  <input value={activa.descripcion || ""} onChange={(e) => updateActiva({ descripcion: e.target.value })}
                         className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"/>
                </div>
              </div>

              {/* Tema */}
              <ThemeSelector
                value={activa.tema_preset || "ifc_corporate"}
                onChange={(v) => updateActiva({ tema_preset: v })}
                onApplyPreset={aplicarPresetTema}
              />

              {/* Ajustes globales */}
              <GlobalSettings
                ajustes={activa.ajustes_globales || {}}
                onChange={updateAjustes}
                onAssetPick={openAssetPicker}
              />

              {/* Lienzo */}
              <Canvas
                bloques={activa.bloques || []}
                selectedId={selectedBlockId}
                onSelect={setSelectedBlockId}
                onMove={moveBloque}
                onDuplicate={duplicateBloque}
                onDelete={deleteBloque}
              />

              {/* Inspector */}
              <BlockInspector
                block={selectedBlock}
                onChange={updateBloque}
                onAssetPick={openAssetPicker}
              />
            </>
          )}
        </div>

        {/* Columna derecha: Biblioteca + Preview */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-5 min-h-0 flex flex-col gap-4">
          {activa && <BlockLibrary onAdd={addBloque} />}
          <div className="flex-1 min-h-[400px]">
            <PreviewPane plantillaId={activa?.id} dirty={dirty} autoRefreshKey={previewVersion} />
          </div>
        </div>
      </div>

      <AssetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        tipo={pickerTipo}
        onSelect={pickerCallback}
      />

      {/* D3 — Modal catálogo de plantillas predefinidas */}
      {catalogoOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" data-testid="catalogo-modal">
          <div className="bg-white rounded-lg max-w-2xl w-full p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Elige una plantilla predefinida</h3>
              <button onClick={() => setCatalogoOpen(false)} className="text-slate-500 hover:text-slate-800 text-xl">×</button>
            </div>
            <p className="text-xs text-slate-600 mb-3">Cada plantilla se crea ya aplicada al tema <strong>IFC Corporate</strong> y con las variables necesarias. Podrás editarla después libremente.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catalogo.map((c) => (
                <button key={c.key} onClick={() => crearDesdeCatalogo(c.key)}
                        data-testid={`btn-catalogo-${c.key}`}
                        className="text-left p-3 border border-slate-200 rounded hover:border-slate-900 hover:bg-slate-50 transition">
                  <div className="font-semibold text-sm text-slate-900">{c.nombre}</div>
                  <div className="text-xs text-slate-600 mt-1">{c.descripcion}</div>
                  <div className="text-[11px] text-slate-500 mt-2">
                    Variables: {(c.variables || []).map((v) => `{${v}}`).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfiguracionPlantillas;
