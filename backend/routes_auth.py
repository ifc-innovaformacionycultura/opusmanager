# Authentication Routes - Supabase Auth
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from supabase import create_client
from supabase_client import supabase, create_user_profile
from auth_utils import get_current_user
from typing import Optional
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _make_auth_client():
    """Create a fresh, ephemeral Supabase client for a single login/signup request.
    
    This is CRITICAL to avoid session contamination on the global `supabase` client
    which is shared across all DB operations. If we called auth.sign_in_with_password
    on the shared service-role client, subsequent .table().select() calls would be
    filtered by RLS using the user JWT, causing 404s intermittently.
    """
    url = os.environ['SUPABASE_URL']
    anon = os.environ.get('SUPABASE_ANON_KEY') or os.environ['SUPABASE_KEY']
    return create_client(url, anon)

# ==================== Request/Response Models ====================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    nombre: str
    apellidos: str
    rol: str = "musico"  # 'gestor' or 'musico'
    instrumento: Optional[str] = None
    telefono: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: dict

# ==================== Endpoints ====================

@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest):
    """
    Login with email and password (for gestores).
    Uses an ephemeral Supabase client to avoid contaminating the shared service-role session.
    """
    auth_client = _make_auth_client()
    try:
        response = auth_client.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })
        
        if not response.user or not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas"
            )
        
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "user_metadata": response.user.user_metadata
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "Invalid login credentials" in error_msg or "invalid" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email o contraseña incorrectos"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al iniciar sesión: {error_msg}"
        )

@router.post("/signup")
async def signup(data: SignupRequest):
    """
    Create new user account (gestores only - músicos use magic link).
    Creates auth user + profile in usuarios table.
    Updates app_metadata with rol for RLS policies.
    Uses an ephemeral Supabase client for the sign_up call.
    """
    auth_client = _make_auth_client()
    try:
        # 1. Create Supabase Auth user with rol in app_metadata
        auth_response = auth_client.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {
                    "nombre": data.nombre,
                    "apellidos": data.apellidos
                }
            }
        })
        
        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error al crear cuenta"
            )
        
        # 2. Update app_metadata with rol (use service-role client)
        try:
            supabase.auth.admin.update_user_by_id(
                auth_response.user.id,
                {"app_metadata": {"rol": data.rol}}
            )
        except Exception as e:
            print(f"⚠️ Warning: Could not update app_metadata: {e}")
        
        # 3. Create profile in usuarios table
        profile = await create_user_profile(
            user_id=auth_response.user.id,
            email=data.email,
            nombre=data.nombre,
            apellidos=data.apellidos,
            rol=data.rol,
            instrumento=data.instrumento,
            telefono=data.telefono
        )
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear perfil de usuario"
            )
        
        return {
            "message": "Usuario creado exitosamente",
            "user": {
                "id": auth_response.user.id,
                "email": data.email,
                "nombre": data.nombre,
                "rol": data.rol
            },
            "requires_email_confirmation": auth_response.session is None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg or "already exists" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este email ya está registrado"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear cuenta: {error_msg}"
        )

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user.
    Requires valid Supabase token in Authorization header.
    """
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "nombre": current_user.get("nombre"),
        "apellidos": current_user.get("apellidos"),
        "rol": current_user.get("rol"),
        "profile": current_user.get("profile")
    }

@router.post("/sync-profile")
async def sync_user_profile(current_user: dict = Depends(get_current_user)):
    """
    Sync current user's auth profile with usuarios table.
    Creates profile if it doesn't exist.
    Useful when a user exists in Supabase Auth but not in usuarios table.
    """
    try:
        user_id = current_user["id"]
        email = current_user["email"]
        
        # Check if profile exists
        existing_profile = supabase.table('usuarios').select('*').eq('user_id', user_id).execute()
        
        if existing_profile.data and len(existing_profile.data) > 0:
            return {
                "message": "Perfil ya existe",
                "profile": existing_profile.data[0],
                "synced": False
            }
        
        # Get user metadata from Supabase Auth
        auth_user = supabase.auth.admin.get_user_by_id(user_id)
        
        # Extract metadata
        user_metadata = auth_user.user.user_metadata or {}
        app_metadata = auth_user.user.app_metadata or {}
        
        # Determine rol from app_metadata or default to 'musico'
        rol = app_metadata.get('rol', 'musico')
        
        # Create profile
        profile_data = {
            "user_id": user_id,
            "email": email,
            "nombre": user_metadata.get('nombre', email.split('@')[0]),
            "apellidos": user_metadata.get('apellidos', ''),
            "rol": rol,
            "estado": "activo",
            "instrumento": user_metadata.get('instrumento'),
            "telefono": user_metadata.get('telefono')
        }
        
        response = supabase.table('usuarios').insert(profile_data).execute()
        
        if response.data and len(response.data) > 0:
            return {
                "message": "Perfil creado exitosamente",
                "profile": response.data[0],
                "synced": True
            }
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear perfil"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al sincronizar perfil: {str(e)}"
        )

@router.post("/logout")
async def logout():
    """
    Logout (client should discard token).
    Server-side noop: Supabase logout requires an authenticated client and would
    invalidate ALL user sessions globally. The client-side should just discard
    its token. We keep this endpoint for compatibility but it returns success.
    """
    return {"message": "Sesión cerrada"}

@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """
    Refresh access token using refresh token.
    Uses an ephemeral client to avoid contaminating the shared service-role session.
    """
    auth_client = _make_auth_client()
    try:
        response = auth_client.auth.refresh_session(refresh_token)
        
        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido"
            )
        
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token
        }
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Error al renovar token"
        )
