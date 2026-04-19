# Gestor Routes - Admin/Manager endpoints
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from supabase_client import supabase, create_user_profile
from auth_utils import get_current_user, get_current_gestor
from typing import List, Optional
from datetime import datetime

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
async def get_musicos(current_user: dict = Depends(get_current_gestor)):
    """Get all musicians"""
    try:
        response = supabase.table('usuarios') \
            .select('*') \
            .eq('rol', 'musico') \
            .order('apellidos', desc=False) \
            .execute()
        
        return {"musicos": response.data or []}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar músicos: {str(e)}"
        )

@router.post("/musicos/invite")
async def invite_musico(
    data: MusicoCreate,
    current_user: dict = Depends(get_current_gestor)
):
    """
    Invite musician - sends magic link for first login.
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
