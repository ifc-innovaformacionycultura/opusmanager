import React, { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ConfiguracionBaseDatos = () => {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [columnMapping, setColumnMapping] = useState({});
  const [saving, setSaving] = useState(false);

  const availableColumns = [
    'Nombre', 'Apellidos', 'Email', 'Teléfono', 'DNI', 'Provincia',
    'Especialidad', 'Categoría', 'Baremo', 'IBAN', 'SWIFT', 'Disponibilidad'
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [seasonsRes, mappingRes] = await Promise.all([
        axios.get(`${API}/seasons`),
        axios.get(`${API}/column-mapping`)
      ]);
      setSeasons(seasonsRes.data);
      if (seasonsRes.data.length > 0) {
        setSelectedSeason(seasonsRes.data[0]);
        setSheetUrl(seasonsRes.data[0].sheet_url || '');
      }
      if (mappingRes.data) {
        setColumnMapping(mappingRes.data.mapping || {});
      }
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  const saveMapping = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/column-mapping`, { mapping: columnMapping });
      alert('Configuración guardada correctamente');
    } catch (err) {
      console.error("Error saving mapping:", err);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6" data-testid="configuracion-basedatos-page">
      <header className="mb-6">
        <h1 className="font-cabinet text-3xl font-bold text-slate-900">Base de Datos</h1>
        <p className="font-ibm text-slate-600 mt-1">Configura la fuente de datos y el mapeo de columnas</p>
      </header>

      <div className="space-y-6">
        {/* Temporada */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-blue-500 rounded"></div>
            Temporada Activa
          </h2>
          <select
            value={selectedSeason?.id || ''}
            onChange={(e) => {
              const season = seasons.find(s => s.id === e.target.value);
              setSelectedSeason(season);
              setSheetUrl(season?.sheet_url || '');
            }}
            className="w-full md:w-1/2 px-3 py-2 border border-slate-200 rounded-md"
            data-testid="season-selector"
          >
            {seasons.map(season => (
              <option key={season.id} value={season.id}>{season.name}</option>
            ))}
          </select>
        </div>

        {/* Fuente de datos */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-green-500 rounded"></div>
            Fuente de Datos
          </h2>
          <div>
            <label className="block text-sm text-slate-600 mb-2">Enlace a Google Sheets</label>
            <input
              type="url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
              data-testid="sheet-url-input"
            />
            <p className="text-xs text-slate-500 mt-2">
              Asegúrate de que el documento tenga permisos de lectura públicos o esté compartido con la cuenta de servicio.
            </p>
          </div>
        </div>

        {/* Mapeo de columnas */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-yellow-500 rounded"></div>
            Mapeo de Columnas
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Indica qué columna del Google Sheet corresponde a cada campo del sistema.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableColumns.map(column => (
              <div key={column} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg">
                <span className="text-sm font-medium text-slate-700 w-24">{column}</span>
                <input
                  type="text"
                  value={columnMapping[column.toLowerCase()] || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, [column.toLowerCase()]: e.target.value })}
                  placeholder="Columna A, B, C..."
                  className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                  data-testid={`mapping-${column.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Guardar */}
        <div className="flex justify-end">
          <button
            onClick={saveMapping}
            disabled={saving}
            className="px-6 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
            data-testid="save-mapping-btn"
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracionBaseDatos;
