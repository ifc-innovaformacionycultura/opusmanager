import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Availability color helper
const getAvailabilityColor = (percentage) => {
  if (percentage <= 30) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
  if (percentage <= 60) return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
  if (percentage <= 80) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' };
  return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
};

// Communications Panel (same as SeguimientoConvocatorias)
const CommunicationsPanel = ({ isOpen, onClose, selectedContacts, templates }) => {
  const [selectedTemplates, setSelectedTemplates] = useState({});
  const [sending, setSending] = useState(false);

  const toggleTemplate = (templateId) => {
    setSelectedTemplates(prev => ({ ...prev, [templateId]: !prev[templateId] }));
  };

  const handleSend = async () => {
    if (selectedContacts.length === 0) {
      alert('Selecciona al menos un contacto');
      return;
    }
    const selected = Object.keys(selectedTemplates).filter(k => selectedTemplates[k]);
    if (selected.length === 0) {
      alert('Selecciona al menos una plantilla');
      return;
    }
    setSending(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    alert(`Comunicaciones enviadas a ${selectedContacts.length} contactos`);
    setSending(false);
    setSelectedTemplates({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-lg z-50 flex flex-col" data-testid="communications-panel-plantillas">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Comunicaciones</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        <p className="text-sm text-slate-600 mb-4">
          {selectedContacts.length} contacto(s) seleccionado(s)
        </p>
        
        <div className="space-y-3">
          {templates.map(template => (
            <label key={template.id || template.type} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTemplates[template.type] || false}
                onChange={() => toggleTemplate(template.type)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300"
              />
              <div>
                <span className="text-sm font-medium text-slate-900">
                  {template.type === 'convocatoria_temporada' && 'Convocatoria de temporada'}
                  {template.type === 'convocatoria_individual' && 'Convocatoria individual'}
                  {template.type === 'envio_partituras' && 'Envío de partituras'}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>
      
      <div className="p-4 border-t border-slate-200">
        <button
          onClick={handleSend}
          disabled={sending || selectedContacts.length === 0}
          className="w-full py-2 px-4 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
        >
          {sending ? 'Enviando...' : 'Enviar comunicaciones'}
        </button>
      </div>
    </div>
  );
};

// Instrument sections
const INSTRUMENT_SECTIONS = [
  { id: 'cuerda', name: 'Cuerda', instruments: ['Violín', 'Viola', 'Violonchelo', 'Contrabajo'] },
  { id: 'viento_madera', name: 'Viento Madera', instruments: ['Flauta', 'Oboe', 'Clarinete', 'Fagot'] },
  { id: 'viento_metal', name: 'Viento Metal', instruments: ['Trompeta', 'Trompa', 'Trombón', 'Tuba'] },
  { id: 'percusion', name: 'Percusión', instruments: ['Percusión', 'Timbales'] },
  { id: 'teclados', name: 'Teclados', instruments: ['Piano', 'Órgano', 'Clave', 'Celesta'] },
  { id: 'coralistas', name: 'Coralistas', instruments: ['Soprano', 'Contralto', 'Tenor', 'Bajo'] },
  { id: 'otros', name: 'Otros', instruments: ['Arpa', 'Guitarra', 'Solista'] }
];

// Helper function to get section ID from instrument
const getSectionFromInstrument = (instrument) => {
  if (!instrument) return 'otros';
  
  const section = INSTRUMENT_SECTIONS.find(s => 
    s.instruments.some(inst => 
      instrument.toLowerCase().includes(inst.toLowerCase())
    )
  );
  
  return section ? section.id : 'otros';
};

// Helper function to calculate cache from budget data
const calculateCacheFromBudget = (budgetData, sectionId, studyLevel, eventId, attendancePercentage) => {
  if (!budgetData || !budgetData[sectionId]) {
    return 100; // Fallback to base cache if no budget data
  }
  
  // Default to 'superior_finalizado' if no study level specified
  const level = studyLevel || 'superior_finalizado';
  
  const budgetCell = budgetData[sectionId]?.[level]?.[eventId];
  
  if (!budgetCell) {
    return 100; // Fallback if no budget configured
  }
  
  // Formula: cache_total × (weight / 100) × (attendance / 100)
  const cacheTotal = budgetCell.cache_total || 0;
  const weight = budgetCell.weight || 100;
  const finalCache = cacheTotal * (weight / 100) * (attendancePercentage / 100);
  
  return Math.round(finalCache);
};

// Contact Row Component
const ContactRow = ({ contact, event, eventResponses, contactData, onDataChange, isSelected, onSelect, budgetData }) => {
  const data = contactData || {
    atril_numero: '',
    atril_letra: '',
    atril_comentarios: '',
    asistencia_real: {},
    cache_extra: 0,
    cache_extra_comentario: ''
  };

  // Calculate attendance percentages
  const responses = eventResponses.find(r => r.contact_id === contact.id)?.responses || {};
  const totalDates = Object.keys(responses).length || 1;
  const previstoYes = Object.values(responses).filter(v => v === 'si').length;
  const previstoPct = Math.round((previstoYes / totalDates) * 100);
  
  const realValues = Object.values(data.asistencia_real || {});
  const realPct = realValues.length > 0 
    ? Math.round(realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length)
    : 0;

  // Calculate cache using budget data
  const sectionId = getSectionFromInstrument(contact.especialidad);
  const studyLevel = contact.nivel_estudios || 'superior_finalizado'; // Default if not specified
  
  const cachePrevisto = calculateCacheFromBudget(budgetData, sectionId, studyLevel, event.id, previstoPct);
  const cacheReal = calculateCacheFromBudget(budgetData, sectionId, studyLevel, event.id, realPct);

  const previstoColors = getAvailabilityColor(previstoPct);
  const realColors = getAvailabilityColor(realPct);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      {/* Checkbox */}
      <td className="px-2 py-2 sticky left-0 bg-white">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(contact.id)}
          className="w-4 h-4 rounded border-slate-300"
        />
      </td>

      {/* Personal Data */}
      <td className="px-3 py-2 text-sm">{contact.apellidos}</td>
      <td className="px-3 py-2 text-sm">{contact.nombre}</td>
      <td className="px-3 py-2 text-sm">{contact.especialidad}</td>
      <td className="px-3 py-2 text-sm">{contact.categoria}</td>

      {/* Atril Assignment */}
      <td className="px-2 py-2">
        <input
          type="number"
          value={data.atril_numero}
          onChange={(e) => onDataChange(contact.id, 'atril_numero', e.target.value)}
          className="w-12 px-1 py-1 border border-slate-200 rounded text-xs text-center"
          placeholder="Nº"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={data.atril_letra}
          onChange={(e) => onDataChange(contact.id, 'atril_letra', e.target.value)}
          className="w-10 px-1 py-1 border border-slate-200 rounded text-xs text-center uppercase"
          placeholder="A/B"
          maxLength={1}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={data.atril_comentarios}
          onChange={(e) => onDataChange(contact.id, 'atril_comentarios', e.target.value)}
          className="w-24 px-1 py-1 border border-slate-200 rounded text-xs"
          placeholder="Comentario"
        />
      </td>

      {/* Attendance per rehearsal/function */}
      {Object.entries(responses).map(([key, value]) => (
        <React.Fragment key={key}>
          <td className="px-2 py-2 text-center">
            <span className={`px-2 py-1 rounded text-xs ${value === 'si' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {value === 'si' ? 'Sí' : 'No'}
            </span>
          </td>
          <td className="px-2 py-2">
            <input
              type="number"
              min="0"
              max="100"
              value={data.asistencia_real?.[key] || ''}
              onChange={(e) => onDataChange(contact.id, `asistencia_real.${key}`, e.target.value)}
              className="w-14 px-1 py-1 border border-slate-200 rounded text-xs text-center"
              placeholder="%"
            />
          </td>
        </React.Fragment>
      ))}

      {/* Attendance Percentages */}
      <td className="px-2 py-2 text-center">
        <span className={`inline-flex px-2 py-1 rounded text-xs font-mono ${previstoColors.bg} ${previstoColors.text} border ${previstoColors.border}`}>
          {previstoPct}%
        </span>
      </td>
      <td className="px-2 py-2 text-center">
        <span className={`inline-flex px-2 py-1 rounded text-xs font-mono ${realColors.bg} ${realColors.text} border ${realColors.border}`}>
          {realPct}%
        </span>
      </td>

      {/* Cache */}
      <td className="px-2 py-2 text-center font-mono text-sm">{cachePrevisto}€</td>
      <td className="px-2 py-2 text-center font-mono text-sm font-medium">{cacheReal}€</td>
      <td className="px-2 py-2">
        <input
          type="number"
          min="0"
          value={data.cache_extra || ''}
          onChange={(e) => onDataChange(contact.id, 'cache_extra', e.target.value)}
          className="w-16 px-1 py-1 border border-slate-200 rounded text-xs text-center"
          placeholder="€"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={data.cache_extra_comentario || ''}
          onChange={(e) => onDataChange(contact.id, 'cache_extra_comentario', e.target.value)}
          className="w-28 px-1 py-1 border border-slate-200 rounded text-xs"
          placeholder="Motivo extra"
          required={parseFloat(data.cache_extra) > 0}
        />
      </td>
    </tr>
  );
};

// Section Component
const InstrumentSection = ({ section, contacts, event, eventResponses, contactsData, onDataChange, selectedContacts, onSelectContact, isExpanded, onToggle, budgetData }) => {
  const sectionContacts = contacts.filter(c => 
    section.instruments.some(inst => 
      c.especialidad?.toLowerCase().includes(inst.toLowerCase())
    )
  );

  if (sectionContacts.length === 0) return null;

  // Get response keys for headers
  const sampleResponse = eventResponses[0]?.responses || {};
  const responseKeys = Object.keys(sampleResponse);

  return (
    <div className="border-l-2 border-slate-300 ml-4">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 transition-colors text-left"
      >
        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7"/>
        </svg>
        <span className="font-medium text-slate-700">{section.name}</span>
        <span className="text-xs text-slate-500">({sectionContacts.length} contactos)</span>
      </button>
      
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs">
                <th className="px-2 py-2 sticky left-0 bg-slate-50"></th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Apellidos</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Nombre</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Instrumento</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Categoría</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600" title="Número de atril">Nº</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600" title="Letra de atril">Letra</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">Comentario</th>
                {responseKeys.map(key => (
                  <React.Fragment key={key}>
                    <th className="px-2 py-2 text-center font-medium text-slate-600 bg-blue-50" title={`${key} - Prevista`}>
                      <div className="text-xs">{key.replace('_', ' ')}</div>
                      <div className="text-[10px] text-slate-400">Prev.</div>
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-slate-600 bg-green-50" title={`${key} - Real`}>
                      <div className="text-xs">{key.replace('_', ' ')}</div>
                      <div className="text-[10px] text-slate-400">Real %</div>
                    </th>
                  </React.Fragment>
                ))}
                <th className="px-2 py-2 text-center font-medium text-slate-600">% Prev.</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">% Real</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">Caché Prev.</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">Caché Real</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">Extra €</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {sectionContacts.map(contact => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  event={event}
                  eventResponses={eventResponses}
                  contactData={contactsData[contact.id]}
                  onDataChange={onDataChange}
                  isSelected={selectedContacts.includes(contact.id)}
                  onSelect={onSelectContact}
                  budgetData={budgetData}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Event Accordion Component
const EventAccordion = ({ event, index, contacts, eventResponses, contactsData, onDataChange, selectedContacts, onSelectContact, isExpanded, onToggle, budgetData }) => {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Calculate event totals using budget data
  const eventContacts = contacts;
  let totalCachePrevisto = 0;
  let totalCacheReal = 0;
  let totalCacheExtra = 0;

  eventContacts.forEach(contact => {
    const responses = eventResponses.find(r => r.contact_id === contact.id)?.responses || {};
    const totalDates = Object.keys(responses).length || 1;
    const previstoYes = Object.values(responses).filter(v => v === 'si').length;
    const previstoPct = Math.round((previstoYes / totalDates) * 100);
    
    const data = contactsData[contact.id] || {};
    const realValues = Object.values(data.asistencia_real || {});
    const realPct = realValues.length > 0 
      ? Math.round(realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length)
      : 0;

    const sectionId = getSectionFromInstrument(contact.especialidad);
    const studyLevel = contact.nivel_estudios || 'superior_finalizado';
    
    totalCachePrevisto += calculateCacheFromBudget(budgetData, sectionId, studyLevel, event.id, previstoPct);
    totalCacheReal += calculateCacheFromBudget(budgetData, sectionId, studyLevel, event.id, realPct);
    totalCacheExtra += parseFloat(data.cache_extra) || 0;
  });

  return (
    <div className="border border-slate-200 rounded-lg mb-4 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        data-testid={`event-accordion-${event.id}`}
      >
        <div className="flex items-center gap-3">
          <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7"/>
          </svg>
          <span className="font-semibold">Evento {index + 1}</span>
          <span className="text-slate-300">—</span>
          <span>{event.name}</span>
          <span className="text-slate-400 text-sm">({event.date})</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-slate-300">
            <span className="text-slate-400">Prev:</span> {Math.round(totalCachePrevisto)}€
          </div>
          <div className="text-green-400 font-medium">
            <span className="text-slate-400">Real:</span> {Math.round(totalCacheReal)}€
          </div>
          <div className="text-yellow-400">
            <span className="text-slate-400">Extra:</span> {Math.round(totalCacheExtra)}€
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="bg-white">
          {INSTRUMENT_SECTIONS.map(section => (
            <InstrumentSection
              key={section.id}
              section={section}
              contacts={contacts}
              event={event}
              eventResponses={eventResponses}
              contactsData={contactsData}
              onDataChange={onDataChange}
              selectedContacts={selectedContacts}
              onSelectContact={onSelectContact}
              isExpanded={expandedSections[section.id]}
              onToggle={() => toggleSection(section.id)}
              budgetData={budgetData}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main Component
const PlantillasDefinitivas = () => {
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [eventResponses, setEventResponses] = useState({});
  const [templates, setTemplates] = useState([]);
  const [contactsData, setContactsData] = useState({});
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [showCommunications, setShowCommunications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [budgetData, setBudgetData] = useState(null);
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsRes, contactsRes, templatesRes, seasonsRes] = await Promise.all([
        axios.get(`${API}/events`),
        axios.get(`${API}/contacts`),
        axios.get(`${API}/email-templates`),
        axios.get(`${API}/seasons`)
      ]);
      
      setEvents(eventsRes.data);
      setContacts(contactsRes.data);
      setTemplates(templatesRes.data);
      setSeasons(seasonsRes.data);

      // Load budget for current season
      if (seasonsRes.data.length > 0) {
        const currentSeasonId = seasonsRes.data[0].id;
        try {
          const budgetRes = await axios.get(`${API}/budgets/${currentSeasonId}`);
          setBudgetData(budgetRes.data.budget_data || {});
        } catch (err) {
          console.warn("No budget data found for season");
          setBudgetData({});
        }
      }

      // Load responses for each event
      const responsesMap = {};
      for (const event of eventsRes.data) {
        const responsesRes = await axios.get(`${API}/event-responses/${event.id}`);
        responsesMap[event.id] = responsesRes.data;
      }
      setEventResponses(responsesMap);

      // Expand first event by default
      if (eventsRes.data.length > 0) {
        setExpandedEvents({ [eventsRes.data[0].id]: true });
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (eventId) => {
    setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleDataChange = (contactId, field, value) => {
    setContactsData(prev => {
      const contactData = { ...(prev[contactId] || {}) };
      
      if (field.startsWith('asistencia_real.')) {
        const key = field.replace('asistencia_real.', '');
        contactData.asistencia_real = { ...(contactData.asistencia_real || {}), [key]: value };
      } else {
        contactData[field] = value;
      }
      
      return { ...prev, [contactId]: contactData };
    });
  };

  const saveData = async () => {
    // In real implementation, this would save to backend
    alert('Datos guardados correctamente (simulado)');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="plantillas-definitivas-page">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Plantillas Definitivas</h1>
          <p className="font-ibm text-slate-600 mt-1">Gestión de contactos confirmados, asistencia y cachés por evento</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveData}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium"
            data-testid="save-plantillas-btn"
          >
            Guardar cambios
          </button>
          <button
            onClick={() => setShowCommunications(true)}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium flex items-center gap-2"
            data-testid="open-communications-plantillas-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            Comunicaciones ({selectedContacts.length})
          </button>
        </div>
      </header>

      {/* Events List */}
      <div className="space-y-4">
        {events.map((event, index) => (
          <EventAccordion
            key={event.id}
            event={event}
            index={index}
            contacts={contacts}
            eventResponses={eventResponses[event.id] || []}
            contactsData={contactsData}
            onDataChange={handleDataChange}
            selectedContacts={selectedContacts}
            onSelectContact={toggleContactSelection}
            isExpanded={expandedEvents[event.id]}
            onToggle={() => toggleEvent(event.id)}
            budgetData={budgetData}
          />
        ))}
      </div>

      {events.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No hay eventos configurados</p>
        </div>
      )}

      {/* Communications Panel */}
      <CommunicationsPanel
        isOpen={showCommunications}
        onClose={() => setShowCommunications(false)}
        selectedContacts={selectedContacts}
        templates={templates}
      />
      
      {showCommunications && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setShowCommunications(false)}
        />
      )}
    </div>
  );
};

export default PlantillasDefinitivas;
