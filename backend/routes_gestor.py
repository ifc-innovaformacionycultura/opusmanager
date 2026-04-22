# Gestor Routes - Admin/Manager endpoints
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from supabase_client import supabase, create_user_profile
from auth_utils import get_current_user, get_current_gestor
from typing import List, Optional
from datetime import datetime
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
import secrets
import string
from email_service import send_musico_credentials_email

router = APIRouter(prefix="/api/gestor", tags=["gestor"])

# ==================== Models ====================

class EventoCreate(BaseModel):
    nombre: str
    temporada: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    tipo: Optional[str] = None
    lugar: Optional[str] = None
    notas: Optional[str] = None
    # Fechas secundarias de función (punto 2)
    fecha_secundaria_1: Optional[str] = None
    hora_secundaria_1: Optional[str] = None
    fecha_secundaria_2: Optional[str] = None
    hora_secundaria_2: Optional[str] = None
    fecha_secundaria_3: Optional[str] = None
    hora_secundaria_3: Optional[str] = None
    fecha_secundaria_4: Optional[str] = None
    hora_secundaria_4: Optional[str] = None
    # Partituras por sección instrumental (punto 3)
    partitura_cuerda: Optional[str] = None
    partitura_viento_madera: Optional[str] = None
    partitura_viento_metal: Optional[str] = None
    partitura_percusion: Optional[str] = None
    partitura_coro: Optional[str] = None
    partitura_teclados: Optional[str] = None
    # Notas y enlaces para músicos (punto 4)
    notas_musicos: Optional[str] = None
    info_adicional_url_1: Optional[str] = None
    info_adicional_url_2: Optional[str] = None
    info_adicional_url_3: Optional[str] = None

class EventoUpdate(BaseModel):
    nombre: Optional[str] = None
    temporada: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    estado: Optional[str] = None
    tipo: Optional[str] = None
    lugar: Optional[str] = None
    notas: Optional[str] = None
    # Fechas secundarias de función (punto 2)
    fecha_secundaria_1: Optional[str] = None
    hora_secundaria_1: Optional[str] = None
    fecha_secundaria_2: Optional[str] = None
    hora_secundaria_2: Optional[str] = None
    fecha_secundaria_3: Optional[str] = None
    hora_secundaria_3: Optional[str] = None
    fecha_secundaria_4: Optional[str] = None
    hora_secundaria_4: Optional[str] = None
    # Partituras por sección instrumental (punto 3)
    partitura_cuerda: Optional[str] = None
    partitura_viento_madera: Optional[str] = None
    partitura_viento_metal: Optional[str] = None
    partitura_percusion: Optional[str] = None
    partitura_coro: Optional[str] = None
    partitura_teclados: Optional[str] = None
    # Notas y enlaces para músicos (punto 4)
    notas_musicos: Optional[str] = None
    info_adicional_url_1: Optional[str] = None
    info_adicional_url_2: Optional[str] = None
    info_adicional_url_3: Optional[str] = None

class AsignacionCreate(BaseModel):
    usuario_id: str
    evento_id: str
    importe: Optional[float] = 0
    comentarios: Optional[str] = None

class EnsayoCreate(BaseModel):
    evento_id: str
    fecha: str  # ISO date string
    hora: str  # HH:MM format
    tipo: str = "ensayo"  # 'ensayo', 'concierto', 'funcion'
    obligatorio: bool = True
    lugar: Optional[str] = None
    notas: Optional[str] = None

class MusicoCreate(BaseModel):
    email: EmailStr
    nombre: str
    apellidos: str
    instrumento: Optional[str] = None
    telefono: Optional[str] = None

# ==================== Eventos ====================

@router.get("/eventos")
async def get_eventos(
    estado: Optional[str] = None,
    temporada: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor)
):
    """Get all eventos (with optional filters)"""
    try:
        query = supabase.table('eventos').select('*')
        
        if estado:
            query = query.eq('estado', estado)
        if temporada:
            query = query.eq('temporada', temporada)
        
        response = query.order('created_at', desc=True).execute()
        
        return {"eventos": response.data or []}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar eventos: {str(e)}"
        )

