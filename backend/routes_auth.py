# Authentication Routes - Supabase Auth
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from supabase_client import supabase, create_user_profile
from auth_utils import get_current_user
from typing import Optional
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])

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

class MagicLinkRequest(BaseModel):
    email: EmailStr

# ==================== Endpoints ====================

@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest):
    """
    Login with email and password (for gestores).
    Uses Supabase Auth.
    """
    try:
        response = supabase.auth.sign_in_with_password({
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
    """
    try:
        # 1. Create Supabase Auth user with rol in app_metadata
        auth_response = supabase.auth.sign_up({
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
        
        # 2. Update app_metadata with rol (critical for RLS)
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

@router.post("/magic-link")
async def send_magic_link(data: MagicLinkRequest):
    """
    Send magic link for passwordless login (músicos).
    Email will contain link to /portal with token.
    """
    try:
        # Get app URL from environment or default to localhost
        app_url = os.environ.get('APP_URL', 'http://localhost:3000')
        
        response = supabase.auth.sign_in_with_otp({
            "email": data.email,
            "options": {
                "email_redirect_to": f"{app_url}/portal"
            }
        })
        
        return {
            "message": "Enlace mágico enviado",
            "email": data.email,
            "check_email": True
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al enviar enlace: {str(e)}"
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

@router.post("/logout")
async def logout():
    """
    Logout (client should discard token).
    Supabase handles session invalidation.
    """
    try:
        supabase.auth.sign_out()
        return {"message": "Sesión cerrada"}
    except Exception as e:
        # Even if Supabase call fails, client should discard token
        return {"message": "Sesión cerrada"}

@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """
    Refresh access token using refresh token.
    """
    try:
        response = supabase.auth.refresh_session(refresh_token)
        
        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido"
            )
        
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Error al renovar token"
        )
