import React, { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// User Form Component
const UserForm = ({ user, roles, onSave, onCancel, isNew }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'viewer',
    is_active: user?.is_active !== false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    
    try {
      if (isNew) {
        if (!formData.password) {
          setError('La contraseña es obligatoria');
          setSaving(false);
          return;
        }
        await axios.post(`${API}/admin/users`, formData);
      } else {
        const updateData = { name: formData.name, role: formData.role, is_active: formData.is_active };
        await axios.put(`${API}/admin/users/${user.id}`, updateData);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-md"
          required
          data-testid="user-name-input"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-md"
          required
          disabled={!isNew}
          data-testid="user-email-input"
        />
      </div>
      
      {isNew && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-md"
            required={isNew}
            minLength={6}
            data-testid="user-password-input"
          />
          <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres</p>
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-md"
          data-testid="user-role-select"
        >
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          {roles.find(r => r.id === formData.role)?.description}
        </p>
      </div>
      
      {!isNew && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300"
          />
          <label htmlFor="is_active" className="text-sm text-slate-700">Usuario activo</label>
        </div>
      )}
      
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50"
          data-testid="save-user-btn"
        >
          {saving ? 'Guardando...' : (isNew ? 'Crear usuario' : 'Guardar cambios')}
        </button>
      </div>
    </form>
  );
};

// Password Reset Form
const PasswordResetForm = ({ user, onSave, onCancel }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(`${API}/admin/users/${user.id}/reset-password`, { new_password: password });
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      
      <p className="text-sm text-slate-600">
        Cambiar contraseña para: <strong>{user.name}</strong> ({user.email})
      </p>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-md"
          required
          minLength={6}
          data-testid="new-password-input"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-md"
          required
          data-testid="confirm-password-input"
        />
      </div>
      
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50">
          {saving ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>
      </div>
    </form>
  );
};

// Role Badge Component
const RoleBadge = ({ role }) => {
  const colors = {
    admin: 'bg-red-100 text-red-700 border-red-200',
    manager: 'bg-blue-100 text-blue-700 border-blue-200',
    editor: 'bg-green-100 text-green-700 border-green-200',
    viewer: 'bg-slate-100 text-slate-700 border-slate-200'
  };
  
  const names = {
    admin: 'Administrador',
    manager: 'Gestor',
    editor: 'Editor',
    viewer: 'Visor'
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[role] || colors.viewer}`}>
      {names[role] || role}
    </span>
  );
};

// Main Component
const GestionUsuarios = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/roles`)
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (err) {
      console.error("Error loading data:", err);
      if (err.response?.status === 403) {
        alert('No tienes permisos de administrador para acceder a esta sección');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setIsNewUser(true);
    setModalOpen(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setIsNewUser(false);
    setModalOpen(true);
  };

  const handleResetPassword = (user) => {
    setSelectedUser(user);
    setPasswordModalOpen(true);
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${user.name}"?`)) return;
    
    try {
      await axios.delete(`${API}/admin/users/${user.id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar usuario');
    }
  };

  const handleSendCredentials = async (user) => {
    try {
      const response = await axios.post(`${API}/admin/users/${user.id}/send-credentials`);
      alert(response.data.message);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar credenciales');
    }
  };

  const handleSave = () => {
    setModalOpen(false);
    setPasswordModalOpen(false);
    loadData();
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="gestion-usuarios-page">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Gestión de Usuarios</h1>
          <p className="font-ibm text-slate-600 mt-1">Administra los usuarios y roles del sistema</p>
        </div>
        <button
          onClick={handleCreateUser}
          className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium flex items-center gap-2"
          data-testid="create-user-btn"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4"/>
          </svg>
          Nuevo usuario
        </button>
      </header>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-80 px-3 py-2 border border-slate-200 rounded-md"
            data-testid="search-users-input"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-md"
          data-testid="filter-role-select"
        >
          <option value="">Todos los roles</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full" data-testid="users-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Usuario</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Rol</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Creado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
                <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                <td className="px-4 py-3 text-center">
                  {user.is_active !== false ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Activo</span>
                  ) : (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Inactivo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                      title="Editar"
                      data-testid={`edit-user-${user.id}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleResetPassword(user)}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                      title="Cambiar contraseña"
                      data-testid={`reset-password-${user.id}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleSendCredentials(user)}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                      title="Enviar credenciales"
                      data-testid={`send-credentials-${user.id}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className="p-1.5 hover:bg-red-50 rounded text-red-600"
                      title="Eliminar"
                      data-testid={`delete-user-${user.id}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No se encontraron usuarios
          </div>
        )}
      </div>

      {/* Roles Info */}
      <div className="mt-6 bg-slate-50 rounded-lg p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Roles disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {roles.map(role => (
            <div key={role.id} className="bg-white p-3 rounded border border-slate-200">
              <RoleBadge role={role.id} />
              <p className="text-xs text-slate-500 mt-2">{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit User Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={isNewUser ? 'Crear nuevo usuario' : 'Editar usuario'}>
        <UserForm
          user={selectedUser}
          roles={roles}
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
          isNew={isNewUser}
        />
      </Modal>

      {/* Password Reset Modal */}
      <Modal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="Cambiar contraseña">
        {selectedUser && (
          <PasswordResetForm
            user={selectedUser}
            onSave={handleSave}
            onCancel={() => setPasswordModalOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
};

export default GestionUsuarios;
