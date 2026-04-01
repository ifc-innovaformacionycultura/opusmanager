import React, { useState, useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GestionReportes = () => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    type: "",
    status: "",
    page: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [filters]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);
      if (filters.status) params.append("status", filters.status);
      if (filters.page) params.append("page", filters.page);

      const { data } = await axios.get(`${API}/feedback?${params.toString()}`);
      setReports(data.reports);
    } catch (error) {
      console.error("Error al cargar reportes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API}/feedback/stats`);
      setStats(data);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    }
  };

  const updateStatus = async (reportId, newStatus) => {
    try {
      await axios.put(`${API}/feedback/${reportId}`, { status: newStatus });
      fetchReports();
      fetchStats();
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      alert("Error al actualizar el estado");
    }
  };

  const deleteReport = async (reportId) => {
    if (!window.confirm("¿Estás seguro de eliminar este reporte?")) return;

    try {
      await axios.delete(`${API}/feedback/${reportId}`);
      fetchReports();
      fetchStats();
    } catch (error) {
      console.error("Error al eliminar reporte:", error);
      alert("Error al eliminar el reporte");
    }
  };

  const exportToExcel = async () => {
    try {
      const response = await axios.get(`${API}/feedback/export/excel`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reportes_feedback_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error al exportar:", error);
      alert("Error al exportar los reportes");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "reportado": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "en_proceso": return "bg-blue-100 text-blue-800 border-blue-200";
      case "solucionado": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getTypeColor = (type) => {
    return type === "error" 
      ? "bg-red-100 text-red-800 border-red-200" 
      : "bg-purple-100 text-purple-800 border-purple-200";
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-cabinet text-3xl font-bold text-slate-900 mb-2">
          Gestión de Reportes
        </h1>
        <p className="font-ibm text-slate-600">
          Administra los reportes de errores y mejoras del equipo
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Total de Reportes</div>
            <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="text-sm text-red-600 mb-1">🐛 Errores</div>
            <div className="text-3xl font-bold text-red-900">{stats.by_type.error}</div>
          </div>
          <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
            <div className="text-sm text-purple-600 mb-1">💡 Mejoras</div>
            <div className="text-3xl font-bold text-purple-900">{stats.by_type.mejora}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="text-sm text-yellow-600 mb-1">⏳ Pendientes</div>
            <div className="text-3xl font-bold text-yellow-900">{stats.by_status.reportado}</div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Todos</option>
              <option value="error">Errores</option>
              <option value="mejora">Mejoras</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Todos</option>
              <option value="reportado">Reportado</option>
              <option value="en_proceso">En Proceso</option>
              <option value="solucionado">Solucionado</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Página</label>
            <select
              value={filters.page}
              onChange={(e) => setFilters({ ...filters, page: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Todas</option>
              <option value="Dashboard">Dashboard</option>
              <option value="Configuración de temporada">Configuración</option>
              <option value="Seguimiento de convocatorias">Seguimiento</option>
              <option value="Plantillas definitivas">Plantillas</option>
              <option value="Asistencia y pagos">Asistencia/Pagos</option>
              <option value="Análisis económico">Análisis</option>
              <option value="Informes">Informes</option>
              <option value="Administración">Administración</option>
            </select>
          </div>

          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando reportes...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No hay reportes</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Página</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(report.created_at).toLocaleDateString('es-ES', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{report.reported_by_name}</div>
                      <div className="text-xs text-slate-500">{report.reported_by}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{report.page}</div>
                      {report.section && <div className="text-xs text-slate-500">{report.section}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(report.type)}`}>
                        {report.type === "error" ? "🐛 Error" : "💡 Mejora"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-xs">
                      {report.description}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={report.status}
                        onChange={(e) => updateStatus(report.id, e.target.value)}
                        className={`px-2 py-1 rounded border text-xs font-medium ${getStatusColor(report.status)}`}
                      >
                        <option value="reportado">Reportado</option>
                        <option value="en_proceso">En Proceso</option>
                        <option value="solucionado">Solucionado</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteReport(report.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        title="Eliminar reporte"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionReportes;
