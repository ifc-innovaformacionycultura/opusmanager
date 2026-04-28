// Portal Calendar - Vista mensual para músicos
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const PortalCalendar = () => {
  const [eventos, setEventos] = useState([]);
  const [cursor, setCursor] = useState(new Date()); // Mes visible
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8001/api'
    : `${process.env.REACT_APP_BACKEND_URL}/api`;

  useEffect(() => {
    cargarCalendario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarCalendario = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/portal/calendario`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar calendario');
      const data = await res.json();
      setEventos(data.eventos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Agrupar eventos por fecha (YYYY-MM-DD)
  const eventosPorFecha = useMemo(() => {
    const map = {};
    eventos.forEach(ev => {
      if (!ev.fecha) return;
      const key = ev.fecha.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [eventos]);

  // Generar grid del mes
  const mesDias = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);

    // Día de la semana del primer día (0=dom, 1=lun..). Ajustamos para que lun=0
    let startWeekday = primerDia.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;

    const dias = [];
    // Padding inicio
    for (let i = 0; i < startWeekday; i++) dias.push(null);
    // Días del mes
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const fecha = new Date(year, month, d);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({ dia: d, key, fecha });
    }
    return dias;
  }, [cursor]);

  const cambiarMes = (delta) => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    setDiaSeleccionado(null);
  };

  const hoy = new Date();
  const isToday = (fecha) =>
    fecha &&
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate();

  const colorClass = (color) => {
    switch (color) {
      case 'blue': return 'bg-blue-500';
      case 'green': return 'bg-green-500';
      case 'orange': return 'bg-orange-500';
      case 'purple': return 'bg-purple-500';
      default: return 'bg-slate-500';
    }
  };

  const colorBadge = (color) => {
    switch (color) {
      case 'blue': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'green': return 'bg-green-100 text-green-800 border-green-200';
      case 'orange': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'purple': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div data-testid="portal-calendar" className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {MESES[cursor.getMonth()]} {cursor.getFullYear()}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => cambiarMes(-1)}
              data-testid="cal-prev"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setCursor(new Date())}
              data-testid="cal-today"
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-white text-sm font-medium"
            >
              Hoy
            </button>
            <button
              onClick={() => cambiarMes(1)}
              data-testid="cal-next"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium"
            >
              Siguiente →
            </button>
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span>Ensayos</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span>Conciertos/Funciones</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500"></span>Fechas límite</div>
        </div>
      </div>

      {/* Grid Calendario */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {mesDias.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="min-h-[90px] border-b border-r border-slate-100 bg-slate-50/30" />;
            }
            const evs = eventosPorFecha[cell.key] || [];
            const today = isToday(cell.fecha);
            return (
              <button
                key={cell.key}
                onClick={() => setDiaSeleccionado(cell.key)}
                data-testid={`cal-day-${cell.key}`}
                className={`min-h-[90px] border-b border-r border-slate-100 p-2 text-left hover:bg-slate-50 transition-colors relative ${
                  today ? 'bg-amber-50' : ''
                } ${diaSeleccionado === cell.key ? 'ring-2 ring-inset ring-slate-900' : ''}`}
              >
                <div className={`text-sm font-semibold mb-1 ${today ? 'text-amber-700' : 'text-slate-700'}`}>
                  {cell.dia}
                </div>
                <div className="space-y-1">
                  {evs.slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      className={`truncate text-[10px] text-white px-1.5 py-0.5 rounded ${colorClass(ev.color)}`}
                      title={ev.titulo}
                    >
                      {ev.hora ? `${ev.hora.slice(0, 5)} ` : ''}{ev.evento_nombre || ev.titulo}
                    </div>
                  ))}
                  {evs.length > 3 && (
                    <div className="text-[10px] text-slate-500">+{evs.length - 3} más</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle del día seleccionado */}
      {diaSeleccionado && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5" data-testid="cal-day-detail">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Eventos del {new Date(diaSeleccionado).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          {(eventosPorFecha[diaSeleccionado] || []).length === 0 ? (
            <p className="text-sm text-slate-500">No hay eventos este día.</p>
          ) : (
            <div className="space-y-3">
              {(eventosPorFecha[diaSeleccionado] || []).map(ev => (
                <div key={ev.id} className={`p-3 border rounded-lg ${colorBadge(ev.color)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{ev.titulo}</div>
                      {ev.hora && <div className="text-xs mt-1">🕒 {ev.hora.slice(0, 5)}</div>}
                      {ev.lugar && <div className="text-xs">📍 {ev.lugar}</div>}
                      {ev.aviso && (
                        <div className="mt-1.5 inline-block bg-amber-200 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded">
                          {ev.aviso}
                        </div>
                      )}
                      {(ev.tipo === 'transporte' || ev.tipo === 'alojamiento') && ev.confirmado && (
                        <div className="mt-1.5 inline-block bg-emerald-200 text-emerald-900 text-[11px] font-bold px-2 py-0.5 rounded">
                          ✅ Confirmado
                        </div>
                      )}
                    </div>
                    {ev.obligatorio && (
                      <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded font-bold flex-shrink-0">
                        OBLIGATORIO
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PortalCalendar;
