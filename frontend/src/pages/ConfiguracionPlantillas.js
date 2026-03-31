import React, { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Accordion Component
const Accordion = ({ title, isOpen, onToggle, children }) => (
  <div className="border border-slate-200 rounded-lg mb-3 bg-white">
    <button
      onClick={onToggle}
      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      data-testid={`accordion-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <span className="font-medium text-slate-900">{title}</span>
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

const ConfiguracionPlantillas = () => {
  const [templates, setTemplates] = useState([]);
  const [events, setEvents] = useState([]);
  const [emailMatrix, setEmailMatrix] = useState({});
  const [openAccordions, setOpenAccordions] = useState({});
  const [saving, setSaving] = useState(false);

  const templateTypes = [
    { id: 'convocatoria_temporada', name: 'Email de convocatoria de temporada' },
    { id: 'convocatoria_individual', name: 'Email de convocatoria individual' },
    { id: 'envio_partituras', name: 'Email de envío de partituras' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [templatesRes, eventsRes, matrixRes] = await Promise.all([
        axios.get(`${API}/email-templates`),
        axios.get(`${API}/events`),
        axios.get(`${API}/email-matrix`)
      ]);
      
      // Initialize templates with defaults if empty
      const existingTemplates = templatesRes.data;
      const templatesMap = {};
      templateTypes.forEach(type => {
        const existing = existingTemplates.find(t => t.type === type.id);
        templatesMap[type.id] = existing || {
          type: type.id,
          header_image: '',
          subject: '',
          body: '',
          signature_image: ''
        };
      });
      setTemplates(templatesMap);
      setEvents(eventsRes.data);

      // Parse email matrix
      const matrix = {};
      matrixRes.data.forEach(item => {
        if (!matrix[item.event_id]) matrix[item.event_id] = {};
        matrix[item.event_id][item.template_type] = item.enabled;
      });
      setEmailMatrix(matrix);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  const toggleAccordion = (id) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateTemplate = (typeId, field, value) => {
    setTemplates(prev => ({
      ...prev,
      [typeId]: { ...prev[typeId], [field]: value }
    }));
  };

  const toggleMatrixCell = (eventId, templateType) => {
    setEmailMatrix(prev => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] || {}),
        [templateType]: !(prev[eventId]?.[templateType])
      }
    }));
  };

  const saveTemplates = async () => {
    setSaving(true);
    try {
      // Save templates
      for (const typeId of Object.keys(templates)) {
        const template = templates[typeId];
        if (template.id) {
          await axios.put(`${API}/email-templates/${template.id}`, template);
        } else {
          const response = await axios.post(`${API}/email-templates`, template);
          setTemplates(prev => ({ ...prev, [typeId]: response.data }));
        }
      }

      // Save matrix
      const matrixData = [];
      Object.keys(emailMatrix).forEach(eventId => {
        Object.keys(emailMatrix[eventId]).forEach(templateType => {
          matrixData.push({
            event_id: eventId,
            template_type: templateType,
            enabled: emailMatrix[eventId][templateType]
          });
        });
      });
      await axios.post(`${API}/email-matrix`, matrixData);

      alert('Plantillas guardadas correctamente');
    } catch (err) {
      console.error("Error saving templates:", err);
      alert('Error al guardar las plantillas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6" data-testid="configuracion-plantillas-page">
      <header className="mb-6">
        <h1 className="font-cabinet text-3xl font-bold text-slate-900">Plantillas de Comunicación</h1>
        <p className="font-ibm text-slate-600 mt-1">Configura los modelos de email y su activación por evento</p>
      </header>

      <div className="space-y-6">
        {/* Email Templates */}
        <div className="space-y-3">
          {templateTypes.map(type => (
            <Accordion
              key={type.id}
              title={type.name}
              isOpen={openAccordions[type.id]}
              onToggle={() => toggleAccordion(type.id)}
            >
              <div className="space-y-4 pt-4">
                {/* Header Image */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imagen de cabecera</label>
                  <input
                    type="url"
                    value={templates[type.id]?.header_image || ''}
                    onChange={(e) => updateTemplate(type.id, 'header_image', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Enlace a imagen JPG desde Google Drive</p>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Asunto</label>
                  <input
                    type="text"
                    value={templates[type.id]?.subject || ''}
                    onChange={(e) => updateTemplate(type.id, 'subject', e.target.value)}
                    placeholder="Asunto del email..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Variables disponibles: {'{{nombre}}, {{temporada}}, {{evento}}, {{fecha}}'}</p>
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuerpo del mensaje</label>
                  <textarea
                    value={templates[type.id]?.body || ''}
                    onChange={(e) => updateTemplate(type.id, 'body', e.target.value)}
                    placeholder="Escribe el contenido del email..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm min-h-[200px]"
                  />
                </div>

                {/* Signature */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imagen de firma</label>
                  <input
                    type="url"
                    value={templates[type.id]?.signature_image || ''}
                    onChange={(e) => updateTemplate(type.id, 'signature_image', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
                  />
                </div>
              </div>
            </Accordion>
          ))}
        </div>

        {/* Email Matrix */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-purple-500 rounded"></div>
            Matriz de Activación de Comunicaciones
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Selecciona qué tipos de email se enviarán para cada evento.
          </p>

          {events.length === 0 ? (
            <p className="text-slate-500 text-sm">No hay eventos configurados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium text-slate-600 sticky left-0 bg-slate-50">Evento</th>
                    {templateTypes.map(type => (
                      <th key={type.id} className="px-4 py-3 text-center font-medium text-slate-600 whitespace-nowrap">
                        {type.name.replace('Email de ', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, index) => (
                    <tr key={event.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <span className="font-medium">Evento {index + 1}</span>
                        <span className="text-slate-500 ml-2">— {event.name}</span>
                      </td>
                      {templateTypes.map(type => (
                        <td key={type.id} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={emailMatrix[event.id]?.[type.id] || false}
                            onChange={() => toggleMatrixCell(event.id, type.id)}
                            className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            data-testid={`matrix-${event.id}-${type.id}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveTemplates}
            disabled={saving}
            className="px-6 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
            data-testid="save-templates-btn"
          >
            {saving ? 'Guardando...' : 'Guardar plantillas'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracionPlantillas;
