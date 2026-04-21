// Portal Dashboard - Músicos
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { supabase } from '../../lib/supabaseClient';
import CambiarPasswordPrimeraVez from './CambiarPasswordPrimeraVez';

const PortalDashboard = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, loading: authLoading, isAuthenticated } = useAuth();
  
  console.log('🔵 PortalDashboard rendered, auth state:', {
    isAuthenticated, 
    loading: authLoading, 
    user: user ? { email: user.email, rol: user.rol } : null,
    profile: profile ? { requiere_cambio_password: profile.requiere_cambio_password } : null
  });
  
  // Estado local para controlar si se requiere cambio de password
  const [requiereCambio, setRequiereCambio] = useState(profile?.requiere_cambio_password === true);

  // Actualizar estado cuando el profile cambie
  useEffect(() => {
    setRequiereCambio(profile?.requiere_cambio_password === true);
  }, [profile]);

  // Si requiere cambio de contraseña, mostrar pantalla de cambio
  if (requiereCambio) {
    return (
      <CambiarPasswordPrimeraVez 
        onPasswordChanged={() => {
          console.log('✅ Password cambiada, actualizando estado local');
          // Actualizar estado local para ocultar el componente de cambio
          setRequiereCambio(false);
          // El profile se actualizará en el próximo loadUserProfile automático
        }}
      />
    );
  }
  
  const [eventos, setEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [ensayos, setEnsayos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // API URL
  const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8001/api' 
    : `${process.env.REACT_APP_BACKEND_URL}/api`;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (user.rol !== 'musico') {
      navigate('/');
      return;
    }

    cargarMisEventos();
  }, [user, navigate]);

  const cargarMisEventos = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${API_URL}/portal/mis-eventos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Error al cargar eventos');

      const data = await response.json();
      setEventos(data.asignaciones || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarDetallesEvento = async (eventoId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Cargar ensayos
      const ensayosRes = await fetch(`${API_URL}/portal/evento/${eventoId}/ensayos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const ensayosData = await ensayosRes.json();
      setEnsayos(ensayosData.ensayos || []);

      // Cargar materiales
      const materialesRes = await fetch(`${API_URL}/portal/evento/${eventoId}/materiales`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const materialesData = await materialesRes.json();
      setMateriales(materialesData.materiales || []);
    } catch (err) {
      console.error('Error cargando detalles:', err);
    }
  };

  const confirmarAsistencia = async (asignacionId, estado) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${API_URL}/portal/asignacion/${asignacionId}/confirmar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ asignacion_id: asignacionId, estado })
      });

      if (!response.ok) throw new Error('Error al actualizar asistencia');

      // Recargar eventos
      await cargarMisEventos();
      alert(`Asistencia ${estado === 'confirmado' ? 'confirmada' : 'rechazada'} correctamente`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const seleccionarEvento = (asignacion) => {
    setEventoSeleccionado(asignacion);
    if (asignacion?.evento?.id) {
      cargarDetallesEvento(asignacion.evento.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Portal de Músicos</h1>
            <p className="text-sm text-slate-600 mt-1">
              {profile?.nombre} {profile?.apellidos} • {profile?.instrumento || 'Músico'}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {eventos.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              No tienes eventos asignados
            </h3>
            <p className="text-slate-500">
              Cuando el gestor te asigne a un evento, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de Eventos */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Mis Eventos</h2>
              {eventos.map((asignacion) => (
                <div
                  key={asignacion.id}
                  onClick={() => seleccionarEvento(asignacion)}
                  className={`p-4 bg-white rounded-lg shadow-sm border-2 cursor-pointer transition-all ${
                    eventoSeleccionado?.id === asignacion.id
                      ? 'border-slate-900'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <h3 className="font-semibold text-slate-900">{asignacion.evento?.nombre}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Temporada: {asignacion.evento?.temporada || 'N/A'}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      asignacion.estado === 'confirmado'
                        ? 'bg-green-100 text-green-800'
                        : asignacion.estado === 'rechazado'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {asignacion.estado === 'confirmado' && '✓ Confirmado'}
                      {asignacion.estado === 'rechazado' && '✗ Rechazado'}
                      {asignacion.estado === 'pendiente' && '⏳ Pendiente'}
                    </span>
                    {asignacion.importe > 0 && (
                      <span className="text-sm font-semibold text-slate-700">
                        {asignacion.importe}€
                      </span>
                    )}
                  </div>

                  {/* Botones de Confirmar/Rechazar */}
                  {asignacion.estado === 'pendiente' && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmarAsistencia(asignacion.id, 'confirmado');
                        }}
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        ✓ Confirmar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmarAsistencia(asignacion.id, 'rechazado');
                        }}
                        className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                      >
                        ✗ Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Detalles del Evento Seleccionado */}
            <div className="lg:col-span-2">
              {eventoSeleccionado ? (
                <div className="space-y-6">
                  {/* Información del Evento */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">
                      {eventoSeleccionado.evento?.nombre}
                    </h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">Temporada:</span>
                        <p className="font-medium text-slate-900">{eventoSeleccionado.evento?.temporada || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Estado:</span>
                        <p className="font-medium text-slate-900">{eventoSeleccionado.evento?.estado || 'N/A'}</p>
                      </div>
                      {eventoSeleccionado.evento?.descripcion && (
                        <div className="col-span-2">
                          <span className="text-slate-600">Descripción:</span>
                          <p className="font-medium text-slate-900 mt-1">{eventoSeleccionado.evento.descripcion}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ensayos */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">📅 Ensayos y Fechas</h3>
                    {ensayos.length === 0 ? (
                      <p className="text-slate-500 text-sm">No hay ensayos programados aún.</p>
                    ) : (
                      <div className="space-y-3">
                        {ensayos.map((ensayo) => (
                          <div
                            key={ensayo.id}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {new Date(ensayo.fecha).toLocaleDateString('es-ES', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              <p className="text-sm text-slate-600">{ensayo.hora} • {ensayo.tipo}</p>
                              {ensayo.lugar && <p className="text-xs text-slate-500 mt-1">{ensayo.lugar}</p>}
                            </div>
                            {ensayo.obligatorio && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                                Obligatorio
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Materiales */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">📄 Materiales y Partituras</h3>
                    {materiales.length === 0 ? (
                      <p className="text-slate-500 text-sm">No hay materiales disponibles.</p>
                    ) : (
                      <div className="space-y-2">
                        {materiales.map((material) => (
                          <a
                            key={material.id}
                            href={material.url_archivo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">📎</span>
                              <div>
                                <p className="font-medium text-slate-900">{material.nombre}</p>
                                <p className="text-xs text-slate-500">
                                  {material.tipo || 'Documento'}
                                </p>
                              </div>
                            </div>
                            <svg
                              className="w-5 h-5 text-slate-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-lg shadow-sm border border-slate-200 text-center">
                  <p className="text-slate-500">
                    Selecciona un evento de la lista para ver los detalles
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalDashboard;