@router.post("/eventos")
async def create_evento(
    data: EventoCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """Create new evento"""
    try:
        gestor_id = current_user.get("profile", {}).get("id")
        
        evento_data = {
            **data.model_dump(exclude_none=True),
            "gestor_id": gestor_id,
            "estado": "abierto"
        }
        
        response = supabase.table('eventos').insert(evento_data).execute()
        
        return {
            "message": "Evento creado",
            "evento": response.data[0] if response.data else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear evento: {str(e)}"
        )

@router.get("/eventos/{evento_id}")
async def get_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Get evento by ID with related data"""
    try:
        # Get evento with asignaciones and ensayos
        evento = supabase.table('eventos').select('*').eq('id', evento_id).single().execute()
        
        if not evento.data:
            raise HTTPException(status_code=404, detail="Evento no encontrado")
        
        # Get asignaciones
        asignaciones = supabase.table('asignaciones') \
            .select('*, usuario:usuarios(*)') \
            .eq('evento_id', evento_id) \
            .execute()
        
        # Get ensayos
        ensayos = supabase.table('ensayos') \
            .select('*') \
            .eq('evento_id', evento_id) \
            .order('fecha', desc=False) \
            .execute()
        
        return {
            "evento": evento.data,
            "asignaciones": asignaciones.data or [],
            "ensayos": ensayos.data or []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar evento: {str(e)}"
        )

@router.put("/eventos/{evento_id}")
async def update_evento(
    evento_id: str,
    data: EventoUpdate,
    current_user: dict = Depends(get_current_gestor)
):
    """Update evento"""
    try:
        # exclude_unset: permite borrar un campo enviándolo explícitamente como null.
        # Normalizamos strings vacíos a None para los campos de fecha/hora/url,
        # ya que PostgreSQL rechazaría "" en TIMESTAMPTZ/TIME.
        raw = data.model_dump(exclude_unset=True)
        null_on_empty = {
            'fecha_inicio', 'fecha_fin',
            'fecha_secundaria_1', 'fecha_secundaria_2', 'fecha_secundaria_3', 'fecha_secundaria_4',
            'hora_secundaria_1', 'hora_secundaria_2', 'hora_secundaria_3', 'hora_secundaria_4',
            'partitura_cuerda', 'partitura_viento_madera', 'partitura_viento_metal',
            'partitura_percusion', 'partitura_coro', 'partitura_teclados',
            'info_adicional_url_1', 'info_adicional_url_2', 'info_adicional_url_3',
        }
        for key in null_on_empty:
            if key in raw and raw[key] == '':
                raw[key] = None

        update_data = {
            **raw,
            "updated_at": datetime.now().isoformat()
        }
        
        response = supabase.table('eventos') \
            .update(update_data) \
            .eq('id', evento_id) \
            .execute()
        
        return {
            "message": "Evento actualizado",
            "evento": response.data[0] if response.data else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar evento: {str(e)}"
        )

@router.delete("/eventos/{evento_id}")
async def delete_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Delete evento (CASCADE deletes asignaciones and ensayos)"""
    try:
        response = supabase.table('eventos').delete().eq('id', evento_id).execute()
        
        return {"message": "Evento eliminado"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar evento: {str(e)}"
        )

# ==================== Asignaciones ====================

@router.post("/asignaciones")
async def create_asignacion(
    data: AsignacionCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """Assign musician to evento"""
    try:
        asignacion_data = {
            **data.model_dump(),
            "estado": "pendiente",
            "estado_pago": "pendiente"
        }
        
        response = supabase.table('asignaciones').insert(asignacion_data).execute()
        
        return {
            "message": "Músico asignado al evento",
            "asignacion": response.data[0] if response.data else None
        }
        
    except Exception as e:
        error_msg = str(e)
        if "duplicate" in error_msg or "unique" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este músico ya está asignado a este evento"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear asignación: {error_msg}"
        )

@router.get("/asignaciones/evento/{evento_id}")
async def get_asignaciones_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Get all asignaciones for an evento"""
    try:
        response = supabase.table('asignaciones') \
            .select('*, usuario:usuarios(*)') \
            .eq('evento_id', evento_id) \
            .execute()
        
        return {"asignaciones": response.data or []}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar asignaciones: {str(e)}"
        )

@router.delete("/asignaciones/{asignacion_id}")
async def delete_asignacion(
    asignacion_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Remove musician from evento"""
    try:
        response = supabase.table('asignaciones').delete().eq('id', asignacion_id).execute()
        
        return {"message": "Asignación eliminada"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar asignación: {str(e)}"
        )

# ==================== Ensayos ====================

@router.post("/ensayos")
async def create_ensayo(
    data: EnsayoCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """Create rehearsal/performance for evento"""
    try:
        response = supabase.table('ensayos').insert(data.model_dump()).execute()
        
        return {
            "message": "Ensayo creado",
            "ensayo": response.data[0] if response.data else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear ensayo: {str(e)}"
        )

@router.delete("/ensayos/{ensayo_id}")
async def delete_ensayo(
    ensayo_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Delete ensayo"""
    try:
        response = supabase.table('ensayos').delete().eq('id', ensayo_id).execute()
        
        return {"message": "Ensayo eliminado"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar ensayo: {str(e)}"
        )

# ==================== Músicos ====================

@router.get("/musicos")
async def get_musicos(
    q: Optional[str] = None,
    instrumento: Optional[str] = None,
    estado: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor)
):
    """Get all musicians with optional filters.
    
    Query params:
    - q: search by nombre, apellidos or email (ilike)
    - instrumento: filter by instrumento
    - estado: 'activo' | 'inactivo'
    """
    try:
        query = supabase.table('usuarios').select('*').eq('rol', 'musico')
        
        if instrumento:
            query = query.eq('instrumento', instrumento)
        
        if estado:
            query = query.eq('estado', estado)
        
        if q:
            # Supabase OR filter: search on nombre, apellidos, email
            safe = q.replace(',', ' ').strip()
            query = query.or_(f"nombre.ilike.%{safe}%,apellidos.ilike.%{safe}%,email.ilike.%{safe}%")
        
        response = query.order('apellidos', desc=False).execute()
        
        return {"musicos": response.data or []}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar músicos: {str(e)}"
        )


@router.get("/musicos/{musico_id}")
async def get_musico_detalle(
    musico_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Ficha completa de un músico: perfil + historial de eventos + pagos + reclamaciones."""
    try:
        # Perfil
        u_res = supabase.table('usuarios').select('*').eq('id', musico_id).eq('rol', 'musico').single().execute()
        musico = u_res.data
        if not musico:
            raise HTTPException(status_code=404, detail="Músico no encontrado")
        
        # Historial eventos
        asigs_res = supabase.table('asignaciones') \
            .select('*, evento:eventos(id,nombre,temporada,fecha_inicio,fecha_fin,estado)') \
            .eq('usuario_id', musico_id) \
            .order('created_at', desc=True) \
            .execute()
        asignaciones = asigs_res.data or []
        
        # Totales de pago
        total_cobrado = 0.0
        total_pendiente = 0.0
        for a in asignaciones:
            try: imp = float(a.get('importe') or 0)
            except: imp = 0
            if a.get('estado_pago') == 'pagado': total_cobrado += imp
            else: total_pendiente += imp
        
        # Reclamaciones
        recl_res = supabase.table('reclamaciones') \
            .select('*, evento:eventos(nombre,temporada)') \
            .eq('usuario_id', musico_id) \
            .order('fecha_creacion', desc=True) \
            .execute()
        
        return {
            "musico": musico,
            "asignaciones": asignaciones,
            "total_cobrado": round(total_cobrado, 2),
            "total_pendiente": round(total_pendiente, 2),
            "reclamaciones": recl_res.data or []
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/pendientes")
async def get_pendientes(current_user: dict = Depends(get_current_gestor)):
    """Contadores de pendientes para el sidebar y el dashboard del gestor."""
    try:
        # Reclamaciones pendientes
        r_res = supabase.table('reclamaciones').select('id', count='exact') \
            .in_('estado', ['pendiente', 'en_gestion']).execute()
        reclamaciones_pendientes = r_res.count or 0
        
        # Perfiles actualizados en últimas 24h (si la migración está aplicada)
        perfiles_actualizados = 0
        try:
            from datetime import timezone, timedelta
            cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
            p_res = supabase.table('usuarios').select('id', count='exact') \
                .eq('rol', 'musico') \
                .gte('ultima_actualizacion_perfil', cutoff_24h) \
                .execute()
            perfiles_actualizados = p_res.count or 0
        except Exception:
            perfiles_actualizados = 0
        
        # Respuestas nuevas desde el último acceso del gestor
        from datetime import timezone, timedelta
        gestor_profile = current_user.get('profile') or {}
        ultimo_acceso = gestor_profile.get('ultimo_acceso_gestor') or (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        a_res = supabase.table('asignaciones').select('id', count='exact') \
            .in_('estado', ['confirmado', 'rechazado']) \
            .gte('fecha_respuesta', ultimo_acceso) \
            .execute()
        respuestas_nuevas = a_res.count or 0
        
        # Tareas próximas (24h) - si existe la tabla tareas
        tareas_proximas = 0
        try:
            cutoff_24h_fw = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            t_res = supabase.table('tareas').select('id', count='exact') \
                .lte('fecha_limite', cutoff_24h_fw) \
                .neq('estado', 'completada') \
                .execute()
            tareas_proximas = t_res.count or 0
        except Exception:
            tareas_proximas = 0
        
        return {
            "reclamaciones_pendientes": reclamaciones_pendientes,
            "perfiles_actualizados": perfiles_actualizados,
            "respuestas_nuevas": respuestas_nuevas,
            "tareas_proximas": tareas_proximas,
            "ultimo_acceso_gestor": ultimo_acceso
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/marcar-acceso")
async def marcar_acceso_gestor(current_user: dict = Depends(get_current_gestor)):
    """Marca el acceso actual del gestor (para tracking de 'respuestas desde último acceso')."""
    try:
        gestor_id = (current_user.get('profile') or {}).get('id')
        if not gestor_id:
            raise HTTPException(status_code=400, detail="Perfil no encontrado")
        now = datetime.now().isoformat()
        supabase.table('usuarios').update({'ultimo_acceso_gestor': now}).eq('id', gestor_id).execute()
        return {"ultimo_acceso": now}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/instrumentos")
async def get_instrumentos_disponibles(current_user: dict = Depends(get_current_gestor)):
    """Return distinct list of instrumentos for filter dropdown"""
    try:
        response = supabase.table('usuarios') \
            .select('instrumento') \
            .eq('rol', 'musico') \
            .execute()
        
        instrumentos = sorted({u.get('instrumento') for u in (response.data or []) if u.get('instrumento')})
        return {"instrumentos": instrumentos}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar instrumentos: {str(e)}"
        )

def _generate_temp_password(length: int = 12) -> str:
    """Generate a secure temp password: letters + digits (meets 8+ upper + digit rule)."""
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
        if any(c.isupper() for c in pwd) and any(c.isdigit() for c in pwd) and any(c.islower() for c in pwd):
            return pwd


@router.post("/musicos/crear")
async def crear_musico(
    data: MusicoCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """
    Crea un nuevo músico:
    - Genera contraseña temporal
    - Crea usuario en Supabase Auth (email + password, confirmado)
    - Asigna rol 'musico' en app_metadata
    - Crea perfil en tabla usuarios con requiere_cambio_password=True
    - Envía email con credenciales vía Resend (si está configurado)
    """
    import os
    from supabase import create_client
    # Fresh admin client to avoid any session interference from auth verification flow
    admin_client = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_KEY']  # service role
    )

    temp_password = _generate_temp_password(12)
    email_str = data.email
    created_user_id = None

    try:
        # 1. Crear usuario en Supabase Auth (email confirmed)
        try:
            auth_resp = admin_client.auth.admin.create_user({
                "email": email_str,
                "password": temp_password,
                "email_confirm": True,
                "app_metadata": {"rol": "musico"}
            })
            created_user = auth_resp.user if hasattr(auth_resp, 'user') else None
            if not created_user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo crear el usuario en Supabase Auth"
                )
            created_user_id = created_user.id
        except HTTPException:
            raise
        except Exception as e:
            msg = str(e).lower()
            if "already" in msg or "exists" in msg or "duplicate" in msg or "registered" in msg:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Este email ya está registrado"
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear usuario: {str(e)}"
            )

        # 2. Crear perfil en tabla usuarios
        profile_payload = {
            "user_id": created_user_id,
            "email": email_str,
            "nombre": data.nombre,
            "apellidos": data.apellidos,
            "instrumento": data.instrumento,
            "telefono": data.telefono,
            "rol": "musico",
            "estado": "activo",
            "requiere_cambio_password": True
        }
        profile_payload = {k: v for k, v in profile_payload.items() if v is not None}

        try:
            insert_res = admin_client.table('usuarios').insert(profile_payload).execute()
            profile = insert_res.data[0] if insert_res.data else None
        except Exception as e:
            try:
                admin_client.auth.admin.delete_user(created_user_id)
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear perfil: {str(e)}"
            )

        # 3. Enviar email con credenciales (no bloqueante de errores)
        email_result = await send_musico_credentials_email(
            to_email=email_str,
            nombre=data.nombre,
            password_temporal=temp_password,
            usuario_id=created_user_id
        )

        # Registro de actividad
        try:
            gp = current_user.get('profile') or {}
            gname = f"{gp.get('nombre','')} {gp.get('apellidos','')}".strip()
            supabase.table('registro_actividad').insert({
                'tipo': 'musico_creado',
                'descripcion': f"{gname} creó al músico {data.nombre} {data.apellidos}",
                'usuario_id': gp.get('id'),
                'usuario_nombre': gname,
                'entidad_tipo': 'musico',
                'entidad_id': profile['id'] if profile else None
            }).execute()
        except Exception:
            pass

        return {
            "message": "Músico creado correctamente" + (
                " y email de credenciales enviado" if email_result.get("sent") else ". Email NO enviado (configurar RESEND_API_KEY)"
            ),
            "musico": profile,
            "password_temporal": temp_password,
            "email_enviado": email_result.get("sent", False),
            "email_error": email_result.get("reason") if not email_result.get("sent") else None
        }

    except HTTPException:
        raise
    except Exception as e:
        if created_user_id:
            try:
                admin_client.auth.admin.delete_user(created_user_id)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear músico: {str(e)}"
        )


@router.post("/musicos/invite")
async def invite_musico(
    data: MusicoCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """
    (Legacy) Invite musician - sends magic link for first login.
    Creates profile without auth account (created on first magic link login).
    """
    try:
        # Send magic link invitation
        supabase.auth.sign_in_with_otp({
            "email": data.email,
            "options": {
                "email_redirect_to": f"/portal"
            }
        })
        
        # Create profile (user_id will be null until they log in)
        profile_data = {
            **data.model_dump(),
            "rol": "musico",
            "estado": "activo",
            "user_id": None  # Will be linked on first login
        }
        
        response = supabase.table('usuarios').insert(profile_data).execute()
        
        return {
            "message": f"Invitación enviada a {data.email}",
            "musico": response.data[0] if response.data else None
        }
        
    except Exception as e:
        error_msg = str(e)
        if "duplicate" in error_msg or "unique" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este email ya está registrado"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al invitar músico: {error_msg}"
        )


# ==================== Export Excel ====================

@router.get("/export/xlsx")
async def export_excel(current_user: dict = Depends(get_current_gestor)):
    """
    Export Usuarios, Eventos y Asignaciones en un fichero .xlsx con 3 hojas.
    """
    try:
        usuarios_res = supabase.table('usuarios').select('*').order('apellidos', desc=False).execute()
        eventos_res = supabase.table('eventos').select('*').order('created_at', desc=True).execute()
        asignaciones_res = supabase.table('asignaciones') \
            .select('*, usuario:usuarios(nombre,apellidos,email,instrumento), evento:eventos(nombre,temporada)') \
            .execute()

        wb = Workbook()

        header_font = Font(bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_align = Alignment(horizontal="center", vertical="center")

        def write_sheet(ws, headers, rows):
            for col_idx, h in enumerate(headers, start=1):
                cell = ws.cell(row=1, column=col_idx, value=h)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_align
            for r_idx, row in enumerate(rows, start=2):
                for c_idx, value in enumerate(row, start=1):
                    ws.cell(row=r_idx, column=c_idx, value=value)
            # Auto width (aprox)
            for col_idx, h in enumerate(headers, start=1):
                max_len = len(str(h))
                for row in rows:
                    val = row[col_idx - 1] if col_idx - 1 < len(row) else ""
                    max_len = max(max_len, len(str(val)) if val is not None else 0)
                ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = min(max_len + 2, 40)

        # Hoja 1: Usuarios
        ws_u = wb.active
        ws_u.title = "Usuarios"
        u_headers = ["Nombre", "Apellidos", "Email", "Rol", "Instrumento", "Teléfono", "Estado", "Fecha Alta"]
        u_rows = []
        for u in (usuarios_res.data or []):
            u_rows.append([
                u.get('nombre', ''),
                u.get('apellidos', ''),
                u.get('email', ''),
                u.get('rol', ''),
                u.get('instrumento', '') or '',
                u.get('telefono', '') or '',
                u.get('estado', ''),
                u.get('fecha_alta', '') or u.get('created_at', '') or ''
            ])
        write_sheet(ws_u, u_headers, u_rows)

        # Hoja 2: Eventos
        ws_e = wb.create_sheet("Eventos")
        e_headers = ["Nombre", "Temporada", "Tipo", "Estado", "Fecha Inicio", "Fecha Fin", "Lugar", "Descripción"]
        e_rows = []
        for e in (eventos_res.data or []):
            e_rows.append([
                e.get('nombre', ''),
                e.get('temporada', '') or '',
                e.get('tipo', '') or '',
                e.get('estado', '') or '',
                e.get('fecha_inicio', '') or '',
                e.get('fecha_fin', '') or '',
                e.get('lugar', '') or '',
                e.get('descripcion', '') or ''
            ])
        write_sheet(ws_e, e_headers, e_rows)

        # Hoja 3: Asignaciones
        ws_a = wb.create_sheet("Asignaciones")
        a_headers = ["Evento", "Temporada", "Músico", "Email", "Instrumento", "Estado", "Estado Pago", "Importe"]
        a_rows = []
        for a in (asignaciones_res.data or []):
            ev = a.get('evento') or {}
            us = a.get('usuario') or {}
            nombre_completo = f"{us.get('nombre', '')} {us.get('apellidos', '')}".strip()
            a_rows.append([
                ev.get('nombre', ''),
                ev.get('temporada', '') or '',
                nombre_completo,
                us.get('email', '') or '',
                us.get('instrumento', '') or '',
                a.get('estado', '') or '',
                a.get('estado_pago', '') or '',
                a.get('importe', 0) or 0
            ])
        write_sheet(ws_a, a_headers, a_rows)

        # Guardar en memoria
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)

        filename = f"opus_manager_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al exportar Excel: {str(e)}"
        )


