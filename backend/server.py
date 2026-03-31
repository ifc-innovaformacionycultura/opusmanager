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
    
    return {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user")
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
    await get_current_user(request)
    update_data = contact.model_dump()
    result = await db.contacts.update_one({"id": contact_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    updated = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
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

# Include routers
app.include_router(auth_router)
app.include_router(api_router)

# CORS
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
