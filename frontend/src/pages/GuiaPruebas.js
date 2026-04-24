// Guía interactiva de pruebas para el equipo (NO está en el menú de la app —
// se mantiene como referencia interna fuera del menú lateral).
// Casos prácticos por gestor + por músico + queries SQL de verificación.
// Cada paso puede llevar una propiedad `ruta` que muestra un botón "Ir →"
// con enlace directo a la página correspondiente.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// ==================================================================
// Datos de los casos
// pasos: array de { texto, ruta? }
// ==================================================================
const CASOS_GESTORES = [
  {
    email: 'palvarez@netmetrix.es',
    nombre: 'Pablo Álvarez',
    titulo: 'Configuración de un nuevo evento de temporada',
    pasos: [
      { texto: 'Entra como gestor con palvarez@netmetrix.es / Opus2026!', ruta: '/login' },
      { texto: 'Ve a Configuración → Eventos', ruta: '/configuracion/eventos' },
      { texto: 'Crea evento: "Concierto de Primavera 2026"\nFecha: 15/06/2026, Lugar: Auditorio Nacional' },
      { texto: 'Añade 2 ensayos:\n- 01/06/2026 19:00-21:00 Sala Principal\n- 08/06/2026 19:00-21:00 Sala Principal' },
      { texto: 'En el primer ensayo, desconvoca Percusión' },
      { texto: 'Añade logística: transporte ida Madrid→Auditorio\n08/06/2026 17:00, punto recogida: Plaza Mayor 16:45' },
      { texto: 'Guarda el evento' },
      { texto: 'Ve a Presupuestos y aplica la plantilla base al nuevo evento', ruta: '/configuracion/presupuestos' },
    ],
    sql: `SELECT nombre, estado FROM eventos WHERE nombre LIKE '%Primavera%';
SELECT count(*) FROM ensayos
  WHERE evento_id = (SELECT id FROM eventos WHERE nombre LIKE '%Primavera%');`,
  },
  {
    email: 'malvarez@e.csmb.es',
    nombre: 'María Álvarez',
    titulo: 'Gestión de músicos y seguimiento',
    pasos: [
      { texto: 'Entra como gestora con malvarez@e.csmb.es / Opus2026!', ruta: '/login' },
      { texto: 'Ve a Base de datos de músicos', ruta: '/admin/musicos' },
      { texto: 'Descarga la plantilla Excel e importa un músico nuevo:\nnombre=Test, apellidos=Importación, email=testimport@test.com, instrumento=Violín' },
      { texto: 'Ve a Seguimiento de Plantillas', ruta: '/seguimiento-convocatorias' },
      { texto: 'Publica el "Concierto de Primavera 2026" para los músicos: Pablo Álvarez y Ana Aparicio' },
      { texto: 'Verifica que aparecen como "Pendiente"' },
    ],
    sql: `SELECT u.nombre, u.apellidos, a.estado, a.publicado_musico
FROM asignaciones a
JOIN usuarios u ON u.id = a.usuario_id
JOIN eventos e ON e.id = a.evento_id
WHERE e.nombre LIKE '%Primavera%';`,
  },
  {
    email: 'calvarez@p.csmb.es',
    nombre: 'Carmen Álvarez',
    titulo: 'Presupuestos y configuración de cachets',
    pasos: [
      { texto: 'Entra como gestora con calvarez@p.csmb.es / Opus2026!', ruta: '/login' },
      { texto: 'Ve a Configuración → Presupuestos', ruta: '/configuracion/presupuestos' },
      { texto: 'Pulsa "⚙️ Configurar plantilla base" y configura:\nViolín Superior finalizado: 380€\nViolín Profesional finalizado: 280€' },
      { texto: 'Aplica la plantilla al "Concierto de Primavera" con el botón "📋 Aplicar plantilla base" en la cabecera del evento' },
      { texto: 'Modifica el caché de Violín Superior para ese evento a 400€ (ponderación 105%)' },
      { texto: 'Guarda con "Guardar todos"' },
    ],
    sql: `SELECT instrumento, nivel_estudios, importe, factor_ponderacion
FROM cachets_config
WHERE evento_id = (SELECT id FROM eventos WHERE nombre LIKE '%Primavera%');`,
  },
  {
    email: 'antonioalvarez.mellizo@gmail.com',
    nombre: 'Antonio Álvarez Mellizo',
    titulo: 'Plantillas definitivas y pagos',
    pasos: [
      { texto: 'Entra como gestor con antonioalvarez.mellizo@gmail.com / Opus2026!', ruta: '/login' },
      { texto: 'Ve a Seguimiento → confirma a Pablo Álvarez y Ana Aparicio para el Concierto de Primavera', ruta: '/seguimiento-convocatorias' },
      { texto: 'Ve a Plantillas Definitivas', ruta: '/plantillas-definitivas' },
      { texto: 'Introduce asistencia real:\nPablo: Ensayo1=100%, Ensayo2=80%\nAna: Ensayo1=100%, Ensayo2=100%' },
      { texto: 'Añade extra a Pablo: 50€ "Desplazamiento"' },
      { texto: 'Guarda cambios' },
      { texto: 'Ve a Asistencia → Gestión Económica', ruta: '/asistencia/pagos' },
      { texto: 'Verifica los totales y marca el pago de Ana como "Pagado"' },
    ],
    sql: `SELECT u.nombre, a.porcentaje_asistencia, ga.cache_extra, a.estado_pago
FROM asignaciones a
JOIN usuarios u ON u.id = a.usuario_id
LEFT JOIN gastos_adicionales ga
  ON ga.usuario_id = a.usuario_id AND ga.evento_id = a.evento_id
WHERE a.evento_id = (SELECT id FROM eventos WHERE nombre LIKE '%Primavera%');`,
  },
  {
    email: 'aaparicio@p.csmb.es',
    nombre: 'Ana Aparicio Núñez',
    titulo: 'Planificador de tareas e incidencias',
    pasos: [
      { texto: 'Entra como gestora con aaparicio@p.csmb.es / Opus2026!', ruta: '/login' },
      { texto: 'Ve a Administración → Tareas', ruta: '/admin/tareas' },
      { texto: 'Crea tarea: "Confirmar técnico de sonido"\nEvento: Concierto de Primavera\nDeadline: 01/06/2026, Prioridad: Alta\nResponsable: Alberto Serrano' },
      { texto: 'Verifica que aparece en vista Gantt' },
      { texto: 'Crea un reporte de incidencia con el botón flotante 💬 Feedback:\nTipo: Mejora\nPrioridad: Media\nDescripción: "Añadir campo de notas en la ficha del músico para observaciones internas del equipo gestor"' },
      { texto: 'Verifica en /admin/incidencias que aparece tu reporte', ruta: '/admin/incidencias' },
    ],
    sql: `SELECT titulo, estado, prioridad, responsable_nombre
FROM tareas WHERE titulo LIKE '%técnico%';
SELECT tipo, prioridad, descripcion, estado
FROM incidencias ORDER BY created_at DESC LIMIT 1;`,
  },
  {
    email: 'aserrano@p.csmb.es',
    nombre: 'Alberto Serrano',
    titulo: 'Recordatorios y comunicaciones',
    pasos: [
      { texto: 'Entra como gestor con aserrano@p.csmb.es / Opus2026!', ruta: '/login' },
      { texto: 'Ve al evento "Concierto de Primavera"', ruta: '/configuracion/eventos' },
      { texto: 'Activa recordatorio: "Aviso ensayo 24h antes"' },
      { texto: 'Personaliza el mensaje:\n"Hola {nombre}, mañana tienes ensayo de {evento} a las {hora} en {lugar}. ¡Te esperamos!"' },
      { texto: 'Ve a Administración → Historial de emails', ruta: '/admin/emails' },
      { texto: 'Verifica que aparecen emails previos' },
    ],
    sql: `SELECT tipo, activo, mensaje_personalizado
FROM recordatorios_config
WHERE evento_id = (SELECT id FROM eventos WHERE nombre LIKE '%Primavera%');`,
  },
  {
    email: 'msanchez@p.csmb.es',
    nombre: 'María Sánchez Cortés',
    titulo: 'Análisis económico y exportaciones',
    pasos: [
      { texto: 'Entra como gestora con msanchez@p.csmb.es / Opus2026!', ruta: '/login' },
      { texto: 'Ve a Asistencia → Análisis Económico', ruta: '/asistencia/analisis' },
      { texto: 'Revisa las estadísticas de la temporada' },
      { texto: 'Exporta a Excel toda la temporada' },
      { texto: 'Ve a Asistencia → Gestión Económica', ruta: '/asistencia/pagos' },
      { texto: 'Exporta XML SEPA del Concierto de Primavera' },
    ],
    sql: `SELECT COUNT(*) as total_musicos_confirmados,
       AVG(porcentaje_asistencia) as media_asistencia
FROM asignaciones
WHERE estado='confirmado'
  AND evento_id IN (SELECT id FROM eventos WHERE estado='abierto');`,
  },
  {
    email: 'sdiaz-ropero@p.csmb.es',
    nombre: 'Sara Díaz Ropero',
    titulo: 'Gestión de reclamaciones y actividad',
    pasos: [
      { texto: 'Entra como gestora con sdiaz-ropero@p.csmb.es / Opus2026!', ruta: '/login' },
      { texto: 'Ve a Administración → Reclamaciones', ruta: '/admin/reclamaciones' },
      { texto: 'Gestiona la reclamación de prueba existente:\ncambia estado a "En gestión"\nañade respuesta: "Revisando, contactamos en 48h"' },
      { texto: 'Ve a Administración → Registro de Actividad', ruta: '/admin/registro-actividad' },
      { texto: 'Verifica que aparecen las acciones recientes' },
    ],
    sql: `SELECT estado, respuesta_gestor, gestor_nombre
FROM reclamaciones ORDER BY created_at DESC LIMIT 1;
SELECT tipo, descripcion, usuario_nombre
FROM registro_actividad ORDER BY created_at DESC LIMIT 5;`,
  },
];

