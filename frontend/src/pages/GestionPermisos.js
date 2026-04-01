import React, { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Default permission structure
const PERMISSION_STRUCTURE = {
  dashboard: {
    name: "Dashboard",
    permissions: {
      ver: { name: "Ver dashboard", default: { admin: true, personal: true, logistica: true, archivo: true, economico: true } }
    }
  },
  config_eventos: {
    name: "Configuración › Eventos",
    permissions: {
      ver: { name: "Ver eventos", default: { admin: true, personal: false, logistica: true, archivo: false, economico: false } },
      editar: { name: "Editar eventos", default: { admin: true, personal: false, logistica: true, archivo: false, economico: false } },
      crear: { name: "Crear eventos", default: { admin: true, personal: false, logistica: true, archivo: false, economico: false } },
      eliminar: { name: "Eliminar eventos", default: { admin: true, personal: false, logistica: false, archivo: false, economico: false } }
    }
  },
  config_basedatos: {
    name: "Configuración › Base de Datos",
    permissions: {
      ver: { name: "Ver configuración", default: { admin: true, personal: true, logistica: false, archivo: false, economico: false } },
      editar: { name: "Editar mapeo", default: { admin: true, personal: true, logistica: false, archivo: false, economico: false } }
    }
  },
  config_plantillas: {
    name: "Configuración › Plantillas Email",
    permissions: {
      ver: { name: "Ver plantillas", default: { admin: true, personal: true, logistica: false, archivo: true, economico: false } },
      editar: { name: "Editar plantillas", default: { admin: true, personal: true, logistica: false, archivo: false, economico: false } }
    }
  },
  seguimiento: {
    name: "Seguimiento de Convocatorias",
    permissions: {
      ver: { name: "Ver contactos", default: { admin: true, personal: true, logistica: true, archivo: true, economico: false } },
      editar: { name: "Editar contactos", default: { admin: true, personal: true, logistica: false, archivo: false, economico: false } },
      comunicar: { name: "Enviar comunicaciones", default: { admin: true, personal: true, logistica: false, archivo: false, economico: false } },
      crear_contacto: { name: "Crear contactos", default: { admin: true, personal: true, logistica: false, archivo: false, economico: false } }
    }
  },
  plantillas_definitivas: {
    name: "Plantillas Definitivas",
    permissions: {
      ver: { name: "Ver plantillas", default: { admin: true, personal: true, logistica: true, archivo: true, economico: true } },
      editar_atriles: { name: "Editar atriles", default: { admin: true, personal: false, logistica: true, archivo: false, economico: false } },
      editar_asistencia: { name: "Editar asistencia", default: { admin: true, personal: true, logistica: false, archivo: false, economico: false } },
      editar_cache: { name: "Editar cachés", default: { admin: true, personal: false, logistica: false, archivo: false, economico: true } }
    }
  },
  asistencia_pagos: {
    name: "Asistencia y Pagos",
    permissions: {
      ver: { name: "Ver datos", default: { admin: true, personal: false, logistica: true, archivo: true, economico: true } },
      editar_cache: { name: "Editar cachés", default: { admin: true, personal: false, logistica: false, archivo: false, economico: true } },
      editar_extras: { name: "Editar extras", default: { admin: true, personal: false, logistica: false, archivo: false, economico: true } },
      subir_documentos: { name: "Subir documentos", default: { admin: true, personal: false, logistica: true, archivo: true, economico: false } },
      ver_documentos: { name: "Ver documentos", default: { admin: true, personal: false, logistica: true, archivo: true, economico: true } }
    }
  },
  analisis_economico: {
    name: "Análisis Económico",
    permissions: {
      ver: { name: "Ver análisis", default: { admin: true, personal: false, logistica: false, archivo: true, economico: true } },
      exportar: { name: "Exportar datos", default: { admin: true, personal: false, logistica: false, archivo: true, economico: true } },
      exportar_xml: { name: "Exportar XML bancario", default: { admin: true, personal: false, logistica: false, archivo: false, economico: true } }
    }
  },
  informes: {
    name: "Informes",
    permissions: {
      ver: { name: "Ver informes", default: { admin: true, personal: true, logistica: true, archivo: true, economico: true } },
      exportar: { name: "Exportar informes", default: { admin: true, personal: true, logistica: true, archivo: true, economico: true } },
      enviar: { name: "Enviar por email", default: { admin: true, personal: true, logistica: false, archivo: true, economico: false } }
    }
  },
  administracion: {
    name: "Administración",
    permissions: {
      ver_usuarios: { name: "Ver usuarios", default: { admin: true, personal: false, logistica: false, archivo: false, economico: false } },
      gestionar_usuarios: { name: "Gestionar usuarios", default: { admin: true, personal: false, logistica: false, archivo: false, economico: false } },
      ver_actividad: { name: "Ver registro actividad", default: { admin: true, personal: false, logistica: false, archivo: false, economico: false } },
      gestionar_permisos: { name: "Gestionar permisos", default: { admin: true, personal: false, logistica: false, archivo: false, economico: false } }
    }
  }
};

// Default roles
const DEFAULT_ROLES = [
  { id: "admin", name: "Administrador", description: "Acceso completo a todas las funciones del sistema", color: "red", isSystem: true },
  { id: "personal", name: "Gestor de Personal", description: "Gestión de contactos, comunicaciones y seguimiento de músicos", color: "blue", isSystem: false },
  { id: "logistica", name: "Gestor de Logística", description: "Gestión de eventos, atriles, transporte y alojamiento", color: "green", isSystem: false },
  { id: "archivo", name: "Gestor de Archivo", description: "Gestión documental, informes y exportaciones", color: "purple", isSystem: false },
  { id: "economico", name: "Gestor Económico", description: "Gestión de cachés, pagos y análisis financiero", color: "yellow", isSystem: false }
];

// Role Badge Component
const RoleBadge = ({ role, roles }) => {
  const roleInfo = roles.find(r => r.id === role) || { name: role, color: 'slate' };
  const colorClasses = {
    red: 'bg-red-100 text-red-700 border-red-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200'
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colorClasses[roleInfo.color] || colorClasses.slate}`}>
      {roleInfo.name}
    </span>
  );
};

// Permission Checkbox Component
const PermissionCheckbox = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-400'
    } ${checked ? 'bg-green-500 border-green-500' : 'bg-white border-slate-300'}`}
  >
    {checked && (
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    )}
  </button>
);

