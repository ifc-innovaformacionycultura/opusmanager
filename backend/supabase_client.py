# Supabase Client for Backend
# Handles Auth validation and PostgreSQL queries
import os
from supabase import create_client, Client
from typing import Optional, Dict

# Get credentials from environment
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_KEY', '')  # Service role key for backend
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', SUPABASE_SERVICE_KEY)  # Anon key for token verification

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("❌ SUPABASE_URL and SUPABASE_KEY must be set in .env")

# Create Supabase client with service role key (backend has full access)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Create client with anon key for token verification
supabase_anon: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def verify_supabase_token(token: str) -> Optional[Dict]:
    """
    Verify a Supabase Auth token and return user data.
    
    Args:
        token: JWT token from Authorization header
        
    Returns:
        User data dict if valid, None if invalid
    """
    try:
        # Use anon client to verify user tokens
        response = supabase_anon.auth.get_user(token)
        
        if response and response.user:
            user = response.user
            return {
                "id": user.id,
                "email": user.email,
                "user_metadata": user.user_metadata or {},
                "app_metadata": user.app_metadata or {}
            }
        return None
    except Exception as e:
        print(f"❌ Token verification failed: {e}")
        return None

def get_user_profile_sync(user_id: str) -> Optional[Dict]:
    """
    Get user profile from usuarios table (sync version).
    
    Args:
        user_id: Supabase Auth user ID
        
    Returns:
        User profile dict or None
    """
    try:
        print(f"🔍 Looking for profile with user_id: {user_id}")
        response = supabase.table('usuarios').select('*').eq('user_id', user_id).execute()
        
        print(f"📊 Query result: {len(response.data) if response.data else 0} records")
        
        if response.data and len(response.data) > 0:
            print(f"✅ Profile found: {response.data[0].get('email')}")
            return response.data[0]
        print(f"❌ No profile found for user_id: {user_id}")
        return None
    except Exception as e:
        print(f"❌ Error fetching profile: {e}")
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
    Also updates auth.users app_metadata with the rol.
    
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
        # 1. Update app_metadata in auth.users with rol
        supabase.auth.admin.update_user_by_id(
            user_id,
            {"app_metadata": {"rol": rol}}
        )
        
        # 2. Create profile in usuarios table
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
