"""
Script de creación masiva de usuarios — Iteración 12 (feb 2026).
Usa Supabase Admin API + tabla `usuarios`.
Idempotente: si el email ya existe en auth, lo marca como omitido.
"""
import os
import sys
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / '.env')

from datetime import datetime
from supabase_client import supabase

GESTORES = [
    {"email": "palvarez@netmetrix.es",         "nombre": "Pablo",   "apellidos": "Álvarez Rábanos"},
    {"email": "malvarez@e.csmb.es",            "nombre": "María",   "apellidos": "Álvarez"},
    {"email": "calvarez@p.csmb.es",            "nombre": "Carmen",  "apellidos": "Álvarez Melliza"},
    {"email": "antonioalvarez.mellizo@gmail.com", "nombre": "Antonio", "apellidos": "Álvarez Mellizo"},
    {"email": "aaparicio@p.csmb.es",           "nombre": "Ana",     "apellidos": "Aparicio Núñez"},
    {"email": "aserrano@p.csmb.es",            "nombre": "Alberto", "apellidos": "Serrano"},
    {"email": "msanchez@p.csmb.es",            "nombre": "María",   "apellidos": "Sánchez Cortés"},
    {"email": "sdiaz-ropero@p.csmb.es",        "nombre": "Sara",    "apellidos": "Díaz Ropero"},
]

MUSICOS = [
    {"email": "pablo_alvarez_rabanos@telefonica.net", "nombre": "Pablo",   "apellidos": "Álvarez Rábanos"},
    {"email": "mariaalvarez181107@gmail.com",         "nombre": "María",   "apellidos": "Álvarez"},
    {"email": "carmenalvarez.melliza@gmail.com",      "nombre": "Carmen",  "apellidos": "Álvarez Melliza"},
    {"email": "ana.aparicio.nunez@gmail.com",         "nombre": "Ana",     "apellidos": "Aparicio Núñez"},
    {"email": "albertoserranero@gmail.com",           "nombre": "Alberto", "apellidos": "Serrano"},
    {"email": "maria.s.complu@gmail.com",             "nombre": "María",   "apellidos": "Sánchez Cortés"},
    {"email": "sara.alberca10@gmail.com",             "nombre": "Sara",    "apellidos": "Díaz Ropero"},
]

PASS_GESTOR = "Opus2026!"
PASS_MUSICO = "Musico2026!"


def crear_usuario(u: dict, rol: str, password: str, requiere_cambio: bool):
    email = u["email"]
    try:
        # 1) Crear en Auth
        try:
            res = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "app_metadata": {"rol": rol},
                "user_metadata": {"nombre": u["nombre"], "apellidos": u["apellidos"]},
            })
            auth_user = res.user
            user_id = auth_user.id if auth_user else None
            ya_existia_auth = False
        except Exception as e_create:
            msg = str(e_create).lower()
            if "already" in msg or "registered" in msg or "duplicate" in msg or "email_exists" in msg:
                # Buscar el usuario existente en auth
                listed = supabase.auth.admin.list_users()
                user_id = None
                for au in (listed if isinstance(listed, list) else getattr(listed, 'users', [])):
                    if (getattr(au, 'email', '') or '').lower() == email.lower():
                        user_id = au.id
                        break
                if not user_id:
                    return {"email": email, "status": "error", "msg": f"create error: {e_create}"}
                ya_existia_auth = True
            else:
                return {"email": email, "status": "error", "msg": f"create error: {e_create}"}

        # 2) Sincronizar tabla `usuarios`
        existing = supabase.table('usuarios').select('id').eq('id', user_id).limit(1).execute().data
        payload = {
            "id": user_id,
            "email": email,
            "nombre": u["nombre"],
            "apellidos": u["apellidos"],
            "rol": rol,
            "estado": "activo",
            "requiere_cambio_password": requiere_cambio,
        }
        if existing:
            supabase.table('usuarios').update(payload).eq('id', user_id).execute()
            return {"email": email, "status": "ya_existia" if ya_existia_auth else "actualizado"}
        else:
            payload["fecha_alta"] = datetime.now().isoformat()
            supabase.table('usuarios').insert(payload).execute()
            return {"email": email, "status": "ya_existia_auth_insert_perfil" if ya_existia_auth else "creado"}
    except Exception as e:
        return {"email": email, "status": "error", "msg": str(e)}


def main():
    informe = {"creados": 0, "ya_existian": 0, "errores": 0, "detalle": []}

    print("=" * 60)
    print("GESTORES")
    print("=" * 60)
    for u in GESTORES:
        r = crear_usuario(u, rol="gestor", password=PASS_GESTOR, requiere_cambio=False)
        informe["detalle"].append({**r, "rol": "gestor"})
        if r["status"] == "creado":
            informe["creados"] += 1
        elif r["status"].startswith("ya_existia"):
            informe["ya_existian"] += 1
        elif r["status"] == "error":
            informe["errores"] += 1
        elif r["status"] == "actualizado":
            informe["ya_existian"] += 1
        print(f"  · {u['email']:40s} → {r['status']}")
        if r["status"] == "error":
            print(f"    ERROR: {r.get('msg')}")

    print()
    print("=" * 60)
    print("MÚSICOS")
    print("=" * 60)
    for u in MUSICOS:
        r = crear_usuario(u, rol="musico", password=PASS_MUSICO, requiere_cambio=True)
        informe["detalle"].append({**r, "rol": "musico"})
        if r["status"] == "creado":
            informe["creados"] += 1
        elif r["status"].startswith("ya_existia"):
            informe["ya_existian"] += 1
        elif r["status"] == "error":
            informe["errores"] += 1
        elif r["status"] == "actualizado":
            informe["ya_existian"] += 1
        print(f"  · {u['email']:40s} → {r['status']}")
        if r["status"] == "error":
            print(f"    ERROR: {r.get('msg')}")

    print()
    print("=" * 60)
    print(f"RESUMEN: {informe['creados']} creados · {informe['ya_existian']} ya existían · {informe['errores']} errores")
    print("=" * 60)
    return informe


if __name__ == "__main__":
    main()
