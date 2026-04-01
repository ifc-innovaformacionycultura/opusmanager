import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Instrument sections for orchestra layout
const ORCHESTRA_SECTIONS = {
  primeros_violines: { name: 'Primeros Violines', position: { x: 15, y: 75 }, color: '#ef4444' },
  segundos_violines: { name: 'Segundos Violines', position: { x: 25, y: 55 }, color: '#f97316' },
  violas: { name: 'Violas', position: { x: 50, y: 70 }, color: '#eab308' },
  violonchelos: { name: 'Violonchelos', position: { x: 70, y: 75 }, color: '#22c55e' },
  contrabajos: { name: 'Contrabajos', position: { x: 88, y: 65 }, color: '#14b8a6' },
  flautas: { name: 'Flautas', position: { x: 35, y: 40 }, color: '#06b6d4' },
  oboes: { name: 'Oboes', position: { x: 55, y: 45 }, color: '#0ea5e9' },
  clarinetes: { name: 'Clarinetes', position: { x: 30, y: 30 }, color: '#3b82f6' },
  fagotes: { name: 'Fagotes', position: { x: 50, y: 35 }, color: '#6366f1' },
  trompas: { name: 'Trompas', position: { x: 20, y: 20 }, color: '#8b5cf6' },
  trompetas: { name: 'Trompetas', position: { x: 45, y: 15 }, color: '#a855f7' },
  trombones: { name: 'Trombones', position: { x: 65, y: 20 }, color: '#d946ef' },
  tubas: { name: 'Tubas', position: { x: 80, y: 25 }, color: '#ec4899' },
  percusion: { name: 'Percusión', position: { x: 50, y: 5 }, color: '#f43f5e' },
  arpas: { name: 'Arpas', position: { x: 5, y: 50 }, color: '#fb7185' },
  teclados: { name: 'Teclados', position: { x: 8, y: 35 }, color: '#fda4af' }
};

// Report Header Component
const ReportHeader = ({ title, eventName, date }) => (
  <div className="border-b-2 border-slate-800 pb-4 mb-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">PANEL DE GESTIÓN DE CONVOCATORIAS</h1>
        <p className="text-sm text-slate-600 mt-1">Sistema de gestión musical profesional</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-500">Fecha de generación:</p>
        <p className="font-mono text-sm">{date || new Date().toLocaleString('es-ES')}</p>
      </div>
    </div>
    <div className="mt-4 bg-slate-100 p-3 rounded">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      {eventName && <p className="text-sm text-slate-600">Evento: {eventName}</p>}
    </div>
  </div>
);

// Report Footer Component
const ReportFooter = () => (
  <div className="mt-8 pt-6 border-t-2 border-slate-300">
    <div className="grid grid-cols-3 gap-8">
      <div className="text-center">
        <div className="border-t border-slate-400 pt-2 mt-8">
          <p className="text-xs text-slate-500">Dirección Artística</p>
        </div>
      </div>
      <div className="text-center">
        <div className="border-t border-slate-400 pt-2 mt-8">
          <p className="text-xs text-slate-500">Producción</p>
        </div>
      </div>
      <div className="text-center">
        <div className="border-t border-slate-400 pt-2 mt-8">
          <p className="text-xs text-slate-500">Gerencia</p>
        </div>
      </div>
    </div>
    <p className="text-xs text-slate-400 text-center mt-6">
      Documento generado automáticamente. Válido sin firma para uso interno.
    </p>
  </div>
);

