#!/usr/bin/env python3
"""
Seed Admin User in Supabase
Creates admin user with gestor role
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from supabase import create_client

# Admin credentials from .env
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@convocatorias.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin123!')

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']

def seed_admin():
    """Create admin user in Supabase Auth and usuarios table"""
    
    # Use service role key to bypass RLS
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print(f"🔧 Creating admin user: {ADMIN_EMAIL}")
    
    try:
        # 1. Create auth user (if not exists)
        auth_response = supabase.auth.admin.create_user({
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "email_confirm": True,  # Auto-confirm
            "user_metadata": {
                "nombre": "Administrador",
                "apellidos": "OPUS",
                "rol": "gestor"
            }
        })
        
        if not auth_response.user:
            print("❌ Failed to create auth user")
            return False
        
        user_id = auth_response.user.id
        print(f"✅ Auth user created: {user_id}")
        
        # 2. Update or create profile in usuarios table
        # First check if profile exists
        existing = supabase.table('usuarios').select('*').eq('email', ADMIN_EMAIL).execute()
        
        if existing.data and len(existing.data) > 0:
            # Update existing profile with new user_id
            profile_response = supabase.table('usuarios').update({
                "user_id": user_id,
                "nombre": "Administrador",
                "apellidos": "OPUS",
                "rol": "gestor",
                "estado": "activo"
            }).eq('email', ADMIN_EMAIL).execute()
            
            print(f"✅ Profile updated in usuarios table")
        else:
            # Create new profile
            profile_response = supabase.table('usuarios').insert({
                "user_id": user_id,
                "email": ADMIN_EMAIL,
                "nombre": "Administrador",
                "apellidos": "OPUS",
                "rol": "gestor",
                "estado": "activo"
            }).execute()
            
            print(f"✅ Profile created in usuarios table")
        
        print(f"\n🎉 Admin user ready!")
        print(f"   Email: {ADMIN_EMAIL}")
        print(f"   Password: {ADMIN_PASSWORD}")
        print(f"   Role: gestor")
        return True
            
    except Exception as e:
        error_msg = str(e)
        
        # Handle "User already exists" gracefully
        if "already been registered" in error_msg or "User already registered" in error_msg:
            print(f"⚠️  User {ADMIN_EMAIL} already exists in Supabase Auth")
            print(f"   Attempting to link profile...")
            
            try:
                # Try to sign in to get user_id
                signin_response = supabase.auth.sign_in_with_password({
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD
                })
                
                if signin_response.user:
                    user_id = signin_response.user.id
                    
                    # Check if profile exists
                    existing = supabase.table('usuarios').select('*').eq('user_id', user_id).execute()
                    
                    if existing.data and len(existing.data) > 0:
                        print(f"✅ Profile already exists")
                        print(f"\n🎉 Admin user ready!")
                        print(f"   Email: {ADMIN_EMAIL}")
                        print(f"   Password: {ADMIN_PASSWORD}")
                        return True
                    else:
                        # Create profile
                        supabase.table('usuarios').insert({
                            "user_id": user_id,
                            "email": ADMIN_EMAIL,
                            "nombre": "Administrador",
                            "apellidos": "OPUS",
                            "rol": "gestor",
                            "estado": "activo"
                        }).execute()
                        
                        print(f"✅ Profile created for existing auth user")
                        print(f"\n🎉 Admin user ready!")
                        return True
                        
            except Exception as inner_e:
                print(f"❌ Error linking profile: {inner_e}")
                return False
        else:
            print(f"❌ Error: {e}")
            return False

if __name__ == "__main__":
    success = seed_admin()
    sys.exit(0 if success else 1)
