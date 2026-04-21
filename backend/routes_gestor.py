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
        update_data = {
            **data.model_dump(exclude_none=True),
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
            password_temporal=temp_password
        )

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