# ==================== RECORDATORIOS (Bloque 3) ====================

# Catálogo de los 10 recordatorios predefinidos
RECORDATORIOS_PREDEFINIDOS = [
    {"tipo": "nueva_asignacion", "nombre": "Nueva asignación", "descripcion": "Email al músico al ser asignado a un evento", "destinatario_default": "musico", "dias_default": None},
    {"tipo": "respuesta_7d", "nombre": "Recordatorio respuesta 7 días antes del límite", "descripcion": "Solo a músicos sin responder", "destinatario_default": "musico", "dias_default": 7},
    {"tipo": "respuesta_3d", "nombre": "Recordatorio respuesta 3 días antes", "descripcion": "Solo a músicos sin responder", "destinatario_default": "musico", "dias_default": 3},
    {"tipo": "respuesta_24h", "nombre": "Último aviso 24h", "descripcion": "Solo a músicos sin responder", "destinatario_default": "musico", "dias_default": 1},
    {"tipo": "aviso_ensayo_24h", "nombre": "Aviso ensayo 24h antes", "descripcion": "Solo a músicos confirmados", "destinatario_default": "musico", "dias_default": 1},
    {"tipo": "aviso_funcion_48h", "nombre": "Aviso función 48h antes", "descripcion": "Solo a músicos confirmados", "destinatario_default": "musico", "dias_default": 2},
    {"tipo": "alerta_baja_respuesta", "nombre": "Alerta baja respuesta <50% a 5 días", "descripcion": "Aviso al gestor si menos del 50% ha respondido", "destinatario_default": "gestor", "dias_default": 5},
    {"tipo": "pago_pendiente_3d", "nombre": "Recordatorio pago pendiente 3 días antes", "descripcion": "Aviso al gestor para pagos pendientes", "destinatario_default": "gestor", "dias_default": 3},
    {"tipo": "confirmacion_cobro", "nombre": "Confirmación de cobro al pagar", "descripcion": "Email al músico al marcarse como pagado", "destinatario_default": "musico", "dias_default": None},
    {"tipo": "resumen_diario", "nombre": "Resumen diario 8:00 con eventos activos", "descripcion": "Resumen diario para el gestor", "destinatario_default": "gestor", "dias_default": None},
]


