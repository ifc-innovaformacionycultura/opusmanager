// HelpPanel — Sistema de ayuda contextual para el panel gestor.
// Botón fijo "?" en esquina inferior izquierda. Al hacer clic se abre un panel
// lateral de 320px con el texto de ayuda correspondiente a la ruta actual.
// El estado (abierto/cerrado) se persiste en localStorage para la sesión.
// Solo visible si la ruta actual tiene texto definido; solo en el panel gestor.
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const HELP_TEXTS = {
  "/dashboard": {
    titulo: "Dashboard — Panel de control",
    texto: "Esta es tu pantalla principal. Aquí tienes un resumen de todo lo que necesita tu atención: eventos próximos, tareas pendientes, comentarios sin resolver, verificaciones pendientes de dirección y músicos sin activar.\n\nCada tarjeta es clickable y te lleva directamente a la sección correspondiente. El widget de próximos 7 días muestra ensayos, funciones y desplazamientos ordenados cronológicamente.",
  },
  "/admin/eventos": {
    titulo: "Configuración de Eventos",
    texto: "Aquí configuras todos los detalles de cada evento de la temporada. Cada evento tiene secciones coloreadas para facilitar la lectura: datos generales, ensayos y funciones, logística de músicos, programa musical, montaje, transporte de material y servicio de comedor.\n\nUsa los badges de verificación (🟡/✅/⚡) para indicar a dirección qué secciones están listas. Un evento no se puede publicar hasta que todas las secciones estén verificadas o autorizadas.\n\nUsa Ctrl+K para navegar rápidamente entre secciones.",
  },
  "/configuracion/eventos": {
    titulo: "Configuración de Eventos",
    texto: "Aquí configuras todos los detalles de cada evento de la temporada. Cada evento tiene secciones coloreadas para facilitar la lectura: datos generales, ensayos y funciones, logística de músicos, programa musical, montaje, transporte de material y servicio de comedor.\n\nUsa los badges de verificación (🟡/✅/⚡) para indicar a dirección qué secciones están listas. Un evento no se puede publicar hasta que todas las secciones estén verificadas o autorizadas.\n\nUsa Ctrl+K para navegar rápidamente entre secciones.",
  },
  "/configuracion/presupuestos": {
    titulo: "Presupuestos y Cachés",
    texto: "Configura los importes de caché para cada instrumento, nivel de estudios y evento. La matriz tiene 76 filas (19 instrumentos × 4 niveles).\n\nPrimero configura la plantilla base (valores por defecto para todos los eventos) y luego aplícala a cada evento con el botón 'Aplicar plantilla base'.\n\nPuedes ajustar individualmente el importe y la ponderación % para cada combinación. El Total € se calcula automáticamente: Caché × Ponderación / 100.",
  },
  "/admin/presupuestos": {
    titulo: "Presupuestos y Cachés",
    texto: "Configura los importes de caché para cada instrumento, nivel de estudios y evento. La matriz tiene 76 filas (19 instrumentos × 4 niveles).\n\nPrimero configura la plantilla base (valores por defecto para todos los eventos) y luego aplícala a cada evento con el botón 'Aplicar plantilla base'.\n\nPuedes ajustar individualmente el importe y la ponderación % para cada combinación. El Total € se calcula automáticamente: Caché × Ponderación / 100.",
  },
  "/seguimiento": {
    titulo: "Seguimiento de Convocatorias",
    texto: "Esta es la tabla central de gestión de plantillas. Cada fila es un músico y cada bloque de columnas es un evento.\n\nActiva el toggle 'Publicado' para que el músico vea el evento en su portal. Cambia el estado a 'Confirmar' cuando el músico confirme su asistencia.\n\nUsa el botón '📞 CRM' para desplegar el historial de contactos con cada músico por evento. Las acciones masivas (parte inferior) permiten publicar o confirmar a varios músicos a la vez.",
  },
  "/admin/seguimiento": {
    titulo: "Seguimiento de Convocatorias",
    texto: "Esta es la tabla central de gestión de plantillas. Cada fila es un músico y cada bloque de columnas es un evento.\n\nActiva el toggle 'Publicado' para que el músico vea el evento en su portal. Cambia el estado a 'Confirmar' cuando el músico confirme su asistencia.\n\nUsa el botón '📞 CRM' para desplegar el historial de contactos con cada músico por evento. Las acciones masivas (parte inferior) permiten publicar o confirmar a varios músicos a la vez.",
  },
  "/plantillas-definitivas": {
    titulo: "Plantillas Definitivas",
    texto: "Aquí registras la asistencia real de cada músico confirmado. Introduce el porcentaje de asistencia por ensayo (0-100%) y el sistema calcula automáticamente el % total y el caché real.\n\nIMPORTANTE: El caché se calcula siempre con el % que introduces manualmente. Los datos de fichaje QR (columnas grises) son solo informativos.\n\nUsa el campo 'Extra €' para añadir gastos adicionales justificados. Activa 'Mostrar datos QR' para ver la asistencia registrada por los músicos al escanear el código QR.",
  },
  "/admin/plantillas-definitivas": {
    titulo: "Plantillas Definitivas",
    texto: "Aquí registras la asistencia real de cada músico confirmado. Introduce el porcentaje de asistencia por ensayo (0-100%) y el sistema calcula automáticamente el % total y el caché real.\n\nIMPORTANTE: El caché se calcula siempre con el % que introduces manualmente. Los datos de fichaje QR (columnas grises) son solo informativos.\n\nUsa el campo 'Extra €' para añadir gastos adicionales justificados. Activa 'Mostrar datos QR' para ver la asistencia registrada por los músicos al escanear el código QR.",
  },
  "/asistencia/logistica": {
    titulo: "Logística y Servicios",
    texto: "Aquí ves un resumen de todos los músicos que han confirmado o tienen pendiente confirmar su transporte, alojamiento y servicio de comedor.\n\nLos acordeones están organizados por evento. Dentro de cada evento verás una tabla con el estado de confirmación de cada músico para cada servicio (✅ confirmado / ⏳ pendiente / — no aplica).\n\nLas alertas de fecha límite aparecen en rojo cuando quedan menos de 7 días.",
  },
  "/asistencia/registro": {
    titulo: "Registro de Asistencia QR",
    texto: "Aquí gestionas el sistema de fichaje por código QR para cada ensayo y función. Cada ensayo tiene un QR único que los músicos escanean con su móvil para registrar su entrada y salida.\n\nDescarga el QR con el botón '⬇️ Descargar' e imprímelo o muéstralo en pantalla en el lugar del ensayo.\n\nConfigura las reglas de fichaje: cuánto antes se puede fichar, si se computa tiempo extra antes de la hora oficial, y a partir de qué minutos de retraso se genera un aviso. La tabla de fichajes muestra en tiempo real quién ha fichado y quién no.",
  },
  "/asistencia/pagos": {
    titulo: "Gestión Económica",
    texto: "Aquí gestionas los pagos de todos los músicos confirmados. Verás el caché previsto, el caché real (basado en % de asistencia de Plantillas Definitivas), los extras y el total a pagar.\n\nUsa el toggle individual para marcar cada músico como pagado, o el botón 'Marcar todos como Pagado' para el evento completo.\n\nExporta a Excel para tu contabilidad o genera el XML SEPA para enviar directamente a tu banco. Recuerda que los músicos deben tener IBAN y SWIFT registrados para aparecer en el fichero SEPA.",
  },
  "/admin/gestion-economica": {
    titulo: "Gestión Económica",
    texto: "Aquí gestionas los pagos de todos los músicos confirmados. Verás el caché previsto, el caché real (basado en % de asistencia de Plantillas Definitivas), los extras y el total a pagar.\n\nUsa el toggle individual para marcar cada músico como pagado, o el botón 'Marcar todos como Pagado' para el evento completo.\n\nExporta a Excel para tu contabilidad o genera el XML SEPA para enviar directamente a tu banco. Recuerda que los músicos deben tener IBAN y SWIFT registrados para aparecer en el fichero SEPA.",
  },
  "/asistencia/analisis": {
    titulo: "Análisis Económico",
    texto: "Vista consolidada de todos los datos económicos de la temporada. Los 7 KPIs superiores muestran el resumen global: eventos activos, músicos convocados, confirmados, % asistencia media, coste previsto, real y diferencia.\n\nLos gráficos muestran la evolución por evento. Filtra por temporada para comparar ejercicios anteriores.\n\nExporta el análisis completo a Excel para informes de gestión.",
  },
  "/admin/analisis-economico": {
    titulo: "Análisis Económico",
    texto: "Vista consolidada de todos los datos económicos de la temporada. Los 7 KPIs superiores muestran el resumen global: eventos activos, músicos convocados, confirmados, % asistencia media, coste previsto, real y diferencia.\n\nLos gráficos muestran la evolución por evento. Filtra por temporada para comparar ejercicios anteriores.\n\nExporta el análisis completo a Excel para informes de gestión.",
  },
  "/asistencia/recibos-certificados": {
    titulo: "Recibos y Certificados",
    texto: "Aquí se generan automáticamente los documentos para los músicos.\n\nLos RECIBOS se generan cuando marcas un pago como 'Pagado' en Gestión Económica. Incluyen el importe bruto, IRPF aplicado e importe neto.\n\nLos CERTIFICADOS se generan cuando cambias el estado de un evento a 'Finalizado'. Incluyen las horas de participación del músico.\n\nPuedes regenerar, editar o descargar cualquier documento individualmente o todos juntos en un ZIP.",
  },
  "/admin/recibos-certificados": {
    titulo: "Recibos y Certificados",
    texto: "Aquí se generan automáticamente los documentos para los músicos.\n\nLos RECIBOS se generan cuando marcas un pago como 'Pagado' en Gestión Económica. Incluyen el importe bruto, IRPF aplicado e importe neto.\n\nLos CERTIFICADOS se generan cuando cambias el estado de un evento a 'Finalizado'. Incluyen las horas de participación del músico.\n\nPuedes regenerar, editar o descargar cualquier documento individualmente o todos juntos en un ZIP.",
  },
  "/informes": {
    titulo: "Informes",
    texto: "Genera documentos PDF profesionales con la información de uno o varios eventos. Selecciona el tipo de informe en el panel izquierdo y elige el evento o eventos.\n\nTipos disponibles:\nA — Plantilla definitiva y plano de orquesta\nB — Económico por evento\nC — Estadístico de asistencia\nD — Configuración completa del evento\nE — Hoja de servicio para transportista de material\nF — Hoja de servicio para transportista de músicos\nG — Carta de convocatoria por músico\nH — Todo en uno (A+B+C+D combinados)\nI — Hoja de trabajo para montaje\nJ — Hoja de trabajo para archivo\nK — Comidas por evento\n\nEl plano de orquesta (Informe A) tiene toggle entre vista herradura y por filas.",
  },
  "/admin/archivo": {
    titulo: "Archivo Musical",
    texto: "Catálogo completo de las partituras de la orquesta. Busca obras por título, autor o código usando el buscador (admite búsqueda sin acentos y con stemming en español).\n\nEn la ficha de cada obra puedes ver el inventario de partes: cuántas copias físicas hay de cada papel y si hay copia digital disponible.\n\nLa pestaña Alertas muestra las obras que necesitan revisión de material. Cuando vinculas una obra a un evento, el sistema avisa si hay suficientes copias para los atriles convocados o si la obra está en préstamo en esas fechas.\n\nGenera etiquetas PDF para las carpetas físicas con el botón '🏷️ Etiquetas'.",
  },
  "/admin/inventario": {
    titulo: "Inventario de Material",
    texto: "Registro de todo el material físico de la orquesta: instrumentos de percusión, mobiliario, iluminación, audio, tarimas y material de transporte.\n\nEl catálogo muestra la disponibilidad real (unidades totales menos prestadas). Registra préstamos internos (para eventos propios) o externos (a otras entidades).\n\nEl sistema avisa si programas el uso de un material que está prestado en las fechas del evento. Solo los usuarios con rol archivero, director general o administrador pueden modificar el inventario.",
  },
  "/admin/musicos": {
    titulo: "Base de Datos de Músicos",
    texto: "Gestión completa del directorio de músicos. Puedes crear músicos manualmente, importarlos desde Excel (descarga la plantilla con el botón 'Descargar plantilla') o aprobar las solicitudes de auto-registro.\n\nLa pestaña 'Solicitudes' muestra los músicos que se han registrado ellos mismos a través del enlace público de registro.\n\nUsa el botón '📨 Invitar' en la ficha de cada músico para enviarle el acceso por email, WhatsApp o enlace/QR.\n\nLos badges de estado indican si el músico ha activado su cuenta (⚪ pendiente / 📨 invitado / ✅ activado).",
  },
  "/configuracion/base-datos": {
    titulo: "Base de Datos de Músicos",
    texto: "Gestión completa del directorio de músicos. Puedes crear músicos manualmente, importarlos desde Excel (descarga la plantilla con el botón 'Descargar plantilla') o aprobar las solicitudes de auto-registro.\n\nLa pestaña 'Solicitudes' muestra los músicos que se han registrado ellos mismos a través del enlace público de registro.\n\nUsa el botón '📨 Invitar' en la ficha de cada músico para enviarle el acceso por email, WhatsApp o enlace/QR.\n\nLos badges de estado indican si el músico ha activado su cuenta (⚪ pendiente / 📨 invitado / ✅ activado).",
  },
  "/admin/historial-musicos": {
    titulo: "Historial y CRM",
    texto: "Vista completa del historial de cada músico: eventos en los que ha participado, pagos recibidos, certificados emitidos y todas las comunicaciones (emails, llamadas, WhatsApp) registradas en el CRM.\n\nBusca un músico en el buscador para cargar su historial.\n\nVista Timeline: muestra los eventos ordenados cronológicamente con colores por tipo.\nVista Gantt: muestra los eventos como barras por temporada.\n\nExporta el historial completo a Excel. Registra nuevos contactos con el botón '➕' junto a cada evento o desde la sección 'Historial de contactos' en la ficha del músico.",
  },
  "/admin/preview-musico": {
    titulo: "Vista Previa Portal Músico",
    texto: "Simula exactamente lo que ve un músico en su portal, en formato móvil. Selecciona un músico en el panel izquierdo y pulsa 'Generar vista previa' para ver su portal en el frame de iPhone derecho.\n\nEl token de vista previa dura 30 minutos. Pasado ese tiempo puedes regenerarlo.\n\nTodas las acciones del portal están deshabilitadas en la vista previa — no se pueden hacer cambios en nombre del músico.\n\nÚtil para soporte: cuando un músico dice que no ve algo, puedes ver exactamente lo mismo que él.",
  },
  "/admin/comunicaciones": {
    titulo: "Centro de Comunicaciones",
    texto: "Hub central de todas las comunicaciones de la orquesta.\n\n📥 Bandeja: emails recibidos en la cuenta de Gmail configurada. Sincroniza manualmente con '🔄 Sincronizar' o automáticamente cada 15 minutos. Al responder, el email queda registrado en el CRM del músico.\n\n📤 Enviados: historial de todos los emails enviados desde la plataforma.\n\n💬 Chat: mensajes internos del equipo gestor, organizados por canales.\n\n📋 Comentarios: hilos de comentarios contextuales dejados en cualquier sección de la app con el botón 💬 azul flotante.\n\n🔔 Recordatorios: gestión de los crons automáticos de push y email.\n\n🎨 Plantillas: editor visual de plantillas de email con 12 tipos de bloques.\n\n⚙️ Configuración: credenciales de Gmail, firma institucional y ajustes de envío.",
  },
  "/admin/tareas": {
    titulo: "Planificador de Tareas",
    texto: "Gestiona las tareas del equipo de gestión. Asigna tareas a gestores con fecha límite y prioridad. El responsable recibe una notificación push al ser asignado.\n\nVistas disponibles:\n📋 Lista: todas las tareas con indicadores de urgencia por colores\n📊 Gantt: barras por mes para visión temporal\n📅 Calendario mensual/semanal/anual: tareas en su día exacto\n\nLos eventos del calendario (ensayos, funciones, desplazamientos) aparecen automáticamente como eventos de solo lectura en el Gantt y Calendario.\n\nAñade @menciones en los comentarios para notificar a compañeros del equipo.",
  },
  "/admin/incidencias": {
    titulo: "Incidencias y Mejoras",
    texto: "Registro de todos los bugs y sugerencias de mejora reportados por el equipo.\n\nPara reportar una incidencia desde cualquier página usa el atajo Ctrl+Shift+B (o Cmd+Shift+B en Mac). Se abrirá un modal con captura automática de pantalla que puedes anotar antes de enviar.\n\nEl mini-dashboard superior muestra las estadísticas globales: incidencias abiertas, distribución por tipo y tiempo medio de resolución.\n\nLa pestaña 'Mis incidencias' filtra solo las reportadas por ti.",
  },
  "/admin/reclamaciones": {
    titulo: "Reclamaciones",
    texto: "Gestión de las reclamaciones enviadas por los músicos desde su portal.\n\nCuando un músico envía una reclamación (sobre pagos, cachés, etc.) aparece aquí con estado 'Pendiente'. Responde desde esta página con el campo de respuesta — el músico verá tu respuesta en su portal en 'Mi Historial'.\n\nCambia el estado a 'En gestión' cuando estés trabajando en ello y a 'Resuelto' cuando esté cerrado.\n\nEl badge del menú lateral indica cuántas reclamaciones están pendientes.",
  },
  "/admin/recordatorios": {
    titulo: "Recordatorios Push",
    texto: "Monitorización y control de los recordatorios automáticos del sistema.\n\nEl panel de Estado muestra los crons activos y sus próximas ejecuciones:\n- 09:00 Madrid: recordatorios de disponibilidad y logística\n- 12:00 Madrid: última llamada del día para quienes no han respondido aún\n- Lunes 08:00: resumen semanal a admins\n- Día 1 del mes: resumen mensual a músicos\n\nEl Historial muestra todos los push enviados con éxito o error. Suscriptores: músicos y gestores que han activado las notificaciones push.\n\nUsa 'Ejecutar ahora' para forzar la ejecución sin esperar al cron.",
  },
  "/admin/configuracion": {
    titulo: "Configuración de la Aplicación",
    texto: "Ajustes globales de OPUS MANAGER.\n\nDatos de la organización: nombre, CIF, dirección, teléfono — estos datos aparecen en todos los informes y documentos PDF.\n\nDirección artística: nombre y firma del director — aparecen en certificados y documentos oficiales.\n\nParámetros económicos: porcentaje de IRPF aplicado en los recibos de pago.\n\nIdentidad visual: colores corporativos y logos que se usan en emails y PDFs.\n\nReglas de fichaje: configuración global del sistema de asistencia QR que se precarga en todos los eventos.\n\nRegistro público: enlace y QR para que músicos nuevos se registren ellos mismos.\n\nBandeja de entrada: credenciales Gmail para sincronizar emails recibidos.",
  },
  "/admin/actividad": {
    titulo: "Registro de Actividad",
    texto: "Log completo de todas las acciones realizadas en la plataforma.\n\nRegistra automáticamente: creación y modificación de eventos, cambios de estado de músicos, pagos realizados, verificaciones de secciones, envíos de emails y más.\n\nFiltra por tipo de acción, usuario o rango de fechas para auditar cualquier cambio.\n\nÚtil para resolver disputas ('¿quién cambió esto?') y para auditorías internas.",
  },
};

