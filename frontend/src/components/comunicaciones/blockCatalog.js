// Catálogo de tipos de bloques disponibles en el constructor visual
// El backend (routes_comunicaciones_plantillas.py) renderiza cada tipo a HTML.

export const BLOCK_TYPES = [
  { tipo: "cabecera", icon: "🎩", label: "Cabecera",
    defaults: { titulo: "Título", subtitulo: "Subtítulo opcional", alineacion: "left", estilo: "navy_gold" } },
  { tipo: "texto", icon: "📝", label: "Texto / párrafo",
    defaults: { html: "<p>Escribe aquí tu mensaje.</p>" } },
  { tipo: "imagen", icon: "🖼️", label: "Imagen",
    defaults: { url: "", alt: "", ancho: 600 } },
  { tipo: "imagen_texto_2col", icon: "🧱", label: "Imagen + texto (2 col)",
    defaults: { url: "", html: "<p>Texto a la derecha de la imagen.</p>", invertir: false } },
  { tipo: "boton", icon: "🔘", label: "Botón / CTA",
    defaults: { label: "Acceder", url: "{portal_url}", color: "#1e293b", texto_color: "#ffffff" } },
  { tipo: "cita", icon: "💬", label: "Cita",
    defaults: { texto: "La música es el lenguaje universal.", autor: "Anónimo" } },
  { tipo: "lista", icon: "•", label: "Lista",
    defaults: { items: ["Punto 1", "Punto 2", "Punto 3"], ordenada: false } },
  { tipo: "galeria", icon: "🗂️", label: "Galería (3-6)",
    defaults: { urls: [] } },
  { tipo: "video", icon: "▶️", label: "Vídeo",
    defaults: { url: "", thumbnail: "" } },
  { tipo: "redes_sociales", icon: "🔗", label: "Redes sociales",
    defaults: { instagram: "", facebook: "", twitter: "", youtube: "", linkedin: "", web: "" } },
  { tipo: "separador", icon: "━", label: "Separador",
    defaults: { color: "#e2e8f0", grosor: 1 } },
  { tipo: "pie", icon: "🪧", label: "Pie de página",
    defaults: { texto: "© Tu organización · Sistema OPUS", estilo: "navy_gold" } },
];

export const PRESET_THEMES = [
  { key: "ifc_corporate", icon: "🏛️", label: "IFC Corporate",
    desc: "Navy + dorado. Tono institucional sobrio." },
  { key: "editorial_minimal", icon: "📰", label: "Editorial Minimal",
    desc: "Blanco roto, tipografía limpia, líneas finas." },
  { key: "festival_warm", icon: "🎉", label: "Festival Warm",
    desc: "Ámbar y ocres, gradientes cálidos festivos." },
];

export const VARIABLES_DISPONIBLES = [
  { key: "nombre_destinatario", desc: "Nombre del músico/contacto" },
  { key: "evento", desc: "Nombre del evento" },
  { key: "fecha_proxima", desc: "Próxima fecha relevante" },
  { key: "lugar", desc: "Lugar / sede" },
  { key: "instrumento", desc: "Instrumento del músico" },
  { key: "portal_url", desc: "URL al portal del músico" },
];

export function emptyTemplate() {
  return {
    nombre: "",
    descripcion: "",
    asunto_default: "",
    tema_preset: "ifc_corporate",
    estado: "borrador",
    ajustes_globales: {
      logo_url: "",
      font_family: "Georgia, 'Times New Roman', serif",
      font_url: "",
      color_primario: "#1e293b",
      color_secundario: "#d4af37",
      color_fondo: "#f1f5f9",
      color_texto: "#0f172a",
      ancho_max: 600,
      padding: 32,
    },
    bloques: [],
  };
}

export function uid() {
  return "b-" + Math.random().toString(36).slice(2, 9);
}
