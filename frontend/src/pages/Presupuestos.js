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
      initializeBudgetData(response.data);
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Presupuestos de Temporada</h1>
          <p className="font-ibm text-slate-600 mt-1">Gestión de cachés por evento y categoría</p>
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
      </header>

      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No hay eventos configurados para esta temporada</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="px-3 py-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-100 border-r border-slate-300 min-w-[200px]">
                  Sección / Nivel de Estudios
                </th>
                {events.map(event => (
                  <th key={event.id} colSpan={3} className="px-2 py-3 text-center font-semibold text-slate-700 border-r border-slate-300">
                    <div className="text-xs font-bold mb-1">{event.name}</div>
                    <div className="text-[10px] text-slate-500">{event.date}</div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-semibold text-slate-700 bg-slate-200 min-w-[100px]">
                  TOTAL
                </th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-600">
                <th className="px-3 py-2 sticky left-0 bg-slate-50 border-r border-slate-300"></th>
                {events.map(event => (
                  <React.Fragment key={`header-${event.id}`}>
                    <th className="px-1 py-2 text-center border-r border-slate-200">Ensayos €</th>
                    <th className="px-1 py-2 text-center border-r border-slate-200">Funciones €</th>
                    <th className="px-1 py-2 text-center border-r border-slate-300">Pond. %</th>
                  </React.Fragment>
                ))}
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
                      <td className="px-3 py-2 text-slate-700 sticky left-0 bg-white border-r border-slate-300 text-xs">
                        <span className="pl-4">{level.name}</span>
                      </td>
                      {events.map(event => {
                        const cell = budgetData[section.id]?.[level.id]?.[event.id] || { rehearsals: 0, functions: 0, weight: 100 };
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
                                max="100"
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
                    <td className="px-3 py-2 text-slate-800 sticky left-0 bg-slate-100 border-r border-slate-300 text-xs">
                      SUBTOTAL {section.name}
                    </td>
                    {events.map(event => (
                      <td key={`subtotal-${section.id}-${event.id}`} colSpan={3} className="px-2 py-2 text-center text-slate-900 border-r border-slate-300 text-xs">
                        {calculateSectionEventTotal(section.id, event.id).toFixed(2)}€
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center text-slate-900 bg-slate-200 text-xs">
                      {STUDY_LEVELS.reduce((sum, level) => sum + calculateRowTotal(section.id, level.id), 0).toFixed(2)}€
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              
              {/* Grand Total */}
              <tr className="bg-slate-800 text-white font-bold">
                <td className="px-3 py-3 sticky left-0 bg-slate-800 border-r border-slate-600 text-sm uppercase">
                  TOTAL TEMPORADA
                </td>
                {events.map(event => (
                  <td key={`total-${event.id}`} colSpan={3} className="px-2 py-3 text-center border-r border-slate-600 text-sm">
                    {calculateEventTotal(event.id).toFixed(2)}€
                  </td>
                ))}
                <td className="px-3 py-3 text-center bg-slate-900 text-base">
                  {calculateGrandTotal().toFixed(2)}€
                </td>
              </tr>
            </tbody>
          </table>
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
        </ul>
      </div>
    </div>
  );
};

export default Presupuestos;