const CASOS_MUSICOS = [
  {
    email: 'pablo_alvarez_rabanos@telefonica.net',
    nombre: 'Pablo Álvarez Rábanos',
    titulo: 'Primer acceso y confirmar convocatoria',
    pasos: [
      { texto: 'Entra como músico con pablo_alvarez_rabanos@telefonica.net / Musico2026!', ruta: '/login' },
      { texto: 'Te pedirá cambiar contraseña en el primer login' },
      { texto: 'Establece nueva contraseña: PabloMusico2026!' },
      { texto: 'Completa tu perfil:\ninstrumento=Violín, nivel=Superior finalizado, teléfono, dirección, IBAN', ruta: '/portal/perfil' },
      { texto: 'Ve a Convocatorias', ruta: '/portal' },
      { texto: 'Busca el "Concierto de Primavera 2026"' },
      { texto: 'Indica disponibilidad: Ensayo1=Sí, Ensayo2=Sí' },
      { texto: 'Confirma asistencia al transporte' },
    ],
    sql: `SELECT asiste FROM disponibilidad d
JOIN ensayos e ON e.id = d.ensayo_id
JOIN eventos ev ON ev.id = e.evento_id
WHERE d.usuario_id = (
  SELECT id FROM usuarios WHERE email='pablo_alvarez_rabanos@telefonica.net'
)
  AND ev.nombre LIKE '%Primavera%';`,
  },
  {
    email: 'ana.aparicio.nunez@gmail.com',
    nombre: 'Ana Aparicio Núñez',
    titulo: 'Perfil completo con titulaciones',
    pasos: [
      { texto: 'Entra como música con ana.aparicio.nunez@gmail.com / Musico2026!', ruta: '/login' },
      { texto: 'Cambia contraseña en el primer login' },
      { texto: 'Completa perfil completo:\ninstrumento=Flauta, nivel=Superior finalizado', ruta: '/portal/perfil' },
      { texto: 'Añade titulación:\n"Grado Superior de Música"\nConservatorio Superior de Madrid, 2020' },
      { texto: 'Sube foto de perfil' },
      { texto: 'Ve a Mi Historial → Reclamaciones', ruta: '/portal/historial' },
      { texto: 'Crea reclamación:\ntipo=Pago incorrecto\ndescripción="El caché indicado no coincide con el acordado verbalmente"' },
    ],
    sql: `SELECT nombre, apellidos, instrumento, nivel_estudios, titulaciones
FROM usuarios WHERE email='ana.aparicio.nunez@gmail.com';`,
  },
];

