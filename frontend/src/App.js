import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import "@/App.css";

// Supabase Auth Context (replaces legacy AuthContext)
import { SupabaseAuthProvider, useAuth } from "./contexts/SupabaseAuthContext";

// Import unified login page
import LoginUnificado from "./pages/LoginUnificado";

// Import portal pages
import PortalDashboard from "./pages/portal/PortalDashboard";

// Protected Route
const ProtectedRoute = ({ children, requireRole }) => {
  const { user, loading, isAuthenticated } = useAuth();
  
  // Debug logging
  console.log('🔐 ProtectedRoute Estado:', {
    loading,
    isAuthenticated,
    user: user ? { email: user.email, rol: user.rol } : null,
    requireRole
  });
  
  if (loading) {
    console.log('⏳ Loading auth...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    console.log('❌ No autenticado, redirigiendo a /login');
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requireRole && user?.rol !== requireRole) {
    console.log(`⚠️ Rol incorrecto. Esperado: ${requireRole}, Actual: ${user?.rol}`);
    // Redirect to appropriate dashboard
    if (user?.rol === 'gestor') {
      console.log('→ Redirigiendo a dashboard gestor');
      return <Navigate to="/" replace />;
    } else if (user?.rol === 'musico') {
      console.log('→ Redirigiendo a portal músico');
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  
  console.log('✅ Renderizando children protegidos');
  return children;
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
const Sidebar = ({ isCollapsed, onToggle }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({});

  const navItems = Array.isArray(user) ? [] : [
    { 
      id: "dashboard", 
      label: "Dashboard", 
      icon: "LayoutDashboard", 
      path: "/" 
    },
    { 
      id: "configuracion", 
      label: "Configuración de temporada", 
      icon: "Settings",
      path: "/configuracion",
      children: [
        { id: "eventos", label: "Eventos", path: "/configuracion/eventos" },
        { id: "presupuestos", label: "Presupuestos", path: "/configuracion/presupuestos" },
        { id: "base-datos", label: "Base de datos", path: "/configuracion/base-datos" },
        { id: "plantillas", label: "Plantillas de comunicación", path: "/configuracion/plantillas" }
      ]
    },
    { 
      id: "seguimiento", 
      label: "Seguimiento de convocatorias", 
      icon: "Users",
      path: "/seguimiento"
    },
    { 
      id: "plantillas-definitivas", 
      label: "Plantillas definitivas", 
      icon: "CheckSquare",
      path: "/plantillas-definitivas"
    },
    { 
      id: "asistencia", 
      label: "Asistencia y pagos", 
      icon: "CreditCard",
      path: "/asistencia",
      children: [
        { id: "asistencia-pagos", label: "Gestión económica", path: "/asistencia/pagos" },
        { id: "analisis-economico", label: "Análisis económico", path: "/asistencia/analisis" }
      ]
    },
    { 
      id: "informes", 
      label: "Informes", 
      icon: "BarChart3",
      path: "/informes"
    },
    { 
      id: "administracion", 
      label: "Administración", 
      icon: "Shield",
      path: "/admin",
      children: [
        { id: "usuarios", label: "Gestión de usuarios", path: "/admin/usuarios" },
        { id: "permisos", label: "Gestión de permisos", path: "/admin/permisos" },
        { id: "actividad", label: "Registro de actividad", path: "/admin/actividad" },
        { id: "reportes", label: "Reportes del equipo", path: "/admin/reportes" }
      ]
    },
    { 
      id: "ayuda", 
      label: "Manual de Usuario", 
      icon: "HelpCircle",
      path: "/ayuda"
    }
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
                {(item.children || []).map(child => (
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
                    {child.label}
                  </button>
                ))}
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
const Layout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Detectar página y sección actual basándose en la ruta
  const getCurrentPageInfo = () => {
    const path = location.pathname;
    
    if (path === "/" || path === "/dashboard") {
      return { page: "Dashboard", section: null };
    } else if (path.startsWith("/configuracion/eventos")) {
      return { page: "Configuración de temporada", section: "Eventos" };
    } else if (path.startsWith("/configuracion/base-datos")) {
      return { page: "Configuración de temporada", section: "Base de Datos" };
    } else if (path.startsWith("/configuracion/plantillas")) {
      return { page: "Configuración de temporada", section: "Plantillas Email" };
    } else if (path.startsWith("/seguimiento")) {
      return { page: "Seguimiento de convocatorias", section: null };
    } else if (path.startsWith("/plantillas-definitivas")) {
      return { page: "Plantillas definitivas", section: null };
    } else if (path.startsWith("/asistencia/pagos")) {
      return { page: "Asistencia y pagos", section: "Gestión económica" };
    } else if (path.startsWith("/asistencia/analisis")) {
      return { page: "Asistencia y pagos", section: "Análisis económico" };
    } else if (path.startsWith("/informes")) {
      return { page: "Informes", section: null };
    } else if (path.startsWith("/admin/usuarios")) {
      return { page: "Administración", section: "Gestión de usuarios" };
    } else if (path.startsWith("/admin/permisos")) {
      return { page: "Administración", section: "Gestión de permisos" };
    } else if (path.startsWith("/admin/actividad")) {
      return { page: "Administración", section: "Registro de actividad" };
    } else if (path.startsWith("/admin/reportes")) {
      return { page: "Administración", section: "Reportes del equipo" };
    } else if (path.startsWith("/ayuda")) {
      return { page: "Manual de Usuario", section: null };
    }
    
    return { page: "Página desconocida", section: null };
  };

  const pageInfo = getCurrentPageInfo();

  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className="flex-1 overflow-auto">
        {children}
        {/* Botón flotante de feedback - visible en todas las páginas */}
        <FeedbackButton currentPage={pageInfo.page} currentSection={pageInfo.section} />
      </main>
    </div>
  );
};

// Dashboard Page
const DashboardPage = () => {
  const [stats, setStats] = useState({ events: 0, contacts: 0, seasons: 0 });
  const [recentEvents, setRecentEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { session, user } = useAuth();
  const loadedRef = useRef(false);

  useEffect(() => {
    // Solo cargar una vez cuando el usuario esté autenticado
    if (user && session?.access_token && !loadedRef.current && !isLoading) {
      loadedRef.current = true;
      loadData();
    }
  }, [user, session?.access_token]);

  const loadData = async () => {
    if (isLoading) {
      console.log('⏳ Ya hay una carga en progreso, ignorando...');
      return;
    }

    setIsLoading(true);
    
    try {
      if (!session?.access_token) {
        console.warn('⚠️ No hay sesión activa para cargar datos del dashboard');
        return;
      }

      const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:8001/api' 
        : `${process.env.REACT_APP_BACKEND_URL}/api`;

      console.log('📊 Cargando datos del dashboard...');

      // Cargar eventos desde Supabase
      const eventsResponse = await fetch(`${API_URL}/gestor/eventos`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      let eventsData = [];
      if (eventsResponse.ok) {
        try {
          const eventsJson = await eventsResponse.json();
          eventsData = eventsJson.eventos || [];
          console.log(`✅ ${eventsData.length} eventos cargados`);
        } catch (parseError) {
          console.error('Error parsing events response:', parseError);
        }
      } else {
        console.warn(`⚠️ Error al cargar eventos: HTTP ${eventsResponse.status}`);
      }
      
      setStats({
        events: eventsData.length,
        contacts: 0, // TODO: Implementar endpoint de contactos
        seasons: 0   // TODO: Implementar endpoint de temporadas
      });
      setRecentEvents(eventsData.slice(0, 5));
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setStats({ events: 0, contacts: 0, seasons: 0 });
      setRecentEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6" data-testid="dashboard-page">
      <header className="mb-8">
        <h1 className="font-cabinet text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="font-ibm text-slate-600 mt-1">Visión general de la temporada actual</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border border-slate-200" data-testid="stat-events">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Eventos</p>
              <p className="text-3xl font-bold text-slate-900 font-mono">{stats.events}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200" data-testid="stat-contacts">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Contactos</p>
              <p className="text-3xl font-bold text-slate-900 font-mono">{stats.contacts}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200" data-testid="stat-seasons">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Temporadas</p>
              <p className="text-3xl font-bold text-slate-900 font-mono">{stats.seasons}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-cabinet text-lg font-semibold text-slate-900">Próximos eventos</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {!recentEvents || recentEvents.length === 0 ? (
            <p className="p-4 text-slate-500 text-sm">No hay eventos programados</p>
          ) : (
            (recentEvents || []).map(event => (
              <div key={event.id} className="p-4 hover:bg-slate-50 transition-colors" data-testid={`event-${event.id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">{event.name}</h3>
                    <p className="text-sm text-slate-500">{event.date} a las {event.time}</p>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                    {event.rehearsals?.length || 0} ensayos
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
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
import Presupuestos from "./pages/Presupuestos";
import SeguimientoConvocatorias from "./pages/SeguimientoConvocatorias";
import PlantillasDefinitivas from "./pages/PlantillasDefinitivas";
import AsistenciaPagos from "./pages/AsistenciaPagos";
import AnalisisEconomico from "./pages/AnalisisEconomico";
import Informes from "./pages/Informes";
import GestionUsuarios from "./pages/GestionUsuarios";
import RegistroActividad from "./pages/RegistroActividad";
import GestionPermisos from "./pages/GestionPermisos";
import ManualUsuario from "./pages/ManualUsuario";
import GestionReportes from "./pages/GestionReportes";
import FeedbackButton from "./components/FeedbackButton";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SupabaseAuthProvider>
          <Routes>
            {/* Login Unificado - Una sola página para todos */}
            <Route path="/login" element={<LoginUnificado />} />
            
            {/* Portal de Músicos (después de magic link) */}
            <Route 
              path="/portal" 
              element={
                <ProtectedRoute requireRole="musico">
                  <PortalDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Panel de Gestores */}
            <Route
              path="/*"
              element={
                <ProtectedRoute requireRole="gestor">
                  <Layout>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/configuracion" element={<Navigate to="/configuracion/eventos" replace />} />
                      <Route path="/configuracion/eventos" element={<ConfiguracionEventos />} />
                      <Route path="/configuracion/presupuestos" element={<Presupuestos />} />
                      <Route path="/configuracion/base-datos" element={<ConfiguracionBaseDatos />} />
                      <Route path="/configuracion/plantillas" element={<ConfiguracionPlantillas />} />
                      <Route path="/seguimiento" element={<SeguimientoConvocatorias />} />
                      <Route path="/plantillas-definitivas" element={<PlantillasDefinitivas />} />
                      <Route path="/asistencia" element={<Navigate to="/asistencia/pagos" replace />} />
                      <Route path="/asistencia/pagos" element={<AsistenciaPagos />} />
                      <Route path="/asistencia/analisis" element={<AnalisisEconomico />} />
                      <Route path="/informes" element={<Informes />} />
                      <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
                      <Route path="/admin/usuarios" element={<GestionUsuarios />} />
                      <Route path="/admin/permisos" element={<GestionPermisos />} />
                      <Route path="/admin/actividad" element={<RegistroActividad />} />
                      <Route path="/admin/reportes" element={<GestionReportes />} />
                      <Route path="/ayuda" element={<ManualUsuario />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </SupabaseAuthProvider>
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
