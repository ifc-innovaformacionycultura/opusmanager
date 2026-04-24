"""
Mapeo centralizado de instrumento → sección instrumental.
Reutilizado por routes_gestor.py (Plantillas Definitivas) y routes_portal.py
(partitura específica por instrumento).
"""
from typing import Optional

# Orden de secciones instrumentales usado en Plantillas Definitivas.
SECCIONES_ORDER = [
    ("cuerda",        "Cuerda"),
    ("viento_madera", "Viento Madera"),
    ("viento_metal",  "Viento Metal"),
    ("percusion",     "Percusión"),
    ("teclados",      "Teclados"),
    ("coro",          "Coro"),
]

INSTRUMENTO_A_SECCION = {
    # Cuerda
    'violin': 'cuerda', 'violín': 'cuerda', 'violines': 'cuerda',
    'viola': 'cuerda', 'violas': 'cuerda',
    'cello': 'cuerda', 'chelo': 'cuerda', 'violonchelo': 'cuerda', 'violoncello': 'cuerda',
    'contrabajo': 'cuerda', 'contrabajos': 'cuerda',
    # Viento madera
    'flauta': 'viento_madera', 'flauta travesera': 'viento_madera',
    'flautin': 'viento_madera', 'flautín': 'viento_madera',
    'oboe': 'viento_madera', 'corno ingles': 'viento_madera', 'corno inglés': 'viento_madera',
    'clarinete': 'viento_madera', 'clarinete bajo': 'viento_madera',
    'fagot': 'viento_madera', 'contrafagot': 'viento_madera',
    'saxofon': 'viento_madera', 'saxofón': 'viento_madera', 'saxo': 'viento_madera',
    # Viento metal
    'trompa': 'viento_metal', 'corno': 'viento_metal',
    'corno frances': 'viento_metal', 'corno francés': 'viento_metal',
    'trompeta': 'viento_metal',
    'trombon': 'viento_metal', 'trombón': 'viento_metal',
    'tuba': 'viento_metal',
    # Percusión
    'percusion': 'percusion', 'percusión': 'percusion',
    'timbales': 'percusion', 'bateria': 'percusion', 'batería': 'percusion',
    # Teclados
    'piano': 'teclados', 'organo': 'teclados', 'órgano': 'teclados',
    'clave': 'teclados', 'clavecin': 'teclados', 'clavecín': 'teclados',
    'teclado': 'teclados', 'teclados': 'teclados',
    # Coro
    'tenor': 'coro', 'soprano': 'coro', 'baritono': 'coro', 'barítono': 'coro',
    'bajo': 'coro', 'mezzo': 'coro', 'mezzosoprano': 'coro',
    'contratenor': 'coro', 'contralto': 'coro', 'alto': 'coro',
    'coro': 'coro',
}

# Orden dentro de cada sección (para ordenar músicos)
INSTRUMENTO_ORDER = [
    'violin', 'viola', 'violonchelo', 'cello', 'chelo', 'contrabajo',
    'flauta', 'flautin', 'oboe', 'corno ingles', 'clarinete', 'clarinete bajo',
    'fagot', 'contrafagot', 'saxofon',
    'trompa', 'corno', 'trompeta', 'trombon', 'tuba',
    'percusion', 'timbales', 'bateria',
    'piano', 'organo', 'clave', 'clavecin', 'teclado',
    'soprano', 'mezzosoprano', 'alto', 'contralto', 'tenor', 'baritono', 'bajo', 'contratenor', 'coro',
]


def norm(s: Optional[str]) -> str:
    return (s or '').strip().lower().replace('í', 'i').replace('ó', 'o').replace('é', 'e').replace('á', 'a').replace('ú', 'u')


def seccion_de_instrumento(instrumento: Optional[str]) -> Optional[str]:
    """Devuelve la clave de sección ('cuerda', 'viento_madera', ...) o None."""
    if not instrumento:
        return None
    return INSTRUMENTO_A_SECCION.get(str(instrumento).strip().lower())


def partitura_url_para_instrumento(evento: dict, instrumento: Optional[str]) -> Optional[str]:
    """Devuelve la URL de la partitura del evento correspondiente al instrumento del músico."""
    if not evento or not instrumento:
        return None
    seccion = seccion_de_instrumento(instrumento)
    if not seccion:
        return None
    return evento.get(f'partitura_{seccion}')


def instrumento_sort_key(instr: Optional[str]) -> int:
    """Clave de ordenación: respeta INSTRUMENTO_ORDER."""
    key = norm(instr)
    try:
        return INSTRUMENTO_ORDER.index(key)
    except ValueError:
        return 9999
