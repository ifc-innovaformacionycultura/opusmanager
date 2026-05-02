// Centro de Comunicaciones — 7 pestañas unificadas (Bandeja IMAP + Enviados + Chat + Comentarios + Push + Plantillas + Config)
import React, { useState } from "react";
import BandejaEntrada from "../components/comunicaciones/BandejaEntrada";
import ConfiguracionBandeja from "../components/comunicaciones/ConfiguracionBandeja";
import ConfiguracionPlantillas from "./ConfiguracionPlantillas";
import GestorEmailLog from "./GestorEmailLog";
import ChatInterno from "./ChatInterno";
import RecordatoriosAdmin from "./RecordatoriosAdmin";
import ComentariosEquipoGlobal from "../components/comunicaciones/ComentariosEquipoGlobal";

const TABS = [
  { key: "bandeja", label: "📥 Bandeja de entrada" },
  { key: "enviados", label: "📤 Enviados" },
  { key: "chat", label: "💬 Chat del equipo" },
  { key: "comentarios", label: "📋 Comentarios del equipo" },
  { key: "push", label: "🔔 Recordatorios push" },
  { key: "plantillas", label: "🎨 Plantillas" },
  { key: "configuracion", label: "⚙️ Configuración" },
];

const CentroComunicaciones = () => {
  const [activa, setActiva] = useState("bandeja");

  return (
    <div className="space-y-4" data-testid="centro-comunicaciones">
      <div>
        <h1 className="text-2xl font-bold text-[#1A3A5C]">Centro de Comunicaciones</h1>
        <p className="text-sm text-slate-500">Bandeja de correo, chat interno, recordatorios y plantillas en un solo lugar.</p>
      </div>

      <div className="border-b border-slate-200 flex items-end gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = activa === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiva(t.key)}
              data-testid={`tab-${t.key}`}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                active
                  ? "border-[#C9920A] text-[#1A3A5C] bg-white"
                  : "border-transparent text-slate-500 hover:text-[#1A3A5C] hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        {activa === "bandeja" && <BandejaEntrada />}
        {activa === "enviados" && <GestorEmailLog />}
        {activa === "chat" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: 560 }}>
            <ChatInterno />
          </div>
        )}
        {activa === "comentarios" && <ComentariosEquipoGlobal />}
        {activa === "push" && <RecordatoriosAdmin />}
        {activa === "plantillas" && <ConfiguracionPlantillas />}
        {activa === "configuracion" && <ConfiguracionBandeja />}
      </div>
    </div>
  );
};

export default CentroComunicaciones;