// Orchestra Stage Layout Component
const OrchestraLayout = ({ contacts, contactsData }) => {
  // Group contacts by instrument section
  const groupedContacts = useMemo(() => {
    const groups = {};
    contacts.forEach(contact => {
      const instrument = contact.especialidad?.toLowerCase() || '';
      let section = 'otros';
      
      if (instrument.includes('violín') || instrument.includes('violin')) {
        const data = contactsData[contact.id] || {};
        section = data.atril_numero <= 8 ? 'primeros_violines' : 'segundos_violines';
      } else if (instrument.includes('viola')) section = 'violas';
      else if (instrument.includes('violonchelo') || instrument.includes('cello')) section = 'violonchelos';
      else if (instrument.includes('contrabajo')) section = 'contrabajos';
      else if (instrument.includes('flauta')) section = 'flautas';
      else if (instrument.includes('oboe')) section = 'oboes';
      else if (instrument.includes('clarinete')) section = 'clarinetes';
      else if (instrument.includes('fagot')) section = 'fagotes';
      else if (instrument.includes('trompa')) section = 'trompas';
      else if (instrument.includes('trompeta')) section = 'trompetas';
      else if (instrument.includes('trombón') || instrument.includes('trombon')) section = 'trombones';
      else if (instrument.includes('tuba')) section = 'tubas';
      else if (instrument.includes('percusión') || instrument.includes('timbal')) section = 'percusion';
      else if (instrument.includes('arpa')) section = 'arpas';
      else if (instrument.includes('piano') || instrument.includes('órgano') || instrument.includes('clave')) section = 'teclados';
      
      if (!groups[section]) groups[section] = [];
      groups[section].push(contact);
    });
    return groups;
  }, [contacts, contactsData]);

  return (
    <div className="bg-gradient-to-b from-amber-50 to-orange-50 rounded-lg p-6 relative" style={{ minHeight: '500px' }}>
      {/* Stage Arc */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-16 bg-slate-200 rounded-t-full flex items-center justify-center">
        <span className="text-xs font-semibold text-slate-600">DIRECTOR</span>
      </div>
      
      {/* Orchestra Sections */}
      {Object.entries(ORCHESTRA_SECTIONS).map(([key, section]) => {
        const sectionContacts = groupedContacts[key] || [];
        if (sectionContacts.length === 0) return null;
        
        return (
          <div
            key={key}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${section.position.x}%`, top: `${section.position.y}%` }}
          >
            <div 
              className="rounded-lg p-2 shadow-md border-2 min-w-[100px]"
              style={{ backgroundColor: section.color + '20', borderColor: section.color }}
            >
              <p className="text-xs font-bold text-center mb-1" style={{ color: section.color }}>
                {section.name}
              </p>
              <div className="space-y-0.5">
                {sectionContacts.slice(0, 6).map((contact, idx) => {
                  const data = contactsData[contact.id] || {};
                  return (
                    <div key={contact.id} className="text-[10px] bg-white/80 rounded px-1 py-0.5 flex justify-between">
                      <span className="truncate max-w-[60px]">{contact.apellidos}</span>
                      {data.atril_numero && (
                        <span className="font-mono text-slate-500">{data.atril_numero}{data.atril_letra}</span>
                      )}
                    </div>
                  );
                })}
                {sectionContacts.length > 6 && (
                  <p className="text-[9px] text-center text-slate-500">+{sectionContacts.length - 6} más</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Legend */}
      <div className="absolute bottom-2 right-2 bg-white/90 p-2 rounded text-xs">
        <p className="font-semibold mb-1">Total: {contacts.length} músicos</p>
      </div>
    </div>
  );
};

// Filters Panel Component
const FiltersPanel = ({ 
  events, selectedEvent, onEventChange,
  sections, selectedSections, onSectionsChange,
  onGenerateAll, onExport, onEmail
}) => {
  const instrumentSections = [
    'Cuerda', 'Viento Madera', 'Viento Metal', 'Percusión', 'Teclados', 'Coralistas', 'Otros'
  ];

  return (
    <div className="w-80 bg-white border-l border-slate-200 p-4 overflow-y-auto">
      <h3 className="font-semibold text-slate-900 mb-4">Filtros y Opciones</h3>
      
      {/* Event Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Evento</label>
        <select
          value={selectedEvent}
          onChange={(e) => onEventChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
          data-testid="report-event-filter"
        >
          <option value="all">Todos los eventos</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>
      </div>

      {/* Section Filters */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Secciones</label>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {instrumentSections.map(section => (
            <label key={section} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedSections.includes(section)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onSectionsChange([...selectedSections, section]);
                  } else {
                    onSectionsChange(selectedSections.filter(s => s !== section));
                  }
                }}
                className="w-4 h-4 rounded border-slate-300"
              />
              {section}
            </label>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Rango de fechas</label>
        <div className="space-y-2">
          <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
          <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm" />
        </div>
      </div>

      <hr className="my-4" />

      {/* Export Options */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-700">Exportar</h4>
        <button
          onClick={() => onExport('pdf')}
          className="w-full px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 flex items-center justify-center gap-2"
          data-testid="export-pdf-btn"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
          Exportar PDF
        </button>
        <button
          onClick={() => onExport('excel')}
          className="w-full px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 flex items-center justify-center gap-2"
          data-testid="export-excel-btn"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Exportar Excel
        </button>
        <button
          onClick={() => onExport('xml')}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
          </svg>
          Exportar XML
        </button>
      </div>

      <hr className="my-4" />

      {/* Email */}
      <button
        onClick={onEmail}
        className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-md text-sm hover:bg-slate-50 flex items-center justify-center gap-2"
        data-testid="send-email-btn"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        Enviar por correo
      </button>

      <hr className="my-4" />

      {/* Generate All */}
      <button
        onClick={onGenerateAll}
        className="w-full px-3 py-2 bg-slate-900 text-white rounded-md text-sm hover:bg-slate-800 flex items-center justify-center gap-2"
        data-testid="generate-all-btn"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Generar todos los informes
      </button>
    </div>
  );
};

// Report A - Plantilla Definitiva
const ReportPlantillaDefinitiva = ({ event, contacts, contactsData, viewMode }) => {
  if (viewMode === 'orchestra') {
    return (
      <div className="print-page">
        <ReportHeader title="Informe de Plantilla Definitiva - Plano de Orquesta" eventName={event?.name} />
        <OrchestraLayout contacts={contacts} contactsData={contactsData} />
        <ReportFooter />
      </div>
    );
  }

  return (
    <div className="print-page">
      <ReportHeader title="Informe de Plantilla Definitiva" eventName={event?.name} />
      
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-3 py-2 text-left">Apellidos</th>
            <th className="border border-slate-300 px-3 py-2 text-left">Nombre</th>
            <th className="border border-slate-300 px-3 py-2 text-left">Sección</th>
            <th className="border border-slate-300 px-3 py-2 text-left">Instrumento</th>
            <th className="border border-slate-300 px-3 py-2 text-center">Categoría</th>
            <th className="border border-slate-300 px-3 py-2 text-center">Atril</th>
            <th className="border border-slate-300 px-3 py-2 text-left">Email</th>
            <th className="border border-slate-300 px-3 py-2 text-left">Teléfono</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map(contact => {
            const data = contactsData[contact.id] || {};
            return (
              <tr key={contact.id} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-3 py-2">{contact.apellidos}</td>
                <td className="border border-slate-300 px-3 py-2">{contact.nombre}</td>
                <td className="border border-slate-300 px-3 py-2">{contact.especialidad?.split(' ')[0] || '-'}</td>
                <td className="border border-slate-300 px-3 py-2">{contact.especialidad}</td>
                <td className="border border-slate-300 px-3 py-2 text-center">{contact.categoria}</td>
                <td className="border border-slate-300 px-3 py-2 text-center font-mono">
                  {data.atril_numero || '-'}{data.atril_letra || ''}
                </td>
                <td className="border border-slate-300 px-3 py-2 text-xs">{contact.email}</td>
                <td className="border border-slate-300 px-3 py-2">{contact.telefono}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      <div className="mt-4 text-sm text-slate-600">
        <p><strong>Total contactos:</strong> {contacts.length}</p>
      </div>
      
      <ReportFooter />
    </div>
  );
};

// Report B - Informe Económico
const ReportEconomico = ({ event, contacts, contactsData, eventResponses }) => {
  const calculateTotals = () => {
    let totalPrevisto = 0;
    let totalReal = 0;
    let totalExtras = 0;
    const sectionTotals = {};

    contacts.forEach(contact => {
      const data = contactsData[contact.id] || {};
      const responses = eventResponses.find(r => r.contact_id === contact.id)?.responses || {};
      
      const totalDates = Object.keys(responses).length || 1;
      const previstoYes = Object.values(responses).filter(v => v === 'si').length;
      const previstoPct = previstoYes / totalDates;
      
      const realValues = Object.values(data.asistencia_real || {});
      const realPct = realValues.length > 0 
        ? realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length / 100
        : 0;

      const cacheBase = 100;
      const cachePrevisto = cacheBase * previstoPct;
      const cacheReal = cacheBase * realPct;
      const extras = (parseFloat(data.cache_extra) || 0) + 
                     (parseFloat(data.extra_produccion) || 0) + 
                     (parseFloat(data.extra_transporte) || 0) + 
                     (parseFloat(data.otros_gastos) || 0);

      totalPrevisto += cachePrevisto;
      totalReal += cacheReal;
      totalExtras += extras;

      const section = contact.especialidad?.split(' ')[0] || 'Otros';
      if (!sectionTotals[section]) sectionTotals[section] = { previsto: 0, real: 0, extras: 0 };
      sectionTotals[section].previsto += cachePrevisto;
      sectionTotals[section].real += cacheReal;
      sectionTotals[section].extras += extras;
    });

    return { totalPrevisto, totalReal, totalExtras, sectionTotals };
  };

  const totals = calculateTotals();

  return (
    <div className="print-page">
      <ReportHeader title="Informe Económico por Evento" eventName={event?.name} />
      
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-100 p-4 rounded">
          <p className="text-sm text-slate-600">Caché Previsto</p>
          <p className="text-xl font-bold font-mono">{Math.round(totals.totalPrevisto)}€</p>
        </div>
        <div className="bg-blue-100 p-4 rounded">
          <p className="text-sm text-blue-600">Caché Real</p>
          <p className="text-xl font-bold font-mono text-blue-800">{Math.round(totals.totalReal)}€</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded">
          <p className="text-sm text-yellow-600">Extras</p>
          <p className="text-xl font-bold font-mono text-yellow-800">{Math.round(totals.totalExtras)}€</p>
        </div>
        <div className="bg-green-100 p-4 rounded">
          <p className="text-sm text-green-600">Total General</p>
          <p className="text-xl font-bold font-mono text-green-800">{Math.round(totals.totalReal + totals.totalExtras)}€</p>
        </div>
      </div>

      {/* Section breakdown */}
      <h3 className="font-semibold mb-2">Desglose por Sección</h3>
      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-3 py-2 text-left">Sección</th>
            <th className="border border-slate-300 px-3 py-2 text-right">Previsto</th>
            <th className="border border-slate-300 px-3 py-2 text-right">Real</th>
            <th className="border border-slate-300 px-3 py-2 text-right">Extras</th>
            <th className="border border-slate-300 px-3 py-2 text-right bg-green-50">Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(totals.sectionTotals).map(([section, vals]) => (
            <tr key={section}>
              <td className="border border-slate-300 px-3 py-2">{section}</td>
              <td className="border border-slate-300 px-3 py-2 text-right font-mono">{Math.round(vals.previsto)}€</td>
              <td className="border border-slate-300 px-3 py-2 text-right font-mono">{Math.round(vals.real)}€</td>
              <td className="border border-slate-300 px-3 py-2 text-right font-mono">{Math.round(vals.extras)}€</td>
              <td className="border border-slate-300 px-3 py-2 text-right font-mono font-bold bg-green-50">{Math.round(vals.real + vals.extras)}€</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-200 font-bold">
            <td className="border border-slate-300 px-3 py-2">TOTAL</td>
            <td className="border border-slate-300 px-3 py-2 text-right font-mono">{Math.round(totals.totalPrevisto)}€</td>
            <td className="border border-slate-300 px-3 py-2 text-right font-mono">{Math.round(totals.totalReal)}€</td>
            <td className="border border-slate-300 px-3 py-2 text-right font-mono">{Math.round(totals.totalExtras)}€</td>
            <td className="border border-slate-300 px-3 py-2 text-right font-mono bg-green-100">{Math.round(totals.totalReal + totals.totalExtras)}€</td>
          </tr>
        </tfoot>
      </table>

      {/* Deviation */}
      <div className="p-4 bg-slate-50 rounded">
        <h4 className="font-semibold mb-2">Desviación Presupuestaria</h4>
        <p className="text-sm">
          Diferencia: <span className={`font-bold ${totals.totalReal > totals.totalPrevisto ? 'text-red-600' : 'text-green-600'}`}>
            {totals.totalReal > totals.totalPrevisto ? '+' : ''}{Math.round(totals.totalReal - totals.totalPrevisto)}€
          </span>
          <span className="text-slate-500 ml-2">
            ({totals.totalPrevisto > 0 ? Math.round(((totals.totalReal - totals.totalPrevisto) / totals.totalPrevisto) * 100) : 0}%)
          </span>
        </p>
      </div>

      <ReportFooter />
    </div>
  );
};

// Report C - Estadístico Asistencia
const ReportAsistencia = ({ event, contacts, contactsData, eventResponses }) => {
  const getColor = (pct) => {
    if (pct <= 30) return 'bg-red-100 text-red-700';
    if (pct <= 60) return 'bg-orange-100 text-orange-700';
    if (pct <= 80) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  const attendanceData = contacts.map(contact => {
    const responses = eventResponses.find(r => r.contact_id === contact.id)?.responses || {};
    const data = contactsData[contact.id] || {};
    
    const totalDates = Object.keys(responses).length || 1;
    const previstoYes = Object.values(responses).filter(v => v === 'si').length;
    const previstoPct = Math.round((previstoYes / totalDates) * 100);
    
    const realValues = Object.values(data.asistencia_real || {});
    const realPct = realValues.length > 0 
      ? Math.round(realValues.reduce((a, b) => a + (parseFloat(b) || 0), 0) / realValues.length)
      : 0;

    return {
      ...contact,
      previstoPct,
      realPct,
      hasComments: !!data.atril_comentarios
    };
  });

  // Section averages
  const sectionAverages = {};
  attendanceData.forEach(c => {
    const section = c.especialidad?.split(' ')[0] || 'Otros';
    if (!sectionAverages[section]) sectionAverages[section] = { previsto: [], real: [] };
    sectionAverages[section].previsto.push(c.previstoPct);
    sectionAverages[section].real.push(c.realPct);
  });

  const chartData = Object.entries(sectionAverages).map(([section, vals]) => ({
    name: section,
    Previsto: Math.round(vals.previsto.reduce((a, b) => a + b, 0) / vals.previsto.length),
    Real: Math.round(vals.real.reduce((a, b) => a + b, 0) / vals.real.length)
  }));

  return (
    <div className="print-page">
      <ReportHeader title="Informe Estadístico de Asistencia" eventName={event?.name} />
      
      {/* Chart */}
      <div className="mb-6 h-64">
        <h3 className="font-semibold mb-2">Asistencia por Sección (%)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Previsto" fill="#94a3b8" />
            <Bar dataKey="Real" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-3 py-2 text-left">Apellidos</th>
            <th className="border border-slate-300 px-3 py-2 text-left">Nombre</th>
            <th className="border border-slate-300 px-3 py-2 text-left">Instrumento</th>
            <th className="border border-slate-300 px-3 py-2 text-center">% Previsto</th>
            <th className="border border-slate-300 px-3 py-2 text-center">% Real</th>
            <th className="border border-slate-300 px-3 py-2 text-center">Obs.</th>
          </tr>
        </thead>
        <tbody>
          {attendanceData.map(contact => (
            <tr key={contact.id}>
              <td className="border border-slate-300 px-3 py-2">{contact.apellidos}</td>
              <td className="border border-slate-300 px-3 py-2">{contact.nombre}</td>
              <td className="border border-slate-300 px-3 py-2">{contact.especialidad}</td>
              <td className="border border-slate-300 px-3 py-2 text-center">
                <span className={`px-2 py-1 rounded ${getColor(contact.previstoPct)}`}>{contact.previstoPct}%</span>
              </td>
              <td className="border border-slate-300 px-3 py-2 text-center">
                <span className={`px-2 py-1 rounded ${getColor(contact.realPct)}`}>{contact.realPct}%</span>
              </td>
              <td className="border border-slate-300 px-3 py-2 text-center">
                {contact.hasComments && <span className="text-amber-600">*</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ReportFooter />
    </div>
  );
};

// Report D - Configuración de Eventos
const ReportConfiguracion = ({ event }) => {
  if (!event) return null;

  return (
    <div className="print-page">
      <ReportHeader title="Informe de Configuración del Evento" eventName={event.name} />
      
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="bg-slate-50 p-4 rounded">
          <h3 className="font-semibold mb-3">Datos del Evento</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-600">Nombre:</span> <strong>{event.name}</strong></div>
            <div><span className="text-slate-600">Fecha:</span> <strong>{event.date}</strong></div>
            <div><span className="text-slate-600">Hora:</span> <strong>{event.time}</strong></div>
          </div>
        </div>

        {/* Rehearsals */}
        {event.rehearsals?.length > 0 && (
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-semibold mb-3">Ensayos Programados</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-100">
                  <th className="px-3 py-2 text-left">Ensayo</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Hora inicio</th>
                  <th className="px-3 py-2 text-left">Hora fin</th>
                </tr>
              </thead>
              <tbody>
                {event.rehearsals.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">Ensayo {idx + 1}</td>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.start}</td>
                    <td className="px-3 py-2">{r.end}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Instrumentation */}
        {event.instrumentation && (
          <div className="bg-green-50 p-4 rounded">
            <h3 className="font-semibold mb-3">Plantilla Requerida</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {Object.entries(event.instrumentation).map(([section, instruments]) => (
                <div key={section} className="bg-white p-2 rounded">
                  <p className="font-medium capitalize mb-1">{section.replace('_', ' ')}</p>
                  {typeof instruments === 'object' && Object.entries(instruments).map(([inst, count]) => (
                    <p key={inst} className="text-xs text-slate-600">
                      {inst.replace('_', ' ')}: <span className="font-mono">{count}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Program */}
        {event.program?.length > 0 && (
          <div className="bg-purple-50 p-4 rounded">
            <h3 className="font-semibold mb-3">Programa Musical</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-purple-100">
                  <th className="px-3 py-2 text-left">Duración</th>
                  <th className="px-3 py-2 text-left">Autor</th>
                  <th className="px-3 py-2 text-left">Obra</th>
                </tr>
              </thead>
              <tbody>
                {event.program.map((p, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">{p.duration}</td>
                    <td className="px-3 py-2">{p.author}</td>
                    <td className="px-3 py-2">{p.obra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReportFooter />
    </div>
  );
};

// Main Component
const Informes = () => {
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [eventResponses, setEventResponses] = useState({});
  const [contactsData, setContactsData] = useState({});
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [selectedSections, setSelectedSections] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef(null);

  const reports = [
    { id: 'plantilla', name: 'A. Informe de Plantilla Definitiva', description: 'Lista de contactos confirmados y plano de orquesta' },
    { id: 'economico', name: 'B. Informe Económico por Evento', description: 'Cachés, extras y totales económicos' },
    { id: 'asistencia', name: 'C. Informe Estadístico de Asistencia', description: 'Porcentajes de asistencia y gráficos' },
    { id: 'configuracion', name: 'D. Informe de Configuración de Eventos', description: 'Datos completos de configuración' },
    { id: 'combinado', name: 'E. Informe Combinado "Todo en Uno"', description: 'Reporte ejecutivo completo' }
  ];

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

  const currentEvent = selectedEvent !== 'all' ? events.find(e => e.id === selectedEvent) : events[0];
  const currentResponses = currentEvent ? (eventResponses[currentEvent.id] || []) : [];

  const handleExport = (format) => {
    if (format === 'pdf') {
      window.print();
    } else if (format === 'excel') {
      // Generate CSV
      const headers = ['Apellidos', 'Nombre', 'Instrumento', 'Email', 'Teléfono'];
      const rows = contacts.map(c => [c.apellidos, c.nombre, c.especialidad, c.email, c.telefono]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `informe_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else if (format === 'xml') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Informe>\n';
      contacts.forEach(c => {
        xml += `  <Contacto>\n    <Nombre>${c.nombre} ${c.apellidos}</Nombre>\n    <IBAN>${c.iban || ''}</IBAN>\n  </Contacto>\n`;
      });
      xml += '</Informe>';
      const blob = new Blob([xml], { type: 'application/xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `informe_${activeReport}.xml`;
      link.click();
    }
    alert(`Informe exportado en formato ${format.toUpperCase()}`);
  };

  const handleEmail = () => {
    alert('Función de envío por correo (simulada). En producción se integraría con Gmail API.');
  };

  const handleGenerateAll = () => {
    alert('Generando todos los informes para todos los eventos de la temporada...');
  };

  const renderPreview = () => {
    if (!activeReport || !previewOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto" ref={previewRef}>
          <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
            <h3 className="font-semibold">Vista previa del informe</h3>
            <div className="flex items-center gap-2">
              {activeReport === 'plantilla' && (
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded text-sm"
                >
                  <option value="list">Formato Lista</option>
                  <option value="orchestra">Plano de Orquesta</option>
                </select>
              )}
              <button
                onClick={() => handleExport('pdf')}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Imprimir/PDF
              </button>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="p-6">
            {activeReport === 'plantilla' && (
              <ReportPlantillaDefinitiva event={currentEvent} contacts={contacts} contactsData={contactsData} viewMode={viewMode} />
            )}
            {activeReport === 'economico' && (
              <ReportEconomico event={currentEvent} contacts={contacts} contactsData={contactsData} eventResponses={currentResponses} />
            )}
            {activeReport === 'asistencia' && (
              <ReportAsistencia event={currentEvent} contacts={contacts} contactsData={contactsData} eventResponses={currentResponses} />
            )}
            {activeReport === 'configuracion' && (
              <ReportConfiguracion event={currentEvent} />
            )}
            {activeReport === 'combinado' && (
              <div className="space-y-8">
                <ReportPlantillaDefinitiva event={currentEvent} contacts={contacts} contactsData={contactsData} viewMode="list" />
                <div className="border-t-4 border-slate-300 pt-8">
                  <ReportPlantillaDefinitiva event={currentEvent} contacts={contacts} contactsData={contactsData} viewMode="orchestra" />
                </div>
                <div className="border-t-4 border-slate-300 pt-8">
                  <ReportEconomico event={currentEvent} contacts={contacts} contactsData={contactsData} eventResponses={currentResponses} />
                </div>
                <div className="border-t-4 border-slate-300 pt-8">
                  <ReportAsistencia event={currentEvent} contacts={contacts} contactsData={contactsData} eventResponses={currentResponses} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full" data-testid="informes-page">
      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <header className="mb-6">
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Generación de Informes</h1>
          <p className="font-ibm text-slate-600 mt-1">Visualiza, exporta e imprime informes corporativos</p>
        </header>

        {/* Reports List */}
        <div className="space-y-3">
          {reports.map(report => (
            <div
              key={report.id}
              className={`border rounded-lg overflow-hidden transition-all ${activeReport === report.id ? 'border-slate-400 shadow-md' : 'border-slate-200'}`}
            >
              <button
                onClick={() => setActiveReport(activeReport === report.id ? null : report.id)}
                className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors text-left"
                data-testid={`report-${report.id}`}
              >
                <div>
                  <h3 className="font-semibold text-slate-900">{report.name}</h3>
                  <p className="text-sm text-slate-500">{report.description}</p>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform ${activeReport === report.id ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              
              {activeReport === report.id && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPreviewOpen(true)}
                      className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm hover:bg-slate-800 flex items-center gap-2"
                      data-testid={`preview-${report.id}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                      Previsualizar
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 flex items-center gap-2"
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => handleExport('excel')}
                      className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 flex items-center gap-2"
                    >
                      Excel
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm hover:bg-slate-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                      </svg>
                      Imprimir
                    </button>
                    <button
                      onClick={handleEmail}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm hover:bg-slate-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                      Enviar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Filters */}
      <FiltersPanel
        events={events}
        selectedEvent={selectedEvent}
        onEventChange={setSelectedEvent}
        sections={[]}
        selectedSections={selectedSections}
        onSectionsChange={setSelectedSections}
        onGenerateAll={handleGenerateAll}
        onExport={handleExport}
        onEmail={handleEmail}
      />

      {/* Preview Modal */}
      {renderPreview()}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-page, .print-page * { visibility: visible; }
          .print-page { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default Informes;
