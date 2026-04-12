import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Action type translations and icons
const ACTION_INFO = {
  create: { label: 'Crear', color: 'bg-green-100 text-green-700', icon: '➕' },
  update: { label: 'Actualizar', color: 'bg-blue-100 text-blue-700', icon: '✏️' },
  update_contact: { label: 'Modificar contacto', color: 'bg-blue-100 text-blue-700', icon: '👤' },
  delete: { label: 'Eliminar', color: 'bg-red-100 text-red-700', icon: '🗑️' },
  view: { label: 'Ver', color: 'bg-slate-100 text-slate-700', icon: '👁️' },
  login: { label: 'Iniciar sesión', color: 'bg-purple-100 text-purple-700', icon: '🔐' },
  logout: { label: 'Cerrar sesión', color: 'bg-purple-100 text-purple-700', icon: '🚪' },
  export: { label: 'Exportar', color: 'bg-yellow-100 text-yellow-700', icon: '📤' },
  password_reset: { label: 'Cambiar contraseña', color: 'bg-orange-100 text-orange-700', icon: '🔑' },
  send_credentials: { label: 'Enviar credenciales', color: 'bg-cyan-100 text-cyan-700', icon: '📧' },
  confirm_attendance: { label: 'Confirmar asistencia', color: 'bg-green-100 text-green-700', icon: '✅' },
  send_invitation: { label: 'Enviar invitación', color: 'bg-blue-100 text-blue-700', icon: '✉️' },
  assign_to_roster: { label: 'Asignar a plantilla', color: 'bg-purple-100 text-purple-700', icon: '🎼' },
  update_cache: { label: 'Modificar caché', color: 'bg-yellow-100 text-yellow-700', icon: '💰' }
};

// Entity type translations
const ENTITY_LABELS = {
  user: 'Usuario',
  user_list: 'Lista de usuarios',
  event: 'Evento',
  contact: 'Contacto',
  attendance: 'Asistencia',
  roster: 'Plantilla',
  email: 'Email',
  season: 'Temporada',
  template: 'Plantilla email',
  activity_logs: 'Registro de actividad',
  feedback: 'Reporte'
};

