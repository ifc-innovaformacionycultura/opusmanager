import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Colors for charts
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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

// Export functions
const exportToExcel = (data, eventName) => {
  // Create CSV content
  const headers = ['Apellidos', 'Nombre', 'Instrumento', 'IBAN', 'SWIFT', '% Asistencia', 'Caché Real', 'Extras', 'Total'];
  const rows = data.map(row => [
    row.apellidos,
    row.nombre,
    row.instrumento,
    row.iban || '',
    row.swift || '',
    row.asistenciaPct + '%',
    row.cacheReal + '€',
    row.extras + '€',
    row.total + '€'
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${eventName}_liquidacion.csv`;
  link.click();
};

const exportToXML = (data, eventName) => {
  // Create XML for bank transfer
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<Pagos>\n';
  xml += `  <Evento>${eventName}</Evento>\n`;
  xml += `  <FechaGeneracion>${new Date().toISOString()}</FechaGeneracion>\n`;
  xml += '  <Beneficiarios>\n';
  
  data.forEach(row => {
    if (row.iban && row.total > 0) {
      xml += '    <Beneficiario>\n';
      xml += `      <Nombre>${row.apellidos}, ${row.nombre}</Nombre>\n`;
      xml += `      <IBAN>${row.iban}</IBAN>\n`;
      xml += `      <Importe>${row.total}</Importe>\n`;
      xml += '    </Beneficiario>\n';
    }
  });
  
  xml += '  </Beneficiarios>\n';
  xml += '</Pagos>';
  
  const blob = new Blob([xml], { type: 'application/xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${eventName}_pagos_bancarios.xml`;
  link.click();
};

// Summary Card Component
const SummaryCard = ({ title, value, subtitle, color = 'slate' }) => {
  const colorClasses = {
    slate: 'bg-slate-100 text-slate-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800'
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <p className="text-sm opacity-75">{title}</p>
      <p className="text-2xl font-bold font-mono">{value}</p>
      {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
    </div>
  );
};

// Event Analysis Component
const EventAnalysis = ({ event, contacts, eventResponses, contactsData, onExportExcel, onExportXML }) => {
  const [expandedSections, setExpandedSections] = useState({});

  // Calculate all data for this event
  const analysisData = useMemo(() => {
    const data = [];
    let totalPrevisto = 0;
    let totalReal = 0;
    let totalExtras = 0;
    const sectionTotals = {};

    contacts.forEach(contact => {
      const responses = eventResponses.find(r => r.contact_id === contact.id)?.responses || {};
      const contactData = contactsData[contact.id] || {};
      
      const totalDates = Object.keys(responses).length || 1;
      const previstoYes = Object.values(responses).filter(v => v === 'si').length;
      const previstoPct = Math.round((previstoYes / totalDates) * 100);
      
      const realValues = Object.values(contactData.asistencia_real || {});
      const realPct = realValues.length > 0 
        ? Math.round(realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length)
        : 0;

      const cacheBase = 100;
      const cachePrevisto = Math.round(cacheBase * (previstoPct / 100));
      const cacheReal = Math.round(cacheBase * (realPct / 100));
      const extras = (parseFloat(contactData.cache_extra) || 0) + 
                     (parseFloat(contactData.extra_produccion) || 0) + 
                     (parseFloat(contactData.extra_transporte) || 0) + 
                     (parseFloat(contactData.otros_gastos) || 0);
      const total = cacheReal + extras;

      // Find section
      const section = INSTRUMENT_SECTIONS.find(s => 
        s.instruments.some(inst => contact.especialidad?.toLowerCase().includes(inst.toLowerCase()))
      ) || { id: 'otros', name: 'Otros' };

      if (!sectionTotals[section.id]) {
        sectionTotals[section.id] = { name: section.name, previsto: 0, real: 0, extras: 0, count: 0 };
      }
      sectionTotals[section.id].previsto += cachePrevisto;
      sectionTotals[section.id].real += cacheReal;
      sectionTotals[section.id].extras += extras;
      sectionTotals[section.id].count += 1;

      totalPrevisto += cachePrevisto;
      totalReal += cacheReal;
      totalExtras += extras;

      data.push({
        id: contact.id,
        apellidos: contact.apellidos,
        nombre: contact.nombre,
        instrumento: contact.especialidad,
        iban: contact.iban,
        swift: contact.swift,
        section: section.name,
        asistenciaPct: realPct,
        cachePrevisto,
        cacheReal,
        extras,
        total
      });
    });

    return {
      contacts: data,
      totalPrevisto,
      totalReal,
      totalExtras,
      totalGeneral: totalReal + totalExtras,
      desviacion: totalReal - totalPrevisto,
      desviacionPct: totalPrevisto > 0 ? Math.round(((totalReal - totalPrevisto) / totalPrevisto) * 100) : 0,
      sectionTotals: Object.values(sectionTotals)
    };
  }, [contacts, eventResponses, contactsData]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Chart data
  const comparisonData = [
    { name: 'Presupuesto', Previsto: analysisData.totalPrevisto, Real: analysisData.totalReal }
  ];

  const distributionData = [
    { name: 'Caché Real', value: analysisData.totalReal },
    { name: 'Extras', value: analysisData.totalExtras }
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 mb-6">
      {/* Event Header */}
      <div className="px-4 py-3 bg-slate-800 text-white rounded-t-lg flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{event.name}</h3>
          <p className="text-sm text-slate-300">{event.date}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExportExcel(analysisData.contacts, event.name)}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium flex items-center gap-1"
            data-testid={`export-excel-${event.id}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Excel
          </button>
          <button
            onClick={() => onExportXML(analysisData.contacts, event.name)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium flex items-center gap-1"
            data-testid={`export-xml-${event.id}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            XML Bancario
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard title="Caché Previsto" value={`${analysisData.totalPrevisto}€`} color="slate" />
        <SummaryCard title="Caché Real" value={`${analysisData.totalReal}€`} color="blue" />
        <SummaryCard title="Total Extras" value={`${analysisData.totalExtras}€`} color="yellow" />
        <SummaryCard title="Total General" value={`${analysisData.totalGeneral}€`} color="green" />
        <SummaryCard 
          title="Desviación" 
          value={`${analysisData.desviacion >= 0 ? '+' : ''}${analysisData.desviacion}€`}
          subtitle={`${analysisData.desviacionPct >= 0 ? '+' : ''}${analysisData.desviacionPct}%`}
          color={analysisData.desviacion > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Charts */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200">
        {/* Bar Chart - Comparison */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h4 className="font-medium text-slate-700 mb-3">Comparativa Presupuestaria</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}€`} />
              <Legend />
              <Bar dataKey="Previsto" fill="#94a3b8" />
              <Bar dataKey="Real" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Distribution */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h4 className="font-medium text-slate-700 mb-3">Distribución de Gastos</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}€`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section Breakdown */}
      <div className="p-4 border-t border-slate-200">
        <h4 className="font-medium text-slate-700 mb-3">Desglose por Sección</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-2 text-left font-medium text-slate-600">Sección</th>
                <th className="px-3 py-2 text-center font-medium text-slate-600">Músicos</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Previsto</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Real</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Extras</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 bg-green-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {analysisData.sectionTotals.map((section, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{section.name}</td>
                  <td className="px-3 py-2 text-center">{section.count}</td>
                  <td className="px-3 py-2 text-right font-mono">{section.previsto}€</td>
                  <td className="px-3 py-2 text-right font-mono">{section.real}€</td>
                  <td className="px-3 py-2 text-right font-mono">{section.extras}€</td>
                  <td className="px-3 py-2 text-right font-mono font-bold bg-green-50">{section.real + section.extras}€</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-center">{analysisData.contacts.length}</td>
                <td className="px-3 py-2 text-right font-mono">{analysisData.totalPrevisto}€</td>
                <td className="px-3 py-2 text-right font-mono">{analysisData.totalReal}€</td>
                <td className="px-3 py-2 text-right font-mono">{analysisData.totalExtras}€</td>
                <td className="px-3 py-2 text-right font-mono bg-green-100">{analysisData.totalGeneral}€</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detailed Contact Table */}
      <div className="p-4 border-t border-slate-200">
        <h4 className="font-medium text-slate-700 mb-3">Detalle por Contacto</h4>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-slate-50">
                <th className="px-3 py-2 text-left font-medium text-slate-600">Apellidos</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Nombre</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Instrumento</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">IBAN</th>
                <th className="px-3 py-2 text-center font-medium text-slate-600">% Asist.</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Caché</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Extras</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 bg-green-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {analysisData.contacts.map(contact => (
                <tr key={contact.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{contact.apellidos}</td>
                  <td className="px-3 py-2">{contact.nombre}</td>
                  <td className="px-3 py-2">{contact.instrumento}</td>
                  <td className="px-3 py-2 font-mono text-xs">{contact.iban || '-'}</td>
                  <td className="px-3 py-2 text-center">{contact.asistenciaPct}%</td>
                  <td className="px-3 py-2 text-right font-mono">{contact.cacheReal}€</td>
                  <td className="px-3 py-2 text-right font-mono">{contact.extras}€</td>
                  <td className="px-3 py-2 text-right font-mono font-bold bg-green-50">{contact.total}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Main Component
const AnalisisEconomico = () => {
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [eventResponses, setEventResponses] = useState({});
  const [contactsData, setContactsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState('all');

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
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate global totals
  const globalTotals = useMemo(() => {
    let totalPrevisto = 0;
    let totalReal = 0;
    let totalExtras = 0;

    contacts.forEach(contact => {
      events.forEach(event => {
        const responses = (eventResponses[event.id] || []).find(r => r.contact_id === contact.id)?.responses || {};
        const contactData = contactsData[contact.id] || {};
        
        const totalDates = Object.keys(responses).length || 1;
        const previstoYes = Object.values(responses).filter(v => v === 'si').length;
        const previstoPct = previstoYes / totalDates;
        
        const realValues = Object.values(contactData.asistencia_real || {});
        const realPct = realValues.length > 0 
          ? realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length / 100
          : 0;

        totalPrevisto += 100 * previstoPct;
        totalReal += 100 * realPct;
        totalExtras += (parseFloat(contactData.cache_extra) || 0) + 
                       (parseFloat(contactData.extra_produccion) || 0) + 
                       (parseFloat(contactData.extra_transporte) || 0) + 
                       (parseFloat(contactData.otros_gastos) || 0);
      });
    });

    return { totalPrevisto, totalReal, totalExtras, totalGeneral: totalReal + totalExtras };
  }, [contacts, events, eventResponses, contactsData]);

  const filteredEvents = selectedEvent === 'all' ? events : events.filter(e => e.id === selectedEvent);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="analisis-economico-page">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Análisis Económico</h1>
          <p className="font-ibm text-slate-600 mt-1">Control presupuestario, informes y exportaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-md text-sm"
            data-testid="event-filter"
          >
            <option value="all">Todos los eventos</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Global Summary */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-6 mb-6 text-white">
        <h2 className="text-lg font-semibold mb-4">Resumen Global de Temporada</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-slate-300 text-sm">Presupuesto Previsto</p>
            <p className="text-2xl font-bold font-mono">{Math.round(globalTotals.totalPrevisto)}€</p>
          </div>
          <div>
            <p className="text-slate-300 text-sm">Presupuesto Real</p>
            <p className="text-2xl font-bold font-mono text-blue-400">{Math.round(globalTotals.totalReal)}€</p>
          </div>
          <div>
            <p className="text-slate-300 text-sm">Total Extras</p>
            <p className="text-2xl font-bold font-mono text-yellow-400">{Math.round(globalTotals.totalExtras)}€</p>
          </div>
          <div>
            <p className="text-slate-300 text-sm">Total General</p>
            <p className="text-2xl font-bold font-mono text-green-400">{Math.round(globalTotals.totalGeneral)}€</p>
          </div>
        </div>
      </div>

      {/* Event Analysis */}
      {filteredEvents.map(event => (
        <EventAnalysis
          key={event.id}
          event={event}
          contacts={contacts}
          eventResponses={eventResponses[event.id] || []}
          contactsData={contactsData}
          onExportExcel={exportToExcel}
          onExportXML={exportToXML}
        />
      ))}

      {events.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No hay eventos configurados</p>
        </div>
      )}
    </div>
  );
};

export default AnalisisEconomico;
