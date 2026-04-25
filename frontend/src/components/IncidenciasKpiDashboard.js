// Mini-dashboard de KPIs para /admin/incidencias.
// Calcula métricas en cliente sobre la lista ya cargada (sin endpoints extra).

import React, { useMemo } from 'react';

const TIPO_LABELS = {
  incidencia: { label: '🐞 Incidencias', color: 'bg-red-500' },
  mejora:     { label: '✨ Mejoras',     color: 'bg-blue-500' },
  pregunta:   { label: '❓ Preguntas',   color: 'bg-slate-400' },
};

function fmtDuration(hours) {
  if (hours == null || isNaN(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export default function IncidenciasKpiDashboard({ list = [] }) {
  const kpis = useMemo(() => {
    const total = list.length;
    const abiertas = list.filter(i => i.estado !== 'resuelto').length;
    const altas = list.filter(i => i.prioridad === 'alta' && i.estado !== 'resuelto').length;

    const porTipo = { incidencia: 0, mejora: 0, pregunta: 0 };
    for (const inc of list) {
      const t = inc.tipo || 'incidencia';
      if (porTipo[t] !== undefined) porTipo[t] += 1;
    }

    // Tiempo medio de resolución (entre created_at y updated_at) de las resueltas
    const resueltas = list.filter(i => i.estado === 'resuelto' && i.created_at && i.updated_at);
    let tiempoMedioH = null;
    if (resueltas.length > 0) {
      const horas = resueltas.map(i => {
        const c = new Date(i.created_at).getTime();
        const u = new Date(i.updated_at).getTime();
        return Math.max(0, (u - c) / (1000 * 60 * 60));
      });
      tiempoMedioH = horas.reduce((a, b) => a + b, 0) / horas.length;
    }

    // Top 5 páginas con más incidencias
    const pageCount = {};
    for (const inc of list) {
      const p = inc.pagina || '(sin página)';
      pageCount[p] = (pageCount[p] || 0) + 1;
    }
    const topPages = Object.entries(pageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, abiertas, altas, porTipo, tiempoMedioH, topPages, resueltas: resueltas.length };
  }, [list]);

  const pct = (n) => (kpis.total > 0 ? Math.round((n / kpis.total) * 100) : 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4" data-testid="incidencias-kpis">
      {/* Card 1: Abiertas */}
      <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="kpi-abiertas">
        <div className="text-xs text-slate-500 uppercase font-medium tracking-wide">Abiertas</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900 tabular-nums">{kpis.abiertas}</span>
          <span className="text-xs text-slate-400">/ {kpis.total} total</span>
        </div>
        {kpis.altas > 0 && (
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
            🔴 {kpis.altas} de prioridad alta
          </div>
        )}
      </div>

      {/* Card 2: Distribución por tipo */}
      <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="kpi-tipos">
        <div className="text-xs text-slate-500 uppercase font-medium tracking-wide mb-2">Distribución por tipo</div>
        <div className="space-y-1.5">
          {Object.entries(TIPO_LABELS).map(([key, meta]) => {
            const count = kpis.porTipo[key] || 0;
            const p = pct(count);
            return (
              <div key={key} className="flex items-center gap-2 text-xs" data-testid={`kpi-tipo-${key}`}>
                <span className="w-24 text-slate-700">{meta.label}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                  <div className={`h-full ${meta.color}`} style={{ width: `${p}%` }} />
                </div>
                <span className="w-12 text-right tabular-nums text-slate-600">{count} · {p}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card 3: Tiempo medio de resolución */}
      <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="kpi-tiempo-resolucion">
        <div className="text-xs text-slate-500 uppercase font-medium tracking-wide">Tiempo medio resolución</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-emerald-700 tabular-nums">
            {fmtDuration(kpis.tiempoMedioH)}
          </span>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Sobre <span className="font-semibold text-slate-700">{kpis.resueltas}</span> incidencia(s) resueltas
        </div>
      </div>

      {/* Card 4: Top 5 páginas */}
      <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="kpi-top-paginas">
        <div className="text-xs text-slate-500 uppercase font-medium tracking-wide mb-2">Top 5 páginas con más reportes</div>
        {kpis.topPages.length === 0 ? (
          <div className="text-xs text-slate-400">Sin datos.</div>
        ) : (
          <ol className="space-y-1 text-xs">
            {kpis.topPages.map(([page, count], idx) => (
              <li key={page} className="flex items-center gap-2" data-testid={`kpi-page-${idx}`}>
                <span className="text-slate-400 tabular-nums w-4">{idx + 1}.</span>
                <code className="flex-1 truncate text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded">
                  {page}
                </code>
                <span className="w-8 text-right text-slate-600 tabular-nums">{count}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
