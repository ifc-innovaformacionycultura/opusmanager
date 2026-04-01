import React, { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Color helper
const getAvailabilityColor = (percentage) => {
  if (percentage <= 30) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
  if (percentage <= 60) return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
  if (percentage <= 80) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' };
  return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
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

// File Upload Component
const FileUpload = ({ label, value, onChange, eventName, contactName }) => {
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Simulate upload to Google Drive with auto-rename
      const date = new Date().toISOString().split('T')[0];
      const newFileName = `${eventName}_${date}_${contactName}_${file.name}`;
      // In real implementation, this would upload to Google Drive
      onChange({ name: newFileName, url: URL.createObjectURL(file), originalName: file.name });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {value ? (
        <a href={value.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          {value.originalName?.substring(0, 10)}...
        </a>
      ) : (
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.png,.jpeg" />
          <span className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4"/>
            </svg>
            {label}
          </span>
        </label>
      )}
    </div>
  );
};

// Contact Row with Economic Block
const ContactRowEconomic = ({ contact, event, eventResponses, contactData, onDataChange }) => {
  const data = contactData || {
    atril_numero: '',
    atril_letra: '',
    asistencia_real: {},
    cache_extra: 0,
    cache_extra_comentario: '',
    extra_produccion: 0,
    extra_transporte: 0,
    otros_gastos: 0,
    justificante_transporte: null,
    justificante_alojamiento: null,
    titulaciones: null
  };

  // Calculate attendance
  const responses = eventResponses.find(r => r.contact_id === contact.id)?.responses || {};
  const totalDates = Object.keys(responses).length || 1;
  const previstoYes = Object.values(responses).filter(v => v === 'si').length;
  const previstoPct = Math.round((previstoYes / totalDates) * 100);
  
  const realValues = Object.values(data.asistencia_real || {});
  const realPct = realValues.length > 0 
    ? Math.round(realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length)
    : 0;

  // Calculate totals
  const cacheBase = 100;
  const cacheReal = Math.round(cacheBase * (realPct / 100));
  const cacheExtra = parseFloat(data.cache_extra) || 0;
  const extraProduccion = parseFloat(data.extra_produccion) || 0;
  const extraTransporte = parseFloat(data.extra_transporte) || 0;
  const otrosGastos = parseFloat(data.otros_gastos) || 0;
  const totalPercibir = cacheReal + cacheExtra + extraProduccion + extraTransporte + otrosGastos;

  const realColors = getAvailabilityColor(realPct);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      {/* Personal Data */}
      <td className="px-3 py-2 text-sm sticky left-0 bg-white">{contact.apellidos}</td>
      <td className="px-3 py-2 text-sm">{contact.nombre}</td>
      <td className="px-3 py-2 text-sm">{contact.especialidad}</td>

      {/* Atril */}
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <input
            type="number"
            value={data.atril_numero || ''}
            onChange={(e) => onDataChange(contact.id, 'atril_numero', e.target.value)}
            className="w-10 px-1 py-1 border border-slate-200 rounded text-xs text-center"
            placeholder="Nº"
          />
          <input
            type="text"
            value={data.atril_letra || ''}
            onChange={(e) => onDataChange(contact.id, 'atril_letra', e.target.value)}
            className="w-8 px-1 py-1 border border-slate-200 rounded text-xs text-center uppercase"
            maxLength={1}
          />
        </div>
      </td>

      {/* Attendance */}
      <td className="px-2 py-2 text-center">
        <span className={`inline-flex px-2 py-1 rounded text-xs font-mono ${realColors.bg} ${realColors.text}`}>
          {realPct}%
        </span>
      </td>

      {/* Cache */}
      <td className="px-2 py-2 text-center font-mono text-sm">{cacheReal}€</td>
      <td className="px-2 py-2">
        <input
          type="number"
          min="0"
          value={data.cache_extra || ''}
          onChange={(e) => onDataChange(contact.id, 'cache_extra', e.target.value)}
          className="w-16 px-1 py-1 border border-slate-200 rounded text-xs text-center"
        />
      </td>

      {/* Economic Block - Visually differentiated */}
      <td className="px-2 py-2 bg-blue-50/50">
        <input
          type="number"
          min="0"
          value={data.extra_produccion || ''}
          onChange={(e) => onDataChange(contact.id, 'extra_produccion', e.target.value)}
          className="w-16 px-1 py-1 border border-blue-200 rounded text-xs text-center bg-white"
          placeholder="€"
        />
      </td>
      <td className="px-2 py-2 bg-blue-50/50">
        <input
          type="number"
          min="0"
          value={data.extra_transporte || ''}
          onChange={(e) => onDataChange(contact.id, 'extra_transporte', e.target.value)}
          className="w-16 px-1 py-1 border border-blue-200 rounded text-xs text-center bg-white"
          placeholder="€"
        />
      </td>
      <td className="px-2 py-2 bg-blue-50/50">
        <input
          type="number"
          min="0"
          value={data.otros_gastos || ''}
          onChange={(e) => onDataChange(contact.id, 'otros_gastos', e.target.value)}
          className="w-16 px-1 py-1 border border-blue-200 rounded text-xs text-center bg-white"
          placeholder="€"
        />
      </td>

      {/* Documentation */}
      <td className="px-2 py-2 bg-amber-50/50">
        <FileUpload
          label="Transporte"
          value={data.justificante_transporte}
          onChange={(v) => onDataChange(contact.id, 'justificante_transporte', v)}
          eventName={event.name}
          contactName={`${contact.apellidos}_${contact.nombre}`}
        />
      </td>
      <td className="px-2 py-2 bg-amber-50/50">
        <FileUpload
          label="Alojamiento"
          value={data.justificante_alojamiento}
          onChange={(v) => onDataChange(contact.id, 'justificante_alojamiento', v)}
          eventName={event.name}
          contactName={`${contact.apellidos}_${contact.nombre}`}
        />
      </td>
      <td className="px-2 py-2 bg-amber-50/50">
        <FileUpload
          label="Titulaciones"
          value={data.titulaciones}
          onChange={(v) => onDataChange(contact.id, 'titulaciones', v)}
          eventName={event.name}
          contactName={`${contact.apellidos}_${contact.nombre}`}
        />
      </td>

      {/* Total */}
      <td className="px-3 py-2 bg-green-100 text-center">
        <span className="font-bold text-green-800 font-mono">{totalPercibir}€</span>
      </td>
    </tr>
  );
};

// Section Component
const SectionEconomic = ({ section, contacts, event, eventResponses, contactsData, onDataChange, isExpanded, onToggle }) => {
  const sectionContacts = contacts.filter(c => 
    section.instruments.some(inst => 
      c.especialidad?.toLowerCase().includes(inst.toLowerCase())
    )
  );

  if (sectionContacts.length === 0) return null;

  // Calculate section totals
  let sectionTotal = 0;
  sectionContacts.forEach(contact => {
    const data = contactsData[contact.id] || {};
    const responses = eventResponses.find(r => r.contact_id === contact.id)?.responses || {};
    const realValues = Object.values(data.asistencia_real || {});
    const realPct = realValues.length > 0 
      ? realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length / 100
      : 0;
    
    const cacheReal = 100 * realPct;
    sectionTotal += cacheReal + (parseFloat(data.cache_extra) || 0) + (parseFloat(data.extra_produccion) || 0) + (parseFloat(data.extra_transporte) || 0) + (parseFloat(data.otros_gastos) || 0);
  });

  return (
    <div className="border-l-2 border-slate-300 ml-4">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-between bg-slate-100 hover:bg-slate-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7"/>
          </svg>
          <span className="font-medium text-slate-700">{section.name}</span>
          <span className="text-xs text-slate-500">({sectionContacts.length})</span>
        </div>
        <span className="text-sm font-mono text-slate-600">{Math.round(sectionTotal)}€</span>
      </button>
      
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs">
                <th className="px-3 py-2 text-left font-medium text-slate-600 sticky left-0 bg-slate-50">Apellidos</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Nombre</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Instrumento</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">Atril</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">% Real</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">Caché</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600">Extra</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600 bg-blue-50">Producción</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600 bg-blue-50">Transporte</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600 bg-blue-50">Otros</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600 bg-amber-50">Just. Trans.</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600 bg-amber-50">Just. Aloj.</th>
                <th className="px-2 py-2 text-center font-medium text-slate-600 bg-amber-50">Titulaciones</th>
                <th className="px-3 py-2 text-center font-medium text-slate-600 bg-green-100">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sectionContacts.map(contact => (
                <ContactRowEconomic
                  key={contact.id}
                  contact={contact}
                  event={event}
                  eventResponses={eventResponses}
                  contactData={contactsData[contact.id]}
                  onDataChange={onDataChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Event Accordion
const EventAccordionEconomic = ({ event, index, contacts, eventResponses, contactsData, onDataChange, isExpanded, onToggle }) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [driveFolder, setDriveFolder] = useState('');

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Calculate event totals
  let totalCacheReal = 0;
  let totalExtras = 0;
  let totalGeneral = 0;

  contacts.forEach(contact => {
    const data = contactsData[contact.id] || {};
    const realValues = Object.values(data.asistencia_real || {});
    const realPct = realValues.length > 0 
      ? realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length / 100
      : 0;
    
    const cacheReal = 100 * realPct;
    const extras = (parseFloat(data.cache_extra) || 0) + (parseFloat(data.extra_produccion) || 0) + (parseFloat(data.extra_transporte) || 0) + (parseFloat(data.otros_gastos) || 0);
    
    totalCacheReal += cacheReal;
    totalExtras += extras;
    totalGeneral += cacheReal + extras;
  });

  return (
    <div className="border border-slate-200 rounded-lg mb-4 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-800 text-white hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7"/>
          </svg>
          <span className="font-semibold">Evento {index + 1}</span>
          <span className="text-slate-300">—</span>
          <span>{event.name}</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-slate-300">Caché: {Math.round(totalCacheReal)}€</div>
          <div className="text-yellow-400">Extras: {Math.round(totalExtras)}€</div>
          <div className="text-green-400 font-bold">TOTAL: {Math.round(totalGeneral)}€</div>
        </div>
      </button>

      {isExpanded && (
        <div className="bg-white">
          {/* Drive folder config */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <label className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
              <span className="text-slate-600">Carpeta Google Drive:</span>
              <input
                type="url"
                value={driveFolder}
                onChange={(e) => setDriveFolder(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
              />
            </label>
          </div>

          {INSTRUMENT_SECTIONS.map(section => (
            <SectionEconomic
              key={section.id}
              section={section}
              contacts={contacts}
              event={event}
              eventResponses={eventResponses}
              contactsData={contactsData}
              onDataChange={onDataChange}
              isExpanded={expandedSections[section.id]}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main Component
const AsistenciaPagos = () => {
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [eventResponses, setEventResponses] = useState({});
  const [contactsData, setContactsData] = useState({});
  const [expandedEvents, setExpandedEvents] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsRes, contactsRes] = await Promise.all([
        axios.get(`${API}/events`),
        axios.get(`${API}/contacts`)
      ]);
      
      setEvents(eventsRes.data);
      setContacts(contactsRes.data);

      const responsesMap = {};
      for (const event of eventsRes.data) {
        const responsesRes = await axios.get(`${API}/event-responses/${event.id}`);
        responsesMap[event.id] = responsesRes.data;
      }
      setEventResponses(responsesMap);

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

  const saveData = () => {
    alert('Datos económicos guardados correctamente (simulado)');
  };

  // Calculate global totals
  let globalTotal = 0;
  contacts.forEach(contact => {
    const data = contactsData[contact.id] || {};
    const realValues = Object.values(data.asistencia_real || {});
    const realPct = realValues.length > 0 
      ? realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length / 100
      : 0;
    
    globalTotal += 100 * realPct + (parseFloat(data.cache_extra) || 0) + (parseFloat(data.extra_produccion) || 0) + (parseFloat(data.extra_transporte) || 0) + (parseFloat(data.otros_gastos) || 0);
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="asistencia-pagos-page">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Asistencia, Pagos y Bloque Económico</h1>
          <p className="font-ibm text-slate-600 mt-1">Gestión económica completa y documentación justificativa</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-green-100 rounded-lg">
            <span className="text-sm text-green-700">Total general:</span>
            <span className="ml-2 font-bold text-green-800 font-mono text-lg">{Math.round(globalTotal)}€</span>
          </div>
          <button
            onClick={saveData}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium"
            data-testid="save-economic-btn"
          >
            Guardar cambios
          </button>
        </div>
      </header>

      <div className="space-y-4">
        {events.map((event, index) => (
          <EventAccordionEconomic
            key={event.id}
            event={event}
            index={index}
            contacts={contacts}
            eventResponses={eventResponses[event.id] || []}
            contactsData={contactsData}
            onDataChange={handleDataChange}
            isExpanded={expandedEvents[event.id]}
            onToggle={() => toggleEvent(event.id)}
          />
        ))}
      </div>

      {events.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No hay eventos configurados</p>
        </div>
      )}
    </div>
  );
};

export default AsistenciaPagos;
