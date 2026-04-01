from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "default-secret-key-change-in-production")

# Password utilities
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT utilities
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Pydantic Models
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

class SeasonCreate(BaseModel):
    name: str
    sheet_url: Optional[str] = None

class SeasonResponse(BaseModel):
    id: str
    name: str
    sheet_url: Optional[str] = None
    created_at: str

class EventCreate(BaseModel):
    name: str
    date: str
    time: str
    season_id: str
    secondary_dates: List[str] = []
    rehearsals: List[Dict[str, str]] = []
    instrumentation: Dict[str, Any] = {}
    transport: Dict[str, Any] = {}
    program: List[Dict[str, str]] = []
    form_url: Optional[str] = None

class EventUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    secondary_dates: Optional[List[str]] = None
    rehearsals: Optional[List[Dict[str, str]]] = None
    instrumentation: Optional[Dict[str, Any]] = None
    transport: Optional[Dict[str, Any]] = None
    program: Optional[List[Dict[str, str]]] = None
    form_url: Optional[str] = None

class ContactCreate(BaseModel):
    baremo: Optional[int] = None
    apellidos: str
    nombre: str
    dni: Optional[str] = None
    provincia: Optional[str] = None
    especialidad: Optional[str] = None
    categoria: Optional[str] = None
    telefono: Optional[str] = None
    email: str
    iban: Optional[str] = None
    swift: Optional[str] = None

class EmailTemplateCreate(BaseModel):
    type: str
    header_image: Optional[str] = None
    subject: str
    body: str
    signature_image: Optional[str] = None

# Create the main app
app = FastAPI()

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth")

# Auth endpoints
@auth_router.post("/login")
async def login(user_data: UserLogin, response: Response):
    email = user_data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    # Return token in response body for Authorization header usage
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "user")
        }
    }

@auth_router.post("/register")
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(user_data.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": user_data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": user_data.name,
        "role": "user"
    }

@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@auth_router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@auth_router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# API endpoints
@api_router.get("/")
async def root():
    return {"message": "Panel de Gestión de Convocatorias API"}

# Seasons
@api_router.get("/seasons")
async def get_seasons(request: Request):
    await get_current_user(request)
    seasons = await db.seasons.find({}, {"_id": 0}).to_list(100)
    return seasons

