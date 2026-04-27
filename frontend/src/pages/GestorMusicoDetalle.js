// Gestor: Ficha completa del músico
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ComentariosEquipoInline from '../components/ComentariosEquipoInline';

const estadoBadge = (e) => ({
  confirmado: 'bg-green-100 text-green-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  rechazado: 'bg-red-100 text-red-800'
})[e] || 'bg-slate-100 text-slate-700';

const pagoBadge = (e) => ({
  pagado: 'bg-green-100 text-green-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  enviado: 'bg-blue-100 text-blue-800',
  enviado_banco: 'bg-blue-100 text-blue-800'
})[e] || 'bg-slate-100 text-slate-700';

const GestorMusicoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/gestor/musicos/${id}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message);
      } finally { setLoading(false); }
    })();
  }, [api, id]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setDeleteError(null);
      await api.delete(`/api/gestor/musicos/${id}`);
      setShowDelete(false);
      navigate('/admin/musicos');
    } catch (err) {
      setDeleteError(err.response?.data?.detail || err.message);
    } finally { setDeleting(false); }
  };

  if (loading) return <div className="p-8 text-slate-500">Cargando...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return null;

  const m = data.musico;
  const titulaciones = Array.isArray(m.titulaciones) ? m.titulaciones : [];
  const recientemente = m.ultima_actualizacion_perfil &&
    (new Date() - new Date(m.ultima_actualizacion_perfil)) < 24 * 60 * 60 * 1000;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="gestor-musico-detalle">
      <div className="flex items-start justify-between gap-4">
        <button onClick={() => navigate('/admin/musicos')}
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1">
          ← Volver a la lista
        </button>
        <button
          onClick={() => setShowDelete(true)}
          data-testid="btn-eliminar-musico"
          className="px-3 py-1.5 text-sm text-red-700 border border-red-300 bg-white hover:bg-red-50 rounded-md font-medium"
        >
          Eliminar músico
        </button>
      </div>

      {showDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="modal-eliminar-musico">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">¿Eliminar este músico?</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Se eliminará <strong>{m.nombre} {m.apellidos}</strong> ({m.email}) del sistema y del sistema de autenticación.
                  Esta acción no se puede deshacer.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Si el músico tiene convocatorias confirmadas activas, la eliminación se bloqueará automáticamente.
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm" data-testid="delete-error">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDelete(false); setDeleteError(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium"
                data-testid="btn-cancelar-eliminar-musico"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium disabled:opacity-60"
                data-testid="btn-confirmar-eliminar-musico"
              >
                {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header con foto y datos básicos */}
      <div className="bg-white rounded-lg border border-slate-200 p-6"
           data-entidad-nombre={`${m.nombre || ''} ${m.apellidos || ''}`.trim()}
           data-entidad-tipo="musico"
           data-entidad-id={m.id || ''}>
        <div className="flex items-start gap-6">
          <div className="w-28 h-28 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
            {m.foto_url ? <img src={m.foto_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl text-slate-400">👤</div>}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{m.nombre} {m.apellidos}</h1>
              {recientemente && <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium" data-testid="badge-actualizado">Actualizado recientemente</span>}
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${m.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>{m.estado}</span>
            </div>
            <p className="text-slate-600 mt-1">{m.email}</p>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-500">Instrumento:</span> <span className="font-medium">{m.instrumento || '—'}</span></div>
              <div><span className="text-slate-500">Teléfono:</span> <span className="font-medium">{m.telefono || '—'}</span></div>
              <div><span className="text-slate-500">DNI/NIF:</span> <span className="font-medium">{m.dni || '—'}</span></div>
              <div><span className="text-slate-500">Nacionalidad:</span> <span className="font-medium">{m.nacionalidad || '—'}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Comentarios del equipo sobre este músico */}
      <ComentariosEquipoInline
        api={api}
        entidadTipo="musico"
        entidadId={m.id}
        entidadNombre={`${m.nombre || ''} ${m.apellidos || ''}`.trim()}
        pagina="/admin/musicos"
        seccion="Administración → Base de datos músicos"
      />

      {/* Datos personales/profesionales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Datos personales</h3>
          <dl className="text-sm space-y-2">
            <div><dt className="text-slate-500 inline">Dirección:</dt> <dd className="inline ml-1">{m.direccion || '—'}</dd></div>
            <div><dt className="text-slate-500 inline">Fecha nac.:</dt> <dd className="inline ml-1">{m.fecha_nacimiento ? new Date(m.fecha_nacimiento).toLocaleDateString('es-ES') : '—'}</dd></div>
            <div><dt className="text-slate-500 inline">IBAN:</dt> <dd className="inline ml-1 font-mono" data-testid="ficha-iban">{m.iban || '—'}</dd></div>
            <div><dt className="text-slate-500 inline">SWIFT:</dt> <dd className="inline ml-1 font-mono" data-testid="ficha-swift">{m.swift || '—'}</dd></div>
            <div><dt className="text-slate-500 inline">Alta:</dt> <dd className="inline ml-1">{m.fecha_alta ? new Date(m.fecha_alta).toLocaleDateString('es-ES') : '—'}</dd></div>
            <div><dt className="text-slate-500 inline">Últ. actualización perfil:</dt> <dd className="inline ml-1">{m.ultima_actualizacion_perfil ? new Date(m.ultima_actualizacion_perfil).toLocaleString('es-ES') : '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Datos profesionales</h3>
          <dl className="text-sm space-y-2">
            <div><dt className="text-slate-500 inline">Otros instrumentos:</dt> <dd className="inline ml-1">{m.otros_instrumentos || '—'}</dd></div>
            <div><dt className="text-slate-500 inline">Especialidad:</dt> <dd className="inline ml-1">{m.especialidad || '—'}</dd></div>
            <div><dt className="text-slate-500 inline">Años exp.:</dt> <dd className="inline ml-1">{m.anos_experiencia ?? '—'}</dd></div>
          </dl>
          {m.bio && <p className="mt-3 text-sm text-slate-700 italic border-t border-slate-100 pt-3">{m.bio}</p>}
        </div>
      </div>

      {/* Titulaciones + CV */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Formación y titulaciones</h3>
          {m.cv_url && (
            <a href={m.cv_url} target="_blank" rel="noopener noreferrer"
              data-testid="link-cv"
              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
              📎 Descargar CV
            </a>
          )}
        </div>
        {titulaciones.length === 0 ? (
          <p className="text-sm text-slate-500">Sin titulaciones registradas.</p>
        ) : (
          <ul className="space-y-2">
            {titulaciones.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md" data-testid={`titulacion-${i}`}>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{t.titulo}</p>
                  <p className="text-xs text-slate-600">
                    {t.institucion}{t.anio ? ` · ${t.anio}` : ''}
                  </p>
                  {t.descripcion && <p className="text-xs text-slate-500 mt-1">{t.descripcion}</p>}
                </div>
                {t.archivo_url && (
                  <a href={t.archivo_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex-shrink-0"
                    data-testid={`link-titulacion-${i}`}>
                    📎 PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totales pagos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs uppercase text-green-700 font-semibold">Total cobrado</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{data.total_cobrado.toFixed(2)}€</p>
        </div>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs uppercase text-amber-700 font-semibold">Pendiente de cobro</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{data.total_pendiente.toFixed(2)}€</p>
        </div>
      </div>

      {/* Historial de eventos */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Historial de eventos ({data.asignaciones.length})</h3>
        </div>
        {data.asignaciones.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Sin historial.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-xs text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Evento</th>
                <th className="px-4 py-2 text-left">Temporada</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Importe</th>
                <th className="px-4 py-2 text-left">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.asignaciones.map(a => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-medium">{a.evento?.nombre || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{a.evento?.temporada || '—'}</td>
                  <td className="px-4 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${estadoBadge(a.estado)}`}>{a.estado}</span></td>
                  <td className="px-4 py-2 text-right">{parseFloat(a.importe || 0).toFixed(2)}€</td>
                  <td className="px-4 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${pagoBadge(a.estado_pago)}`}>{a.estado_pago || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reclamaciones */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Reclamaciones ({data.reclamaciones.length})</h3>
          <Link to="/admin/reclamaciones" className="text-xs text-blue-600 hover:underline">Gestionar →</Link>
        </div>
        {data.reclamaciones.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Sin reclamaciones.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.reclamaciones.map(r => (
              <li key={r.id} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${estadoBadge(r.estado) || 'bg-slate-100 text-slate-700'}`}>{r.estado}</span>
                  <span className="text-xs text-slate-500 uppercase">{r.tipo?.replace('_',' ')}</span>
                  <span className="text-xs text-slate-400 ml-auto">{new Date(r.fecha_creacion).toLocaleDateString('es-ES')}</span>
                </div>
                <p className="text-sm text-slate-700">{r.descripcion}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GestorMusicoDetalle;
