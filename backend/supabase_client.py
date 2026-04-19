# Supabase Client for Backend
# Handles Auth validation and PostgreSQL queries
import os
from supabase import create_client, Client
from typing import Optional, Dict

# Get credentials from environment
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_KEY', '')  # Service role key for backend

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("❌ SUPABASE_URL and SUPABASE_KEY must be set in .env")

# Create Supabase client with service role key (backend has full access)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async def verify_supabase_token(token: str) -> Optional[Dict]:
    """
    Verify a Supabase Auth token and return user data.
    
    Args:
        token: JWT token from Authorization header
        
    Returns:
        User data dict if valid, None if invalid
    """
    try:
        # Use Supabase SDK to validate token (no JWT Secret needed!)
        response = supabase.auth.get_user(token)
        
        if response and response.user:
            return {
                "id": response.user.id,
                "email": response.user.email,
                "user_metadata": response.user.user_metadata,
                "app_metadata": response.user.app_metadata
            }
        return None
    except Exception as e:
        print(f"❌ Token verification failed: {e}")
        return None

async def get_user_profile(user_id: str) -> Optional[Dict]:
    """
    Get user profile from usuarios table.
    
    Args:
        user_id: Supabase Auth user ID
        
    Returns:
        User profile dict or None
    """
    try:
        response = supabase.table('usuarios').select('*').eq('user_id', user_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"❌ Error fetching profile: {e}")
        return None

async def create_user_profile(user_id: str, email: str, nombre: str, apellidos: str, rol: str, **kwargs) -> Optional[Dict]:
    """
    Create a user profile in usuarios table after Supabase Auth signup.
    
    Args:
        user_id: Supabase Auth user ID
        email: User email
        nombre: First name
        apellidos: Last name
        rol: 'gestor' or 'musico'
        **kwargs: Additional fields (instrumento, telefono, etc.)
        
    Returns:
        Created profile dict or None
    """
    try:
        profile_data = {
            "user_id": user_id,
            "email": email,
            "nombre": nombre,
            "apellidos": apellidos,
            "rol": rol,
            "estado": "activo",
            **kwargs
        }
        
        response = supabase.table('usuarios').insert(profile_data).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"❌ Error creating profile: {e}")
        return None
