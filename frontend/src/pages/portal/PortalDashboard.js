// Portal Dashboard - Músicos
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { supabase } from '../../lib/supabaseClient';
import CambiarPasswordPrimeraVez from './CambiarPasswordPrimeraVez';
import PortalCalendar from './PortalCalendar';
import MiPerfil from './MiPerfil';
import MiHistorial from './MiHistorial';
import MiDisponibilidadPanel from './MiDisponibilidadPanel';
import { computeProfileCompleteness } from '../../lib/profileCompleteness';

const PortalDashboard = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  // Estado local para controlar si se requiere cambio de password
  const [requiereCambio, setRequiereCambio] = useState(profile?.requiere_cambio_password === true);

  const [vista, setVista] = useState('eventos'); // 'eventos' | 'calendario' | 'perfil' | 'historial'
  const [showBanner, setShowBanner] = useState(true);
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

  // Actualizar estado cuando el profile cambie
  useEffect(() => {
    setRequiereCambio(profile?.requiere_cambio_password === true);
  }, [profile]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (user.rol !== 'musico') {
      navigate('/');
      return;
    }

    // Solo cargar eventos si no requiere cambio de password y estamos en pestaña eventos
    if (!requiereCambio && vista === 'eventos') {
      cargarMisEventos();
    } else if (!requiereCambio) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate, requiereCambio, vista]);

  const cargarMisEventos = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/portal/mis-eventos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Error al cargar eventos');

      const data = await response.json();
      const asigs = data.asignaciones || [];
      setEventos(asigs);
      // Si hay un evento seleccionado, reemplazar su referencia con la nueva
      if (eventoSeleccionado) {
        const fresh = asigs.find(a => a.id === eventoSeleccionado.id);
        if (fresh) setEventoSeleccionado(fresh);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
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

  // Render condicional DESPUÉS de todos los hooks
  if (requiereCambio) {
    return (
      <CambiarPasswordPrimeraVez
        onPasswordChanged={() => {
          console.log('✅ Password cambiada, actualizando estado local');
          setRequiereCambio(false);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header estilo gestor — slate-900 con acentos purple */}
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {/* Foto de perfil */}
            <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 border-2 border-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {profile?.foto_url ? (
                <img src={profile.foto_url} alt={profile.nombre || 'perfil'} className="w-full h-full object-cover" />
              ) : (
                <span>{((profile?.nombre || '')[0] || '') + ((profile?.apellidos || '')[0] || '')}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-cabinet text-lg sm:text-xl font-bold text-white truncate">
                {profile?.nombre} {profile?.apellidos}
              </h1>
              <p className="text-xs text-slate-300 font-ibm">
                <span className="text-purple-300 font-medium">Portal de músicos</span>
                {profile?.instrumento ? ` · ${profile.instrumento}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            data-testid="portal-logout-btn"
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-md transition-colors"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Tabs con acento purple-500 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 border-t border-slate-800">
          <nav className="flex gap-6 -mb-px overflow-x-auto">
            <button
              onClick={() => setVista('eventos')}
              data-testid="tab-eventos"
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                vista === 'eventos'
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              🎵 Convocatorias
            </button>
            <button
              onClick={() => setVista('calendario')}
              data-testid="tab-calendario"
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                vista === 'calendario'
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              📅 Calendario
            </button>
            <button
              onClick={() => setVista('perfil')}
              data-testid="tab-perfil"
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                vista === 'perfil'
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              👤 Mi Perfil
            </button>
            <button
              onClick={() => setVista('historial')}
              data-testid="tab-historial"
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                vista === 'historial'
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              📋 Mi Historial
            </button>
          </nav>
        </div>
      </header>

      {/* Banner inteligente: sólo se muestra si faltan datos obligatorios */}
      {showBanner && (() => {
        const { missingRequired, percentage } = computeProfileCompleteness(profile);
        if (missingRequired.length === 0) return null;
        const preview = missingRequired.slice(0, 3).map((f) => f.label).join(', ');
        const extra = missingRequired.length - 3;
        return (
          <div className="bg-amber-50 border-b border-amber-200" data-testid="perfil-banner">
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-900">
                  <strong>Tu perfil está al {percentage}%.</strong> Faltan datos obligatorios:{' '}
                  <span className="font-medium">{preview}{extra > 0 ? ` y ${extra} más` : ''}</span>.{' '}
                  Completa tu ficha en{' '}
                  <button
                    onClick={() => { setVista('perfil'); }}
                    className="underline font-medium hover:text-amber-700"
                    data-testid="banner-link-perfil"
                  >
                    Mi Perfil
                  </button>
                  {' '}para que el equipo gestor tenga siempre tu información correcta.
                </p>
              </div>
              <button
                onClick={() => setShowBanner(false)}
                data-testid="banner-close"
                className="text-amber-700 hover:text-amber-900 p-1 flex-shrink-0"
                aria-label="Cerrar aviso"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        );
      })()}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {vista === 'calendario' ? (
          <PortalCalendar />
        ) : vista === 'perfil' ? (
          <MiPerfil />
        ) : vista === 'historial' ? (
          <MiHistorial />
        ) : eventos.length === 0 ? (
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
                  data-testid={`evento-card-${asignacion.id}`}
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

                  {/* Indicador de compañeros confirmados */}
                  {typeof asignacion.companeros_confirmados === 'number' && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span data-testid={`companeros-confirmados-${asignacion.id}`}>
                        {asignacion.companeros_confirmados} {asignacion.companeros_confirmados === 1 ? 'compañero confirmado' : 'compañeros confirmados'}
                        {typeof asignacion.companeros_total === 'number' && ` / ${asignacion.companeros_total}`}
                      </span>
                    </div>
                  )}

                  {/* Botones de Confirmar/Rechazar */}
                  {asignacion.estado === 'pendiente' && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmarAsistencia(asignacion.id, 'confirmado');
                        }}
                        data-testid={`btn-confirmar-${asignacion.id}`}
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        ✓ Confirmar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmarAsistencia(asignacion.id, 'rechazado');
                        }}
                        data-testid={`btn-rechazar-${asignacion.id}`}
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

                  {/* Fechas y Mi disponibilidad — tabla unificada basada en ensayos */}
                  {(eventoSeleccionado.ensayos || []).length > 0 && (
                    <MiDisponibilidadPanel
                      ensayos={eventoSeleccionado.ensayos || []}
                      onSaved={() => cargarMisEventos(true)}
                    />
                  )}

                  {/* Notas para los músicos */}
                  {eventoSeleccionado.evento?.notas_musicos && (
                    <div className="bg-blue-50 p-6 rounded-lg border border-blue-200" data-testid="notas-musicos-block">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">📝 Notas del equipo gestor</h3>
                      <p className="text-sm text-blue-900 whitespace-pre-wrap">{eventoSeleccionado.evento.notas_musicos}</p>
                    </div>
                  )}

                  {/* Partitura específica del instrumento del músico */}
                  {eventoSeleccionado.partitura_url && (
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200" data-testid="partitura-block">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">🎼 Partitura de tu sección</h3>
                      <p className="text-xs text-slate-500 mb-3">
                        {profile?.instrumento ? `Partitura para ${profile.instrumento}` : 'Partitura de tu sección instrumental'}
                      </p>
                      <a
                        href={eventoSeleccionado.partitura_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium"
                        data-testid="btn-abrir-partitura"
                      >
                        <span>📎</span> Abrir partitura
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                      </a>
                    </div>
                  )}

                  {/* Información adicional (hasta 3 enlaces) */}
                  {(() => {
                    const ev = eventoSeleccionado.evento || {};
                    const urls = [ev.info_adicional_url_1, ev.info_adicional_url_2, ev.info_adicional_url_3]
                      .filter(Boolean);
                    if (urls.length === 0) return null;
                    return (
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200" data-testid="info-adicional-block">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">🔗 Información adicional</h3>
                        <div className="space-y-2">
                          {urls.map((u, i) => (
                            <a
                              key={i}
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`info-adicional-link-${i + 1}`}
                              className="flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-sm text-blue-700 hover:underline"
                            >
                              <span>🔗</span>
                              <span className="truncate">{u}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Ensayos — reemplazado por la tabla unificada MiDisponibilidadPanel arriba */}

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
