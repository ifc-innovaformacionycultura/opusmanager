# Integración con Google Sheets - Sistema de Reportes

## 📊 Configuración de Google Sheets

El sistema de reportes ya está completamente funcional y permite:
- ✅ Crear reportes desde cualquier página de la aplicación
- ✅ Ver y gestionar todos los reportes en la sección "Reportes del equipo"
- ✅ Exportar todos los reportes a Excel/CSV con un solo clic
- ✅ Filtrar por tipo, estado y página
- ✅ Actualizar el estado de cada reporte

## 📥 Exportación Actual (Sin necesidad de configuración)

### Opción 1: Exportar a Excel/CSV
1. Ve a **Administración → Reportes del equipo**
2. Haz clic en el botón verde **"Exportar Excel"**
3. Se descargará automáticamente un archivo CSV con todos los reportes
4. Abre el archivo con Excel, Google Sheets o cualquier hoja de cálculo

### Estructura del archivo exportado:
```
id | created_at | updated_at | reported_by | reported_by_name | page | section | type | status | description | user_agent
```

## 🔗 Integración Automática con Google Sheets (Opcional)

Si deseas que los reportes se sincronicen automáticamente con una Google Sheet específica, necesitarás:

### Requisitos:
1. **Cuenta de servicio de Google Cloud** con acceso a Google Sheets API
2. **Credenciales JSON** de la cuenta de servicio
3. **ID de la Google Sheet** donde quieres volcar los datos

### Pasos para configurar:

#### 1. Crear una Cuenta de Servicio en Google Cloud
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Sheets API**
4. Ve a **IAM & Admin → Service Accounts**
5. Crea una nueva cuenta de servicio
6. Descarga las credenciales en formato JSON

#### 2. Compartir tu Google Sheet
1. Crea una nueva Google Sheet
2. Copia el **ID de la hoja** (está en la URL: `https://docs.google.com/spreadsheets/d/{ESTE_ES_EL_ID}/edit`)
3. Comparte la hoja con el email de la cuenta de servicio (está en el JSON, campo `client_email`)
4. Dale permisos de **Editor**

#### 3. Configurar las Variables de Entorno
Agrega estas variables al archivo `/app/backend/.env`:

```env
# Google Sheets Integration
GOOGLE_SHEETS_ENABLED=true
GOOGLE_CREDENTIALS_JSON={"type":"service_account","project_id":"...","private_key":"..."}
GOOGLE_SHEET_ID=tu_sheet_id_aqui
```

**IMPORTANTE:** El JSON de credenciales debe estar en una sola línea.

#### 4. Instalar Dependencias
```bash
cd /app/backend
pip install gspread google-auth
pip freeze > requirements.txt
```

#### 5. Código Backend para Sincronización Automática

Agrega este código al archivo `/app/backend/server.py`:

```python
import gspread
from google.oauth2.service_account import Credentials
import json

# Google Sheets configuration
GOOGLE_SHEETS_ENABLED = os.environ.get("GOOGLE_SHEETS_ENABLED", "false").lower() == "true"

def get_gspread_client():
    """Initialize Google Sheets client"""
    if not GOOGLE_SHEETS_ENABLED:
        return None
    
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not creds_json:
        return None
    
    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(
        creds_dict,
        scopes=['https://www.googleapis.com/auth/spreadsheets']
    )
    return gspread.authorize(creds)

async def sync_report_to_sheets(report_doc):
    """Sync a single report to Google Sheets"""
    if not GOOGLE_SHEETS_ENABLED:
        return
    
    try:
        client = get_gspread_client()
        if not client:
            return
        
        sheet_id = os.environ.get("GOOGLE_SHEET_ID")
        if not sheet_id:
            return
        
        sheet = client.open_by_key(sheet_id).sheet1
        
        # Add header if sheet is empty
        if len(sheet.get_all_values()) == 0:
            sheet.append_row([
                "ID", "Fecha Creación", "Fecha Actualización", "Reportado Por (Email)",
                "Reportado Por (Nombre)", "Página", "Sección", "Tipo", "Estado", "Descripción"
            ])
        
        # Add the report
        sheet.append_row([
            report_doc["id"],
            report_doc["created_at"],
            report_doc["updated_at"],
            report_doc["reported_by"],
            report_doc["reported_by_name"],
            report_doc["page"],
            report_doc.get("section", ""),
            report_doc["type"],
            report_doc["status"],
            report_doc["description"]
        ])
    except Exception as e:
        # Log error but don't fail the request
        print(f"Error syncing to Google Sheets: {str(e)}")
```

#### 6. Modificar el Endpoint de Creación de Reportes

Actualiza el endpoint `POST /api/feedback` para incluir la sincronización:

```python
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
        "status": "reportado",
        "reported_by": current_user["email"],
        "reported_by_name": current_user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "user_agent": report.user_agent,
        "screenshot_url": report.screenshot_url
    }
    
    await db.feedback_reports.insert_one(report_doc)
    
    # Sync to Google Sheets (async, non-blocking)
    await sync_report_to_sheets(report_doc)
    
    # Log activity
    await log_activity(...)
    
    return {"message": "Reporte creado exitosamente", "id": report_doc["id"]}
```

### 🎯 Resultado Final

Una vez configurado:
1. Cada vez que alguien reporte un error o mejora desde la app, se guardará en MongoDB
2. Automáticamente se agregará una fila nueva en tu Google Sheet
3. Podrás ver los reportes tanto en la app como en Google Sheets
4. Las actualizaciones de estado se reflejarán en la app (Google Sheets es solo para respaldo/análisis)

### 📋 Estructura de la Google Sheet

La hoja tendrá las siguientes columnas:
- **ID**: Identificador único del reporte
- **Fecha Creación**: Cuándo se reportó
- **Fecha Actualización**: Última modificación
- **Reportado Por (Email)**: Email del usuario que reportó
- **Reportado Por (Nombre)**: Nombre del usuario
- **Página**: Sección de la app donde ocurrió
- **Sección**: Subsección específica
- **Tipo**: "error" o "mejora"
- **Estado**: "reportado", "en_proceso" o "solucionado"
- **Descripción**: Texto detallado del reporte

## 💡 Ventajas de la Integración con Google Sheets

✅ **Respaldo automático** de todos los reportes
✅ **Análisis con herramientas de Google** (gráficos, tablas dinámicas)
✅ **Compartir fácilmente** con personas sin acceso a la app
✅ **Histórico permanente** incluso si borras reportes de la app
✅ **Colaboración en tiempo real** para discutir reportes

## ⚠️ Notas Importantes

1. La sincronización es **unidireccional** (App → Google Sheets)
2. Si editas la Google Sheet, esos cambios NO se reflejarán en la app
3. La fuente de verdad es la base de datos MongoDB
4. Google Sheets es solo para visualización y análisis externo

## 🔒 Seguridad

- Nunca compartas el archivo JSON de credenciales públicamente
- No lo subas a repositorios de Git
- La cuenta de servicio solo debe tener acceso a la hoja específica
- Puedes revocar el acceso en cualquier momento desde Google Cloud Console

---

**¿Necesitas ayuda con la configuración?**
Contacta al administrador del sistema: admin@convocatorias.com