// Create/Edit Role Modal
const RoleModal = ({ role, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    color: 'blue'
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (role) {
      setFormData({
        id: role.id,
        name: role.name,
        description: role.description,
        color: role.color || 'blue'
      });
    } else {
      setFormData({ id: '', name: '', description: '', color: 'blue' });
    }
  }, [role]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    
    const newId = formData.id || formData.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    onSave({ ...formData, id: newId });
  };

  if (!isOpen) return null;

  const colors = ['red', 'blue', 'green', 'purple', 'yellow', 'orange', 'pink', 'cyan'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold">{role ? 'Editar rol' : 'Crear nuevo rol'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del rol</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-md"
              placeholder="Ej: Gestor de Producción"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-md"
              rows={2}
              placeholder="Describe las responsabilidades de este rol"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 ${
                    formData.color === color ? 'border-slate-800 ring-2 ring-offset-2 ring-slate-400' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: `var(--color-${color}-400, ${color})` }}
                >
                  <span className={`block w-full h-full rounded-full bg-${color}-400`}></span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800">
              {role ? 'Guardar cambios' : 'Crear rol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Component
const GestionPermisos = () => {
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Try to load saved roles and permissions from backend
      const [rolesRes, permsRes] = await Promise.all([
        axios.get(`${API}/admin/roles-config`).catch(() => ({ data: null })),
        axios.get(`${API}/admin/permissions-config`).catch(() => ({ data: null }))
      ]);
      
      if (rolesRes.data?.roles) {
        setRoles(rolesRes.data.roles);
      }
      
      if (permsRes.data?.permissions) {
        setPermissions(permsRes.data.permissions);
      } else {
        // Initialize with defaults
        initializeDefaultPermissions();
      }
    } catch (err) {
      console.error("Error loading data:", err);
      initializeDefaultPermissions();
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultPermissions = () => {
    const defaultPerms = {};
    Object.entries(PERMISSION_STRUCTURE).forEach(([sectionId, section]) => {
      defaultPerms[sectionId] = {};
      Object.entries(section.permissions).forEach(([permId, perm]) => {
        defaultPerms[sectionId][permId] = { ...perm.default };
      });
    });
    setPermissions(defaultPerms);
  };

  const togglePermission = (sectionId, permId, roleId) => {
    if (roleId === 'admin') return; // Admin always has all permissions
    
    setPermissions(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [permId]: {
          ...prev[sectionId]?.[permId],
          [roleId]: !prev[sectionId]?.[permId]?.[roleId]
        }
      }
    }));
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleModalOpen(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setRoleModalOpen(true);
  };

  const handleDeleteRole = (roleId) => {
    if (roleId === 'admin') {
      alert('No se puede eliminar el rol de Administrador');
      return;
    }
    if (!window.confirm('¿Estás seguro de eliminar este rol?')) return;
    
    setRoles(prev => prev.filter(r => r.id !== roleId));
    
    // Remove role from permissions
    const newPerms = { ...permissions };
    Object.keys(newPerms).forEach(sectionId => {
      Object.keys(newPerms[sectionId]).forEach(permId => {
        delete newPerms[sectionId][permId][roleId];
      });
    });
    setPermissions(newPerms);
  };

  const handleSaveRole = (roleData) => {
    if (editingRole) {
      setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, ...roleData } : r));
    } else {
      // New role - add to list and initialize permissions
      setRoles(prev => [...prev, { ...roleData, isSystem: false }]);
      
      // Initialize permissions for new role (all false by default)
      const newPerms = { ...permissions };
      Object.keys(newPerms).forEach(sectionId => {
        Object.keys(newPerms[sectionId]).forEach(permId => {
          newPerms[sectionId][permId][roleData.id] = false;
        });
      });
      setPermissions(newPerms);
    }
    setRoleModalOpen(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        axios.post(`${API}/admin/roles-config`, { roles }),
        axios.post(`${API}/admin/permissions-config`, { permissions })
      ]);
      alert('Configuración guardada correctamente');
    } catch (err) {
      console.error("Error saving:", err);
      alert('Error al guardar. Los cambios se mantienen localmente.');
    } finally {
      setSaving(false);
    }
  };

  const setAllPermissionsForRole = (roleId, value) => {
    if (roleId === 'admin') return;
    
    const newPerms = { ...permissions };
    Object.keys(newPerms).forEach(sectionId => {
      Object.keys(newPerms[sectionId]).forEach(permId => {
        newPerms[sectionId][permId][roleId] = value;
      });
    });
    setPermissions(newPerms);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="gestion-permisos-page">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Gestión de Permisos</h1>
          <p className="font-ibm text-slate-600 mt-1">Configura los permisos de acceso para cada rol</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateRole}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-medium flex items-center gap-2"
            data-testid="create-role-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4"/>
            </svg>
            Nuevo rol
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 text-sm font-medium disabled:opacity-50"
            data-testid="save-permissions-btn"
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </header>

      {/* Roles Overview */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <h3 className="font-semibold text-slate-800 mb-3">Roles del sistema</h3>
        <div className="flex flex-wrap gap-3">
          {roles.map(role => (
            <div key={role.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 pr-3">
              <RoleBadge role={role.id} roles={roles} />
              <span className="text-xs text-slate-500 max-w-[150px] truncate">{role.description}</span>
              {!role.isSystem && (
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleEditRole(role)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500"
                    title="Editar"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteRole(role.id)}
                    className="p-1 hover:bg-red-100 rounded text-red-500"
                    title="Eliminar"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="permissions-matrix">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600 sticky left-0 bg-slate-50 min-w-[250px]">
                  Sección / Permiso
                </th>
                {roles.map(role => (
                  <th key={role.id} className="px-3 py-3 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <RoleBadge role={role.id} roles={roles} />
                      {role.id !== 'admin' && (
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => setAllPermissionsForRole(role.id, true)}
                            className="text-[10px] text-green-600 hover:underline"
                            title="Activar todos"
                          >
                            ✓ Todos
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => setAllPermissionsForRole(role.id, false)}
                            className="text-[10px] text-red-600 hover:underline"
                            title="Desactivar todos"
                          >
                            ✗ Ninguno
                          </button>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSION_STRUCTURE).map(([sectionId, section]) => (
                <React.Fragment key={sectionId}>
                  {/* Section Header */}
                  <tr 
                    className="bg-slate-100 cursor-pointer hover:bg-slate-200"
                    onClick={() => toggleSection(sectionId)}
                  >
                    <td className="px-4 py-2 sticky left-0 bg-slate-100" colSpan={roles.length + 1}>
                      <div className="flex items-center gap-2 font-semibold text-slate-700">
                        <svg 
                          className={`w-4 h-4 transition-transform ${expandedSections[sectionId] ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 5l7 7-7 7"/>
                        </svg>
                        {section.name}
                        <span className="text-xs font-normal text-slate-500">
                          ({Object.keys(section.permissions).length} permisos)
                        </span>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Permission Rows */}
                  {expandedSections[sectionId] && Object.entries(section.permissions).map(([permId, perm]) => (
                    <tr key={`${sectionId}-${permId}`} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 pl-10 sticky left-0 bg-white text-sm text-slate-600">
                        {perm.name}
                      </td>
                      {roles.map(role => (
                        <td key={role.id} className="px-3 py-2 text-center">
                          <div className="flex justify-center">
                            <PermissionCheckbox
                              checked={permissions[sectionId]?.[permId]?.[role.id] ?? false}
                              onChange={(value) => togglePermission(sectionId, permId, role.id)}
                              disabled={role.id === 'admin'}
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border-2 bg-green-500 border-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span>Permiso activo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border-2 bg-white border-slate-300"></div>
          <span>Permiso inactivo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border-2 bg-green-500 border-green-500 opacity-50 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span>Administrador (no editable)</span>
        </div>
      </div>

      {/* Role Modal */}
      <RoleModal
        role={editingRole}
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        onSave={handleSaveRole}
      />
    </div>
  );
};

export default GestionPermisos;
