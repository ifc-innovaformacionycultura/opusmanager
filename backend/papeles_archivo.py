"""
Papeles predefinidos del archivo musical.
Reutilizado por routes_archivo.py para la generación de partes y el cálculo de atriles.

Estructura: { codigo: { label, seccion, instrumento } }
"""

PAPELES_ARCHIVO = {
    # CUERDA
    'violin_1':    {'label': 'Violín 1º',    'seccion': 'cuerda',         'instrumento': 'violin'},
    'violin_2':    {'label': 'Violín 2º',    'seccion': 'cuerda',         'instrumento': 'violin'},
    'viola':       {'label': 'Viola',        'seccion': 'cuerda',         'instrumento': 'viola'},
    'violonchelo': {'label': 'Violonchelo',  'seccion': 'cuerda',         'instrumento': 'violonchelo'},
    'contrabajo':  {'label': 'Contrabajo',   'seccion': 'cuerda',         'instrumento': 'contrabajo'},

    # VIENTO MADERA
    'flauta_1':    {'label': 'Flauta 1ª',    'seccion': 'viento_madera',  'instrumento': 'flauta'},
    'flauta_2':    {'label': 'Flauta 2ª',    'seccion': 'viento_madera',  'instrumento': 'flauta'},
    'oboe_1':      {'label': 'Oboe 1º',      'seccion': 'viento_madera',  'instrumento': 'oboe'},
    'oboe_2':      {'label': 'Oboe 2º',      'seccion': 'viento_madera',  'instrumento': 'oboe'},
    'clarinete_1': {'label': 'Clarinete 1º', 'seccion': 'viento_madera',  'instrumento': 'clarinete'},
    'clarinete_2': {'label': 'Clarinete 2º', 'seccion': 'viento_madera',  'instrumento': 'clarinete'},
    'fagot_1':     {'label': 'Fagot 1º',     'seccion': 'viento_madera',  'instrumento': 'fagot'},
    'fagot_2':     {'label': 'Fagot 2º',     'seccion': 'viento_madera',  'instrumento': 'fagot'},

    # VIENTO METAL
    'trompa_1_3':  {'label': 'Trompa 1ª y 3ª', 'seccion': 'viento_metal', 'instrumento': 'trompa'},
    'trompa_2_4':  {'label': 'Trompa 2ª y 4ª', 'seccion': 'viento_metal', 'instrumento': 'trompa'},
    'trompeta_1':  {'label': 'Trompeta 1ª',    'seccion': 'viento_metal', 'instrumento': 'trompeta'},
    'trompeta_2':  {'label': 'Trompeta 2ª',    'seccion': 'viento_metal', 'instrumento': 'trompeta'},
    'trompeta_3':  {'label': 'Trompeta 3ª',    'seccion': 'viento_metal', 'instrumento': 'trompeta'},
    'trompeta_4':  {'label': 'Trompeta 4ª',    'seccion': 'viento_metal', 'instrumento': 'trompeta'},
    'trombón_1':   {'label': 'Trombón 1º',     'seccion': 'viento_metal', 'instrumento': 'trombon'},
    'trombón_2':   {'label': 'Trombón 2º',     'seccion': 'viento_metal', 'instrumento': 'trombon'},
    'trombón_3':   {'label': 'Trombón 3º',     'seccion': 'viento_metal', 'instrumento': 'trombon'},
    'trombón_4':   {'label': 'Trombón 4º',     'seccion': 'viento_metal', 'instrumento': 'trombon'},
    'tuba':        {'label': 'Tuba',           'seccion': 'viento_metal', 'instrumento': 'tuba'},

    # PERCUSIÓN
    'timbales':     {'label': 'Timbales',     'seccion': 'percusion', 'instrumento': 'timbales'},
    'bombo':        {'label': 'Bombo',        'seccion': 'percusion', 'instrumento': 'bombo'},
    'caja':         {'label': 'Caja',         'seccion': 'percusion', 'instrumento': 'caja'},
    'percusion_1':  {'label': 'Percusión 1',  'seccion': 'percusion', 'instrumento': 'percusion'},
    'percusion_2':  {'label': 'Percusión 2',  'seccion': 'percusion', 'instrumento': 'percusion'},
    'percusion_3':  {'label': 'Percusión 3',  'seccion': 'percusion', 'instrumento': 'percusion'},
    'laminas':      {'label': 'Láminas',      'seccion': 'percusion', 'instrumento': 'laminas'},

    # CORO
    'soprano':  {'label': 'Soprano',  'seccion': 'coro', 'instrumento': 'soprano'},
    'alto':     {'label': 'Alto',     'seccion': 'coro', 'instrumento': 'alto'},
    'tenor':    {'label': 'Tenor',    'seccion': 'coro', 'instrumento': 'tenor'},
    'baritono': {'label': 'Barítono', 'seccion': 'coro', 'instrumento': 'baritono'},

    # TECLADOS
    'piano':    {'label': 'Piano',    'seccion': 'teclados', 'instrumento': 'piano'},
    'organo':   {'label': 'Órgano',   'seccion': 'teclados', 'instrumento': 'organo'},
    'clave':    {'label': 'Clavecín', 'seccion': 'teclados', 'instrumento': 'clave'},
}

PAPELES_POR_SECCION = {
    'cuerda':        ['violin_1', 'violin_2', 'viola', 'violonchelo', 'contrabajo'],
    'viento_madera': ['flauta_1', 'flauta_2', 'oboe_1', 'oboe_2', 'clarinete_1', 'clarinete_2', 'fagot_1', 'fagot_2'],
    'viento_metal':  ['trompa_1_3', 'trompa_2_4', 'trompeta_1', 'trompeta_2', 'trompeta_3', 'trompeta_4',
                      'trombón_1', 'trombón_2', 'trombón_3', 'trombón_4', 'tuba'],
    'percusion':     ['timbales', 'bombo', 'caja', 'percusion_1', 'percusion_2', 'percusion_3', 'laminas'],
    'coro':          ['soprano', 'alto', 'tenor', 'baritono'],
    'teclados':      ['piano', 'organo', 'clave'],
}
