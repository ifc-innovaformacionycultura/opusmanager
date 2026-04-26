# Authentication utilities for FastAPI endpoints
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict
from supabase_client import verify_supabase_token, get_user_profile_sync, supabase

# HTTP Bearer security scheme
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    Dependency to get current authenticated user from Supabase token.
    
    Usage in endpoints:
        @app.get("/api/protected")
        async def protected(user: Dict = Depends(get_current_user)):
            return {"user_id": user["id"]}
    """
    token = credentials.credentials
    
    # Verify token with Supabase (no JWT Secret needed!)
    user_data = verify_supabase_token(token)
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    # Get user profile from usuarios table
    profile = get_user_profile_sync(user_data["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )
    
    # Combine auth data with profile
    return {
        **user_data,
        "profile": profile,
        "rol": profile.get("rol"),
        "nombre": profile.get("nombre"),
        "apellidos": profile.get("apellidos")
    }

async def get_current_gestor(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """Dependency for gestor-only endpoints. El rol 'archivero' tiene acceso idéntico al 'gestor'."""
    user = await get_current_user(credentials)
    if user.get("rol") not in ("gestor", "archivero"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requiere rol de gestor o archivero."
        )
    return user

async def get_current_musico(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """Dependency for musico-only endpoints"""
    user = await get_current_user(credentials)
    if user.get("rol") != "musico":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requiere rol de músico."
        )
    return user