const SQL_GLOBAL = [
  {
    titulo: 'Resumen de usuarios creados',
    sql: `SELECT rol, COUNT(*) as total, string_agg(email, ', ') as emails
FROM usuarios GROUP BY rol;`,
  },
  {
    titulo: 'Estado de todos los eventos',
    sql: `SELECT ev.nombre, ev.estado, COUNT(e.id) as ensayos
FROM eventos ev
LEFT JOIN ensayos e ON e.evento_id = ev.id
GROUP BY ev.id, ev.nombre, ev.estado
ORDER BY ev.created_at;`,
  },
  {
    titulo: 'Resumen de asignaciones por evento',
    sql: `SELECT ev.nombre AS evento,
  COUNT(CASE WHEN a.estado='confirmado' THEN 1 END) as confirmados,
  COUNT(CASE WHEN a.estado='pendiente'  THEN 1 END) as pendientes,
  COUNT(CASE WHEN a.publicado_musico    THEN 1 END) as publicados
FROM eventos ev
LEFT JOIN asignaciones a ON a.evento_id = ev.id
GROUP BY ev.id, ev.nombre;`,
  },
  {
    titulo: 'Verificar cachets configurados',
    sql: `SELECT ev.nombre AS evento,
  COUNT(*) as cachets_configurados,
  SUM(cc.importe) as total_cachets
FROM cachets_config cc
JOIN eventos ev ON ev.id = cc.evento_id
GROUP BY ev.id, ev.nombre;`,
  },
];

