import React, { useState, useEffect } from "react";
import { useAuth as useGestorAuth } from "../contexts/AuthContext";
import ComentariosPanel from "../components/ComentariosPanel";

// Accordion Component
const Accordion = ({ title, subtitle, isOpen, onToggle, children }) => (
  <div className="border border-slate-200 rounded-lg mb-3 bg-white">
    <button
      onClick={onToggle}
      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      data-testid={`accordion-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="flex-1">
        <span className="font-medium text-slate-900">{title}</span>
        {subtitle && <span className="ml-4 text-sm text-slate-500">{subtitle}</span>}
      </div>
      <svg
        className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {isOpen && <div className="px-4 pb-4 border-t border-slate-100">{children}</div>}
  </div>
);

// Section Title
const SectionTitle = ({ children, color }) => {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500'
  };
  return (
    <div className="flex items-center gap-2 mb-3 mt-4">
      <div className={`w-1 h-5 ${colors[color] || 'bg-slate-500'} rounded`}></div>
      <h4 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{children}</h4>
    </div>
  );
};

// Input Field
const InputField = ({ label, value, onChange, type = "text", placeholder = "" }) => (
  <div className="mb-3">
    <label className="block text-sm text-slate-600 mb-1">{label}</label>
    <input
      type={type}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-300 focus:border-transparent"
    />
  </div>
);

// Number Input
const NumberInput = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm text-slate-600">{label}</span>
    <input
      type="number"
      min="0"
      value={value || 0}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
    />
  </div>
);

// Instrumentation Table
const InstrumentationSection = ({ instrumentation, onChange }) => {
  const updateSection = (section, field, value) => {
    onChange({
      ...instrumentation,
      [section]: { ...(instrumentation[section] || {}), [field]: value }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Cuerda */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">CUERDA</h5>
        <NumberInput label="Violines I" value={instrumentation?.cuerda?.violines_i} onChange={(v) => updateSection('cuerda', 'violines_i', v)} />
        <NumberInput label="Violines II" value={instrumentation?.cuerda?.violines_ii} onChange={(v) => updateSection('cuerda', 'violines_ii', v)} />
        <NumberInput label="Violas" value={instrumentation?.cuerda?.violas} onChange={(v) => updateSection('cuerda', 'violas', v)} />
        <NumberInput label="Violonchelos" value={instrumentation?.cuerda?.violonchelos} onChange={(v) => updateSection('cuerda', 'violonchelos', v)} />
        <NumberInput label="Contrabajos" value={instrumentation?.cuerda?.contrabajos} onChange={(v) => updateSection('cuerda', 'contrabajos', v)} />
      </div>

      {/* Viento Madera */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">VIENTO MADERA</h5>
        <NumberInput label="Flautas" value={instrumentation?.viento_madera?.flautas} onChange={(v) => updateSection('viento_madera', 'flautas', v)} />
        <NumberInput label="Oboes" value={instrumentation?.viento_madera?.oboes} onChange={(v) => updateSection('viento_madera', 'oboes', v)} />
        <NumberInput label="Clarinetes" value={instrumentation?.viento_madera?.clarinetes} onChange={(v) => updateSection('viento_madera', 'clarinetes', v)} />
        <NumberInput label="Fagotes" value={instrumentation?.viento_madera?.fagotes} onChange={(v) => updateSection('viento_madera', 'fagotes', v)} />
      </div>

      {/* Viento Metal */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">VIENTO METAL</h5>
        <NumberInput label="Trompetas" value={instrumentation?.viento_metal?.trompetas} onChange={(v) => updateSection('viento_metal', 'trompetas', v)} />
        <NumberInput label="Trompas" value={instrumentation?.viento_metal?.trompas} onChange={(v) => updateSection('viento_metal', 'trompas', v)} />
        <NumberInput label="Trombones" value={instrumentation?.viento_metal?.trombones} onChange={(v) => updateSection('viento_metal', 'trombones', v)} />
        <NumberInput label="Tubas" value={instrumentation?.viento_metal?.tubas} onChange={(v) => updateSection('viento_metal', 'tubas', v)} />
      </div>

      {/* Percusión */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">PERCUSIÓN</h5>
        <NumberInput label="Nº Percusionistas" value={instrumentation?.percusion?.num_percusionistas} onChange={(v) => updateSection('percusion', 'num_percusionistas', v)} />
        <div className="mt-2">
          <label className="text-sm text-slate-600">Instrumental requerido</label>
          <textarea
            value={instrumentation?.percusion?.instrumental || ''}
            onChange={(e) => updateSection('percusion', 'instrumental', e.target.value)}
            className="w-full px-2 py-1 border border-slate-200 rounded text-sm mt-1"
            rows="2"
          />
        </div>
      </div>

      {/* Coro */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">CORO</h5>
        <NumberInput label="Sopranos" value={instrumentation?.coro?.sopranos} onChange={(v) => updateSection('coro', 'sopranos', v)} />
        <NumberInput label="Contraltos" value={instrumentation?.coro?.contraltos} onChange={(v) => updateSection('coro', 'contraltos', v)} />
        <NumberInput label="Tenores" value={instrumentation?.coro?.tenores} onChange={(v) => updateSection('coro', 'tenores', v)} />
        <NumberInput label="Bajos" value={instrumentation?.coro?.bajos} onChange={(v) => updateSection('coro', 'bajos', v)} />
      </div>

      {/* Teclados */}
      <div className="border border-slate-200 rounded-lg p-3">
        <h5 className="font-medium text-slate-800 mb-2 text-sm">TECLADOS Y ARPAS</h5>
        <NumberInput label="Pianistas" value={instrumentation?.teclados?.pianistas} onChange={(v) => updateSection('teclados', 'pianistas', v)} />
        <NumberInput label="Organistas" value={instrumentation?.teclados?.organistas} onChange={(v) => updateSection('teclados', 'organistas', v)} />
        <NumberInput label="Clavecinistas" value={instrumentation?.teclados?.clavecinistas} onChange={(v) => updateSection('teclados', 'clavecinistas', v)} />
        <NumberInput label="Celestistas" value={instrumentation?.teclados?.celestistas} onChange={(v) => updateSection('teclados', 'celestistas', v)} />
        <NumberInput label="Arpistas" value={instrumentation?.teclados?.arpistas} onChange={(v) => updateSection('teclados', 'arpistas', v)} />
      </div>
    </div>
  );
};

// Event Form
const EventForm = ({ event, onChange, onSave, onDelete, canDelete }) => {
  const [rehearsals, setRehearsals] = useState(event.rehearsals || []);
  const [program, setProgram] = useState(event.program || []);
  const [fechasSecVisibles, setFechasSecVisibles] = useState(() => {
    // Mostrar tantos bloques como los rellenados + uno vacío (mínimo 0, máx 4)
    let count = 0;
    for (let i = 1; i <= 4; i++) {
      if (event[`fecha_secundaria_${i}`]) count = i;
    }
    return count;
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    setRehearsals(event.rehearsals || []);
    setProgram(event.program || []);
  }, [event]);

  const addRehearsal = () => {
    const newRehearsals = [...rehearsals, { date: '', start: '', end: '' }];
    setRehearsals(newRehearsals);
    onChange({ ...event, rehearsals: newRehearsals });
  };

  const updateRehearsal = (index, field, value) => {
    const newRehearsals = [...rehearsals];
    newRehearsals[index] = { ...newRehearsals[index], [field]: value };
    setRehearsals(newRehearsals);
    onChange({ ...event, rehearsals: newRehearsals });
  };

  const removeRehearsal = (index) => {
    const newRehearsals = rehearsals.filter((_, i) => i !== index);
    setRehearsals(newRehearsals);
    onChange({ ...event, rehearsals: newRehearsals });
  };

  const addProgramItem = () => {
    const newProgram = [...program, { duration: '', author: '', obra: '', observaciones: '' }];
    setProgram(newProgram);
    onChange({ ...event, program: newProgram });
  };

  const updateProgramItem = (index, field, value) => {
    const newProgram = [...program];
    newProgram[index] = { ...newProgram[index], [field]: value };
    setProgram(newProgram);
    onChange({ ...event, program: newProgram });
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Datos Generales */}
      <SectionTitle color="blue">Datos Generales</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          label="Nombre del evento"
          value={event.nombre}
          onChange={(v) => onChange({ ...event, nombre: v })}
        />
        <div className="mb-3">
          <label className="block text-sm text-slate-600 mb-1">Tipo</label>
          <select
            value={event.tipo || 'concierto'}
            onChange={(e) => onChange({ ...event, tipo: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            data-testid="event-tipo"
          >
            <option value="concierto">Concierto</option>
            <option value="ensayo">Ensayo</option>
            <option value="funcion">Función</option>
            <option value="gira">Gira</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <InputField
          label="Fecha de inicio"
          type="date"
          value={event.fecha_inicio ? String(event.fecha_inicio).slice(0, 10) : ''}
          onChange={(v) => onChange({ ...event, fecha_inicio: v })}
        />
        <InputField
          label="Fecha de fin"
          type="date"
          value={event.fecha_fin ? String(event.fecha_fin).slice(0, 10) : ''}
          onChange={(v) => onChange({ ...event, fecha_fin: v })}
        />
        <InputField
          label="Lugar"
          value={event.lugar}
          onChange={(v) => onChange({ ...event, lugar: v })}
          placeholder="Auditorio, sala..."
        />
        <div className="mb-3">
          <label className="block text-sm text-slate-600 mb-1">Estado</label>
          <select
            value={event.estado || 'borrador'}
            onChange={(e) => onChange({ ...event, estado: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            data-testid="event-estado"
          >
            <option value="borrador">Borrador (no visible para músicos)</option>
            <option value="abierto">Público (visible para músicos)</option>
            <option value="en_curso">En curso</option>
            <option value="cerrado">Cerrado</option>
            <option value="cancelado">Cancelado</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>
        <div className="md:col-span-2 mb-3">
          <label className="block text-sm text-slate-600 mb-1">Descripción</label>
          <textarea
            value={event.descripcion || ''}
            onChange={(e) => onChange({ ...event, descripcion: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            data-testid="event-descripcion"
          />
        </div>
        <div className="md:col-span-2 mb-3">
          <label className="block text-sm text-slate-600 mb-1">Notas internas</label>
          <textarea
            value={event.notas || ''}
            onChange={(e) => onChange({ ...event, notas: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            data-testid="event-notas"
          />
        </div>
      </div>

      {/* Ensayos */}
      <SectionTitle color="green">Ensayos</SectionTitle>
      <div className="space-y-2">
        {rehearsals.map((rehearsal, index) => (
          <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded">
            <span className="text-sm text-slate-500 w-20">Ensayo {index + 1}</span>
            <input
              type="date"
              value={rehearsal.date || ''}
              onChange={(e) => updateRehearsal(index, 'date', e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
            />
            <input
              type="time"
              value={rehearsal.start || ''}
              onChange={(e) => updateRehearsal(index, 'start', e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
              placeholder="Inicio"
            />
            <span className="text-slate-400">-</span>
            <input
              type="time"
              value={rehearsal.end || ''}
              onChange={(e) => updateRehearsal(index, 'end', e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-sm"
              placeholder="Fin"
            />
            <button
              onClick={() => removeRehearsal(index)}
              className="p-1 text-red-500 hover:bg-red-50 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
        <button
          onClick={addRehearsal}
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
          Añadir ensayo
        </button>
      </div>

      {/* Instrumentación */}
      <SectionTitle color="yellow">Propuesta de Plantilla</SectionTitle>
      <InstrumentationSection
        instrumentation={event.instrumentation || {}}
        onChange={(inst) => onChange({ ...event, instrumentation: inst })}
      />

      {/* Programa Musical */}
      <SectionTitle color="orange">Programa Musical</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3 py-2 text-left font-medium text-slate-600">Duración</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Autor</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Obra</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Observaciones</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {program.map((item, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="px-3 py-2">
                  <input
                    value={item.duration || ''}
                    onChange={(e) => updateProgramItem(index, 'duration', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                    placeholder="15'"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={item.author || ''}
                    onChange={(e) => updateProgramItem(index, 'author', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={item.obra || ''}
                    onChange={(e) => updateProgramItem(index, 'obra', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={item.observaciones || ''}
                    onChange={(e) => updateProgramItem(index, 'observaciones', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={addProgramItem}
          className="mt-2 text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
          Añadir obra
        </button>
      </div>

      {/* Fechas adicionales de función */}
      <SectionTitle color="blue">Fechas adicionales de función</SectionTitle>
      <p className="text-xs text-slate-500 -mt-2 mb-2">Añade hasta 4 fechas extra de función con su hora correspondiente.</p>
      <div className="space-y-2" data-testid="fechas-secundarias-wrapper">
        {[1, 2, 3, 4].slice(0, fechasSecVisibles).map((i) => {
          const fechaKey = `fecha_secundaria_${i}`;
          const horaKey = `hora_secundaria_${i}`;
          const fechaValue = event[fechaKey] ? String(event[fechaKey]).slice(0, 10) : '';
          return (
            <div key={i} className="flex items-center gap-2 bg-slate-50 p-2 rounded" data-testid={`fecha-secundaria-row-${i}`}>
              <span className="text-sm text-slate-500 w-20">Fecha {i}</span>
              <input
                type="date"
                value={fechaValue}
                onChange={(e) => onChange({ ...event, [fechaKey]: e.target.value })}
                className="px-2 py-1 border border-slate-200 rounded text-sm"
                data-testid={`input-fecha-sec-${i}`}
              />
              <input
                type="time"
                value={event[horaKey] || ''}
                onChange={(e) => onChange({ ...event, [horaKey]: e.target.value })}
                className="px-2 py-1 border border-slate-200 rounded text-sm"
                data-testid={`input-hora-sec-${i}`}
                placeholder="Hora"
              />
              <button
                type="button"
                onClick={() => {
                  // Vaciamos esta fecha y desplazamos el resto visualmente (simple: la dejamos vacía)
                  onChange({ ...event, [fechaKey]: null, [horaKey]: null });
                  if (i === fechasSecVisibles) setFechasSecVisibles(Math.max(0, fechasSecVisibles - 1));
                }}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
                title="Quitar fecha"
                data-testid={`btn-remove-fecha-sec-${i}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          );
        })}
        {fechasSecVisibles < 4 && (
          <button
            type="button"
            onClick={() => setFechasSecVisibles(fechasSecVisibles + 1)}
            className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
            data-testid="btn-add-fecha-secundaria"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
            Añadir fecha
          </button>
        )}
      </div>

      {/* Partituras y materiales por sección */}
      <SectionTitle color="yellow">Partituras y materiales por sección</SectionTitle>
      <p className="text-xs text-slate-500 -mt-2 mb-2">Pega un enlace (Google Drive, Dropbox...) para cada sección. Cada músico verá sólo el de su instrumento.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { key: 'partitura_cuerda',        label: 'Cuerda (violines, violas, cellos, contrabajos)' },
          { key: 'partitura_viento_madera', label: 'Viento madera (flauta, oboe, clarinete, fagot)' },
          { key: 'partitura_viento_metal',  label: 'Viento metal (trompa, trompeta, trombón, tuba)' },
          { key: 'partitura_percusion',     label: 'Percusión' },
          { key: 'partitura_coro',          label: 'Coro' },
          { key: 'partitura_teclados',      label: 'Teclados y piano' },
        ].map((f) => (
          <InputField
            key={f.key}
            label={f.label}
            value={event[f.key]}
            onChange={(v) => onChange({ ...event, [f.key]: v })}
            placeholder="https://drive.google.com/..."
          />
        ))}
      </div>

      {/* Notas para los músicos + información adicional */}
      <SectionTitle color="orange">Notas e información para músicos</SectionTitle>
      <div className="mb-3">
        <label className="block text-sm text-slate-600 mb-1">Notas para los músicos (visibles en el portal)</label>
        <textarea
          value={event.notas_musicos || ''}
          onChange={(e) => onChange({ ...event, notas_musicos: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-300 focus:border-transparent"
          data-testid="event-notas-musicos"
          placeholder="Indicaciones sobre vestuario, puntualidad, material a traer..."
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => {
          const key = `info_adicional_url_${i}`;
          return (
            <InputField
              key={key}
              label={`Enlace información adicional ${i}`}
              value={event[key]}
              onChange={(v) => onChange({ ...event, [key]: v })}
              placeholder="https://..."
            />
          );
        })}
      </div>

      {/* Formulario de inscripción */}
      <SectionTitle color="purple">Formulario de Inscripción</SectionTitle>
      <InputField
        label="Enlace a Google Form"
        value={event.form_url}
        onChange={(v) => onChange({ ...event, form_url: v })}
        placeholder="https://docs.google.com/forms/..."
      />

      {/* Notas internas del equipo */}
      {event.id && !String(event.id).startsWith('temp-') && (
        <div className="pt-2">
          <SectionTitle color="slate">Notas internas del equipo</SectionTitle>
          <ComentariosPanel tipo="evento" entidadId={event.id} title="Notas internas del evento" />
        </div>
      )}

      {/* Save Button + Eliminar evento (condicional) */}
      <div className="flex items-center justify-between pt-4 gap-3 flex-wrap">
        <div>
          {canDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
              data-testid="btn-eliminar-evento"
            >
              Eliminar evento
            </button>
          )}
        </div>
        <button
          onClick={onSave}
          className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium"
          data-testid="save-event-btn"
        >
          Guardar cambios
        </button>
      </div>

      {/* Modal confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="modal-eliminar-evento">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">¿Eliminar este evento?</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Esta acción eliminará el evento <strong>{event.nombre || ''}</strong> y TODOS sus datos asociados
                  (ensayos, asignaciones, materiales, presupuestos). Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium"
                data-testid="btn-cancelar-eliminar"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setShowDeleteModal(false);
                  if (onDelete) await onDelete(event.id);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium"
                data-testid="btn-confirmar-eliminar"
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Component
const ConfiguracionEventos = () => {
  const { api, user } = useGestorAuth();
  const [events, setEvents] = useState([]);
  const [temporadas, setTemporadas] = useState(['2024-2025', '2025-2026', '2026-2027']);
  const [selectedSeason, setSelectedSeason] = useState('2025-2026');
  const [openAccordions, setOpenAccordions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', text: string }

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  useEffect(() => {
    loadEvents(selectedSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason]);

  const loadEvents = async (temporada) => {
    try {
      setLoading(true);
      const url = temporada
        ? `/api/gestor/eventos?temporada=${encodeURIComponent(temporada)}`
        : '/api/gestor/eventos';
      console.log('[Eventos] GET', url);
      const response = await api.get(url);
      console.log('[Eventos] GET response:', response.data?.eventos?.length ?? 0, 'eventos');
      setEvents(response.data?.eventos || []);
    } catch (err) {
      console.error("[Eventos] Error loading events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccordion = (id) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateEvent = (id, data) => {
    setEvents(events.map(e => e.id === id ? { ...e, ...data } : e));
  };

  // Campos que acepta el backend (EventoUpdate / EventoCreate en routes_gestor.py).
  // Cualquier otro campo del form (rehearsals, program, instrumentation...) se
  // descarta: se gestiona en tablas independientes (ensayos, etc).
  const pickPayload = (event) => {
    const base = {
      nombre: event.nombre ?? null,
      temporada: event.temporada ?? null,
      descripcion: event.descripcion ?? null,
      fecha_inicio: event.fecha_inicio || null,
      fecha_fin: event.fecha_fin || null,
      estado: event.estado ?? null,
      tipo: event.tipo ?? null,
      lugar: event.lugar ?? null,
      notas: event.notas ?? null,
      notas_musicos: event.notas_musicos ?? null,
    };
    // Fechas secundarias (punto 2)
    for (let i = 1; i <= 4; i++) {
      base[`fecha_secundaria_${i}`] = event[`fecha_secundaria_${i}`] || null;
      base[`hora_secundaria_${i}`] = event[`hora_secundaria_${i}`] || null;
    }
    // Partituras (punto 3)
    ['cuerda','viento_madera','viento_metal','percusion','coro','teclados'].forEach(s => {
      const k = `partitura_${s}`;
      base[k] = event[k] ?? null;
    });
    // Info adicional (punto 4)
    for (let i = 1; i <= 3; i++) {
      const k = `info_adicional_url_${i}`;
      base[k] = event[k] ?? null;
    }
    return base;
  };

  const saveEvent = async (event) => {
    setSaving(true);
    try {
      const payload = pickPayload(event);
      // nombre es obligatorio en EventoCreate; validamos también en update
      if (!payload.nombre || !payload.nombre.trim()) {
        showFeedback('error', 'El nombre del evento es obligatorio');
        setSaving(false);
        return;
      }
      console.log('[Eventos] PUT /api/gestor/eventos/' + event.id, payload);
      const res = await api.put(`/api/gestor/eventos/${event.id}`, payload);
      console.log('[Eventos] PUT response:', res.data);
      showFeedback('success', 'Evento guardado correctamente');
      await loadEvents(selectedSeason);
    } catch (err) {
      console.error("[Eventos] Error saving event:", err, err.response?.data);
      showFeedback('error', `Error al guardar: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const createNewEvent = async () => {
    if (!selectedSeason) {
      showFeedback('error', 'Selecciona una temporada antes de crear un evento');
      return;
    }

    try {
      const newEvent = {
        nombre: `Nuevo Evento ${events.length + 1}`,
        temporada: selectedSeason,
        descripcion: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
        tipo: 'concierto',
      };
      console.log('[Eventos] POST /api/gestor/eventos', newEvent);
      const response = await api.post('/api/gestor/eventos', newEvent);
      console.log('[Eventos] POST response:', response.data);
      await loadEvents(selectedSeason);
      const createdId = response.data?.evento?.id;
      if (createdId) setOpenAccordions(prev => ({ ...prev, [createdId]: true }));
      showFeedback('success', 'Evento creado correctamente');
    } catch (err) {
      console.error("[Eventos] Error creating event:", err, err.response?.data);
      showFeedback('error', `Error al crear evento: ${err.response?.data?.detail || err.message}`);
    }
  };

  const duplicateEvent = async (eventId) => {
    try {
      const originalEvent = events.find(e => e.id === eventId);
      if (!originalEvent) return;

      const duplicatedPayload = {
        ...pickPayload(originalEvent),
        nombre: `${originalEvent.nombre || 'Evento'} (Copia)`,
      };
      console.log('[Eventos] POST (duplicate)', duplicatedPayload);
      await api.post('/api/gestor/eventos', duplicatedPayload);
      await loadEvents(selectedSeason);
      showFeedback('success', 'Evento duplicado correctamente');
    } catch (err) {
      console.error("[Eventos] Error duplicating event:", err, err.response?.data);
      showFeedback('error', `Error al duplicar: ${err.response?.data?.detail || err.message}`);
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      console.log('[Eventos] DELETE /api/gestor/eventos/' + eventId);
      await api.delete(`/api/gestor/eventos/${eventId}`);
      setOpenAccordions(prev => {
        const next = { ...prev }; delete next[eventId]; return next;
      });
      await loadEvents(selectedSeason);
      showFeedback('success', 'Evento eliminado correctamente');
    } catch (err) {
      console.error("[Eventos] Error deleting event:", err, err.response?.data);
      showFeedback('error', `Error al eliminar: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Puede eliminar el evento si es admin o el gestor que lo creó.
  const canDeleteEvent = (event) => {
    if (!user) return false;
    if (user.rol === 'admin') return true;
    const myProfileId = user.profile?.id;
    return Boolean(myProfileId && event.gestor_id && myProfileId === event.gestor_id);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="configuracion-eventos-page">
      {feedback && (
        <div
          data-testid="eventos-feedback"
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border max-w-sm text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <strong>{feedback.type === 'success' ? '✅ ' : '❌ '}</strong>{feedback.text}
        </div>
      )}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Configuración de Eventos</h1>
          <p className="font-ibm text-slate-600 mt-1">Define los eventos de la temporada</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedSeason || ''}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-md text-sm"
            data-testid="season-selector"
          >
            {temporadas.map(temp => (
              <option key={temp} value={temp}>{temp}</option>
            ))}
          </select>
          <button
            onClick={createNewEvent}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium flex items-center gap-2"
            data-testid="create-event-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
            Nuevo evento
          </button>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No hay eventos configurados para esta temporada</p>
          <button
            onClick={createNewEvent}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm"
          >
            Crear primer evento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => (
            <div key={event.id} className="relative">
              <Accordion
                title={`Evento ${index + 1}`}
                subtitle={`${event.nombre || 'Sin nombre'} — ${event.temporada || 'Sin temporada'} — ${event.estado || 'abierto'}`}
                isOpen={openAccordions[event.id]}
                onToggle={() => toggleAccordion(event.id)}
              >
                <EventForm
                  event={event}
                  onChange={(data) => updateEvent(event.id, data)}
                  onSave={() => saveEvent(event)}
                  onDelete={deleteEvent}
                  canDelete={canDeleteEvent(event)}
                />
              </Accordion>
              {/* Duplicate Button */}
              <button
                onClick={() => duplicateEvent(event.id)}
                className="absolute top-3 right-12 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium flex items-center gap-1.5"
                title="Duplicar evento"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Duplicar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


export default ConfiguracionEventos;