class RecordatorioConfigPayload(BaseModel):
    tipo: str
    activo: Optional[bool] = None
    dias_antes: Optional[int] = None
    mensaje_personalizado: Optional[str] = None
    destinatario: Optional[str] = None


@router.get("/eventos/{evento_id}/recordatorios")
async def get_recordatorios(evento_id: str, current_user: dict = Depends(get_current_gestor)):
    """Devuelve la lista de 10 recordatorios con su config actual (o defaults)."""
    try:
        cfgs_res = supabase.table('recordatorios_config') \
            .select('*') \
            .eq('evento_id', evento_id) \
            .execute()
        cfgs_by_tipo = {c['tipo']: c for c in (cfgs_res.data or [])}

        resultado = []
        for predef in RECORDATORIOS_PREDEFINIDOS:
            cfg = cfgs_by_tipo.get(predef['tipo'], {})
            resultado.append({
                **predef,
                "activo": cfg.get('activo', False),
                "dias_antes": cfg.get('dias_antes', predef['dias_default']),
                "mensaje_personalizado": cfg.get('mensaje_personalizado', ''),
                "destinatario": cfg.get('destinatario', predef['destinatario_default']),
                "config_id": cfg.get('id')
            })
        return {"recordatorios": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.put("/eventos/{evento_id}/recordatorios")
async def upsert_recordatorio(
    evento_id: str,
    payload: RecordatorioConfigPayload,
    current_user: dict = Depends(get_current_gestor)
):
    """Activa/desactiva/edita un recordatorio (upsert por tipo+evento)."""
    try:
        data = payload.model_dump(exclude_none=True)
        data['evento_id'] = evento_id
        data['updated_at'] = datetime.utcnow().isoformat()

        # Upsert: intento update, si no existe inserto
        existing = supabase.table('recordatorios_config') \
            .select('id') \
            .eq('evento_id', evento_id) \
            .eq('tipo', payload.tipo) \
            .execute()
        if existing.data:
            supabase.table('recordatorios_config') \
                .update(data) \
                .eq('id', existing.data[0]['id']) \
                .execute()
        else:
            supabase.table('recordatorios_config').insert(data).execute()
        return {"message": "Recordatorio actualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== EMAIL LOG ====================

@router.get("/emails/log")
async def get_email_log(
    limit: int = 200,
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    evento_id: Optional[str] = None,
    desde: Optional[str] = None,  # 'YYYY-MM-DD'
    hasta: Optional[str] = None,
    current_user: dict = Depends(get_current_gestor)
):
    """Historial de emails enviados con filtros y contadores."""
    try:
        query = supabase.table('email_log').select('*')
        if tipo:
            query = query.eq('tipo', tipo)
        if estado:
            query = query.eq('estado', estado)
        if evento_id:
            query = query.eq('evento_id', evento_id)
        if desde:
            query = query.gte('created_at', f"{desde}T00:00:00")
        if hasta:
            query = query.lte('created_at', f"{hasta}T23:59:59")
        res = query.order('created_at', desc=True).limit(min(limit, 500)).execute()
        emails = res.data or []

        # Enrichment: get destinatario nombre de tabla usuarios
        dest_emails = list({e['destinatario'] for e in emails if e.get('destinatario')})
        dest_info = {}
        if dest_emails:
            try:
                u_res = supabase.table('usuarios').select('email,nombre,apellidos') \
                    .in_('email', dest_emails).execute()
                dest_info = {u['email']: f"{u.get('nombre','')} {u.get('apellidos','')}".strip() for u in (u_res.data or [])}
            except Exception:
                dest_info = {}
        for e in emails:
            e['destinatario_nombre'] = dest_info.get(e.get('destinatario'), '')

        # Contadores del día actual
        from datetime import timezone, timedelta
        now = datetime.now(timezone.utc)
        hoy_inicio = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        mes_inicio = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        total_hoy = supabase.table('email_log').select('id', count='exact') \
            .gte('created_at', hoy_inicio).eq('estado', 'enviado').execute().count or 0
        total_error_hoy = supabase.table('email_log').select('id', count='exact') \
            .gte('created_at', hoy_inicio).eq('estado', 'error').execute().count or 0
        total_mes = supabase.table('email_log').select('id', count='exact') \
            .gte('created_at', mes_inicio).eq('estado', 'enviado').execute().count or 0

        return {
            "emails": emails,
            "contadores": {
                "enviados_hoy": total_hoy,
                "errores_hoy": total_error_hoy,
                "enviados_mes": total_mes
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/emails/status")
async def get_resend_status(current_user: dict = Depends(get_current_gestor)):
    """Estado de conexión con Resend."""
    from email_service import _get_api_key, _get_sender
    api_key = _get_api_key()
    if not api_key:
        return {
            "conectado": False,
            "sender": _get_sender(),
            "mensaje": "RESEND_API_KEY no configurada",
            "enviados_mes": 0
        }
    try:
        # Validamos la key intentando listar domains. Si Resend responde
        # con un error de "restricted" significa que la key es válida pero
        # sólo permite enviar emails (sending key). Ese caso lo consideramos OK.
        import resend
        resend.api_key = api_key
        import asyncio
        try:
            await asyncio.to_thread(resend.Domains.list)
        except Exception as inner:
            msg = str(inner).lower()
            if 'restricted' not in msg and 'insufficient' not in msg:
                raise
        
        # Contar emails del mes
        from datetime import timezone
        now = datetime.now(timezone.utc)
        mes_inicio = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        c = supabase.table('email_log').select('id', count='exact') \
            .gte('created_at', mes_inicio).eq('estado', 'enviado').execute().count or 0
        
        return {
            "conectado": True,
            "sender": _get_sender(),
            "mensaje": "Conexión establecida con Resend",
            "enviados_mes": c
        }
    except Exception as e:
        return {
            "conectado": False,
            "sender": _get_sender(),
            "mensaje": f"Error: {str(e)[:200]}",
            "enviados_mes": 0
        }


class EmailTestRequest(BaseModel):
    destinatario: EmailStr
    tipo: str = "prueba"  # 'prueba' | 'nueva_convocatoria' | 'recordatorio' | ...
    asunto: Optional[str] = None
    html: Optional[str] = None


EMAIL_TEST_TEMPLATES = {
    "prueba": {
        "asunto": "OPUS MANAGER — Email de prueba",
        "html": "<h2>✅ Email de prueba</h2><p>Si recibes este correo, Resend está correctamente configurado.</p><p>— OPUS MANAGER</p>"
    },
    "nueva_convocatoria": {
        "asunto": "[Prueba] Nueva convocatoria",
        "html": "<h2>🎼 Nueva convocatoria</h2><p>Has sido asignado a un nuevo evento. Accede al portal para confirmar tu asistencia.</p><p>— OPUS MANAGER</p>"
    },
    "recordatorio": {
        "asunto": "[Prueba] Recordatorio de respuesta",
        "html": "<h2>⏰ Recordatorio</h2><p>Aún no has respondido a la convocatoria. Por favor, confirma tu asistencia lo antes posible.</p>"
    },
    "aviso_ensayo": {
        "asunto": "[Prueba] Aviso de ensayo",
        "html": "<h2>🎵 Recordatorio de ensayo</h2><p>Tu próximo ensayo es mañana. Consulta hora y lugar en el portal.</p>"
    },
    "confirmacion_cobro": {
        "asunto": "[Prueba] Confirmación de pago",
        "html": "<h2>💰 Pago procesado</h2><p>Hemos procesado tu pago correctamente. Consulta el detalle en tu historial.</p>"
    }
}


@router.get("/emails/preview")
async def email_preview(tipo: str = "prueba", current_user: dict = Depends(get_current_gestor)):
    """Devuelve la previsualización del email según tipo."""
    tmpl = EMAIL_TEST_TEMPLATES.get(tipo, EMAIL_TEST_TEMPLATES["prueba"])
    return {"asunto": tmpl["asunto"], "html": tmpl["html"]}


@router.post("/emails/test")
async def email_test_send(
    payload: EmailTestRequest,
    current_user: dict = Depends(get_current_gestor)
):
    """Envía un email de prueba."""
    from email_service import _send_email
    tmpl = EMAIL_TEST_TEMPLATES.get(payload.tipo, EMAIL_TEST_TEMPLATES["prueba"])
    asunto = payload.asunto or tmpl["asunto"]
    html = payload.html or tmpl["html"]
    gestor_profile = current_user.get('profile') or {}
    r = await _send_email(
        to_email=payload.destinatario,
        subject=asunto,
        html=html,
        tipo=f"test_{payload.tipo}",
        usuario_id=gestor_profile.get('id')
    )
    return r


class ReenviarEmailRequest(BaseModel):
    email_log_id: str


@router.post("/emails/reenviar")
async def reenviar_email(
    payload: ReenviarEmailRequest,
    current_user: dict = Depends(get_current_gestor)
):
    """Reenvía un email a partir de un log entry."""
    from email_service import _send_email
    try:
        res = supabase.table('email_log').select('*').eq('id', payload.email_log_id).single().execute()
        item = res.data
        if not item:
            raise HTTPException(status_code=404, detail="Email no encontrado")
        # Cuerpo simple si no tenemos el HTML original
        html = f"<p>Reenvío del email: {item.get('asunto')}</p>"
        r = await _send_email(
            to_email=item['destinatario'],
            subject=f"[Reenvío] {item.get('asunto','')}",
            html=html,
            tipo=f"reenvio_{item.get('tipo','')}",
            usuario_id=item.get('usuario_id'),
            evento_id=item.get('evento_id')
        )
        return r
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== RECLAMACIONES (Gestor) ====================

@router.get("/reclamaciones")
async def get_reclamaciones_gestor(current_user: dict = Depends(get_current_gestor)):
    """Todas las reclamaciones para el panel del gestor."""
    try:
        res = supabase.table('reclamaciones') \
            .select('*, usuario:usuarios(nombre,apellidos,email), evento:eventos(nombre,temporada)') \
            .order('fecha_creacion', desc=True) \
            .execute()
        return {"reclamaciones": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class ReclamacionUpdatePayload(BaseModel):
    estado: Optional[str] = None
    respuesta_gestor: Optional[str] = None


@router.put("/reclamaciones/{reclamacion_id}")
async def update_reclamacion(
    reclamacion_id: str,
    payload: ReclamacionUpdatePayload,
    current_user: dict = Depends(get_current_gestor)
):
    """El gestor actualiza el estado/respuesta de una reclamación."""
    try:
        gestor_profile = current_user.get('profile') or {}
        data = payload.model_dump(exclude_none=True)
        # Trazabilidad: quién gestiona la reclamación
        data['gestor_id'] = gestor_profile.get('id')
        data['gestor_nombre'] = f"{gestor_profile.get('nombre','')} {gestor_profile.get('apellidos','')}".strip()
        if data.get('estado') in ('resuelta', 'rechazada'):
            data['fecha_resolucion'] = datetime.utcnow().isoformat()
        res = supabase.table('reclamaciones').update(data).eq('id', reclamacion_id).execute()
        
        # Registro de actividad
        try:
            supabase.table('registro_actividad').insert({
                'tipo': f"reclamacion_{data.get('estado','actualizada')}",
                'descripcion': f"Reclamación {data.get('estado') or 'actualizada'} por {data['gestor_nombre']}",
                'usuario_id': gestor_profile.get('id'),
                'usuario_nombre': data['gestor_nombre'],
                'entidad_tipo': 'reclamacion',
                'entidad_id': reclamacion_id
            }).execute()
        except Exception:
            pass
        
        return {"message": "Reclamación actualizada", "reclamacion": res.data[0] if res.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== COMENTARIOS INTERNOS ====================

class ComentarioPayload(BaseModel):
    tipo: str  # 'reclamacion' | 'evento'
    entidad_id: str
    contenido: str


@router.get("/comentarios")
async def get_comentarios(
    tipo: str,
    entidad_id: str,
    current_user: dict = Depends(get_current_gestor)
):
    """Lista comentarios internos de una entidad."""
    try:
        res = supabase.table('comentarios_internos') \
            .select('*') \
            .eq('tipo', tipo) \
            .eq('entidad_id', entidad_id) \
            .order('created_at', desc=True) \
            .execute()
        return {"comentarios": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/comentarios")
async def crear_comentario(
    payload: ComentarioPayload,
    current_user: dict = Depends(get_current_gestor)
):
    """Crea un comentario interno entre gestores."""
    try:
        gestor_profile = current_user.get('profile') or {}
        nombre = f"{gestor_profile.get('nombre','')} {gestor_profile.get('apellidos','')}".strip() or gestor_profile.get('email')
        data = {
            "tipo": payload.tipo,
            "entidad_id": payload.entidad_id,
            "gestor_id": gestor_profile.get('id'),
            "gestor_nombre": nombre,
            "contenido": payload.contenido
        }
        res = supabase.table('comentarios_internos').insert(data).execute()
        
        # Notificar a otros gestores si hay menciones @
        import re
        menciones = re.findall(r'@([\w]+)', payload.contenido)
        if menciones:
            try:
                gs = supabase.table('usuarios').select('id,nombre,apellidos') \
                    .eq('rol', 'gestor').execute().data or []
                for g in gs:
                    if g['id'] == gestor_profile.get('id'):
                        continue
                    full = f"{g.get('nombre','')}{g.get('apellidos','')}".lower()
                    if any(m.lower() in full for m in menciones):
                        supabase.table('notificaciones_gestor').insert({
                            "gestor_id": g['id'],
                            "tipo": "mencion_comentario",
                            "titulo": f"{nombre} te ha mencionado",
                            "descripcion": payload.contenido[:200],
                            "entidad_tipo": "comentario",
                            "entidad_id": res.data[0]['id']
                        }).execute()
            except Exception:
                pass
        
        return {"comentario": res.data[0] if res.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ==================== NOTIFICACIONES ====================

@router.get("/notificaciones")
async def get_notificaciones(
    limit: int = 50,
    current_user: dict = Depends(get_current_gestor)
):
    """Lista notificaciones del gestor actual."""
    try:
        gestor_profile = current_user.get('profile') or {}
        gestor_id = gestor_profile.get('id')
        res = supabase.table('notificaciones_gestor') \
            .select('*') \
            .eq('gestor_id', gestor_id) \
            .order('created_at', desc=True) \
            .limit(min(limit, 100)) \
            .execute()
        items = res.data or []
        no_leidas = supabase.table('notificaciones_gestor').select('id', count='exact') \
            .eq('gestor_id', gestor_id).eq('leida', False).execute().count or 0
        return {"notificaciones": items, "no_leidas": no_leidas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.put("/notificaciones/{notif_id}/leer")
async def marcar_leida(notif_id: str, current_user: dict = Depends(get_current_gestor)):
    gestor_id = (current_user.get('profile') or {}).get('id')
    supabase.table('notificaciones_gestor').update({"leida": True}) \
        .eq('id', notif_id).eq('gestor_id', gestor_id).execute()
    return {"message": "Leída"}


@router.post("/notificaciones/leer-todas")
async def marcar_todas_leidas(current_user: dict = Depends(get_current_gestor)):
    gestor_id = (current_user.get('profile') or {}).get('id')
    supabase.table('notificaciones_gestor').update({"leida": True}) \
        .eq('gestor_id', gestor_id).eq('leida', False).execute()
    return {"message": "Todas marcadas como leídas"}


# ==================== REGISTRO DE ACTIVIDAD ====================

@router.get("/actividad")
async def get_actividad(
    limit: int = 100,
    current_user: dict = Depends(get_current_gestor)
):
    """Registro de actividad global."""
    try:
        res = supabase.table('registro_actividad') \
            .select('*') \
            .order('created_at', desc=True) \
            .limit(min(limit, 500)) \
            .execute()
        return {"actividad": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