// ==================================================================
// Subcomponentes
// ==================================================================
const CopyableSql = ({ sql, testid }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <div className="relative">
      <pre className="bg-slate-900 text-emerald-300 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap" data-testid={testid}>{sql}</pre>
      <button onClick={onCopy} className="absolute top-2 right-2 text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-0.5 rounded">
        {copied ? '✓ copiado' : '📋 copiar'}
      </button>
    </div>
  );
};

const CasoAccordion = ({ idx, caso, color, onToggle, isOpen, testidPrefix }) => {
  const [done, setDone] = useState({});
  return (
    <div className={`border ${color} rounded-lg overflow-hidden`}>
      <button type="button" onClick={onToggle}
              data-testid={`${testidPrefix}-${idx}`}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-900">{caso.nombre}</div>
          <div className="text-xs text-slate-600">{caso.titulo}</div>
          <code className="text-[10px] text-slate-500">{caso.email}</code>
        </div>
        <span className="text-slate-400">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="border-t px-4 py-3 bg-slate-50 space-y-3">
          <div>
            <div className="text-xs font-bold text-slate-700 mb-2">PASOS</div>
            <ol className="space-y-2">
              {caso.pasos.map((p, i) => {
                const paso = typeof p === 'string' ? { texto: p } : p;
                return (
                  <li key={i} className="flex items-start gap-2">
                    <input type="checkbox" checked={!!done[i]} onChange={() => setDone(d => ({ ...d, [i]: !d[i] }))}
                           className="mt-0.5 w-4 h-4 accent-emerald-600" />
                    <span className={`text-sm whitespace-pre-line flex-1 ${done[i] ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      <strong className="text-slate-500 mr-1">{i+1}.</strong>{paso.texto}
                    </span>
                    {paso.ruta && (
                      <Link to={paso.ruta}
                            data-testid={`${testidPrefix}-${idx}-paso-${i}-link`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded">
                        Ir →
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 mb-1">✓ VERIFICACIÓN SQL</div>
            <CopyableSql sql={caso.sql} testid={`${testidPrefix}-sql-${idx}`} />
          </div>
        </div>
      )}
    </div>
  );
};

// ==================================================================
// Página principal
// ==================================================================
const GuiaPruebas = () => {
  const [openG, setOpenG] = useState({});
  const [openM, setOpenM] = useState({});

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="guia-pruebas-page">
      <h1 className="font-cabinet text-3xl font-bold text-slate-900 mb-1">📋 Guía de pruebas para el equipo</h1>
      <p className="text-sm text-slate-600 mb-6">Casos prácticos paso a paso, organizados por persona. Marca cada paso al completarlo, copia el SQL para verificar el resultado en Supabase, y usa los botones <strong>Ir →</strong> para abrir la página correspondiente en una nueva pestaña.</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-6 bg-blue-600 rounded" />
          Gestores ({CASOS_GESTORES.length})
        </h2>
        <div className="space-y-2">
          {CASOS_GESTORES.map((c, i) => (
            <CasoAccordion key={c.email} idx={i} caso={c} color="border-blue-200" testidPrefix="gestor"
                           isOpen={!!openG[i]} onToggle={() => setOpenG(o => ({ ...o, [i]: !o[i] }))} />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-6 bg-emerald-600 rounded" />
          Músicos ({CASOS_MUSICOS.length})
        </h2>
        <div className="space-y-2">
          {CASOS_MUSICOS.map((c, i) => (
            <CasoAccordion key={c.email} idx={i} caso={c} color="border-emerald-200" testidPrefix="musico"
                           isOpen={!!openM[i]} onToggle={() => setOpenM(o => ({ ...o, [i]: !o[i] }))} />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-6 bg-slate-700 rounded" />
          Verificaciones SQL globales
        </h2>
        <div className="space-y-3">
          {SQL_GLOBAL.map((s, i) => (
            <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 font-medium text-sm text-slate-800">{s.titulo}</div>
              <div className="p-3"><CopyableSql sql={s.sql} testid={`sql-global-${i}`} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GuiaPruebas;
