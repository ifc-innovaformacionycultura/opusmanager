"""
Backfill de `usuario_id` en `incidencias` para registros antiguos con NULL.

Estrategia (en cascada por incidencia):
  1) Si `usuario_nombre` matchea exactamente "Apellidos, Nombre" en `usuarios`,
     se asigna ese `id`.
  2) Si la página relacionada apunta a `/admin/...`, se asigna al admin gestor.
  3) Si nada hace match, se deja como NULL y se logea.

Ejecutar manualmente:
    cd /app/backend && python scripts/backfill_incidencias_usuario_id.py
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

from supabase import create_client


def main() -> int:
    supa = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])

    todos = supa.table('incidencias').select('id,usuario_id,usuario_nombre,pagina') \
        .is_('usuario_id', 'null').execute().data or []
    print(f"Incidencias con usuario_id=NULL: {len(todos)}")

    if not todos:
        return 0

    usuarios = supa.table('usuarios').select('id,nombre,apellidos,rol,email').execute().data or []
    by_full = {}
    admin_gestor_id = None
    for u in usuarios:
        full = f"{u.get('apellidos') or ''}, {u.get('nombre') or ''}".strip(', ').lower()
        if full:
            by_full[full] = u['id']
        if (u.get('rol') == 'gestor') and (u.get('email') == 'admin@convocatorias.com'):
            admin_gestor_id = u['id']

    actualizadas = 0
    sin_match = 0
    for inc in todos:
        nombre = (inc.get('usuario_nombre') or '').strip().lower()
        pagina = inc.get('pagina') or ''
        target = by_full.get(nombre)

        if not target and pagina.startswith('/admin') and admin_gestor_id:
            target = admin_gestor_id

        if not target:
            sin_match += 1
            print(f"  [NO MATCH] inc={inc['id'][:8]}  nombre='{inc.get('usuario_nombre')}'  pagina={pagina}")
            continue

        supa.table('incidencias').update({'usuario_id': target}).eq('id', inc['id']).execute()
        actualizadas += 1

    print(f"Actualizadas: {actualizadas}  ·  Sin match: {sin_match}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
