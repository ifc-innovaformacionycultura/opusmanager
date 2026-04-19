# Authentication utilities for FastAPI endpoints
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict
from supabase_client import verify_supabase_token, get_user_profile, supabase

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
    user_data = await verify_supabase_token(token)
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    # Get user profile from usuarios table
    profile = await get_user_profile(user_data["id"])
    
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

async def require_role(required_role: str):
    """
    Dependency factory to require specific role.
    
    Usage:
        @app.get("/api/admin/users")
        async def admin_only(user: Dict = Depends(require_role("gestor"))):
            return {"message": "Admin access granted"}
    """
    async def role_checker(user: Dict = Depends(get_current_user)) -> Dict:
        if user.get("rol") != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}"
            )
        return user
    
    return role_checker

# Alias for common roles
require_gestor = lambda: require_role("gestor")
require_musico = lambda: require_role("musico")