@api_router.post("/seasons")
async def create_season(season: SeasonCreate, request: Request):
    await get_current_user(request)
    season_doc = {
        "id": str(uuid.uuid4()),
        "name": season.name,
        "sheet_url": season.sheet_url,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.seasons.insert_one(season_doc)
    return {"id": season_doc["id"], "name": season.name, "sheet_url": season.sheet_url, "created_at": season_doc["created_at"]}

@api_router.get("/seasons/{season_id}")
async def get_season(season_id: str, request: Request):
    await get_current_user(request)
    season = await db.seasons.find_one({"id": season_id}, {"_id": 0})
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    return season

# Events
@api_router.get("/events")
async def get_events(request: Request, season_id: Optional[str] = None):
    await get_current_user(request)
    query = {"season_id": season_id} if season_id else {}
    events = await db.events.find(query, {"_id": 0}).to_list(100)
    return events

@api_router.post("/events")
async def create_event(event: EventCreate, request: Request):
    await get_current_user(request)
    event_doc = {
        "id": str(uuid.uuid4()),
        **event.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event_doc)
    return {k: v for k, v in event_doc.items() if k != "_id"}

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, event: EventUpdate, request: Request):
    await get_current_user(request)
    update_data = {k: v for k, v in event.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.events.update_one({"id": event_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    updated = await db.events.find_one({"id": event_id}, {"_id": 0})
    return updated

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, request: Request):
    await get_current_user(request)
    result = await db.events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted"}

# Contacts
@api_router.get("/contacts")
async def get_contacts(request: Request):
    await get_current_user(request)
    contacts = await db.contacts.find({}, {"_id": 0}).to_list(1000)
    return contacts

@api_router.post("/contacts")
async def create_contact(contact: ContactCreate, request: Request):
    await get_current_user(request)
    contact_doc = {
        "id": str(uuid.uuid4()),
        **contact.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.contacts.insert_one(contact_doc)
    return {k: v for k, v in contact_doc.items() if k != "_id"}

@api_router.put("/contacts/{contact_id}")
async def update_contact(contact_id: str, contact: ContactCreate, request: Request):
    current_user = await get_current_user(request)
    
    # Get old document for comparison
    old_contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not old_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Update data
    update_data = contact.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Perform update
    result = await db.contacts.update_one({"id": contact_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Get updated document
    updated = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    
    # Calculate detailed changes
    changes = calculate_changes(old_contact, updated)
    
    # Create detailed activity description
    action_details = []
    for field, change in changes.items():
        action_details.append(f"{field}: {change['before']} → {change['after']}")
    
    # Log activity with detailed changes
    await log_activity(
        user_id=str(current_user.get("_id", current_user.get("id", "unknown"))),
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="update_contact",
        entity_type="contact",
        entity_id=contact_id,
        entity_name=updated.get("name", "Unknown"),
        details={
            "summary": ", ".join(action_details[:3]) if action_details else "Actualización de contacto",
            "fields_modified": list(changes.keys())
        },
        changes=changes
    )
    
    return updated

# Email Templates
@api_router.get("/email-templates")
async def get_email_templates(request: Request):
    await get_current_user(request)
    templates = await db.email_templates.find({}, {"_id": 0}).to_list(100)
    return templates

@api_router.post("/email-templates")
async def create_email_template(template: EmailTemplateCreate, request: Request):
    await get_current_user(request)
    template_doc = {
        "id": str(uuid.uuid4()),
        **template.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.email_templates.insert_one(template_doc)
    return {k: v for k, v in template_doc.items() if k != "_id"}

@api_router.put("/email-templates/{template_id}")
async def update_email_template(template_id: str, template: EmailTemplateCreate, request: Request):
    await get_current_user(request)
    update_data = template.model_dump()
    result = await db.email_templates.update_one({"id": template_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    updated = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    return updated

# Event Responses (simulated from Google Sheets)
@api_router.get("/event-responses/{event_id}")
async def get_event_responses(event_id: str, request: Request):
    await get_current_user(request)
    responses = await db.event_responses.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    return responses

# ============================================
# CONTACT OPERATIONS WITH DETAILED LOGGING
# ============================================

@api_router.post("/contacts/{contact_id}/confirm-attendance")
async def confirm_contact_attendance(
    contact_id: str,
    data: dict,  # {event_id, rehearsals: [bool], function: bool, notes: str}
    request: Request
):
    """Confirmar asistencia de un contacto a un evento"""
    current_user = await get_current_user(request)
    
    # Get contact
    contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    event_id = data.get("event_id")
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    
    # Create or update attendance record
    attendance_record = {
        "contact_id": contact_id,
        "contact_name": contact.get("name", "Unknown"),
        "event_id": event_id,
        "event_name": event.get("name", "Unknown") if event else "Unknown",
        "status": "confirmed",
        "rehearsals_confirmed": data.get("rehearsals", []),
        "function_confirmed": data.get("function", False),
        "notes": data.get("notes", ""),
        "confirmed_by": current_user["email"],
        "confirmed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update or insert
    await db.attendance.update_one(
        {"contact_id": contact_id, "event_id": event_id},
        {"$set": attendance_record},
        upsert=True
    )
    
    # Log activity
    await log_activity(
        user_id=str(current_user.get("_id", current_user.get("id", "unknown"))),
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="confirm_attendance",
        entity_type="attendance",
        entity_id=f"{contact_id}_{event_id}",
        entity_name=f"{contact.get('name')} - {event.get('name') if event else 'Evento'}",
        details={
            "contact": contact.get("name"),
            "event": event.get("name") if event else "Unknown",
            "rehearsals": data.get("rehearsals", []),
            "function": data.get("function", False),
            "notes": data.get("notes", "")
        },
        changes={
            "status": {"before": "pending", "after": "confirmed"},
            "rehearsals": {"before": [], "after": data.get("rehearsals", [])},
            "function": {"before": False, "after": data.get("function", False)}
        }
    )
    
    return {"message": "Attendance confirmed", "attendance": attendance_record}

@api_router.post("/contacts/{contact_id}/send-invitation")
async def send_contact_invitation(
    contact_id: str,
    data: dict,  # {event_id, template_id, custom_message}
    request: Request
):
    """Enviar invitación/convocatoria a un contacto"""
    current_user = await get_current_user(request)
    
    contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    event_id = data.get("event_id")
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    
    # Record email sent
    email_record = {
        "id": str(uuid.uuid4()),
        "contact_id": contact_id,
        "contact_email": contact.get("email"),
        "contact_name": contact.get("name"),
        "event_id": event_id,
        "event_name": event.get("name") if event else "Unknown",
        "template_id": data.get("template_id"),
        "custom_message": data.get("custom_message", ""),
        "sent_by": current_user["email"],
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "status": "sent"  # In production: sent, bounced, opened, clicked
    }
    
    await db.email_logs.insert_one(email_record)
    
    # Log activity
    await log_activity(
        user_id=str(current_user.get("_id", current_user.get("id", "unknown"))),
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="send_invitation",
        entity_type="email",
        entity_id=email_record["id"],
        entity_name=f"Invitación a {contact.get('name')}",
        details={
            "recipient": contact.get("email"),
            "recipient_name": contact.get("name"),
            "event": event.get("name") if event else "Unknown",
            "template_id": data.get("template_id")
        }
    )
    
    return {"message": "Invitation sent (simulated)", "email_log": email_record}

@api_router.post("/contacts/{contact_id}/assign-to-roster")
async def assign_contact_to_roster(
    contact_id: str,
    data: dict,  # {event_id, section, position, stand_number, cache}
    request: Request
):
    """Asignar contacto a plantilla definitiva"""
    current_user = await get_current_user(request)
    
    contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    event_id = data.get("event_id")
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    
    # Create roster assignment
    roster_assignment = {
        "id": str(uuid.uuid4()),
        "contact_id": contact_id,
        "contact_name": contact.get("name"),
        "event_id": event_id,
        "event_name": event.get("name") if event else "Unknown",
        "section": data.get("section"),  # Cuerda, Viento Madera, etc.
        "instrument": contact.get("instrument"),
        "position": data.get("position"),  # Principal, tutti, etc.
        "stand_number": data.get("stand_number"),
        "cache": data.get("cache", 0),
        "cache_extra": data.get("cache_extra", 0),
        "assigned_by": current_user["email"],
        "assigned_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.roster_assignments.update_one(
        {"contact_id": contact_id, "event_id": event_id},
        {"$set": roster_assignment},
        upsert=True
    )
    
    # Log activity
    await log_activity(
        user_id=str(current_user.get("_id", current_user.get("id", "unknown"))),
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="assign_to_roster",
        entity_type="roster",
        entity_id=roster_assignment["id"],
        entity_name=f"{contact.get('name')} → {event.get('name') if event else 'Evento'}",
        details={
            "contact": contact.get("name"),
            "event": event.get("name") if event else "Unknown",
            "section": data.get("section"),
            "position": data.get("position"),
            "stand": data.get("stand_number"),
            "cache": data.get("cache", 0)
        },
        changes={
            "roster_status": {"before": "not_assigned", "after": "assigned"},
            "section": {"before": None, "after": data.get("section")},
            "cache": {"before": 0, "after": data.get("cache", 0)}
        }
    )
    
    return {"message": "Contact assigned to roster", "assignment": roster_assignment}

@api_router.put("/roster-assignments/{assignment_id}/update-cache")
async def update_roster_cache(
    assignment_id: str,
    data: dict,  # {cache, cache_extra, reason}
    request: Request
):
    """Actualizar caché de un músico en la plantilla"""
    current_user = await get_current_user(request)
    
    # Get old assignment
    old_assignment = await db.roster_assignments.find_one({"id": assignment_id}, {"_id": 0})
    if not old_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Update cache
    new_cache = data.get("cache", old_assignment.get("cache", 0))
    new_cache_extra = data.get("cache_extra", old_assignment.get("cache_extra", 0))
    
    update_result = await db.roster_assignments.update_one(
        {"id": assignment_id},
        {"$set": {
            "cache": new_cache,
            "cache_extra": new_cache_extra,
            "cache_updated_by": current_user["email"],
            "cache_updated_at": datetime.now(timezone.utc).isoformat(),
            "cache_update_reason": data.get("reason", "")
        }}
    )
    
    if update_result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Get updated assignment
    updated_assignment = await db.roster_assignments.find_one({"id": assignment_id}, {"_id": 0})
    
    # Calculate totals
    old_total = old_assignment.get("cache", 0) + old_assignment.get("cache_extra", 0)
    new_total = new_cache + new_cache_extra
    
    # Log activity
    await log_activity(
        user_id=str(current_user.get("_id", current_user.get("id", "unknown"))),
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="update_cache",
        entity_type="roster",
        entity_id=assignment_id,
        entity_name=f"Caché de {old_assignment.get('contact_name')}",
        details={
            "contact": old_assignment.get("contact_name"),
            "event": old_assignment.get("event_name"),
            "reason": data.get("reason", "")
        },
        changes={
            "cache_base": {"before": old_assignment.get("cache", 0), "after": new_cache},
            "cache_extra": {"before": old_assignment.get("cache_extra", 0), "after": new_cache_extra},
            "cache_total": {"before": old_total, "after": new_total}
        }
    )
    
    return {"message": "Cache updated", "assignment": updated_assignment}


@api_router.post("/event-responses")
async def create_event_response(response_data: dict, request: Request):
    await get_current_user(request)
    response_doc = {
        "id": str(uuid.uuid4()),
        **response_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.event_responses.insert_one(response_doc)
    return {k: v for k, v in response_doc.items() if k != "_id"}

# Column Mapping
@api_router.get("/column-mapping")
async def get_column_mapping(request: Request):
    await get_current_user(request)
    mapping = await db.column_mapping.find_one({}, {"_id": 0})
    return mapping or {}

@api_router.post("/column-mapping")
async def save_column_mapping(mapping: dict, request: Request):
    await get_current_user(request)
    await db.column_mapping.delete_many({})
    mapping["id"] = str(uuid.uuid4())
    await db.column_mapping.insert_one(mapping)
    return {k: v for k, v in mapping.items() if k != "_id"}

# Email Matrix
@api_router.get("/email-matrix")
async def get_email_matrix(request: Request):
    await get_current_user(request)
    matrix = await db.email_matrix.find({}, {"_id": 0}).to_list(100)
    return matrix

@api_router.post("/email-matrix")
async def save_email_matrix(matrix: List[dict], request: Request):
    await get_current_user(request)
    await db.email_matrix.delete_many({})
    if matrix:
        await db.email_matrix.insert_many(matrix)
    return {"message": "Matrix saved"}

# =====================================================
# USER MANAGEMENT & ACTIVITY LOG
# =====================================================

# Pydantic Models for User Management
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "viewer"  # admin, manager, editor, viewer

# Feedback/Bug Report Models
class FeedbackReportCreate(BaseModel):
    page: str  # Dashboard, Configuración › Eventos, etc.
    section: Optional[str] = None  # Subsección específica
    type: str  # "error" o "mejora"
    description: str
    user_agent: Optional[str] = None  # Info del navegador
    screenshot_url: Optional[str] = None  # URL de captura de pantalla si la hay

class FeedbackReportUpdate(BaseModel):
    status: str  # "reportado", "en_proceso", "solucionado"

class FeedbackReportResponse(BaseModel):
    id: str
    page: str
    section: Optional[str]
    type: str
    description: str
    status: str
    reported_by: str  # Email del usuario
    reported_by_name: str  # Nombre del usuario
    created_at: str
    updated_at: str
    user_agent: Optional[str]
    screenshot_url: Optional[str]

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class PasswordChange(BaseModel):
    new_password: str

class PasswordReset(BaseModel):
    user_id: str
    new_password: str

# Activity Log Helper
async def log_activity(
    user_id: str,
    user_email: str,
    user_name: str,
    action: str,
    entity_type: str,
    entity_id: str = None,
    entity_name: str = None,
    details: dict = None,
    ip_address: str = None,
    changes: dict = None  # NEW: Para capturar before/after de cambios
):
    """
    Log user activity for audit trail with detailed change tracking
    
    Args:
        changes: Dict with format {"field_name": {"before": old_value, "after": new_value}}
    """
    log_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "user_email": user_email,
        "user_name": user_name,
        "action": action,  # create, update, delete, login, logout, view, export, confirm, assign, email_sent, etc.
        "entity_type": entity_type,  # user, event, contact, season, template, etc.
        "entity_id": entity_id,
        "entity_name": entity_name,
        "details": details or {},
        "changes": changes or {},  # Detailed before/after for each changed field
        "ip_address": ip_address
    }
    await db.activity_logs.insert_one(log_entry)
    return log_entry

def calculate_changes(old_doc: dict, new_doc: dict, fields_to_track: list = None) -> dict:
    """
    Calculate changes between old and new documents
    
    Args:
        old_doc: Original document
        new_doc: Updated document
        fields_to_track: List of field names to track (None = track all)
    
    Returns:
        Dict with format {"field_name": {"before": old_value, "after": new_value}}
    """
    changes = {}
    
    # Determine which fields to check
    if fields_to_track:
        fields = fields_to_track
    else:
        # Track all fields that exist in either document
        fields = set(list(old_doc.keys()) + list(new_doc.keys()))
        # Exclude system fields
        fields = fields - {"_id", "id", "created_at", "updated_at"}
    
    for field in fields:
        old_value = old_doc.get(field)
        new_value = new_doc.get(field)
        
        # Only log if value actually changed
        if old_value != new_value:
            changes[field] = {
                "before": old_value,
                "after": new_value
            }
    
    return changes

# Role check helper
def require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

def require_manager_or_admin(user: dict):
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Manager or admin access required")

# Available roles (same as DEFAULT_ROLES for consistency)
AVAILABLE_ROLES = [
    {"id": "admin", "name": "Administrador", "description": "Acceso completo a todas las funciones del sistema", "color": "red", "isSystem": True},
    {"id": "personal", "name": "Gestor de Personal", "description": "Gestión de contactos, comunicaciones y seguimiento de músicos", "color": "blue", "isSystem": False},
    {"id": "logistica", "name": "Gestor de Logística", "description": "Gestión de eventos, atriles, transporte y alojamiento", "color": "green", "isSystem": False},
    {"id": "archivo", "name": "Gestor de Archivo", "description": "Gestión documental, informes y exportaciones", "color": "purple", "isSystem": False},
    {"id": "economico", "name": "Gestor Económico", "description": "Gestión de cachés, pagos y análisis financiero", "color": "yellow", "isSystem": False}
]

# User Management Endpoints
@api_router.get("/admin/roles")
async def get_available_roles(request: Request):
    user = await get_current_user(request)
    require_admin(user)
    return AVAILABLE_ROLES

@api_router.get("/admin/users")
async def get_all_users(request: Request):
    user = await get_current_user(request)
    require_admin(user)
    
    users = await db.users.find({}, {"password_hash": 0}).to_list(100)
    # Convert ObjectId to string
    for u in users:
        u["id"] = str(u.pop("_id"))
    
    await log_activity(
        user_id=user["_id"],
        user_email=user["email"],
        user_name=user["name"],
        action="view",
        entity_type="user_list",
        details={"count": len(users)}
    )
    
    return users

@api_router.post("/admin/users")
async def create_user(user_data: UserCreate, request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed = hash_password(user_data.password)
    user_doc = {
        "email": user_data.email.lower(),
        "password_hash": hashed,
        "name": user_data.name,
        "role": user_data.role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["_id"]
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    await log_activity(
        user_id=current_user["_id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="create",
        entity_type="user",
        entity_id=user_id,
        entity_name=user_data.name,
        details={"email": user_data.email, "role": user_data.role}
    )
    
    return {
        "id": user_id,
        "email": user_data.email.lower(),
        "name": user_data.name,
        "role": user_data.role,
        "is_active": True
    }

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate, request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["_id"]
    
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    updated_user["id"] = str(updated_user.pop("_id"))
    
    await log_activity(
        user_id=current_user["_id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="update",
        entity_type="user",
        entity_id=user_id,
        entity_name=updated_user["name"],
        details={"changes": update_data}
    )
    
    return updated_user

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    # Prevent self-deletion
    if user_id == current_user["_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user_to_delete = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.delete_one({"_id": ObjectId(user_id)})
    
    await log_activity(
        user_id=current_user["_id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="delete",
        entity_type="user",
        entity_id=user_id,
        entity_name=user_to_delete.get("name", "Unknown"),
        details={"email": user_to_delete.get("email")}
    )
    
    return {"message": "User deleted"}

@api_router.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, password_data: PasswordChange, request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hashed = hash_password(password_data.new_password)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "password_hash": hashed,
            "password_changed_at": datetime.now(timezone.utc).isoformat(),
            "password_changed_by": current_user["_id"]
        }}
    )
    
    await log_activity(
        user_id=current_user["_id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="password_reset",
        entity_type="user",
        entity_id=user_id,
        entity_name=user.get("name", "Unknown"),
        details={"target_email": user.get("email")}
    )
    
    return {"message": "Password reset successfully"}

@api_router.post("/admin/users/{user_id}/send-credentials")
async def send_user_credentials(user_id: str, request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # In production, this would send an email via Gmail API
    # For now, we simulate it
    await log_activity(
        user_id=current_user["_id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="send_credentials",
        entity_type="user",
        entity_id=user_id,
        entity_name=user.get("name", "Unknown"),
        details={"target_email": user.get("email")}
    )
    
    return {"message": f"Credentials sent to {user.get('email')} (simulated)"}

# Activity Log Endpoints
@api_router.get("/admin/activity-logs")
async def get_activity_logs(
    request: Request,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    # Build query
    query = {}
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if entity_type:
        query["entity_type"] = entity_type
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    # Get logs
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count
    total = await db.activity_logs.count_documents(query)
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/admin/activity-logs/stats")
async def get_activity_stats(request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    # Get stats by action type
    pipeline = [
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    action_stats = await db.activity_logs.aggregate(pipeline).to_list(20)
    
    # Get stats by user
    pipeline_user = [
        {"$group": {"_id": {"user_id": "$user_id", "user_name": "$user_name"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    user_stats = await db.activity_logs.aggregate(pipeline_user).to_list(10)
    
    # Get stats by entity type
    pipeline_entity = [
        {"$group": {"_id": "$entity_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    entity_stats = await db.activity_logs.aggregate(pipeline_entity).to_list(20)
    
    # Get recent activity count (last 24 hours)
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent_count = await db.activity_logs.count_documents({"timestamp": {"$gte": yesterday}})
    
    return {
        "by_action": [{"action": s["_id"], "count": s["count"]} for s in action_stats],
        "by_user": [{"user_id": s["_id"]["user_id"], "user_name": s["_id"]["user_name"], "count": s["count"]} for s in user_stats],
        "by_entity": [{"entity_type": s["_id"], "count": s["count"]} for s in entity_stats],
        "recent_24h": recent_count
    }

@api_router.get("/admin/activity-logs/export")
async def export_activity_logs(
    request: Request,
    format: str = "csv",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    query = {}
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(10000)
    
    await log_activity(
        user_id=current_user["_id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="export",
        entity_type="activity_logs",
        details={"format": format, "count": len(logs)}
    )
    
    return {"logs": logs, "format": format, "count": len(logs)}

# =====================================================
# ROLES & PERMISSIONS CONFIGURATION
# =====================================================

# Default roles configuration
DEFAULT_ROLES = [
    {"id": "admin", "name": "Administrador", "description": "Acceso completo a todas las funciones del sistema", "color": "red", "isSystem": True},
    {"id": "personal", "name": "Gestor de Personal", "description": "Gestión de contactos, comunicaciones y seguimiento de músicos", "color": "blue", "isSystem": False},
    {"id": "logistica", "name": "Gestor de Logística", "description": "Gestión de eventos, atriles, transporte y alojamiento", "color": "green", "isSystem": False},
    {"id": "archivo", "name": "Gestor de Archivo", "description": "Gestión documental, informes y exportaciones", "color": "purple", "isSystem": False},
    {"id": "economico", "name": "Gestor Económico", "description": "Gestión de cachés, pagos y análisis financiero", "color": "yellow", "isSystem": False}
]

@api_router.get("/admin/roles-config")
async def get_roles_config(request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    config = await db.roles_config.find_one({}, {"_id": 0})
    if not config:
        return {"roles": DEFAULT_ROLES}
    return config

@api_router.post("/admin/roles-config")
async def save_roles_config(config: dict, request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    # Delete existing config
    await db.roles_config.delete_many({})
    
    # Save new config
    config["updated_at"] = datetime.now(timezone.utc).isoformat()
    config["updated_by"] = current_user["_id"]
    await db.roles_config.insert_one(config)
    
    await log_activity(
        user_id=current_user["_id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="update",
        entity_type="roles_config",
        details={"roles_count": len(config.get("roles", []))}
    )
    
    return {"message": "Roles configuration saved"}

@api_router.get("/admin/permissions-config")
async def get_permissions_config(request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    config = await db.permissions_config.find_one({}, {"_id": 0})
    return config or {"permissions": {}}

@api_router.post("/admin/permissions-config")
async def save_permissions_config(config: dict, request: Request):
    current_user = await get_current_user(request)
    require_admin(current_user)
    
    # Delete existing config
    await db.permissions_config.delete_many({})
    
    # Save new config
    config["updated_at"] = datetime.now(timezone.utc).isoformat()
    config["updated_by"] = current_user["_id"]
    await db.permissions_config.insert_one(config)
    
    await log_activity(
        user_id=current_user["_id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="update",
        entity_type="permissions_config",
        details={"sections_count": len(config.get("permissions", {}))}
    )
    
    return {"message": "Permissions configuration saved"}

# Endpoint to check user permissions
@api_router.get("/user/permissions")
async def get_user_permissions(request: Request):
    current_user = await get_current_user(request)
    user_role = current_user.get("role", "viewer")
    
    # Admin has all permissions
    if user_role == "admin":
        return {"role": "admin", "permissions": "all"}
    
    # Get permissions config
    config = await db.permissions_config.find_one({}, {"_id": 0})
    if not config:
        return {"role": user_role, "permissions": {}}
    
    # Extract permissions for user's role
    user_permissions = {}
    for section_id, section_perms in config.get("permissions", {}).items():
        user_permissions[section_id] = {}
        for perm_id, roles_perms in section_perms.items():
            user_permissions[section_id][perm_id] = roles_perms.get(user_role, False)
    
    return {"role": user_role, "permissions": user_permissions}

# ============================================
# FEEDBACK/BUG REPORTS ENDPOINTS
# ============================================

@api_router.post("/feedback")
async def create_feedback_report(report: FeedbackReportCreate, request: Request):
    """Create a new feedback/bug report"""
    current_user = await get_current_user(request)
    
    report_doc = {
        "id": str(uuid.uuid4()),
        "page": report.page,
        "section": report.section,
        "type": report.type,
        "description": report.description,
        "status": "reportado",  # reportado, en_proceso, solucionado
        "reported_by": current_user["email"],
        "reported_by_name": current_user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "user_agent": report.user_agent,
        "screenshot_url": report.screenshot_url
    }
    
    await db.feedback_reports.insert_one(report_doc)
    
    # Log activity
    await log_activity(
        user_id=str(current_user.get("_id", current_user.get("id", "unknown"))),
        user_email=current_user["email"],
        user_name=current_user["name"],
        action=f"Reportar {report.type}",
        entity_type="feedback",
        entity_id=report_doc["id"],
        entity_name=f"{report.page} - {report.type}",
        details={"description": report.description[:100]}
    )
    
    return {"message": "Reporte creado exitosamente", "id": report_doc["id"]}

@api_router.get("/feedback")
async def get_feedback_reports(
    request: Request,
    type: Optional[str] = None,
    status: Optional[str] = None,
    page: Optional[str] = None
):
    """Get all feedback reports with optional filters"""
    current_user = await get_current_user(request)
    
    # Build filter
    filter_query = {}
    if type:
        filter_query["type"] = type
    if status:
        filter_query["status"] = status
    if page:
        filter_query["page"] = page
    
    reports = await db.feedback_reports.find(filter_query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    return {"reports": reports, "total": len(reports)}

@api_router.put("/feedback/{report_id}")
async def update_feedback_status(report_id: str, update: FeedbackReportUpdate, request: Request):
    """Update feedback report status (admin only)"""
    current_user = await get_current_user(request)
    
    # Check if user is admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update report status")
    
    result = await db.feedback_reports.update_one(
        {"id": report_id},
        {"$set": {
            "status": update.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Log activity
    await log_activity(
        user_id=current_user["id"],
        user_email=current_user["email"],
        user_name=current_user["name"],
        action="Actualizar estado de reporte",
        entity_type="feedback",
        entity_id=report_id,
        entity_name=f"Estado: {update.status}",
        details={}
    )
    
    return {"message": "Estado actualizado"}

@api_router.delete("/feedback/{report_id}")
async def delete_feedback_report(report_id: str, request: Request):
    """Delete a feedback report (admin only)"""
    current_user = await get_current_user(request)
    
    # Check if user is admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete reports")
    
    result = await db.feedback_reports.delete_one({"id": report_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"message": "Reporte eliminado"}

@api_router.get("/feedback/export/excel")
async def export_feedback_to_excel(request: Request):
    """Export all feedback reports to Excel format (CSV)"""
    current_user = await get_current_user(request)
    
    # Check if user is admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can export reports")
    
    reports = await db.feedback_reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    # Create CSV content
    import csv
    import io
    
    output = io.StringIO()
    fieldnames = ["id", "created_at", "updated_at", "reported_by", "reported_by_name", 
                  "page", "section", "type", "status", "description", "user_agent"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for report in reports:
        writer.writerow({
            "id": report.get("id", ""),
            "created_at": report.get("created_at", ""),
            "updated_at": report.get("updated_at", ""),
            "reported_by": report.get("reported_by", ""),
            "reported_by_name": report.get("reported_by_name", ""),
            "page": report.get("page", ""),
            "section": report.get("section", ""),
            "type": report.get("type", ""),
            "status": report.get("status", ""),
            "description": report.get("description", ""),
            "user_agent": report.get("user_agent", "")
        })
    
    csv_content = output.getvalue()
    output.close()
    
    from fastapi.responses import Response as FastAPIResponse
    return FastAPIResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reportes_feedback.csv"}
    )

@api_router.get("/feedback/stats")
async def get_feedback_stats(request: Request):
    """Get statistics about feedback reports"""
    current_user = await get_current_user(request)
    
    total = await db.feedback_reports.count_documents({})
    errors = await db.feedback_reports.count_documents({"type": "error"})
    improvements = await db.feedback_reports.count_documents({"type": "mejora"})
    
    reportados = await db.feedback_reports.count_documents({"status": "reportado"})
    en_proceso = await db.feedback_reports.count_documents({"status": "en_proceso"})
    solucionados = await db.feedback_reports.count_documents({"status": "solucionado"})
    
    # Get reports by page
    pipeline = [
        {"$group": {"_id": "$page", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    by_page = await db.feedback_reports.aggregate(pipeline).to_list(10)
    
    return {
        "total": total,
        "by_type": {
            "error": errors,
            "mejora": improvements
        },
        "by_status": {
            "reportado": reportados,
            "en_proceso": en_proceso,
            "solucionado": solucionados
        },
        "by_page": [{"page": item["_id"], "count": item["count"]} for item in by_page]
    }

# Include routers
app.include_router(auth_router)
app.include_router(api_router)

# CORS
# When using credentials (cookies), we cannot use wildcard "*" for origins
# We need to allow both localhost (for local dev) and the preview domain
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
preview_domain = "https://contact-conductor.preview.emergentagent.com"

allowed_origins = [
    frontend_url,
    "http://localhost:3000",
    preview_domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Startup event
@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    
    # Seed admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Administrador",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info(f"Admin password updated: {admin_email}")
    
    # Seed sample data
    await seed_sample_data()
    
    logger.info("Server started successfully")

async def seed_sample_data():
    # Check if sample data exists
    existing_season = await db.seasons.find_one({"name": "Temporada 2024-2025"})
    if existing_season:
        return
    
    # Create sample season
    season_id = str(uuid.uuid4())
    await db.seasons.insert_one({
        "id": season_id,
        "name": "Temporada 2024-2025",
        "sheet_url": "https://docs.google.com/spreadsheets/d/example",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create sample events
    events = [
        {
            "id": str(uuid.uuid4()),
            "name": "Concierto de Navidad",
            "date": "2024-12-20",
            "time": "20:00",
            "season_id": season_id,
            "rehearsals": [
                {"date": "2024-12-18", "start": "18:00", "end": "21:00"},
                {"date": "2024-12-19", "start": "18:00", "end": "21:00"}
            ],
            "instrumentation": {
                "cuerda": {"violines_i": 8, "violines_ii": 6, "violas": 4, "violonchelos": 3, "contrabajos": 2},
                "viento_madera": {"flautas": 2, "oboes": 2, "clarinetes": 2, "fagotes": 2},
                "viento_metal": {"trompetas": 2, "trompas": 4, "trombones": 2, "tubas": 1},
                "percusion": {"num_percusionistas": 3, "instrumental": "Timbales, bombo, platillos"},
                "coro": {"sopranos": 12, "contraltos": 10, "tenores": 8, "bajos": 8},
                "teclados": {"pianistas": 1, "organistas": 0}
            },
            "program": [
                {"duration": "15'", "author": "Handel", "obra": "El Mesías - Hallelujah", "observaciones": ""},
                {"duration": "20'", "author": "Bach", "obra": "Oratorio de Navidad BWV 248", "observaciones": "Selección"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Concierto de Año Nuevo",
            "date": "2025-01-01",
            "time": "12:00",
            "season_id": season_id,
            "rehearsals": [
                {"date": "2024-12-30", "start": "10:00", "end": "13:00"}
            ],
            "instrumentation": {
                "cuerda": {"violines_i": 10, "violines_ii": 8, "violas": 6, "violonchelos": 4, "contrabajos": 3},
                "viento_madera": {"flautas": 2, "oboes": 2, "clarinetes": 2, "fagotes": 2},
                "viento_metal": {"trompetas": 3, "trompas": 4, "trombones": 3, "tubas": 1},
                "percusion": {"num_percusionistas": 4, "instrumental": "Timbales, caja, glockenspiel"},
                "coro": {"sopranos": 0, "contraltos": 0, "tenores": 0, "bajos": 0},
                "teclados": {"pianistas": 0, "organistas": 0}
            },
            "program": [
                {"duration": "10'", "author": "J. Strauss II", "obra": "El Danubio Azul", "observaciones": ""},
                {"duration": "8'", "author": "J. Strauss II", "obra": "Marcha Radetzky", "observaciones": "Con palmas del público"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for event in events:
        await db.events.insert_one(event)
    
    # Create sample contacts
    contacts = [
        {"id": str(uuid.uuid4()), "baremo": 95, "apellidos": "García López", "nombre": "María", "dni": "12345678A", "provincia": "Madrid", "especialidad": "Violín", "categoria": "Tutti", "telefono": "600123456", "email": "maria.garcia@email.com"},
        {"id": str(uuid.uuid4()), "baremo": 88, "apellidos": "Fernández Ruiz", "nombre": "Carlos", "dni": "23456789B", "provincia": "Barcelona", "especialidad": "Viola", "categoria": "Tutti", "telefono": "600234567", "email": "carlos.fernandez@email.com"},
        {"id": str(uuid.uuid4()), "baremo": 92, "apellidos": "Martínez Sánchez", "nombre": "Ana", "dni": "34567890C", "provincia": "Valencia", "especialidad": "Flauta", "categoria": "Solista", "telefono": "600345678", "email": "ana.martinez@email.com"},
        {"id": str(uuid.uuid4()), "baremo": 85, "apellidos": "López Torres", "nombre": "Pedro", "dni": "45678901D", "provincia": "Sevilla", "especialidad": "Trompeta", "categoria": "Tutti", "telefono": "600456789", "email": "pedro.lopez@email.com"},
        {"id": str(uuid.uuid4()), "baremo": 90, "apellidos": "Rodríguez Pérez", "nombre": "Laura", "dni": "56789012E", "provincia": "Bilbao", "especialidad": "Violonchelo", "categoria": "Principal", "telefono": "600567890", "email": "laura.rodriguez@email.com"},
    ]
    
    for contact in contacts:
        contact["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.contacts.insert_one(contact)
    
    # Create sample email templates
    templates = [
        {"id": str(uuid.uuid4()), "type": "convocatoria_temporada", "subject": "Convocatoria Temporada {{temporada}}", "body": "Estimado/a {{nombre}},\n\nLe informamos de la convocatoria para la temporada {{temporada}}.\n\nAtentamente,\nLa Dirección", "header_image": "", "signature_image": ""},
        {"id": str(uuid.uuid4()), "type": "convocatoria_individual", "subject": "Convocatoria: {{evento}}", "body": "Estimado/a {{nombre}},\n\nQueda convocado/a para el evento {{evento}} que tendrá lugar el {{fecha}}.\n\nAtentamente,\nLa Dirección", "header_image": "", "signature_image": ""},
        {"id": str(uuid.uuid4()), "type": "envio_partituras", "subject": "Partituras: {{evento}}", "body": "Estimado/a {{nombre}},\n\nAdjunto encontrará las partituras para el evento {{evento}}.\n\nAtentamente,\nLa Dirección", "header_image": "", "signature_image": ""}
    ]
    
    for template in templates:
        template["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.email_templates.insert_one(template)
    
    # Create sample event responses
    event_ids = [e["id"] for e in events]
    contact_ids = [c["id"] for c in contacts]
    
    for event_id in event_ids:
        for contact in contacts:
            responses = {}
            for i in range(1, 3):
                responses[f"ensayo_{i}"] = "si" if hash(contact["id"] + event_id + str(i)) % 3 != 0 else "no"
            responses["funcion_1"] = "si" if hash(contact["id"] + event_id) % 4 != 0 else "no"
            
            await db.event_responses.insert_one({
                "id": str(uuid.uuid4()),
                "event_id": event_id,
                "contact_id": contact["id"],
                "contact_email": contact["email"],
                "contact_name": f"{contact['nombre']} {contact['apellidos']}",
                "responses": responses,
                "observaciones": "Sin comentarios" if hash(contact["id"]) % 2 == 0 else "",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    logger.info("Sample data seeded successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
