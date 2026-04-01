import React, { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
const EventForm = ({ event, onChange, onSave }) => {
  const [rehearsals, setRehearsals] = useState(event.rehearsals || []);
  const [program, setProgram] = useState(event.program || []);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InputField label="Nombre del evento" value={event.name} onChange={(v) => onChange({ ...event, name: v })} />
        <InputField label="Fecha principal" type="date" value={event.date} onChange={(v) => onChange({ ...event, date: v })} />
        <InputField label="Hora principal" type="time" value={event.time} onChange={(v) => onChange({ ...event, time: v })} />
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

      {/* Formulario de inscripción */}
      <SectionTitle color="purple">Formulario de Inscripción</SectionTitle>
      <InputField
        label="Enlace a Google Form"
        value={event.form_url}
        onChange={(v) => onChange({ ...event, form_url: v })}
        placeholder="https://docs.google.com/forms/..."
      />

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onSave}
          className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium"
          data-testid="save-event-btn"
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
};

// Main Component
const ConfiguracionEventos = () => {
  const [events, setEvents] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [openAccordions, setOpenAccordions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadEvents(selectedSeason);
    }
  }, [selectedSeason]);

  const loadData = async () => {
    try {
      const seasonsRes = await axios.get(`${API}/seasons`);
      setSeasons(seasonsRes.data);
      if (seasonsRes.data.length > 0) {
        setSelectedSeason(seasonsRes.data[0].id);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (seasonId) => {
    try {
      const eventsRes = await axios.get(`${API}/events?season_id=${seasonId}`);
      setEvents(eventsRes.data);
    } catch (err) {
      console.error("Error loading events:", err);
    }
  };

  const toggleAccordion = (id) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateEvent = (id, data) => {
    setEvents(events.map(e => e.id === id ? { ...e, ...data } : e));
  };

  const saveEvent = async (event) => {
    setSaving(true);
    try {
      await axios.put(`${API}/events/${event.id}`, event);
      alert('Evento guardado correctamente');
    } catch (err) {
      console.error("Error saving event:", err);
      alert('Error al guardar el evento');
    } finally {
      setSaving(false);
    }
  };

  const createNewEvent = async () => {
    if (!selectedSeason) return;
    try {
      const newEvent = {
        name: `Evento ${events.length + 1}`,
        date: new Date().toISOString().split('T')[0],
        time: '20:00',
        season_id: selectedSeason,
        rehearsals: [],
        instrumentation: {},
        program: [],
        form_url: ''
      };
      const response = await axios.post(`${API}/events`, newEvent);
      setEvents([...events, response.data]);
      setOpenAccordions({ ...openAccordions, [response.data.id]: true });
    } catch (err) {
      console.error("Error creating event:", err);
    }
  };

  const duplicateEvent = async (eventId) => {
    try {
      const response = await axios.post(`${API}/events/${eventId}/duplicate`);
      setEvents([...events, response.data]);
      setOpenAccordions({ ...openAccordions, [response.data.id]: true });
    } catch (err) {
      console.error("Error duplicating event:", err);
      alert("Error al duplicar el evento");
    }
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
            {seasons.map(season => (
              <option key={season.id} value={season.id}>{season.name}</option>
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
                subtitle={`${event.name || 'Sin nombre'} — ${event.date || 'Sin fecha'} ${event.time || ''}`}
                isOpen={openAccordions[event.id]}
                onToggle={() => toggleAccordion(event.id)}
              >
                <EventForm
                  event={event}
                  onChange={(data) => updateEvent(event.id, data)}
                  onSave={() => saveEvent(event)}
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
