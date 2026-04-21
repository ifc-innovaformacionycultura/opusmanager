// Cálculo de completitud del perfil del músico.
// Fuente única de verdad para el banner del portal y la barra de Mi Perfil.

const REQUIRED_FIELDS = [
  { key: 'nombre',     label: 'Nombre' },
  { key: 'apellidos',  label: 'Apellidos' },
  { key: 'telefono',   label: 'Teléfono' },
  { key: 'instrumento', label: 'Instrumento principal' },
  { key: 'dni',        label: 'DNI/NIF' },
  { key: 'direccion',  label: 'Dirección' },
  { key: 'foto_url',   label: 'Fotografía' }
];

const OPTIONAL_FIELDS = [
  { key: 'bio',               label: 'Biografía profesional' },
  { key: 'cv_url',            label: 'Currículum (CV)' },
  { key: 'otros_instrumentos', label: 'Otros instrumentos' },
  { key: 'fecha_nacimiento',  label: 'Fecha de nacimiento' },
  { key: 'nacionalidad',      label: 'Nacionalidad' },
  { key: 'especialidad',      label: 'Especialidad / categoría' },
  { key: 'titulaciones',      label: 'Titulaciones', isArray: true }
];

const isFilled = (profile, field) => {
  const v = profile?.[field.key];
  if (field.isArray) return Array.isArray(v) && v.length > 0;
  return typeof v === 'string' ? v.trim() !== '' : v != null && v !== '';
};

export function computeProfileCompleteness(profile) {
  if (!profile) {
    return { percentage: 0, missingRequired: REQUIRED_FIELDS, missingOptional: OPTIONAL_FIELDS, complete: false };
  }
  const missingRequired = REQUIRED_FIELDS.filter((f) => !isFilled(profile, f));
  const missingOptional = OPTIONAL_FIELDS.filter((f) => !isFilled(profile, f));
  const total = REQUIRED_FIELDS.length + OPTIONAL_FIELDS.length;
  const filled = total - missingRequired.length - missingOptional.length;
  const percentage = Math.round((filled / total) * 100);
  return {
    percentage,
    missingRequired,
    missingOptional,
    complete: missingRequired.length === 0
  };
}

export const PROFILE_REQUIRED_FIELDS = REQUIRED_FIELDS;
export const PROFILE_OPTIONAL_FIELDS = OPTIONAL_FIELDS;
