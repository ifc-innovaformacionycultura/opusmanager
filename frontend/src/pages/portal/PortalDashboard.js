// Portal de Músicos - Dashboard Principal
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser, getUserProfile, signOut } from '../../lib/supabaseClient';

const PortalDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        navigate('/portal/login');
        return;
      }

      setUser(currentUser);
      const userProfile = await getUserProfile(currentUser.id);
      
      if (!userProfile) {
        console.error('Perfil no encontrado');
        navigate('/portal/login');
        return;
      }

      setProfile(userProfile);

      // Cargar asignaciones del músico
      const { data: asignacionesData, error } = await supabase
        .from('asignaciones')
        .select(`
          *,
          evento:eventos(*)
        `)
        .eq('usuario_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setAsignaciones(asignacionesData || []);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/portal/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">🎵</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Portal de Músicos</h1>
                <p className="text-sm text-slate-600">OPUS MANAGER</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Bienvenida */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
          <h2 className="text-3xl font-bold mb-2">
            ¡Hola, {profile?.nombre}! 👋
          </h2>
          <p className="text-blue-100">
            {profile?.instrumento && `${profile.instrumento} • `}
            {profile?.email}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-medium">Eventos Asignados</h3>
              <span className="text-2xl">📅</span>
            </div>
            <p className="text-3xl font-bold text-slate-800">{asignaciones.length}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-medium">Pendientes</h3>
              <span className="text-2xl">⏳</span>
            </div>
            <p className="text-3xl font-bold text-amber-600">
              {asignaciones.filter(a => a.estado === 'pendiente').length}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-600 font-medium">Confirmados</h3>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {asignaciones.filter(a => a.estado === 'confirmado').length}
            </p>
          </div>
        </div>

        {/* Eventos Asignados */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">Mis Eventos</h3>
          </div>

          {asignaciones.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500 mb-2">No tienes eventos asignados aún</p>
              <p className="text-sm text-slate-400">Los gestores te asignarán eventos próximamente</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {asignaciones.map((asignacion) => (
                <div key={asignacion.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-slate-800 mb-2">
                        {asignacion.evento?.nombre || 'Sin nombre'}
                      </h4>
                      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                        {asignacion.evento?.temporada && (
                          <span className="flex items-center gap-1">
                            📆 {asignacion.evento.temporada}
                          </span>
                        )}
                        {asignacion.evento?.lugar && (
                          <span className="flex items-center gap-1">
                            📍 {asignacion.evento.lugar}
                          </span>
                        )}
                        {asignacion.importe > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-green-600">
                            💰 {asignacion.importe}€
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4">
                      {asignacion.estado === 'pendiente' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          ⏳ Pendiente
                        </span>
                      )}
                      {asignacion.estado === 'confirmado' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✅ Confirmado
                        </span>
                      )}
                      {asignacion.estado === 'rechazado' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ❌ Rechazado
                        </span>
                      )}
                    </div>
                  </div>

                  {asignacion.comentarios && (
                    <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                      💬 {asignacion.comentarios}
                    </p>
                  )}

                  {asignacion.estado === 'pendiente' && (
                    <div className="mt-4 flex gap-3">
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                        ✅ Confirmar asistencia
                      </button>
                      <button className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium">
                        ❌ Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PortalDashboard;
