import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import "@/App.css";

// Dual Auth System
import { AuthProvider, useAuth as useGestorAuth } from "./contexts/AuthContext";
import { SupabaseAuthProvider, useAuth as useMusicoAuth } from "./contexts/SupabaseAuthContext";

// Import unified login page
import LoginUnificado from "./pages/LoginUnificado";

// Import portal pages
import PortalDashboard from "./pages/portal/PortalDashboard";
import ResetPassword from "./pages/ResetPassword";
import ActivarCuenta from "./pages/ActivarCuenta";
import FicharPublico from "./pages/FicharPublico";

// Protected Route for Gestores (uses AuthContext)
const ProtectedGestorRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useGestorAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <><KeepAlive active /> {children}</>;
};

// Protected Route for Músicos (uses SupabaseAuthContext)
const ProtectedMusicoRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useMusicoAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <><KeepAlive active /> {children}</>;
};

// Login Page (Legacy - will be replaced by LoginUnificado)
const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{ backgroundImage: "url('https://static.prod-images.emergentagent.com/jobs/234efbab-6f82-4a1d-a46a-8abdc8d709c6/images/72918666a3aff7419cc647ca9dbd829fc66c63a17a0ae330882aae3b0e9e0827.png')" }}
      >
        <div className="absolute inset-0 bg-slate-900/60"></div>
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h1 className="font-cabinet text-4xl font-bold mb-4">Panel de Gestión de Convocatorias</h1>
          <p className="font-ibm text-lg text-slate-200">Sistema integral para la gestión de temporadas, eventos y comunicaciones musicales.</p>
        </div>
      </div>
      
      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-cabinet text-3xl font-bold text-slate-900 mb-2">Iniciar sesión</h2>
            <p className="font-ibm text-slate-600">Introduce tus credenciales para acceder al panel</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md" data-testid="login-error">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-400 focus:border-transparent font-ibm"
                placeholder="admin@convocatorias.com"
                required
                data-testid="login-email"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-400 focus:border-transparent font-ibm"
                placeholder="••••••••"
                required
                data-testid="login-password"
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors font-ibm font-medium disabled:opacity-50"
              data-testid="login-submit"
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Sidebar Navigation
const Sidebar = ({ isCollapsed, onToggle, onOpenCommandPalette }) => {
  const { logout, user, api } = useGestorAuth(); // Use AuthContext for gestores
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({});
  const [pendientes, setPendientes] = useState({ reclamaciones_pendientes: 0, perfiles_actualizados: 0, respuestas_nuevas: 0, tareas_proximas: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchPendientes = async () => {
      try {
        const r = await api.get('/api/gestor/pendientes');
        if (!cancelled) setPendientes(r.data || {});
      } catch (e) { /* noop */ }
    };
    fetchPendientes();
    const t = setInterval(fetchPendientes, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, [api, user]);

  // Map child id -> badge count
  const badgeFor = (id) => {
    if (id === 'reclamaciones') return { count: pendientes.reclamaciones_pendientes, color: 'bg-red-500' };
    if (id === 'musicos') return { count: pendientes.solicitudes_pendientes, color: 'bg-rose-500' };
    if (id === 'seguimiento') return { count: pendientes.respuestas_nuevas, color: 'bg-orange-500' };
    if (id === 'mensajes') return { count: pendientes.comentarios_pendientes, color: 'bg-blue-500' };
    return null;
  };
  const adminTotal = (pendientes.reclamaciones_pendientes || 0) + (pendientes.perfiles_actualizados || 0) + (pendientes.comentarios_pendientes || 0);

  const navItems = Array.isArray(user) ? [] : [
    { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/" },
    {
      id: "temporada", label: "Temporada", icon: "Calendar", path: "/configuracion",
      children: [
        { id: "eventos", label: "Configuración de Eventos", path: "/configuracion/eventos" },
        { id: "presupuestos", label: "Presupuestos", path: "/configuracion/presupuestos" },
        { id: "seguimiento", label: "Seguimiento de Convocatorias", path: "/seguimiento" },
        { id: "plantillas-definitivas", label: "Plantillas Definitivas", path: "/plantillas-definitivas" },
      ],
    },
    {
      id: "logistica-servicios", label: "Logística y Servicios", icon: "Truck", path: "/asistencia/logistica",
      children: [
        { id: "logistica", label: "Logística y Servicios", path: "/asistencia/logistica" },
        { id: "registro-asistencia", label: "Registro de Asistencia", path: "/asistencia/registro" },
      ],
    },
    {
      id: "economia", label: "Economía", icon: "CreditCard", path: "/asistencia",
      children: [
        { id: "asistencia-pagos", label: "Gestión Económica", path: "/asistencia/pagos" },
        { id: "analisis-economico", label: "Análisis Económico", path: "/asistencia/analisis" },
        { id: "recibos-certificados", label: "Recibos y Certificados", path: "/asistencia/recibos-certificados" },
        { id: "informes", label: "Informes", path: "/informes" },
      ],
    },
    {
      id: "musicos-grupo", label: "Músicos", icon: "Users", path: "/admin/musicos",
      children: [
        { id: "musicos", label: "Base de Datos de Músicos", path: "/admin/musicos" },
        { id: "historial-musicos", label: "Historial y CRM", path: "/admin/historial-musicos" },
        { id: "preview-musico", label: "Vista Músico", path: "/admin/preview-musico" },
      ],
    },
    {
      id: "repertorio", label: "Repertorio y Material", icon: "BookOpen", path: "/admin/archivo",
      children: [
        { id: "archivo", label: "Archivo Musical", path: "/admin/archivo" },
        { id: "inventario", label: "Inventario Material", path: "/admin/inventario" },
      ],
    },
    {
      id: "comunicaciones", label: "Comunicaciones", icon: "MessageSquare", path: "/admin/comunicaciones",
      children: [
        { id: "comunicaciones-centro", label: "Centro de Comunicaciones", path: "/admin/comunicaciones" },
        { id: "recordatorios", label: "Recordatorios Push", path: "/admin/recordatorios" },
        { id: "emails", label: "Historial de Emails", path: "/admin/emails" },
      ],
    },
    {
      id: "administracion", label: "Administración", icon: "Settings", path: "/admin",
      children: [
        { id: "tareas", label: "Planificador de Tareas", path: "/admin/tareas" },
        { id: "incidencias", label: "Incidencias", path: "/admin/incidencias" },
        { id: "reclamaciones", label: "Reclamaciones", path: "/admin/reclamaciones" },
        { id: "actividad", label: "Registro de Actividad", path: "/admin/actividad" },
        { id: "usuarios", label: "Gestión de usuarios", path: "/admin/usuarios" },
        { id: "permisos", label: "Gestión de permisos", path: "/admin/permisos" },
        { id: "configuracion-app", label: "Configuración", path: "/admin/configuracion" },
      ],
    },
    { id: "ayuda", label: "Manual de Usuario", icon: "HelpCircle", path: "/ayuda" },
  ];

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isActive = (path) => location.pathname === path;
  const isParentActive = (item) => item.children?.some(child => location.pathname.startsWith(child.path));

  useEffect(() => {
    // Auto-expand section when navigating to a child
    navItems.forEach(item => {
      if (item.children && item.children.some(child => location.pathname.startsWith(child.path))) {
        setExpandedSections(prev => ({ ...prev, [item.id]: true }));
      }
    });
  }, [location.pathname]);

  const getIcon = (iconName) => {
    const icons = {
      LayoutDashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
      Settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
      Users: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      CheckSquare: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>,
      CreditCard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
      Truck: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>,
      Calendar: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
      BookOpen: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
      MessageSquare: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
      BarChart3: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>,
      Shield: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
      HelpCircle: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
      ChevronRight: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>,
      ChevronDown: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>,
      LogOut: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
      Menu: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    };
    return icons[iconName] || null;
  };

  return (
    <aside className={`bg-slate-900 text-slate-200 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo/Brand */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">OM</span>
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-cabinet text-lg font-bold text-white">OPUS MANAGER</h1>
              <p className="font-ibm text-xs text-slate-400">Sistema de Gestión y Control de Plantillas Orquestales</p>
            </div>
          )}
        </div>
        <button 
          onClick={onToggle}
          className="mt-3 w-full p-2 hover:bg-slate-800 rounded-md transition-colors flex items-center justify-center"
          data-testid="sidebar-toggle"
        >
          {getIcon("Menu")}
        </button>
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            title="Buscar (Ctrl+K / Cmd+K)"
            data-testid="sidebar-command-k"
            className={`mt-2 w-full p-2 hover:bg-slate-800 rounded-md transition-colors flex items-center ${isCollapsed ? 'justify-center' : 'gap-2 px-3 text-sm text-slate-300'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">Buscar…</span>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">⌘K</kbd>
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" data-testid="sidebar-nav">
        {(navItems || []).map(item => (
          <div key={item.id}>
            <button
              onClick={() => {
                if (item.children) {
                  toggleSection(item.id);
                } else {
                  navigate(item.path);
                }
              }}
              className={`w-full flex items-center px-4 py-3 text-left transition-colors ${
                isActive(item.path) || isParentActive(item) 
                  ? 'bg-slate-800 text-white' 
                  : 'hover:bg-slate-800/50'
              }`}
              data-testid={`sidebar-nav-${item.id}`}
            >
              <span className="flex-shrink-0">{getIcon(item.icon)}</span>
              {!isCollapsed && (
                <>
                  <span className="ml-3 font-ibm text-sm flex-1">{item.label}</span>
                  {item.id === 'seguimiento' && (pendientes.respuestas_nuevas || 0) > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold" data-testid="badge-respuestas">
                      {pendientes.respuestas_nuevas}
                    </span>
                  )}
                  {item.id === 'administracion' && adminTotal > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold" data-testid="badge-admin">
                      {adminTotal}
                    </span>
                  )}
                  {item.children && (
                    <span className="ml-auto">
                      {expandedSections[item.id] ? getIcon("ChevronDown") : getIcon("ChevronRight")}
                    </span>
                  )}
                </>
              )}
            </button>
            
            {/* Children */}
            {item.children && expandedSections[item.id] && !isCollapsed && (
              <div className="bg-slate-950/50">
                {(item.children || []).map(child => {
                  const b = badgeFor(child.id);
                  return (
                  <button
                    key={child.id}
                    onClick={() => navigate(child.path)}
                    className={`w-full flex items-center pl-12 pr-4 py-2 text-left text-sm transition-colors ${
                      isActive(child.path) 
                        ? 'bg-slate-800 text-white' 
                        : 'hover:bg-slate-800/50 text-slate-400'
                    }`}
                    data-testid={`sidebar-nav-${child.id}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current mr-3"></span>
                    <span className="flex-1">{child.label}</span>
                    {b && b.count > 0 && (
                      <span className={`ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full ${b.color} text-white text-[10px] font-bold`} data-testid={`badge-${child.id}`}>
                        {b.count}
                      </span>
                    )}
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>
      
      {/* User & Logout */}
      <div className="p-4 border-t border-slate-700">
        {!isCollapsed && user && (
          <div className="mb-3 px-2">
            <p className="text-xs text-slate-400">Conectado como</p>
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <Link
              to="/admin/mi-perfil"
              data-testid="link-mi-perfil"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
            >
              <span aria-hidden>👤</span>
              <span>Mi perfil</span>
            </Link>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center px-2 py-2 text-sm hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white"
          data-testid="logout-btn"
        >
          {getIcon("LogOut")}
          {!isCollapsed && <span className="ml-3">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
};

// Layout
// Definición estática de navegación (para CommandPalette — Sidebar tiene la suya con badges)
const PALETTE_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", path: "/" },
  { id: "temporada", label: "Temporada", children: [
    { id: "eventos", label: "Configuración de Eventos", path: "/configuracion/eventos" },
    { id: "presupuestos", label: "Presupuestos", path: "/configuracion/presupuestos" },
    { id: "seguimiento", label: "Seguimiento de Convocatorias", path: "/seguimiento" },
    { id: "plantillas-definitivas", label: "Plantillas Definitivas", path: "/plantillas-definitivas" },
  ]},
  { id: "logistica-servicios", label: "Logística y Servicios", children: [
    { id: "logistica", label: "Logística y Servicios", path: "/asistencia/logistica" },
    { id: "registro-asistencia", label: "Registro de Asistencia", path: "/asistencia/registro" },
  ]},
  { id: "economia", label: "Economía", children: [
    { id: "asistencia-pagos", label: "Gestión Económica", path: "/asistencia/pagos" },
    { id: "analisis-economico", label: "Análisis Económico", path: "/asistencia/analisis" },
    { id: "recibos-certificados", label: "Recibos y Certificados", path: "/asistencia/recibos-certificados" },
    { id: "informes", label: "Informes", path: "/informes" },
  ]},
  { id: "musicos-grupo", label: "Músicos", children: [
    { id: "musicos", label: "Base de Datos de Músicos", path: "/admin/musicos" },
    { id: "historial-musicos", label: "Historial y CRM", path: "/admin/historial-musicos" },
    { id: "preview-musico", label: "Vista Músico", path: "/admin/preview-musico" },
  ]},
  { id: "repertorio", label: "Repertorio y Material", children: [
    { id: "archivo", label: "Archivo Musical", path: "/admin/archivo" },
    { id: "inventario", label: "Inventario Material", path: "/admin/inventario" },
  ]},
  { id: "comunicaciones", label: "Comunicaciones", children: [
    { id: "comunicaciones-centro", label: "Centro de Comunicaciones", path: "/admin/comunicaciones" },
    { id: "recordatorios", label: "Recordatorios Push", path: "/admin/recordatorios" },
    { id: "emails", label: "Historial de Emails", path: "/admin/emails" },
  ]},
  { id: "administracion", label: "Administración", children: [
    { id: "tareas", label: "Planificador de Tareas", path: "/admin/tareas" },
    { id: "incidencias", label: "Incidencias", path: "/admin/incidencias" },
    { id: "reclamaciones", label: "Reclamaciones", path: "/admin/reclamaciones" },
    { id: "actividad", label: "Registro de Actividad", path: "/admin/actividad" },
    { id: "usuarios", label: "Gestión de usuarios", path: "/admin/usuarios" },
    { id: "permisos", label: "Gestión de permisos", path: "/admin/permisos" },
    { id: "configuracion-app", label: "Configuración", path: "/admin/configuracion" },
  ]},
  { id: "ayuda", label: "Manual de Usuario", path: "/ayuda" },
];

const Layout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const { api } = useGestorAuth();

  // Atajo Cmd/Ctrl+K global
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Detectar página y sección actual basándose en la ruta
  const getCurrentPageInfo = () => {
    const path = location.pathname;
    
    if (path === "/" || path === "/dashboard") {
      return { page: "Dashboard", section: null };
    } else if (path.startsWith("/configuracion/eventos")) {
      return { page: "Configuración de temporada", section: "Eventos" };
    } else if (path.startsWith("/configuracion/base-datos")) {
      return { page: "Configuración de temporada", section: "Base de datos de músicos" };
    } else if (path.startsWith("/configuracion/plantillas")) {
      return { page: "Centro de comunicaciones", section: null };
    } else if (path.startsWith("/seguimiento")) {
      return { page: "Seguimiento de convocatorias", section: null };
    } else if (path.startsWith("/plantillas-definitivas")) {
      return { page: "Plantillas definitivas", section: null };
    } else if (path.startsWith("/asistencia/pagos")) {
      return { page: "Asistencia y pagos", section: "Gestión económica" };
    } else if (path.startsWith("/asistencia/logistica")) {
      return { page: "Logística y Servicios", section: null };
    } else if (path.startsWith("/asistencia/analisis")) {
      return { page: "Asistencia y pagos", section: "Análisis económico" };
    } else if (path.startsWith("/asistencia/registro")) {
      return { page: "Asistencia y pagos", section: "Registro de Asistencia" };
    } else if (path.startsWith("/asistencia/recibos-certificados")) {
      return { page: "Asistencia y pagos", section: "Recibos y certificados" };
    } else if (path.startsWith("/informes")) {
      return { page: "Informes", section: null };
    } else if (path.startsWith("/admin/usuarios")) {
      return { page: "Administración", section: "Gestión de usuarios" };
    } else if (path.startsWith("/admin/musicos")) {
      return { page: "Administración", section: "Base de datos músicos" };
    } else if (path.startsWith("/admin/configuracion")) {
      return { page: "Administración", section: "⚙️ Configuración" };
    } else if (path.startsWith("/admin/comunicaciones")) {
      return { page: "Centro de Comunicaciones", section: null };
    } else if (path.startsWith("/admin/recordatorios")) {
      return { page: "Comunicaciones", section: "Recordatorios Push" };
    } else if (path.startsWith("/admin/emails/configuracion")) {
      return { page: "Comunicaciones", section: "Configuración de email" };
    } else if (path.startsWith("/admin/emails")) {
      return { page: "Comunicaciones", section: "Historial de emails" };
    } else if (path.startsWith("/admin/reclamaciones")) {
      return { page: "Administración", section: "Reclamaciones" };
    } else if (path.startsWith("/admin/permisos")) {
      return { page: "Administración", section: "Gestión de permisos" };
    } else if (path.startsWith("/admin/actividad")) {
      return { page: "Administración", section: "Registro de actividad" };
    } else if (path.startsWith("/admin/mensajes")) {
      return { page: "Administración", section: "Mensajes" };
    } else if (path.startsWith("/admin/archivo")) {
      return { page: "Administración", section: "Archivo musical" };
    } else if (path.startsWith("/admin/inventario")) {
      return { page: "Administración", section: "Inventario de material" };
    } else if (path.startsWith("/ayuda")) {
      return { page: "Manual de Usuario", section: null };
    }
    
    return { page: "Página desconocida", section: null };
  };

  const pageInfo = getCurrentPageInfo();

  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} onOpenCommandPalette={() => setPaletteOpen(true)} />
      <main className="flex-1 overflow-auto relative">
        <NotificacionesBell />
        {children}
        {/* Botón flotante de feedback - visible en todas las páginas */}
        <FeedbackButton />
        {/* Botón flotante de comentarios al equipo (separado, encima del de feedback) */}
        <ComentariosEquipoButton />
        <HilosPendientesAuto />
        <PushPermissionPrompt clientOrToken={api} />
        <HelpPanel />
      </main>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={PALETTE_NAV_ITEMS}
      />
    </div>
  );
};


// Placeholder pages
const PlaceholderPage = ({ title, description }) => (
  <div className="p-6">
    <header className="mb-8">
      <h1 className="font-cabinet text-3xl font-bold text-slate-900">{title}</h1>
      <p className="font-ibm text-slate-600 mt-1">{description}</p>
    </header>
    <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
      </div>
      <p className="text-slate-500">Esta sección estará disponible próximamente</p>
    </div>
  </div>
);

// Import subpages
import ConfiguracionEventos from "./pages/ConfiguracionEventos";
import ConfiguracionBaseDatos from "./pages/ConfiguracionBaseDatos";
import ConfiguracionPlantillas from "./pages/ConfiguracionPlantillas";
import CentroComunicaciones from "./pages/CentroComunicaciones";
import Presupuestos from "./pages/Presupuestos";
import SeguimientoConvocatorias from "./pages/SeguimientoConvocatorias";
import PlantillasDefinitivas from "./pages/PlantillasDefinitivas";
import AsistenciaPagos from "./pages/AsistenciaPagos";
import Logistica from "./pages/Logistica";
import AnalisisEconomico from "./pages/AnalisisEconomico";
import RecibosCertificados from "./pages/RecibosCertificados";
import ConfiguracionApp from "./pages/ConfiguracionApp";
import RegistroPublico from "./pages/RegistroPublico";
import HistorialMusicos from "./pages/HistorialMusicos";
import RegistroAsistencia from "./pages/RegistroAsistencia";
import PreviewMusico from "./pages/PreviewMusico";
import PortalPreviewFrame from "./pages/PortalPreviewFrame";
import CommandPalette from "./components/CommandPalette";
import Informes from "./pages/Informes";
import GestionUsuarios from "./pages/GestionUsuarios";
import MiPerfilGestor from "./pages/MiPerfilGestor";
import RecordatoriosAdmin from "./pages/RecordatoriosAdmin";
import RegistroActividad from "./pages/RegistroActividad";
import GestionPermisos from "./pages/GestionPermisos";
import ManualUsuario from "./pages/ManualUsuario";
import GestorMusicos from "./pages/GestorMusicos";
import GestorArchivo from "./pages/GestorArchivo";
import GestorInventario from "./pages/GestorInventario";
import ChatInterno from "./pages/ChatInterno";
import KeepAlive from "./components/KeepAlive";
import GestorMusicoDetalle from "./pages/GestorMusicoDetalle";
import GestorTareas from "./pages/GestorTareas";
import GestorIncidencias from "./pages/GestorIncidencias";
import GestorRecordatorios from "./pages/GestorRecordatorios";
import GestorEmailLog from "./pages/GestorEmailLog";
import GestorReclamaciones from "./pages/GestorReclamaciones";
import ConfiguracionEmail from "./pages/ConfiguracionEmail";
import FeedbackButton from "./components/FeedbackButton";
import HilosPendientesDrawer from "./components/HilosPendientesDrawer";
import ActividadPendiente from "./components/ActividadPendiente";

// Detección automática de página para Hilos pendientes (Bloque 4)
const HILOS_PAGES = [
  '/configuracion/eventos', '/seguimiento', '/plantillas-definitivas',
  '/archivo', '/economico', '/tareas', '/logistica', '/informes',
];
const HilosPendientesAuto = () => {
  const location = useLocation();
  const match = HILOS_PAGES.find(p => location.pathname.startsWith(p));
  if (!match) return null;
  return <HilosPendientesDrawer key={match} pagina={match} />;
};
import ComentariosEquipoButton from "./components/ComentariosEquipoButton";
import HelpPanel from "./components/HelpPanel";
import DashboardPage from "./pages/DashboardPage";
import NotificacionesBell from "./components/NotificacionesBell";
import PushPermissionPrompt from "./components/PushPermissionPrompt";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* Dual Auth System: AuthProvider for Gestores, SupabaseAuthProvider for Músicos */}
        <AuthProvider>
          <SupabaseAuthProvider>
            <Routes>
              {/* Login Unificado - Una sola página para todos */}
              <Route path="/login" element={<LoginUnificado />} />
              
              {/* Reset Password - Recuperación de contraseña */}
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Activación de invitación - pública, sin login */}
              <Route path="/activar/:token" element={<ActivarCuenta />} />
              <Route path="/fichar/:token" element={<FicharPublico />} />
              <Route path="/portal-preview/:token" element={<PortalPreviewFrame />} />
              <Route path="/registro/:token" element={<RegistroPublico />} />
              <Route path="/registro" element={<RegistroPublico />} />
              
              {/* Portal de Músicos - usa SupabaseAuthContext */}
              <Route 
                path="/portal" 
                element={
                  <ProtectedMusicoRoute>
                    <PortalDashboard />
                  </ProtectedMusicoRoute>
                } 
              />
              
              {/* Panel de Gestores - usa AuthContext */}
              <Route
                path="/*"
                element={
                  <ProtectedGestorRoute>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/configuracion" element={<Navigate to="/configuracion/eventos" replace />} />
                        <Route path="/configuracion/eventos" element={<ConfiguracionEventos />} />
                        <Route path="/configuracion/presupuestos" element={<Presupuestos />} />
                        <Route path="/configuracion/base-datos" element={<GestorMusicos />} />
                        <Route path="/configuracion/plantillas" element={<ConfiguracionPlantillas />} />
                        <Route path="/admin/comunicaciones" element={<CentroComunicaciones />} />
                        <Route path="/seguimiento" element={<SeguimientoConvocatorias />} />
                        <Route path="/plantillas-definitivas" element={<PlantillasDefinitivas />} />
                        <Route path="/asistencia" element={<Navigate to="/asistencia/pagos" replace />} />
                        <Route path="/asistencia/pagos" element={<AsistenciaPagos />} />
                        <Route path="/asistencia/logistica" element={<Logistica />} />
                        <Route path="/asistencia/analisis" element={<AnalisisEconomico />} />
                        <Route path="/asistencia/recibos-certificados" element={<RecibosCertificados />} />
                        <Route path="/asistencia/registro" element={<RegistroAsistencia />} />
                        <Route path="/admin/configuracion" element={<ConfiguracionApp />} />
                        <Route path="/admin/preview-musico" element={<PreviewMusico />} />
                        <Route path="/admin/historial-musicos" element={<HistorialMusicos />} />
                        <Route path="/informes" element={<Informes />} />
                        <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
                        <Route path="/admin/mi-perfil" element={<MiPerfilGestor />} />
                        <Route path="/admin/recordatorios" element={<RecordatoriosAdmin />} />
                        <Route path="/admin/usuarios" element={<GestionUsuarios />} />
                        <Route path="/admin/musicos" element={<GestorMusicos />} />
                        <Route path="/admin/musicos/:id" element={<GestorMusicoDetalle />} />
                        <Route path="/admin/tareas" element={<GestorTareas />} />
                        <Route path="/admin/incidencias" element={<GestorIncidencias />} />
                        <Route path="/admin/recordatorios" element={<GestorRecordatorios />} />
                        <Route path="/admin/emails" element={<GestorEmailLog />} />
                        <Route path="/admin/emails/configuracion" element={<ConfiguracionEmail />} />
                        <Route path="/admin/reclamaciones" element={<GestorReclamaciones />} />
                        <Route path="/admin/permisos" element={<GestionPermisos />} />
                        <Route path="/admin/actividad" element={<RegistroActividad />} />
                        <Route path="/admin/mensajes" element={<ChatInterno />} />
                        <Route path="/admin/archivo" element={<GestorArchivo />} />
                        <Route path="/admin/inventario" element={<GestorInventario />} />
                        <Route path="/ayuda" element={<ManualUsuario />} />
                      </Routes>
                    </Layout>
                  </ProtectedGestorRoute>
                }
              />
            </Routes>
          </SupabaseAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error de Aplicación</h1>
            <p className="text-slate-600 mb-4">
              Ha ocurrido un error. Por favor, recarga la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Recargar Página
            </button>
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-slate-500">Detalles técnicos</summary>
              <pre className="mt-2 p-2 bg-slate-100 rounded text-xs overflow-auto">
                {this.state.error?.toString()}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrap App with Error Boundary
function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