const findHelp = (pathname) => {
  // Match exacto primero
  if (HELP_TEXTS[pathname]) return HELP_TEXTS[pathname];
  // Match por prefijo (más específico primero)
  const keys = Object.keys(HELP_TEXTS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (pathname.startsWith(k + "/") || pathname === k) return HELP_TEXTS[k];
  }
  if (pathname === "/") return HELP_TEXTS["/dashboard"];
  return null;
};

const LS_KEY = "helpPanel_open";

const HelpPanel = () => {
  const location = useLocation();
  const help = useMemo(() => findHelp(location.pathname), [location.pathname]);
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      return v === "true";
    } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, String(open)); } catch {}
  }, [open]);

  // Portal/músico: el layout envolvente solo se usa en panel gestor; aun así,
  // como salvaguarda, si la URL empieza por /portal no renderizamos.
  if (location.pathname.startsWith("/portal")) return null;
  if (!help) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="help-panel-toggle"
        title="Ayuda de esta página"
        className="fixed bottom-4 left-4 z-40 w-11 h-11 rounded-full bg-gray-500 hover:bg-gray-600 text-white shadow-lg flex items-center justify-center font-bold text-lg transition hover:scale-105"
        aria-label="Ayuda contextual"
      >
        ?
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setOpen(false)}
            data-testid="help-panel-backdrop"
          />
          <aside
            className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col border-r-2 border-gray-300 animate-slide-in-left"
            data-testid="help-panel"
            style={{ animation: "slideInLeft 0.25s ease-out" }}
          >
            <div className="bg-gray-600 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-white text-gray-600 flex items-center justify-center font-bold text-sm">?</span>
                <span className="font-semibold text-sm">{help.titulo}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                data-testid="help-panel-close"
                className="text-white hover:text-gray-200 text-xl leading-none"
                aria-label="Cerrar ayuda"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm text-slate-700 whitespace-pre-line leading-relaxed" data-testid="help-panel-contenido">
              {help.texto}
            </div>
            <div className="px-5 py-2 border-t border-slate-200 text-xs text-slate-400 text-center">
              Pulsa el botón <strong>?</strong> para ocultar
            </div>
          </aside>

          <style>{`
            @keyframes slideInLeft {
              from { transform: translateX(-100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </>
      )}
    </>
  );
};

export default HelpPanel;