// Action Badge Component
const ActionBadge = ({ action }) => {
  const info = ACTION_INFO[action] || { label: action, color: 'bg-slate-100 text-slate-700', icon: '📌' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${info.color}`}>
      <span>{info.icon}</span>
      {info.label}
    </span>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, subtitle, icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200'
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-75">{title}</p>
          <p className="text-2xl font-bold font-mono">{value}</p>
          {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
        </div>
        {icon && <span className="text-3xl opacity-50">{icon}</span>}
      </div>
    </div>
  );
};

// Detail Modal Component
const DetailModal = ({ log, isOpen, onClose }) => {
  if (!isOpen || !log) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
          <h3 className="font-semibold text-lg">Detalle de actividad</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-6">
          {/* Basic Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Fecha y hora</p>
              <p className="text-sm font-medium">{new Date(log.timestamp).toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Acción</p>
              <ActionBadge action={log.action} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Usuario</p>
              <p className="text-sm font-medium">{log.user_name}</p>
              <p className="text-xs text-slate-500">{log.user_email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Tipo de entidad</p>
              <p className="text-sm font-medium">{ENTITY_LABELS[log.entity_type] || log.entity_type}</p>
            </div>
            {log.entity_name && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-slate-500 mb-1">Entidad afectada</p>
                <p className="text-sm font-medium">{log.entity_name}</p>
              </div>
            )}
          </div>

          {/* Changes Section (Before/After) - NUEVO */}
          {log.changes && Object.keys(log.changes).length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📝</span>
                <h4 className="text-sm font-semibold text-slate-900">Cambios Realizados</h4>
              </div>
              <div className="space-y-3">
                {Object.entries(log.changes).map(([field, change]) => (
                  <div key={field} className="bg-slate-50 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                      {field.replace(/_/g, ' ')}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Before */}
                      <div>
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-xs font-medium text-red-700">Antes</span>
                          <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <div className="bg-white border-2 border-red-200 rounded-md px-3 py-2">
                          <code className="text-sm text-red-900 break-all">
                            {typeof change.before === 'object' 
                              ? JSON.stringify(change.before, null, 2) 
                              : (change.before === null || change.before === undefined || change.before === '')
                                ? <span className="text-slate-400 italic">(vacío)</span>
                                : String(change.before)
                            }
                          </code>
                        </div>
                      </div>
                      {/* After */}
                      <div>
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-xs font-medium text-green-700">Después</span>
                          <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="bg-white border-2 border-green-200 rounded-md px-3 py-2">
                          <code className="text-sm text-green-900 break-all">
                            {typeof change.after === 'object' 
                              ? JSON.stringify(change.after, null, 2) 
                              : (change.after === null || change.after === undefined || change.after === '')
                                ? <span className="text-slate-400 italic">(vacío)</span>
                                : String(change.after)
                            }
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Details Section */}
          {log.details && Object.keys(log.details).length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">ℹ️</span>
                <h4 className="text-sm font-semibold text-slate-900">Información Adicional</h4>
              </div>
              
              {log.details.summary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <div className="text-xs font-medium text-blue-700 mb-1">Resumen</div>
                  <div className="text-sm text-blue-900">{log.details.summary}</div>
                </div>
              )}
              
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                {Object.entries(log.details).map(([key, value]) => {
                  if (key === 'summary' || key === 'fields_modified') return null;
                  return (
                    <div key={key} className="flex gap-2">
                      <span className="text-xs font-medium text-slate-600 min-w-[120px]">{key}:</span>
                      <span className="text-xs text-slate-900 flex-1">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {log.ip_address && (
            <div className="text-xs text-slate-500 border-t border-slate-200 pt-3">
              <span className="font-medium">Dirección IP:</span> {log.ip_address}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Component
const RegistroActividad = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    entity_type: '',
    start_date: '',
    end_date: ''
  });
  
  const [pagination, setPagination] = useState({
    limit: 50,
    skip: 0,
    total: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters, pagination.skip]);

  const loadData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/activity-logs/stats`),
        axios.get(`${API}/admin/users`)
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error("Error loading data:", err);
      if (err.response?.status === 403) {
        alert('No tienes permisos de administrador para acceder a esta sección');
      }
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.action) params.append('action', filters.action);
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('limit', pagination.limit);
      params.append('skip', pagination.skip);
      
      const response = await axios.get(`${API}/admin/activity-logs?${params}`);
      setLogs(response.data.logs);
      setPagination(prev => ({ ...prev, total: response.data.total }));
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('format', format);
      
      const response = await axios.get(`${API}/admin/activity-logs/export?${params}`);
      
      if (format === 'csv') {
        const headers = ['Fecha', 'Usuario', 'Email', 'Acción', 'Entidad', 'Nombre', 'Detalles'];
        const rows = (response?.data?.logs || []).map(log => [
          new Date(log.timestamp).toLocaleString('es-ES'),
          log.user_name,
          log.user_email,
          log.action,
          log.entity_type,
          log.entity_name || '',
          JSON.stringify(log.details || {})
        ]);
        
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `registro_actividad_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      }
      
      alert(`Exportados ${response.data.count} registros`);
    } catch (err) {
      alert('Error al exportar');
    }
  };

  const handleViewDetail = (log) => {
    setSelectedLog(log);
    setDetailModalOpen(true);
  };

  const handlePageChange = (direction) => {
    setPagination(prev => ({
      ...prev,
      skip: Math.max(0, prev.skip + (direction * prev.limit))
    }));
  };

  const clearFilters = () => {
    setFilters({
      user_id: '',
      action: '',
      entity_type: '',
      start_date: '',
      end_date: ''
    });
    setPagination(prev => ({ ...prev, skip: 0 }));
  };

  // Unique actions and entity types from stats
  const availableActions = useMemo(() => 
    stats?.by_action?.map(a => a.action) || Object.keys(ACTION_INFO)
  , [stats]);
  
  const availableEntities = useMemo(() =>
    stats?.by_entity?.map(e => e.entity_type) || Object.keys(ENTITY_LABELS)
  , [stats]);

  // Chart data
  const actionChartData = useMemo(() => 
    stats?.by_action?.slice(0, 6).map(a => ({
      name: ACTION_INFO[a.action]?.label || a.action,
      value: a.count
    })) || []
  , [stats]);

  const userChartData = useMemo(() =>
    stats?.by_user?.slice(0, 5).map(u => ({
      name: u.user_name,
      value: u.count
    })) || []
  , [stats]);

  return (
    <div className="p-6" data-testid="registro-actividad-page">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Registro de Actividad</h1>
          <p className="font-ibm text-slate-600 mt-1">Auditoría completa de todas las acciones del sistema</p>
        </div>
        <button
          onClick={() => handleExport('csv')}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
          data-testid="export-logs-btn"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Exportar CSV
        </button>
      </header>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Actividad (24h)"
            value={stats.recent_24h}
            icon="📊"
            color="blue"
          />
          <StatsCard
            title="Acciones totales"
            value={pagination.total}
            icon="📋"
            color="green"
          />
          <StatsCard
            title="Usuarios activos"
            value={stats.by_user?.length || 0}
            icon="👥"
            color="purple"
          />
          <StatsCard
            title="Tipos de acción"
            value={stats.by_action?.length || 0}
            icon="🎯"
            color="yellow"
          />
        </div>
      )}

      {/* Charts */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Acciones por tipo</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={actionChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Actividad por usuario</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={userChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name }) => name}
                >
                  {userChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Filtros</h3>
          <button
            onClick={clearFilters}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Limpiar filtros
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Usuario</label>
            <select
              value={filters.user_id}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
              data-testid="filter-user"
            >
              <option value="">Todos</option>
              {(users || []).map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Acción</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
              data-testid="filter-action"
            >
              <option value="">Todas</option>
              {availableActions.map(action => (
                <option key={action} value={action}>{ACTION_INFO[action]?.label || action}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Entidad</label>
            <select
              value={filters.entity_type}
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
              data-testid="filter-entity"
            >
              <option value="">Todas</option>
              {availableEntities.map(entity => (
                <option key={entity} value={entity}>{ENTITY_LABELS[entity] || entity}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Desde</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full" data-testid="activity-logs-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Fecha/Hora</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Usuario</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Acción</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Entidad</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Detalle</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Ver</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-800 mx-auto"></div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No se encontraron registros
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-mono text-xs">
                      {new Date(log.timestamp).toLocaleDateString('es-ES')}
                    </div>
                    <div className="text-slate-500 text-xs">
                      {new Date(log.timestamp).toLocaleTimeString('es-ES')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{log.user_name}</div>
                    <div className="text-xs text-slate-500">{log.user_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-slate-700">{ENTITY_LABELS[log.entity_type] || log.entity_type}</span>
                    {log.entity_name && (
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">{log.entity_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate">
                    {log.details && Object.keys(log.details).length > 0 
                      ? JSON.stringify(log.details).substring(0, 50) + '...'
                      : '-'
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleViewDetail(log)}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                      title="Ver detalle"
                      data-testid={`view-log-${log.id}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Mostrando {pagination.skip + 1} - {Math.min(pagination.skip + pagination.limit, pagination.total)} de {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(-1)}
              disabled={pagination.skip === 0}
              className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
            >
              Anterior
            </button>
            <button
              onClick={() => handlePageChange(1)}
              disabled={pagination.skip + pagination.limit >= pagination.total}
              className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <DetailModal
        log={selectedLog}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
      />
    </div>
  );
};

export default RegistroActividad;
