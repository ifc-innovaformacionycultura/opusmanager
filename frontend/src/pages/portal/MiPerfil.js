// Portal Músico - Mi Perfil (Bloque 1)
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { supabase } from '../../lib/supabaseClient';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8001/api'
  : `${process.env.REACT_APP_BACKEND_URL}/api`;

async function authedFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
}

const SectionCard = ({ title, children, icon }) => (
  <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
      {icon && <span className="text-slate-600">{icon}</span>}
      <h3 className="font-semibold text-slate-900">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    {children}
  </div>
);

const MiPerfil = () => {
  const { profile, reloadProfile } = useAuth();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);
  const fotoInputRef = useRef(null);
  const cvInputRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setForm({
        nombre: profile.nombre || '',
        apellidos: profile.apellidos || '',
        telefono: profile.telefono || '',
        direccion: profile.direccion || '',
        dni: profile.dni || '',
        fecha_nacimiento: profile.fecha_nacimiento || '',
        nacionalidad: profile.nacionalidad || '',
        instrumento: profile.instrumento || '',
        otros_instrumentos: profile.otros_instrumentos || '',
        especialidad: profile.especialidad || '',
        anos_experiencia: profile.anos_experiencia || '',
        bio: profile.bio || '',
        titulaciones: Array.isArray(profile.titulaciones) ? profile.titulaciones : []
      });
    }
  }, [profile]);

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const addTitulacion = () => {
    setForm(prev => ({
      ...prev,
      titulaciones: [...(prev.titulaciones || []), { titulo: '', institucion: '', anio: '', descripcion: '', archivo_url: '', archivo_nombre: '' }]
    }));
  };
  const removeTitulacion = (idx) => {
    setForm(prev => ({ ...prev, titulaciones: prev.titulaciones.filter((_, i) => i !== idx) }));
  };
  const setTitulacionField = (idx, key, value) => {
    setForm(prev => {
      const copy = [...prev.titulaciones];
      copy[idx] = { ...copy[idx], [key]: value };
      return { ...prev, titulaciones: copy };
    });
  };

  const uploadTitulacionArchivo = async (idx, file) => {
    if (!file) return;
    setMessage(null); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authedFetch('/portal/mi-perfil/titulacion-archivo', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || 'Error al subir archivo');
      }
      const data = await res.json();
      setTitulacionField(idx, 'archivo_url', data.archivo_url);
      setTitulacionField(idx, 'archivo_nombre', data.filename || 'archivo.pdf');
      setMessage('Archivo de titulación subido. Recuerda pulsar "Guardar cambios".');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage(null); setError(null); setSaving(true);
    try {
      const payload = { ...form };
      // Normalize titulaciones: convert anio to int
      payload.titulaciones = (payload.titulaciones || []).map(t => ({
        titulo: t.titulo || '',
        institucion: t.institucion || null,
        anio: t.anio ? parseInt(t.anio, 10) : null,
        descripcion: t.descripcion || null,
        archivo_url: t.archivo_url || null,
        archivo_nombre: t.archivo_nombre || null
      })).filter(t => t.titulo);
      if (payload.anos_experiencia === '') delete payload.anos_experiencia;
      else if (payload.anos_experiencia != null) payload.anos_experiencia = parseInt(payload.anos_experiencia, 10);
      if (payload.fecha_nacimiento === '') delete payload.fecha_nacimiento;

      const res = await authedFetch('/portal/mi-perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || 'Error al guardar');
      }
      setMessage('Perfil actualizado correctamente');
      if (reloadProfile) await reloadProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null); setError(null); setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authedFetch('/portal/mi-perfil/foto', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || 'Error al subir foto');
      }
      setMessage('Foto actualizada');
      if (reloadProfile) await reloadProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null); setError(null); setUploadingCV(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authedFetch('/portal/mi-perfil/cv', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || 'Error al subir CV');
      }
      setMessage('CV subido correctamente');
      if (reloadProfile) await reloadProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingCV(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  const handleCVDelete = async () => {
    if (!window.confirm('¿Eliminar el CV actual?')) return;
    try {
      const res = await authedFetch('/portal/mi-perfil/cv', { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setMessage('CV eliminado');
      if (reloadProfile) await reloadProfile();
    } catch (err) { setError(err.message); }
  };

  const input = (k, props = {}) => (
    <input
      type="text"
      value={form[k] || ''}
      onChange={(e) => setField(k, e.target.value)}
      data-testid={`perfil-${k}`}
      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent"
      {...props}
    />
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="mi-perfil-page">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Mi Perfil</h2>
        <p className="text-sm text-slate-600 mt-1">Mantén tus datos al día para que el equipo gestor tenga siempre tu información correcta.</p>
      </div>

      {message && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm" data-testid="perfil-msg">{message}</div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm" data-testid="perfil-error">{error}</div>
      )}

      {/* Fotografía */}
      <SectionCard title="Fotografía" icon={<span>📸</span>}>
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
            {profile?.foto_url ? (
              <img src={profile.foto_url} alt="Foto de perfil" className="w-full h-full object-cover" data-testid="perfil-foto-preview" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-3xl">👤</div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFotoUpload}
              className="hidden"
              data-testid="perfil-foto-input"
            />
            <button
              onClick={() => fotoInputRef.current?.click()}
              disabled={uploadingFoto}
              data-testid="btn-subir-foto"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium disabled:opacity-60"
            >
              {uploadingFoto ? 'Subiendo...' : profile?.foto_url ? 'Cambiar foto' : 'Subir foto'}
            </button>
            <p className="text-xs text-slate-500 mt-2">JPG, PNG o WebP. Máx 2MB.</p>
          </div>
        </div>
      </SectionCard>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Datos Personales */}
        <SectionCard title="Datos personales" icon={<span>👤</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre">{input('nombre')}</Field>
            <Field label="Apellidos">{input('apellidos')}</Field>
            <Field label="Email (no editable)">
              <input type="email" value={profile?.email || ''} disabled className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm text-slate-600" />
            </Field>
            <Field label="Teléfono">{input('telefono', { type: 'tel' })}</Field>
            <Field label="Dirección">{input('direccion')}</Field>
            <Field label="DNI/NIF">{input('dni')}</Field>
            <Field label="Fecha de nacimiento">
              <input type="date" value={form.fecha_nacimiento || ''} onChange={(e) => setField('fecha_nacimiento', e.target.value)}
                data-testid="perfil-fecha_nacimiento"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </Field>
            <Field label="Nacionalidad">{input('nacionalidad')}</Field>
          </div>
        </SectionCard>

        {/* Datos Profesionales */}
        <SectionCard title="Datos profesionales" icon={<span>🎻</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Instrumento principal">{input('instrumento')}</Field>
            <Field label="Otros instrumentos">{input('otros_instrumentos', { placeholder: 'Ej: Viola, Violonchelo' })}</Field>
            <Field label="Especialidad/Categoría">{input('especialidad')}</Field>
            <Field label="Años de experiencia">
              <input type="number" min="0" value={form.anos_experiencia || ''} onChange={(e) => setField('anos_experiencia', e.target.value)}
                data-testid="perfil-anos_experiencia"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Biografía profesional">
                <textarea value={form.bio || ''} onChange={(e) => setField('bio', e.target.value)}
                  rows={4}
                  data-testid="perfil-bio"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Breve descripción de tu trayectoria..." />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* Titulaciones */}
        <SectionCard title="Formación y titulaciones" icon={<span>🎓</span>}>
          {(form.titulaciones || []).length === 0 && (
            <p className="text-sm text-slate-500 mb-3">Aún no has añadido ninguna titulación.</p>
          )}
          <div className="space-y-3">
            {(form.titulaciones || []).map((t, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50" data-testid={`titulacion-${idx}`}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <div className="md:col-span-5">
                    <input type="text" value={t.titulo || ''} onChange={(e) => setTitulacionField(idx, 'titulo', e.target.value)}
                      placeholder="Título"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white" />
                  </div>
                  <div className="md:col-span-4">
                    <input type="text" value={t.institucion || ''} onChange={(e) => setTitulacionField(idx, 'institucion', e.target.value)}
                      placeholder="Institución"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white" />
                  </div>
                  <div className="md:col-span-2">
                    <input type="number" value={t.anio || ''} onChange={(e) => setTitulacionField(idx, 'anio', e.target.value)}
                      placeholder="Año"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white" />
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeTitulacion(idx)}
                      data-testid={`btn-remove-titulacion-${idx}`}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm">
                      Eliminar
                    </button>
                  </div>
                  <div className="md:col-span-12">
                    <input type="text" value={t.descripcion || ''} onChange={(e) => setTitulacionField(idx, 'descripcion', e.target.value)}
                      placeholder="Descripción (opcional)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white" />
                  </div>
                  <div className="md:col-span-12 flex items-center gap-3 flex-wrap">
                    {t.archivo_url ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span>📎</span>
                        <a href={t.archivo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {t.archivo_nombre || 'Ver archivo'}
                        </a>
                        <button type="button"
                          onClick={() => { setTitulacionField(idx, 'archivo_url', ''); setTitulacionField(idx, 'archivo_nombre', ''); }}
                          className="text-xs text-red-600 hover:underline ml-2">
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <label className="text-xs px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded cursor-pointer inline-flex items-center gap-1"
                        data-testid={`btn-upload-titulacion-${idx}`}>
                        📎 Adjuntar PDF
                        <input type="file" accept="application/pdf"
                          onChange={(e) => uploadTitulacionArchivo(idx, e.target.files?.[0])}
                          className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addTitulacion}
            data-testid="btn-add-titulacion"
            className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium">
            + Añadir titulación
          </button>
        </SectionCard>

        {/* CV */}
        <SectionCard title="Currículum Vitae" icon={<span>📄</span>}>
          <div className="flex items-start gap-4">
            {profile?.cv_url ? (
              <div className="flex-1 flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-2xl">📎</span>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 text-sm">CV.pdf</p>
                  <a href={profile.cv_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline" data-testid="perfil-cv-link">Ver CV actual</a>
                </div>
                <button type="button" onClick={handleCVDelete} data-testid="btn-delete-cv"
                  className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Eliminar</button>
              </div>
            ) : (
              <p className="flex-1 text-sm text-slate-500">No has subido tu CV aún.</p>
            )}
            <input ref={cvInputRef} type="file" accept="application/pdf" onChange={handleCVUpload} className="hidden"
              data-testid="perfil-cv-input" />
            <button type="button" onClick={() => cvInputRef.current?.click()}
              disabled={uploadingCV}
              data-testid="btn-subir-cv"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium disabled:opacity-60">
              {uploadingCV ? 'Subiendo...' : profile?.cv_url ? 'Cambiar CV' : 'Subir CV'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Archivo PDF, máx 5MB.</p>
        </SectionCard>

        {/* Save */}
        <div className="flex justify-end sticky bottom-4">
          <button type="submit" disabled={saving}
            data-testid="btn-guardar-perfil"
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium shadow-lg disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MiPerfil;
