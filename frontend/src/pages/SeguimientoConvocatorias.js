import React, { useState, useEffect, useMemo } from "react";
import { useAuth as useGestorAuth } from "../contexts/AuthContext";

// Availability color helper
const getAvailabilityColor = (percentage) => {
  if (percentage <= 30) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
  if (percentage <= 60) return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
  if (percentage <= 80) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' };
  return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
};

// Communications Panel
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
    // Simulate sending (in real app, this would call the Gmail API)
    await new Promise(resolve => setTimeout(resolve, 1500));
    alert(`Comunicaciones enviadas a ${selectedContacts.length} contactos`);
    setSending(false);
    setSelectedTemplates({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-lg z-50 flex flex-col" data-testid="communications-panel">
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
                {template.subject && (
                  <p className="text-xs text-slate-500 mt-1">{template.subject}</p>
                )}
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
          data-testid="send-communications-btn"
        >
          {sending ? 'Enviando...' : 'Enviar comunicaciones'}
        </button>
      </div>
    </div>
  );
};

// Manual Entry Panel
const ManualEntryPanel = ({ isOpen, onClose, onSave }) => {
  const [contact, setContact] = useState({
    baremo: '',
    apellidos: '',
    nombre: '',
    dni: '',
    provincia: '',
    especialidad: '',
    categoria: '',
    telefono: '',
    email: '',
    iban: '',
    swift: ''
  });

  const handleSave = async () => {
    if (!contact.nombre || !contact.apellidos || !contact.email) {
      alert('Nombre, apellidos y email son obligatorios');
      return;
    }
    await onSave(contact);
    setContact({
      baremo: '', apellidos: '', nombre: '', dni: '', provincia: '',
      especialidad: '', categoria: '', telefono: '', email: '', iban: '', swift: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mt-4" data-testid="manual-entry-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Introducir contacto manualmente</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Object.keys(contact).map(field => (
          <div key={field}>
            <label className="block text-xs text-slate-600 mb-1 capitalize">{field}</label>
            <input
              type={field === 'email' ? 'email' : field === 'baremo' ? 'number' : 'text'}
              value={contact[field]}
              onChange={(e) => setContact({ ...contact, [field]: e.target.value })}
              className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
            />
          </div>
        ))}
      </div>
      
      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium"
          data-testid="save-manual-contact-btn"
        >
          Guardar contacto
        </button>
      </div>
    </div>
  );
};

// Main Component
const SeguimientoConvocatorias = () => {
  const { api } = useGestorAuth();
  const [contacts, setContacts] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventResponses, setEventResponses] = useState({});
  const [templates, setTemplates] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [filters, setFilters] = useState({});
  const [showCommunications, setShowCommunications] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [loading, setLoading] = useState(true);

  const columns = [
    { id: 'baremo', label: 'Baremo', width: 'w-16' },
    { id: 'apellidos', label: 'Apellidos', width: 'w-32' },
    { id: 'nombre', label: 'Nombre', width: 'w-24' },
    { id: 'dni', label: 'DNI', width: 'w-24' },
    { id: 'provincia', label: 'Provincia', width: 'w-24' },
    { id: 'especialidad', label: 'Especialidad', width: 'w-24' },
    { id: 'categoria', label: 'Categoría', width: 'w-24' },
    { id: 'telefono', label: 'Teléfono', width: 'w-28' },
    { id: 'email', label: 'Email', width: 'w-40' },
  ];

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      // Endpoints nuevos (Supabase). email-templates no existe aún, silenciado.
      const [musicosRes, eventsRes, templatesRes] = await Promise.all([
        api.get('/api/gestor/musicos').catch(() => ({ data: { musicos: [] } })),
        api.get('/api/gestor/eventos').catch(() => ({ data: { eventos: [] } })),
        api.get('/api/email-templates').catch(() => ({ data: [] }))
      ]);

      const musicos = musicosRes.data?.musicos || [];
      const eventsList = eventsRes.data?.eventos || [];
      setContacts(musicos);
      setEvents(eventsList);
      setTemplates(templatesRes.data || []);

      // Cargar asignaciones de cada evento (reemplaza event-responses legacy)
      const responsesMap = {};
      for (const event of eventsList) {
        try {
          const asigRes = await api.get(`/api/gestor/asignaciones/evento/${event.id}`);
          // Adaptar formato al esperado: { contact_id, responses: {}, observaciones }
          responsesMap[event.id] = (asigRes.data?.asignaciones || []).map(a => ({
            contact_id: a.usuario_id,
            responses: { [event.id]: a.estado === 'confirmado' ? 'si' : (a.estado === 'rechazado' ? 'no' : '') },
            observaciones: a.comentarios || ''
          }));
        } catch { responsesMap[event.id] = []; }
      }
      setEventResponses(responsesMap);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const toggleAllContacts = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const toggleEventExpand = (eventId) => {
    setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const getContactAvailability = (contactId, eventId) => {
    const responses = eventResponses[eventId] || [];
    const contactResponse = responses.find(r => r.contact_id === contactId);
    if (!contactResponse) return { percentage: 0, responses: {}, hasComments: false };

    const responseValues = Object.values(contactResponse.responses || {});
    const yesCount = responseValues.filter(v => v === 'si').length;
    const total = responseValues.length || 1;
    const percentage = Math.round((yesCount / total) * 100);

    return {
      percentage,
      responses: contactResponse.responses || {},
      hasComments: !!contactResponse.observaciones
    };
  };

  const saveManualContact = async (contact) => {
    try {
      // /api/contacts (legacy) reemplazado por /api/gestor/musicos/crear.
      // Aquí sólo creamos el registro local: la creación real se hace desde "Base de datos de músicos".
      alert('Para añadir músicos, usa "Administración → Base de datos músicos".');
      setShowManualEntry(false);
    } catch (err) {
      console.error("Error saving contact:", err);
      alert('Error al guardar el contacto');
    }
  };

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const contactValue = String(contact[key] || '').toLowerCase();
        return contactValue.includes(value.toLowerCase());
      });
    });
  }, [contacts, filters]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="seguimiento-page">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Seguimiento de Convocatorias</h1>
          <p className="font-ibm text-slate-600 mt-1">Gestiona contactos y disponibilidad por evento</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium"
            data-testid="toggle-manual-entry-btn"
          >
            Introducir manualmente
          </button>
          <button
            onClick={() => setShowCommunications(true)}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium flex items-center gap-2"
            data-testid="open-communications-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            Comunicaciones ({selectedContacts.length})
          </button>
        </div>
      </header>

      {/* Manual Entry Panel */}
      <ManualEntryPanel
        isOpen={showManualEntry}
        onClose={() => setShowManualEntry(false)}
        onSave={saveManualContact}
      />

      {/* Data Grid */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="contacts-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {/* Checkbox column */}
                <th className="px-3 py-3 text-left sticky left-0 bg-slate-50 z-10">
                  <input
                    type="checkbox"
                    checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                    onChange={toggleAllContacts}
                    className="w-4 h-4 rounded border-slate-300"
                    data-testid="select-all-checkbox"
                  />
                </th>
                
                {/* Contact columns */}
                {columns.map(col => (
                  <th key={col.id} className={`px-3 py-3 text-left font-medium text-slate-600 ${col.width}`}>
                    <div className="space-y-1">
                      <span>{col.label}</span>
                      <input
                        type="text"
                        value={filters[col.id] || ''}
                        onChange={(e) => setFilters({ ...filters, [col.id]: e.target.value })}
                        placeholder="Filtrar..."
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-normal"
                      />
                    </div>
                  </th>
                ))}
                
                {/* Event columns */}
                {events.map((event, index) => (
                  <th 
                    key={event.id} 
                    className="px-3 py-3 text-center font-medium text-slate-600 min-w-[120px] cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleEventExpand(event.id)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Evento {index + 1}</span>
                      <svg 
                        className={`w-4 h-4 transition-transform ${expandedEvents[event.id] ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                    <span className="text-xs font-normal text-slate-500 block">{event.name}</span>
                  </th>
                ))}
                
                {/* Actions column */}
                <th className="px-3 py-3 text-left font-medium text-slate-600">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => (
                <tr key={contact.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {/* Checkbox */}
                  <td className="px-3 py-2 sticky left-0 bg-white">
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.id)}
                      onChange={() => toggleContactSelection(contact.id)}
                      className="w-4 h-4 rounded border-slate-300"
                      data-testid={`select-contact-${contact.id}`}
                    />
                  </td>
                  
                  {/* Contact data */}
                  {columns.map(col => (
                    <td key={col.id} className="px-3 py-2 text-slate-700">
                      {contact[col.id] || '-'}
                    </td>
                  ))}
                  
                  {/* Event availability */}
                  {events.map(event => {
                    const availability = getContactAvailability(contact.id, event.id);
                    const colors = getAvailabilityColor(availability.percentage);
                    const isExpanded = expandedEvents[event.id];
                    
                    if (isExpanded) {
                      // Show individual responses
                      return (
                        <td key={event.id} className="px-1 py-2">
                          <div className="flex gap-1">
                            {Object.entries(availability.responses).map(([key, value]) => (
                              <span
                                key={key}
                                className={`px-2 py-1 text-xs rounded ${value === 'si' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                title={key}
                              >
                                {value === 'si' ? '✓' : '✗'}
                              </span>
                            ))}
                          </div>
                        </td>
                      );
                    }
                    
                    // Show percentage
                    return (
                      <td key={event.id} className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-mono ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {availability.percentage}%
                          {availability.hasComments && <span className="ml-1">*</span>}
                        </span>
                      </td>
                    );
                  })}
                  
                  {/* Action */}
                  <td className="px-3 py-2">
                    <select className="px-2 py-1 border border-slate-200 rounded text-xs">
                      <option value="">Seleccionar...</option>
                      <option value="confirmar">Confirmar</option>
                      <option value="delegar">Delegar</option>
                      <option value="espera">En espera</option>
                      <option value="contactar">Contactar</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredContacts.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No hay contactos que coincidan con los filtros
          </div>
        )}
      </div>

      {/* Communications Panel */}
      <CommunicationsPanel
        isOpen={showCommunications}
        onClose={() => setShowCommunications(false)}
        selectedContacts={selectedContacts}
        templates={templates}
      />
      
      {/* Overlay for communications panel */}
      {showCommunications && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setShowCommunications(false)}
        />
      )}
    </div>
  );
};

export default SeguimientoConvocatorias;
