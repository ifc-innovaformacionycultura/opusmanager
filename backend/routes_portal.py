# Portal Routes - Músicos Dashboard
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from supabase_client import supabase
from auth_utils import get_current_user, get_current_musico
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/api/portal", tags=["portal"])

# ==================== Models ====================

class ConfirmarAsistenciaRequest(BaseModel):
    asignacion_id: str
    estado: str  # 'confirmado' or 'rechazado'
    comentarios: Optional[str] = None

# ==================== Endpoints ====================

@router.get("/mis-eventos")
async def get_mis_eventos(current_user: dict = Depends(get_current_user)):
    """
    Get all eventos assigned to current musician.
    Returns asignaciones with evento details.
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        if not usuario_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Perfil de usuario no encontrado"
            )
        
        # Query asignaciones with evento details
        response = supabase.table('asignaciones') \
            .select('*, evento:eventos(*)') \
            .eq('usuario_id', usuario_id) \
            .order('created_at', desc=True) \
            .execute()
        
        return {
            "asignaciones": response.data or []
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar eventos: {str(e)}"
        )

@router.get("/evento/{evento_id}/ensayos")
async def get_ensayos_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all ensayos for a specific evento.
    """
    try:
        response = supabase.table('ensayos') \
            .select('*') \
            .eq('evento_id', evento_id) \
            .order('fecha', desc=False) \
            .order('hora', desc=False) \
            .execute()
        
        return {
            "ensayos": response.data or []
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar ensayos: {str(e)}"
        )

@router.get("/evento/{evento_id}/materiales")
async def get_materiales_evento(
    evento_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all materiales (partituras, etc.) for a specific evento.
    """
    try:
        response = supabase.table('materiales') \
            .select('*') \
            .eq('evento_id', evento_id) \
            .order('created_at', desc=True) \
            .execute()
        
        return {
            "materiales": response.data or []
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar materiales: {str(e)}"
        )

@router.put("/asignacion/{asignacion_id}/confirmar")
async def confirmar_asistencia(
    asignacion_id: str,
    data: ConfirmarAsistenciaRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Confirm or reject attendance to an evento.
    Updates asignacion estado.
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        # Verify this asignacion belongs to current user
        asignacion = supabase.table('asignaciones') \
            .select('*') \
            .eq('id', asignacion_id) \
            .eq('usuario_id', usuario_id) \
            .single() \
            .execute()
        
        if not asignacion.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Asignación no encontrada"
            )
        
        # Update estado
        update_data = {
            "estado": data.estado,
            "fecha_respuesta": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        if data.comentarios:
            update_data["comentarios"] = data.comentarios
        
        response = supabase.table('asignaciones') \
            .update(update_data) \
            .eq('id', asignacion_id) \
            .execute()
        
        return {
            "message": f"Asistencia {'confirmada' if data.estado == 'confirmado' else 'rechazada'}",
            "asignacion": response.data[0] if response.data else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar asistencia: {str(e)}"
        )

@router.get("/mi-disponibilidad")
async def get_mi_disponibilidad(current_user: dict = Depends(get_current_user)):
    """
    Get availability records for current musician.
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        response = supabase.table('disponibilidad') \
            .select('*, ensayo:ensayos(*)') \
            .eq('usuario_id', usuario_id) \
            .execute()
        
        return {
            "disponibilidad": response.data or []
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar disponibilidad: {str(e)}"
        )

@router.put("/disponibilidad/{ensayo_id}")
async def marcar_disponibilidad(
    ensayo_id: str,
    asiste: bool,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark availability for a specific ensayo.
    """
    try:
        user_profile = current_user.get("profile", {})
        usuario_id = user_profile.get("id")
        
        # Check if record exists
        existing = supabase.table('disponibilidad') \
            .select('*') \
            .eq('usuario_id', usuario_id) \
            .eq('ensayo_id', ensayo_id) \
            .execute()
        
        if existing.data and len(existing.data) > 0:
            # Update existing
            response = supabase.table('disponibilidad') \
                .update({"asiste": asiste, "updated_at": datetime.now().isoformat()}) \
                .eq('usuario_id', usuario_id) \
                .eq('ensayo_id', ensayo_id) \
                .execute()
        else:
            # Insert new
            response = supabase.table('disponibilidad') \
                .insert({
                    "usuario_id": usuario_id,
                    "ensayo_id": ensayo_id,
                    "asiste": asiste
                }) \
                .execute()
        
        return {
            "message": "Disponibilidad actualizada",
            "asiste": asiste
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar disponibilidad: {str(e)}"
        )
