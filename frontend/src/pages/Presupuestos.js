import React, { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Orchestra sections and study levels
const SECTIONS = [
  { id: 'cuerda', name: 'CUERDA', color: 'bg-blue-50' },
  { id: 'viento_madera', name: 'VIENTO MADERA', color: 'bg-green-50' },
  { id: 'viento_metal', name: 'VIENTO METAL', color: 'bg-yellow-50' },
  { id: 'percusion', name: 'PERCUSIÓN', color: 'bg-orange-50' },
  { id: 'teclados', name: 'TECLADOS', color: 'bg-purple-50' },
  { id: 'coros', name: 'COROS', color: 'bg-pink-50' }
];

const STUDY_LEVELS = [
  { id: 'superior_finalizado', name: 'Superior Finalizado' },
  { id: 'superior_cursando', name: 'Superior Cursando' },
  { id: 'profesional_finalizado', name: 'Profesional Finalizado' },
  { id: 'profesional_cursando', name: 'Profesional Cursando' }
];

const Presupuestos = () => {
  const [events, setEvents] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [budgetData, setBudgetData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collapsedEvents, setCollapsedEvents] = useState({}); // Track which events are collapsed

  useEffect(() => {
    fetchSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      fetchEvents();
    }
  }, [selectedSeason]);

  const fetchSeasons = async () => {
    try {
      const response = await axios.get(`${API}/seasons`);
      setSeasons(response.data);
      if (response.data.length > 0) {
        setSelectedSeason(response.data[0].id);
      }
    } catch (err) {
      console.error("Error loading seasons:", err);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/events?season_id=${selectedSeason}`);
      setEvents(response.data);
      
      // Fetch existing budget or initialize
      try {
        const budgetResponse = await axios.get(`${API}/budgets/${selectedSeason}`);
        if (budgetResponse.data.budget_data && Object.keys(budgetResponse.data.budget_data).length > 0) {
          setBudgetData(budgetResponse.data.budget_data);
        } else {
          initializeBudgetData(response.data);
        }
      } catch (err) {
        // If no budget exists, initialize
        initializeBudgetData(response.data);
      }
    } catch (err) {
      console.error("Error loading events:", err);
    } finally {
      setLoading(false);
    }
  };

  const initializeBudgetData = (eventsList) => {
    const initialData = {};
    SECTIONS.forEach(section => {
      initialData[section.id] = {};
      STUDY_LEVELS.forEach(level => {
        initialData[section.id][level.id] = {};
        eventsList.forEach(event => {
          initialData[section.id][level.id][event.id] = {
            rehearsals: 0,
            functions: 0,
            weight: 100 // Default 100%
          };
        });
      });
    });
    setBudgetData(initialData);
  };

  const updateBudgetCell = (sectionId, levelId, eventId, field, value) => {
    setBudgetData(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [levelId]: {
          ...prev[sectionId][levelId],
          [eventId]: {
            ...prev[sectionId][levelId][eventId],
            [field]: parseFloat(value) || 0
          }
        }
      }
    }));
  };

  // Calculate totals
  const calculateEventTotal = (eventId) => {
    let total = 0;
    SECTIONS.forEach(section => {
      STUDY_LEVELS.forEach(level => {
        const cell = budgetData[section.id]?.[level.id]?.[eventId];
        if (cell) {
          const subtotal = (cell.rehearsals + cell.functions) * (cell.weight / 100);
          total += subtotal;
        }
      });
    });
    return total;
  };

  const calculateSectionEventTotal = (sectionId, eventId) => {
    let total = 0;
    STUDY_LEVELS.forEach(level => {
      const cell = budgetData[sectionId]?.[level.id]?.[eventId];
      if (cell) {
        const subtotal = (cell.rehearsals + cell.functions) * (cell.weight / 100);
        total += subtotal;
      }
    });
    return total;
  };

  const calculateRowTotal = (sectionId, levelId) => {
    let total = 0;
    events.forEach(event => {
      const cell = budgetData[sectionId]?.[levelId]?.[event.id];
      if (cell) {
        const subtotal = (cell.rehearsals + cell.functions) * (cell.weight / 100);
        total += subtotal;
      }
    });
    return total;
  };

  const calculateGrandTotal = () => {
    let total = 0;
    SECTIONS.forEach(section => {
      STUDY_LEVELS.forEach(level => {
        total += calculateRowTotal(section.id, level.id);
      });
    });
    return total;
  };

  const saveBudget = async () => {
    try {
      setSaving(true);
      await axios.post(`${API}/budgets`, {
        season_id: selectedSeason,
        budget_data: budgetData
      });
      alert('✅ Presupuesto guardado correctamente');
    } catch (err) {
      console.error("Error saving budget:", err);
      alert('❌ Error al guardar el presupuesto');
    } finally {
      setSaving(false);
    }
  };

  const toggleEventCollapse = (eventId) => {
    setCollapsedEvents(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  const collapseAllEvents = () => {
    const allCollapsed = {};
    events.forEach(event => {
      allCollapsed[event.id] = true;
    });
    setCollapsedEvents(allCollapsed);
  };

  const expandAllEvents = () => {
    setCollapsedEvents({});
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Presupuestos de Temporada</h1>
          <p className="font-ibm text-slate-600 mt-1">Gestión de cachés por evento y categoría</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Collapse controls */}
          <div className="flex items-center gap-2 border border-slate-300 rounded-md px-2 py-1">
            <button
              onClick={collapseAllEvents}
              className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded"
              title="Contraer todos los eventos"
            >
              ⊟ Contraer todos
            </button>
            <div className="w-px h-4 bg-slate-300"></div>
            <button
              onClick={expandAllEvents}
              className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded"
              title="Expandir todos los eventos"
            >
              ⊞ Expandir todos
            </button>
          </div>
          
          <select
            value={selectedSeason || ''}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-md text-sm"
          >
            {seasons.map(season => (
              <option key={season.id} value={season.id}>{season.name}</option>
            ))}
          </select>
          <button
            onClick={saveBudget}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Guardar Presupuesto
              </>
            )}
          </button>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No hay eventos configurados para esta temporada</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Wrapper with horizontal scroll */}
          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
            <table className="w-full text-sm" style={{ minWidth: '1400px' }}>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="px-3 py-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-100 border-r border-slate-300 min-w-[200px] z-10">
                    Sección / Nivel de Estudios
                  </th>
                  {events.map(event => {
                    const isCollapsed = collapsedEvents[event.id];
                    return (
                      <th 
                        key={event.id} 
                        colSpan={isCollapsed ? 1 : 3} 
                        className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 relative"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => toggleEventCollapse(event.id)}
                            className="hover:bg-slate-200 rounded p-1 transition-colors"
                            title={isCollapsed ? "Expandir evento" : "Contraer evento"}
                          >
                            {isCollapsed ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                          <div>
                            <div className="text-xs font-bold">{event.name}</div>
                            <div className="text-[10px] text-slate-500">{event.date}</div>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-center font-semibold text-slate-700 bg-slate-200 min-w-[100px]">
                    TOTAL
                  </th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-600">
                  <th className="px-3 py-2 sticky left-0 bg-slate-50 border-r border-slate-300 z-10"></th>
                  {events.map(event => {
                    const isCollapsed = collapsedEvents[event.id];
                    if (isCollapsed) {
                      return (
                        <th key={`header-${event.id}`} className="px-2 py-2 text-center border-r border-slate-300">
                          Total €
                        </th>
                      );
                    }
                    return (
                      <React.Fragment key={`header-${event.id}`}>
                        <th className="px-1 py-2 text-center border-r border-slate-200">Ensayos €</th>
                        <th className="px-1 py-2 text-center border-r border-slate-200">Funciones €</th>
                        <th className="px-1 py-2 text-center border-r border-slate-300">Pond. %</th>
                      </React.Fragment>
                    );
                  })}
                  <th className="px-3 py-2 bg-slate-200"></th>
                </tr>
              </thead>
            <tbody>
              {SECTIONS.map((section, sectionIdx) => (
                <React.Fragment key={section.id}>
                  {/* Section Header */}
                  <tr className={`${section.color} border-b border-slate-300`}>
                    <td colSpan={events.length * 3 + 2} className="px-3 py-2 font-bold text-slate-800 text-xs uppercase tracking-wide">
                      {section.name}
                    </td>
                  </tr>
                  
                  {/* Study Levels */}
                  {STUDY_LEVELS.map((level, levelIdx) => (
                    <tr key={`${section.id}-${level.id}`} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700 sticky left-0 bg-white border-r border-slate-300 text-xs z-10">
                        <span className="pl-4">{level.name}</span>
                      </td>
                      {events.map(event => {
                        const cell = budgetData[section.id]?.[level.id]?.[event.id] || { rehearsals: 0, functions: 0, weight: 100 };
                        const isCollapsed = collapsedEvents[event.id];
                        
                        if (isCollapsed) {
                          // Show only total when collapsed
                          const subtotal = (cell.rehearsals + cell.functions) * (cell.weight / 100);
                          return (
                            <td key={`${section.id}-${level.id}-${event.id}`} className="px-2 py-2 text-center border-r border-slate-300 text-xs font-medium">
                              {subtotal.toFixed(2)}€
                            </td>
                          );
                        }
                        
                        // Show all three columns when expanded
                        return (
                          <React.Fragment key={`${section.id}-${level.id}-${event.id}`}>
                            <td className="px-1 py-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={cell.rehearsals}
                                onChange={(e) => updateBudgetCell(section.id, level.id, event.id, 'rehearsals', e.target.value)}
                                className="w-full px-1 py-1 text-center border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                min="0"
                                step="1"
                              />
                            </td>
                            <td className="px-1 py-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={cell.functions}
                                onChange={(e) => updateBudgetCell(section.id, level.id, event.id, 'functions', e.target.value)}
                                className="w-full px-1 py-1 text-center border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                min="0"
                                step="1"
                              />
                            </td>
                            <td className="px-1 py-1 border-r border-slate-300">
                              <input
                                type="number"
                                value={cell.weight}
                                onChange={(e) => updateBudgetCell(section.id, level.id, event.id, 'weight', e.target.value)}
                                className="w-full px-1 py-1 text-center border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-yellow-50"
                                min="0"
                                max="200"
                                step="1"
                              />
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-semibold text-slate-900 bg-slate-100 text-xs">
                        {calculateRowTotal(section.id, level.id).toFixed(2)}€
                      </td>
                    </tr>
                  ))}
                  
                  {/* Section Subtotal */}
                  <tr className="bg-slate-100 border-b-2 border-slate-400 font-semibold">
                    <td className="px-3 py-2 text-slate-800 sticky left-0 bg-slate-100 border-r border-slate-300 text-xs z-10">
                      SUBTOTAL {section.name}
                    </td>
                    {events.map(event => {
                      const isCollapsed = collapsedEvents[event.id];
                      const total = calculateSectionEventTotal(section.id, event.id);
                      
                      return (
                        <td 
                          key={`subtotal-${section.id}-${event.id}`} 
                          colSpan={isCollapsed ? 1 : 3} 
                          className="px-2 py-2 text-center text-slate-900 border-r border-slate-300 text-xs"
                        >
                          {total.toFixed(2)}€
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center text-slate-900 bg-slate-200 text-xs">
                      {STUDY_LEVELS.reduce((sum, level) => sum + calculateRowTotal(section.id, level.id), 0).toFixed(2)}€
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              
              {/* Grand Total */}
              <tr className="bg-slate-800 text-white font-bold">
                <td className="px-3 py-3 sticky left-0 bg-slate-800 border-r border-slate-600 text-sm uppercase z-10">
                  TOTAL TEMPORADA
                </td>
                {events.map(event => {
                  const isCollapsed = collapsedEvents[event.id];
                  const total = calculateEventTotal(event.id);
                  
                  return (
                    <td 
                      key={`total-${event.id}`} 
                      colSpan={isCollapsed ? 1 : 3} 
                      className="px-2 py-3 text-center border-r border-slate-600 text-sm"
                    >
                      {total.toFixed(2)}€
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-center bg-slate-900 text-base">
                  {calculateGrandTotal().toFixed(2)}€
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Legend */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2 text-sm">💡 Cómo usar esta tabla</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• <strong>Ensayos €:</strong> Importe total pagado por asistir a todos los ensayos del evento</li>
          <li>• <strong>Funciones €:</strong> Importe total pagado por asistir a todas las funciones del evento</li>
          <li>• <strong>Ponderación %:</strong> Factor de ajuste aplicable al total (100% = sin cambios, 80% = reducción 20%, 120% = incremento 20%)</li>
          <li>• Los importes se calculan considerando 100% de asistencia real</li>
          <li>• Los totales se actualizan automáticamente al modificar cualquier valor</li>
          <li>• <strong className="text-green-600">Haz clic en "Guardar Presupuesto" para aplicar los cambios a Plantillas y Asistencia/Pagos</strong></li>
        </ul>
      </div>

      {/* Info box */}
      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-green-800">
            <strong className="block mb-1">📊 Integración con otras secciones:</strong>
            <p>Una vez guardado, los cachés configurados aquí se aplicarán automáticamente en:</p>
            <ul className="mt-1 ml-4 list-disc">
              <li><strong>Plantillas definitivas:</strong> Al asignar músicos a eventos</li>
              <li><strong>Asistencia y pagos:</strong> Cálculo automático según asistencia real</li>
            </ul>
            <p className="mt-2">Los músicos se clasifican según su <strong>nivel de estudios</strong> y <strong>sección orquestal</strong> para aplicar el caché correspondiente.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Presupuestos;
