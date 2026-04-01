import React, { useState } from "react";

const ManualUsuario = () => {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const sections = [
    {
      id: "intro",
      title: "Introducción al Sistema",
      icon: "📚",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Bienvenido al <strong>Panel de Gestión de Convocatorias</strong>, un sistema integral diseñado para la gestión profesional 
            de temporadas musicales, eventos, contactos y pagos.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">🎯 Funcionalidades Principales</h4>
            <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
              <li>Gestión completa de temporadas y eventos musicales</li>
              <li>Base de datos de contactos con sistema de puntuación (baremo)</li>
              <li>Seguimiento de convocatorias y respuestas</li>
              <li>Generación de plantillas orquestales definitivas</li>
              <li>Control de asistencia y gestión de pagos</li>
              <li>Análisis económico con gráficos y exportaciones</li>
              <li>Sistema de informes profesionales (PDF, Excel, XML)</li>
              <li>Administración con roles y permisos granulares</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "dashboard",
      title: "Dashboard Principal",
      icon: "📊",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            El Dashboard es tu punto de partida. Aquí encontrarás un resumen visual de toda la actividad del sistema.
          </p>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-3">Métricas Principales</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                <div className="text-xs text-slate-500">Eventos</div>
                <div className="text-2xl font-bold text-slate-800">Total de eventos creados</div>
              </div>
              <div className="bg-white p-3 rounded border-l-4 border-green-500">
                <div className="text-xs text-slate-500">Contactos</div>
                <div className="text-2xl font-bold text-slate-800">Músicos en base de datos</div>
              </div>
              <div className="bg-white p-3 rounded border-l-4 border-purple-500">
                <div className="text-xs text-slate-500">Temporadas</div>
                <div className="text-2xl font-bold text-slate-800">Temporadas activas</div>
              </div>
            </div>
            <h4 className="font-semibold text-slate-800 mb-2 mt-4">Próximos Eventos</h4>
            <p className="text-sm text-slate-600">Lista cronológica de eventos próximos con información de ensayos programados.</p>
          </div>
        </div>
      )
    },
    {
      id: "config-temporada",
      title: "Configuración de Temporada",
      icon: "⚙️",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Esta sección te permite configurar los aspectos fundamentales de cada temporada musical.
          </p>
          
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-blue-200">
              <h4 className="font-semibold text-blue-900">📅 Gestión de Eventos</h4>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-700"><strong>Crear eventos:</strong> Define conciertos con fechas, horarios, ensayos y programa musical.</p>
              <p className="text-sm text-slate-700"><strong>Instrumentación:</strong> Especifica la plantilla orquestal requerida por secciones (cuerda, viento madera, viento metal, percusión, coro, teclados).</p>
              <p className="text-sm text-slate-700"><strong>Programa:</strong> Añade obras con duración, autor y observaciones.</p>
              <div className="bg-blue-50 p-3 rounded text-xs text-blue-800">
                💡 <strong>Tip:</strong> Los eventos se vinculan automáticamente a temporadas para facilitar la organización.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 py-3 border-b border-green-200">
              <h4 className="font-semibold text-green-900">🗄️ Base de Datos de Contactos</h4>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-700"><strong>Integración con Google Sheets:</strong> Conecta tu hoja de cálculo para importar músicos.</p>
              <p className="text-sm text-slate-700"><strong>Mapeo de columnas:</strong> Configura qué columnas de tu hoja corresponden a cada campo (DNI, nombre, apellidos, especialidad, categoría, etc.).</p>
              <p className="text-sm text-slate-700"><strong>Sincronización:</strong> Los datos se actualizan al importar desde Google Sheets.</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-3 border-b border-purple-200">
              <h4 className="font-semibold text-purple-900">✉️ Plantillas de Email</h4>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-700"><strong>Tipos de plantillas:</strong> Convocatoria temporada, convocatoria individual, envío de partituras.</p>
              <p className="text-sm text-slate-700"><strong>Variables dinámicas:</strong> Usa {`{{nombre}}`}, {`{{evento}}`}, {`{{fecha}}`} para personalización automática.</p>
              <p className="text-sm text-slate-700"><strong>Imágenes:</strong> Añade logo de cabecera y firma para emails profesionales.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "seguimiento",
      title: "Seguimiento de Convocatorias",
      icon: "📞",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Gestiona tus músicos y envía comunicaciones para eventos específicos.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-yellow-900 mb-2">🎯 Funcionalidades Principales</h4>
            <ul className="space-y-2 text-sm text-yellow-800">
              <li>✓ <strong>Tabla de contactos</strong> con toda la información de músicos (baremo, especialidad, categoría)</li>
              <li>✓ <strong>Filtros avanzados</strong> por especialidad, categoría o búsqueda por nombre</li>
              <li>✓ <strong>Envío de convocatorias</strong> individuales o masivas</li>
              <li>✓ <strong>Seguimiento de respuestas</strong> (confirmación/rechazo por cada ensayo y función)</li>
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-3">📝 Cómo Enviar una Convocatoria</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
              <li>Selecciona el evento y la plantilla de email</li>
              <li>Marca los músicos a convocar o usa filtros para selección masiva</li>
              <li>Revisa el preview del mensaje personalizado</li>
              <li>Haz clic en "Enviar Convocatoria"</li>
              <li>El sistema registrará el envío en el log de actividad</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: "plantillas-definitivas",
      title: "Plantillas Definitivas",
      icon: "🎼",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Visualiza y gestiona la plantilla orquestal confirmada para cada evento.
          </p>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-semibold text-indigo-900 mb-3">🎻 Disposición Orquestal</h4>
            <p className="text-sm text-indigo-800 mb-4">
              Cada evento muestra la plantilla organizada por secciones instrumentales, con la disposición visual exacta de atriles.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white rounded p-3 border border-indigo-100">
                <div className="text-xs font-semibold text-indigo-700 mb-1">CUERDA</div>
                <div className="text-xs text-slate-600">Violines I y II, Violas, Violonchelos, Contrabajos</div>
              </div>
              <div className="bg-white rounded p-3 border border-indigo-100">
                <div className="text-xs font-semibold text-indigo-700 mb-1">VIENTO MADERA</div>
                <div className="text-xs text-slate-600">Flautas, Oboes, Clarinetes, Fagotes</div>
              </div>
              <div className="bg-white rounded p-3 border border-indigo-100">
                <div className="text-xs font-semibold text-indigo-700 mb-1">VIENTO METAL</div>
                <div className="text-xs text-slate-600">Trompetas, Trompas, Trombones, Tubas</div>
              </div>
              <div className="bg-white rounded p-3 border border-indigo-100">
                <div className="text-xs font-semibold text-indigo-700 mb-1">PERCUSIÓN</div>
                <div className="text-xs text-slate-600">Timbales, Batería, Instrumental específico</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">✏️ Gestión de Atriles</h4>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>• Asigna músicos a cada atril según confirmaciones</li>
              <li>• Visualiza asistencia por ensayo y función</li>
              <li>• Edita cachés individuales directamente desde la plantilla</li>
              <li>• Código de colores para estado de confirmación</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "asistencia-pagos",
      title: "Asistencia y Pagos",
      icon: "💰",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Control financiero completo de cada evento con seguimiento de cachés, extras y documentación.
          </p>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-800 mb-3">📊 Tabla de Pagos</h4>
            <p className="text-sm text-slate-700 mb-3">
              Para cada evento, visualiza todos los músicos convocados con:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <span className="text-green-500 text-lg">✓</span>
                <div>
                  <div className="font-medium text-sm text-slate-800">Asistencia Real</div>
                  <div className="text-xs text-slate-600">Confirmación a ensayos y funciones</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 text-lg">€</span>
                <div>
                  <div className="font-medium text-sm text-slate-800">Cachés</div>
                  <div className="text-xs text-slate-600">Base, ensayos, función, refuerzos</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-500 text-lg">+</span>
                <div>
                  <div className="font-medium text-sm text-slate-800">Extras</div>
                  <div className="text-xs text-slate-600">Transporte, alojamiento, dietas</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500 text-lg">📎</span>
                <div>
                  <div className="font-medium text-sm text-slate-800">Justificantes</div>
                  <div className="text-xs text-slate-600">Subida de documentos (facturas, recibos)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-900 mb-2">⚠️ Importante</h4>
            <p className="text-sm text-amber-800">
              Los totales se calculan automáticamente sumando cachés base + ensayos + función + extras. 
              Puedes editar cualquier valor haciendo clic en la celda correspondiente.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "analisis-economico",
      title: "Análisis Económico",
      icon: "📈",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Visualiza el impacto económico de eventos y temporadas con gráficos interactivos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="text-xs font-semibold text-blue-700 mb-1">GRÁFICO DE BARRAS</div>
              <div className="text-sm text-blue-900">Coste total por evento</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="text-xs font-semibold text-green-700 mb-1">GRÁFICO CIRCULAR</div>
              <div className="text-sm text-green-900">Distribución por secciones</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="text-xs font-semibold text-purple-700 mb-1">LÍNEA TEMPORAL</div>
              <div className="text-sm text-purple-900">Evolución de gastos</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-800 mb-3">📥 Exportaciones Disponibles</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                <span className="text-2xl">📄</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">Exportar a Excel</div>
                  <div className="text-xs text-slate-600">Hoja de cálculo con todos los datos económicos</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                <span className="text-2xl">🏦</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">XML Bancario (SEPA)</div>
                  <div className="text-xs text-slate-600">Archivo para transferencias masivas</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                <span className="text-2xl">📊</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">Gráficos PNG/PDF</div>
                  <div className="text-xs text-slate-600">Exporta visualizaciones para presentaciones</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "informes",
      title: "Generación de Informes",
      icon: "📋",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Crea informes profesionales personalizados en formato PDF, Excel o XML.
          </p>

          <div className="space-y-3">
            <div className="bg-white border-l-4 border-red-500 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-2">A. Informe de Plantilla Definitiva</h4>
              <p className="text-sm text-slate-600 mb-2">Lista completa de músicos confirmados con disposición de atriles por secciones.</p>
              <div className="text-xs text-slate-500">✓ Incluye: Programa del evento, horarios de ensayos, distribución orquestal</div>
            </div>

            <div className="bg-white border-l-4 border-green-500 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-2">B. Informe Económico por Evento</h4>
              <p className="text-sm text-slate-600 mb-2">Desglose detallado de cachés, extras y totales por músico.</p>
              <div className="text-xs text-slate-500">✓ Incluye: Subtotales por sección, total general, estadísticas</div>
            </div>

            <div className="bg-white border-l-4 border-blue-500 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-2">C. Informe Estadístico de Asistencia</h4>
              <p className="text-sm text-slate-600 mb-2">Análisis de porcentajes de confirmación y gráficos de asistencia.</p>
              <div className="text-xs text-slate-500">✓ Incluye: Gráficos por sección, comparativa entre eventos, tendencias</div>
            </div>

            <div className="bg-white border-l-4 border-purple-500 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-2">D. Informe de Configuración de Eventos</h4>
              <p className="text-sm text-slate-600 mb-2">Datos técnicos completos del evento (instrumentación, programa, logística).</p>
              <div className="text-xs text-slate-500">✓ Incluye: Ficha técnica, programa de mano, requerimientos de producción</div>
            </div>

            <div className="bg-white border-l-4 border-orange-500 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-2">E. Informe Combinado "Todo en Uno"</h4>
              <p className="text-sm text-slate-600 mb-2">Documento ejecutivo completo con toda la información del evento.</p>
              <div className="text-xs text-slate-500">✓ Ideal para: Dirección artística, gerencia, archivo histórico</div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-3">⚙️ Opciones de Personalización</h4>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>• Filtra por evento o genera para todos los eventos</li>
              <li>• Selecciona secciones específicas (cuerda, viento, percusión, coro, teclados)</li>
              <li>• Define rango de fechas para informes históricos</li>
              <li>• Envía por email automáticamente o descarga localmente</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "admin-usuarios",
      title: "Administración - Gestión de Usuarios",
      icon: "👥",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Crea y gestiona cuentas de usuario con roles específicos y permisos granulares.
          </p>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-800 mb-3">🎭 Roles Disponibles</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
                <div className="font-semibold text-red-900 text-sm">Administrador</div>
                <div className="text-xs text-red-700">Acceso completo a todas las funciones del sistema</div>
              </div>
              <div className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded">
                <div className="font-semibold text-blue-900 text-sm">Gestor de Personal</div>
                <div className="text-xs text-blue-700">Gestión de contactos, comunicaciones y seguimiento de músicos</div>
              </div>
              <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
                <div className="font-semibold text-green-900 text-sm">Gestor de Logística</div>
                <div className="text-xs text-green-700">Gestión de eventos, atriles, transporte y alojamiento</div>
              </div>
              <div className="border-l-4 border-purple-500 bg-purple-50 p-3 rounded">
                <div className="font-semibold text-purple-900 text-sm">Gestor de Archivo</div>
                <div className="text-xs text-purple-700">Gestión documental, informes y exportaciones</div>
              </div>
              <div className="border-l-4 border-yellow-500 bg-yellow-50 p-3 rounded col-span-1 md:col-span-2">
                <div className="font-semibold text-yellow-900 text-sm">Gestor Económico</div>
                <div className="text-xs text-yellow-700">Gestión de cachés, pagos y análisis financiero</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-800 mb-3">🔧 Funciones de Gestión</h4>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>Crear usuario:</strong> Define nombre, email, contraseña y rol</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>Editar rol:</strong> Cambia el rol asignado en cualquier momento</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>Reset de contraseña:</strong> Genera una nueva contraseña para el usuario</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>Enviar credenciales:</strong> Envía email automático con acceso al sistema</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>Activar/Desactivar:</strong> Suspende acceso temporalmente sin borrar la cuenta</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "admin-permisos",
      title: "Administración - Gestión de Permisos",
      icon: "🔐",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Configura permisos granulares para controlar qué puede ver y editar cada rol.
          </p>

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-semibold text-indigo-900 mb-3">🎯 Matriz de Permisos</h4>
            <p className="text-sm text-indigo-800 mb-3">
              La matriz permite definir permisos específicos para cada rol en 9 secciones del sistema:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded">1. Dashboard</div>
              <div className="bg-white p-2 rounded">2. Configuración › Eventos</div>
              <div className="bg-white p-2 rounded">3. Configuración › Base de Datos</div>
              <div className="bg-white p-2 rounded">4. Configuración › Plantillas Email</div>
              <div className="bg-white p-2 rounded">5. Seguimiento de Convocatorias</div>
              <div className="bg-white p-2 rounded">6. Plantillas Definitivas</div>
              <div className="bg-white p-2 rounded">7. Asistencia y Pagos</div>
              <div className="bg-white p-2 rounded">8. Análisis Económico</div>
              <div className="bg-white p-2 rounded">9. Informes</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-800 mb-3">⚡ Permisos Granulares</h4>
            <p className="text-sm text-slate-700 mb-3">Para cada sección, puedes configurar permisos específicos:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-blue-50 p-2 rounded text-center">
                <div className="text-lg mb-1">👁️</div>
                <div className="text-xs font-semibold text-blue-900">Ver</div>
              </div>
              <div className="bg-green-50 p-2 rounded text-center">
                <div className="text-lg mb-1">✏️</div>
                <div className="text-xs font-semibold text-green-900">Editar</div>
              </div>
              <div className="bg-purple-50 p-2 rounded text-center">
                <div className="text-lg mb-1">➕</div>
                <div className="text-xs font-semibold text-purple-900">Crear</div>
              </div>
              <div className="bg-red-50 p-2 rounded text-center">
                <div className="text-lg mb-1">🗑️</div>
                <div className="text-xs font-semibold text-red-900">Eliminar</div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-900 mb-2">💡 Ejemplo de Uso</h4>
            <p className="text-sm text-amber-800">
              Un <strong>Gestor de Personal</strong> puede tener permiso para <em>ver</em> y <em>editar</em> contactos en "Seguimiento de Convocatorias", 
              pero solo <em>ver</em> (sin editar) en "Análisis Económico".
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-800 mb-3">🔄 Cómo Configurar Permisos</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
              <li>Haz clic en una sección para expandir sus permisos</li>
              <li>Para cada permiso, marca o desmarca el checkbox del rol correspondiente</li>
              <li>Usa los botones "✓ Todos" / "✗ Ninguno" para activar/desactivar todos los permisos de un rol</li>
              <li>Haz clic en "Guardar configuración" para aplicar los cambios</li>
              <li>Los usuarios afectados verán los cambios en su próximo inicio de sesión</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: "admin-actividad",
      title: "Administración - Registro de Actividad",
      icon: "📜",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            Auditoría completa de todas las acciones realizadas en el sistema con filtros avanzados.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-xs font-semibold text-blue-900">Actividad 24h</div>
              <div className="text-sm text-blue-700">Acciones recientes</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
              <div className="text-2xl mb-2">📈</div>
              <div className="text-xs font-semibold text-green-900">Acciones totales</div>
              <div className="text-sm text-green-700">Histórico completo</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
              <div className="text-2xl mb-2">👥</div>
              <div className="text-xs font-semibold text-purple-900">Usuarios activos</div>
              <div className="text-sm text-purple-700">Sesiones abiertas</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
              <div className="text-2xl mb-2">🎯</div>
              <div className="text-xs font-semibold text-orange-900">Tipos de acción</div>
              <div className="text-sm text-orange-700">Categorías únicas</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-800 mb-3">🔍 Filtros Disponibles</h4>
            <div className="space-y-2 text-sm text-slate-700">
              <div>• <strong>Usuario:</strong> Filtra por quién realizó la acción</div>
              <div>• <strong>Acción:</strong> Ver, Crear, Actualizar, Eliminar, Enviar credenciales, etc.</div>
              <div>• <strong>Entidad:</strong> Tipo de elemento afectado (usuario, evento, contacto, etc.)</div>
              <div>• <strong>Rango de fechas:</strong> Desde/Hasta para búsquedas temporales</div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-3">📋 Información Registrada</h4>
            <p className="text-sm text-slate-700 mb-2">Cada entrada de log incluye:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-blue-500">🕐</span>
                <span>Fecha y hora exacta</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">👤</span>
                <span>Usuario que realizó la acción</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-500">⚡</span>
                <span>Tipo de acción ejecutada</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-500">📦</span>
                <span>Entidad y datos afectados</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">💾 Exportar Logs</h4>
            <p className="text-sm text-green-800">
              Exporta el registro de actividad a CSV para análisis externo, cumplimiento normativo o auditorías.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="manual-usuario-page">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">📘</span>
          <h1 className="font-cabinet text-3xl font-bold text-slate-900">Manual de Usuario</h1>
        </div>
        <p className="font-ibm text-slate-600">
          Guía completa para dominar todas las funcionalidades del Panel de Gestión de Convocatorias
        </p>
      </header>

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{section.icon}</span>
                <h2 className="font-semibold text-lg text-slate-800">{section.title}</h2>
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 transition-transform ${
                  expandedSections[section.id] ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSections[section.id] && (
              <div className="px-6 py-5 border-t border-slate-100 bg-slate-50">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">¿Necesitas más ayuda?</h3>
        <p className="text-sm text-blue-800 mb-3">
          Si tienes dudas sobre alguna funcionalidad específica o encuentras algún problema, contacta con el administrador del sistema.
        </p>
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <span>📧</span>
          <span>Email: admin@convocatorias.com</span>
        </div>
      </div>
    </div>
  );
};

export default ManualUsuario;
