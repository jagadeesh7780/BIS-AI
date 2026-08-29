"""
BIS Assistant AI — FastAPI Backend
All 11 features powered by RAG + Groq + ChromaDB + local models.
"""

import os
import sys
import json
import time
import asyncio
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

# Ensure backend directory is in sys.path for direct imports (rag, supervisor, voice, etc.)
sys.path.insert(0, str(Path(__file__).parent.resolve()))

# Disable telemetry before importing chromadb to prevent PostHog crashes
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"] = "false"

if hasattr(sys.stdout, "reconfigure"):
    try:
        getattr(sys.stdout, "reconfigure")(encoding="utf-8")
    except Exception:
        pass

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# ─── Setup ────────────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("bis.main")

# Validate GROQ_API_KEY at startup
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    logger.warning("WARNING: GROQ_API_KEY is not set in .env file!")
else:
    logger.info("✅ GROQ_API_KEY found.")

# Data directory
DATA_DIR = Path(__file__).parent / "data"

from contextlib import asynccontextmanager

# ─── Startup: pre-load embeddings & vector DB (non-blocking) ──────────────────
async def _async_startup_warmup():
    try:
        from rag import ingest_all_datasets, get_embedding_model, get_chroma_collection
        # Run CPU warmup and batch ingestion in thread pool
        await asyncio.to_thread(get_embedding_model)
        await asyncio.to_thread(ingest_all_datasets)
        try:
            collection = get_chroma_collection()
            logger.info(f"✅ ChromaDB ready with {collection.count()} knowledge chunks.")
        except Exception as db_err:
            logger.info(f"ℹ️ Vector DB note: {db_err}")
    except Exception as e:
        logger.error(f"Startup background initialization error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("BIS Assistant AI server started. Binding to port and warming up services...")
    asyncio.create_task(_async_startup_warmup())
    yield


# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="BIS Assistant AI",
    description="AI-powered API for Bureau of Indian Standards guidance across Standards, FAQs, Schemes, and Labs",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request logging middleware ───────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = round(time.time() - start, 3)
    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({elapsed}s)")
    return response


# ─── Pydantic Models ──────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    query: str
    language: Optional[str] = "en"
    role: Optional[str] = "all"

class CompareRequest(BaseModel):
    standard_id_1: Optional[str] = None
    standard_id_2: Optional[str] = None
    standard1: Optional[str] = None
    standard2: Optional[str] = None

class SpeakRequest(BaseModel):
    text: str
    language: Optional[str] = "en"


# ─── Helper: load JSON data files ─────────────────────────────────────────────
def load_json(filename: str):
    path = DATA_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=500, detail=f"Data file {filename} not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ════════════════════════════════════════════════════════════════════════
# ROUTES
# ════════════════════════════════════════════════════════════════════════

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/")
async def health_check():
    return {"status": "ok", "service": "BIS Assistant AI", "version": "1.0.0"}


@app.get("/api/health")
async def api_health():
    from rag import get_chroma_collection
    try:
        count = get_chroma_collection().count()
        return {"status": "ok", "standards_in_db": count, "groq_key_set": bool(GROQ_API_KEY)}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}


# ─── Feature 1 & 2: Chat / Standards Search (RAG) ────────────────────────────
@app.post("/api/chat")
async def chat(req: ChatRequest):
    """
    Features 1 & 2: Multi-dataset RAG chat across 52+ standards, FAQs, schemes & labs.
    POST body: { query: str, language: str }
    Returns: { answer: str, sources: [{id, title, confidence}] }
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    logger.info(f"Chat request | lang={req.language} | query='{req.query[:80]}...'")

    try:
        from rag import generate_rag_answer
        result = await generate_rag_answer(req.query, req.language or "en", role=req.role)
        return result
    except RuntimeError as e:
        logger.error(f"RAG error: {e}")
        raise HTTPException(
            status_code=503,
            detail={"error": "AI service temporarily unavailable, please retry", "details": str(e)}
        )
    except Exception as e:
        logger.error(f"Unexpected chat error: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ─── Standards Listing & Search ──────────────────────────────────────────────
@app.get("/api/standards")
async def list_standards(
    search: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """List or search all Indian Standards."""
    standards = load_json("standards.json")
    filtered = standards

    if category:
        cat_lower = category.lower()
        filtered = [s for s in filtered if cat_lower in s.get("category", "").lower()]

    if search:
        s_lower = search.lower().strip()
        filtered = [
            s for s in filtered
            if s_lower in s.get("id", "").lower()
            or s_lower in s.get("number", "").lower()
            or s_lower in s.get("title", "").lower()
            or s_lower in s.get("summary", "").lower()
            or any(s_lower in kw.lower() for kw in s.get("keywords", []))
        ]

    total = len(filtered)
    paginated = filtered[offset:offset + limit]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "standards": paginated
    }


@app.get("/api/standards/{standard_id}")
async def get_standard(standard_id: str):
    """Feature 4 (Standard Detail): Get full details of one standard by ID or Number."""
    standards = load_json("standards.json")
    std_clean = standard_id.lower().replace(" ", "").replace("-", "")

    for std in standards:
        cur_id_clean = std["id"].lower().replace(" ", "").replace("-", "")
        cur_num_clean = std.get("number", "").lower().replace(" ", "").replace("-", "")
        if cur_id_clean == std_clean or cur_num_clean == std_clean:
            return std

    raise HTTPException(status_code=404, detail=f"Standard '{standard_id}' not found")


# ─── Feature 11: Standards Comparison ────────────────────────────────────────
@app.post("/api/standards/compare")
async def compare_standards(req: CompareRequest):
    """Feature 11: Side-by-side comparison of two IS standards."""
    id1 = req.standard_id_1 or req.standard1
    id2 = req.standard_id_2 or req.standard2

    if not id1 or not id2:
        raise HTTPException(status_code=400, detail="Both standard identifiers are required")

    standards = load_json("standards.json")
    
    def find_std(identifier: str):
        target = identifier.lower().replace(" ", "").replace("-", "")
        for s in standards:
            if s["id"].lower().replace(" ", "").replace("-", "") == target or \
               s.get("number", "").lower().replace(" ", "").replace("-", "") == target:
                return s
        return None

    s1 = find_std(id1)
    s2 = find_std(id2)

    if not s1:
        raise HTTPException(status_code=404, detail=f"Standard '{id1}' not found")
    if not s2:
        raise HTTPException(status_code=404, detail=f"Standard '{id2}' not found")

    comparison_attrs = ["number", "title", "category", "scope", "summary", "certification_scheme"]
    differences = []
    for attr in comparison_attrs:
        if str(s1.get(attr, "")).lower() != str(s2.get(attr, "")).lower():
            differences.append(attr)

    return {
        "standard1": s1,
        "standard2": s2,
        "differences": differences,
        "similarity_score": round((1 - len(differences) / len(comparison_attrs)) * 100),
    }


# ─── Feature 3: Certification Guide ─────────────────────────────────────────
@app.get("/api/certification/schemes")
async def get_certification_schemes():
    """Feature 3: All 7 certification schemes with step-by-step guidance."""
    return load_json("schemes.json")


@app.get("/api/certification/schemes/{scheme_id}")
async def get_certification_scheme(scheme_id: str):
    """Feature 3: Single certification scheme details."""
    schemes = load_json("schemes.json")
    sid_lower = scheme_id.lower().replace("-", "").replace("_", "")

    for key, val in schemes.items():
        if key.lower().replace("-", "").replace("_", "") == sid_lower:
            return val

    raise HTTPException(status_code=404, detail=f"Scheme '{scheme_id}' not found")


# ─── Feature 8: Lab Finder ───────────────────────────────────────────────────
@app.get("/api/labs/nearby")
async def get_labs_nearby(city: str = Query(..., description="City name to search labs in")):
    """Feature 8: Find BIS-recognised testing labs near a city."""
    labs = load_json("labs.json")
    city_lower = city.lower().strip()

    filtered = [
        lab for lab in labs
        if city_lower in lab.get("city", "").lower()
        or city_lower in lab.get("state", "").lower()
        or city_lower in lab.get("address", "").lower()
        or city_lower in lab.get("name", "").lower()
    ]

    if not filtered:
        # Fuzzy prefix match
        for lab in labs:
            if lab.get("city", "").lower().startswith(city_lower[:3]):
                filtered.append(lab)

    return {
        "city": city,
        "count": len(filtered),
        "labs": filtered
    }


# ─── FAQs Endpoint ───────────────────────────────────────────────────────────
@app.get("/api/faq")
async def get_faqs(role: Optional[str] = None, search: Optional[str] = None):
    """Retrieve official FAQs for manufacturers, consumers, or students."""
    results = []
    
    file_map = {
        "manufacturer": "manufacturer_faq.json",
        "consumer": "consumer_faq.json",
        "student": "student_faq.json"
    }

    if role and role.lower() in file_map:
        results = load_json(file_map[role.lower()])
    else:
        for f in file_map.values():
            try:
                results.extend(load_json(f))
            except Exception:
                pass

    if search:
        s_lower = search.lower().strip()
        results = [
            item for item in results
            if s_lower in item.get("question", "").lower()
            or s_lower in item.get("answer", "").lower()
            or s_lower in item.get("category", "").lower()
        ]

    return {
        "count": len(results),
        "faqs": results
    }


# ─── Feature 9: Product Image → Standard Detection ───────────────────────────
@app.post("/api/standards/detect-image")
async def detect_standard_from_image(image: UploadFile = File(...)):
    """Feature 9: Upload product image → detect applicable IS standards."""
    if not (image.content_type and image.content_type.startswith("image/")):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    image_bytes = await image.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=400, detail="Image file too large (max 10MB)")

    try:
        from image_detect import detect_standards_from_image
        result = await detect_standards_from_image(image_bytes)
        return result
    except Exception as e:
        logger.error(f"Image detection error: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ─── Feature 10: Certification Journey Tracker ───────────────────────────────
TRACKER_MOCK_DATA = {
    "BIS-2024-001": {
        "app_id": "BIS-2024-001",
        "product": "Domestic Pressure Cooker",
        "standard": "IS 2347",
        "scheme": "ISI Mark",
        "applicant": "Sunrise Industries Pvt. Ltd.",
        "submitted_on": "2024-01-15",
        "current_stage": 3,
        "stages": [
            {"id": 1, "name": "Application Submitted", "status": "done", "date": "2024-01-15", "note": "Application received. Ref: BIS-2024-001."},
            {"id": 2, "name": "Document Verification", "status": "done", "date": "2024-01-22", "note": "All documents verified successfully."},
            {"id": 3, "name": "Factory Inspection", "status": "current", "date": "In Progress", "note": "BIS inspector visit scheduled for Jan 30."},
            {"id": 4, "name": "Sample Testing", "status": "pending", "date": "Pending", "note": "Awaiting inspection completion."},
            {"id": 5, "name": "Licence Granted", "status": "pending", "date": "Pending", "note": "Final approval and licence issuance."},
        ],
    },
    "BIS-2024-002": {
        "app_id": "BIS-2024-002",
        "product": "LED Bulb (10W)",
        "standard": "IS 16102",
        "scheme": "CRS",
        "applicant": "BrightTech Solutions",
        "submitted_on": "2024-02-10",
        "current_stage": 4,
        "stages": [
            {"id": 1, "name": "Application Submitted", "status": "done", "date": "2024-02-10", "note": "Online CRS application submitted."},
            {"id": 2, "name": "Document Verification", "status": "done", "date": "2024-02-14", "note": "DoC and test reports accepted."},
            {"id": 3, "name": "Factory Inspection", "status": "done", "date": "2024-02-20", "note": "Desk review completed for CRS."},
            {"id": 4, "name": "Sample Testing", "status": "current", "date": "In Progress", "note": "Samples under testing at approved lab."},
            {"id": 5, "name": "Registration Certificate", "status": "pending", "date": "Pending", "note": "Awaiting lab test clearance."},
        ],
    },
    "BIS-2024-003": {
        "app_id": "BIS-2024-003",
        "product": "Gold Jewellery (22K)",
        "standard": "IS 1417",
        "scheme": "Hallmarking",
        "applicant": "Ramesh Jewellers",
        "submitted_on": "2024-03-01",
        "current_stage": 5,
        "stages": [
            {"id": 1, "name": "Application Submitted", "status": "done", "date": "2024-03-01", "note": "HUID portal registration complete."},
            {"id": 2, "name": "Document Verification", "status": "done", "date": "2024-03-01", "note": "KYC verified."},
            {"id": 3, "name": "Submission to AHC", "status": "done", "date": "2024-03-05", "note": "Jewellery submitted to AHC."},
            {"id": 4, "name": "Purity Testing", "status": "done", "date": "2024-03-07", "note": "22K (916) confirmed."},
            {"id": 5, "name": "Hallmark Stamp Applied", "status": "done", "date": "2024-03-10", "note": "HUID: AB1234. Hallmarking complete."},
        ],
    },
}


@app.get("/api/certification/tracker/{application_id}")
async def get_tracker_status(application_id: str):
    """Feature 10: Get certification journey tracker status."""
    app_id_upper = application_id.upper()
    if app_id_upper not in TRACKER_MOCK_DATA:
        raise HTTPException(
            status_code=404,
            detail=f"Application '{application_id}' not found. Demo IDs: BIS-2024-001, BIS-2024-002, BIS-2024-003"
        )
    return TRACKER_MOCK_DATA[app_id_upper]


# ─── Feature 6: Voice Transcription ──────────────────────────────────────────
@app.post("/api/voice/transcribe")
async def voice_transcribe(audio: UploadFile = File(...)):
    """Feature 6: Transcribe audio to text using Whisper."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio data received")

    try:
        from voice import transcribe_audio
        text = transcribe_audio(audio_bytes, filename=audio.filename or "audio.webm")
        return {"text": text, "filename": audio.filename}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ─── Feature 6: Voice TTS (text → audio) ─────────────────────────────────────
@app.post("/api/voice/speak")
async def voice_speak(req: SpeakRequest):
    """Feature 6: Convert text to speech audio (MP3) using gTTS."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        from voice import text_to_speech
        audio_bytes = text_to_speech(req.text, req.language or "en")
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=response.mp3"}
        )
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ─── 2026 BIS Services Endpoint ───────────────────────────────────────────────
@app.get("/api/services")
async def get_bis_services(
    category: Optional[str] = Query(None, description="Filter by service category"),
    search: Optional[str] = Query(None, description="Search query")
):
    """Get complete 2026 BIS Services dataset."""
    services_file = DATA_DIR / "bis_services.json"
    if not services_file.exists():
        return {"services": [], "total": 0}
    with open(services_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    services = data.get("services", [])
    if category:
        services = [s for s in services if category.lower() in s.get("service_category", "").lower()]
    if search:
        q = search.lower()
        services = [
            s for s in services
            if q in s.get("service_subcategory", "").lower()
            or q in s.get("description", "").lower()
            or q in s.get("key_features", "").lower()
        ]
    return {
        "dataset_name": data.get("dataset_name", "BIS_Services_Complete_Dataset_2026"),
        "total": len(services),
        "services": services
    }


# ─── Consumer Complaints Endpoint ────────────────────────────────────────────
class ComplaintRequest(BaseModel):
    contact_number: str
    description: str
    isi_number: Optional[str] = None
    product_name: Optional[str] = None
    photo_type: Optional[str] = "upload"  # "camera" or "upload"
    photo_data: Optional[str] = None      # base64 data url or filename


COMPLAINTS_DB: List[Dict[str, Any]] = []


@app.post("/api/complaints")
async def submit_consumer_complaint(req: ComplaintRequest):
    """Lodge consumer complaint with photo/camera evidence and get official tracking ID."""
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Complaint description is required")
    if not req.contact_number.strip():
        raise HTTPException(status_code=400, detail="Contact number is required")

    complaint_id = f"BIS-CMP-2026-{int(time.time()) % 100000:05d}"
    record = {
        "complaint_id": complaint_id,
        "contact_number": req.contact_number,
        "description": req.description,
        "isi_number": req.isi_number or "Not Provided",
        "product_name": req.product_name or "General Product",
        "photo_type": req.photo_type,
        "has_photo": bool(req.photo_data),
        "status": "Registered & Assigned for Inspection",
        "submitted_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "helpline": "1800-11-4070 (Toll Free)",
        "redressal_portal": "https://www.bis.gov.in/index.php/consumer-affairs/complaint-management-cell/",
    }
    COMPLAINTS_DB.append(record)
    logger.info(f"✅ Complaint filed successfully: {complaint_id}")

    return {
        "success": True,
        "complaint_id": complaint_id,
        "status": record["status"],
        "message": f"Your complaint has been successfully registered under ID {complaint_id}.",
        "details": record
    }


@app.get("/api/complaints/{complaint_id}")
async def get_complaint_status(complaint_id: str):
    """Lookup filed complaint status."""
    match = next((c for c in COMPLAINTS_DB if c["complaint_id"] == complaint_id.upper()), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Complaint ID '{complaint_id}' not found")
    return match


# ─── Manufacturer Automated 5-Step Process Endpoints ─────────────────────────
class ManufacturerProcessRequest(BaseModel):
    product_name: str
    pan_number: str
    aadhaar_number: str
    business_name: str
    factory_address: str
    selected_lab: Optional[str] = None
    slot_date: Optional[str] = None
    slot_time: Optional[str] = None
    payment_method: Optional[str] = "UPI"
    payment_amount: Optional[float] = 12500.0


@app.post("/api/manufacturer/detect")
async def detect_manufacturer_standard(payload: Dict[str, Any]):
    """Step 1: Detect standard, scheme, category, and testing requirements."""
    product_name = payload.get("product_name", "").strip()
    if not product_name:
        raise HTTPException(status_code=400, detail="Product name is required")

    from rag import retrieve
    retrieved = retrieve(f"Indian standard specification for {product_name}", top_k=3)
    
    # Try exact match from standards.json
    standards_file = DATA_DIR / "standards.json"
    matched_std = None
    if standards_file.exists():
        with open(standards_file, "r", encoding="utf-8") as f:
            stds = json.load(f)
        q = product_name.lower()
        for s in stds:
            if q in s.get("title", "").lower() or any(q in kw.lower() for kw in s.get("keywords", [])):
                matched_std = s
                break
        if not matched_std and retrieved:
            first = retrieved[0]
            matched_std = next((s for s in stds if s.get("id") == first.get("id") or s.get("number") == first.get("number")), None)
            if not matched_std:
                matched_std = {
                    "id": first.get("id", "IS-GENERAL"),
                    "number": first.get("number", "IS Standard"),
                    "title": first.get("title", f"Specification for {product_name}"),
                    "category": first.get("category", "General Goods"),
                    "certification_scheme": "Scheme-I (ISI Mark)"
                }

    if not matched_std:
        matched_std = {
            "id": "IS-302",
            "number": "IS 302",
            "title": f"Safety Requirements for {product_name}",
            "category": "Consumer Products",
            "certification_scheme": "Scheme-I (ISI Mark)"
        }

    return {
        "product_name": product_name,
        "standard": matched_std,
        "scheme": matched_std.get("certification_scheme", "Scheme-I (ISI Mark)"),
        "required_mark": "ISI Mark (Standard Mark)" if "CRS" not in matched_std.get("certification_scheme", "") else "CRS Standard Mark",
        "mandatory_qco": True,
        "estimated_timeline_weeks": 2,
        "application_fee": 1000.0,
        "lab_test_fee": 11500.0,
        "total_fee": 12500.0
    }


@app.post("/api/manufacturer/process")
async def process_manufacturer_application(req: ManufacturerProcessRequest):
    """End-to-end processing: generates tracking number, confirmation, and final official report."""
    if not req.product_name.strip():
        raise HTTPException(status_code=400, detail="Product name is required")
    if not req.pan_number.strip():
        raise HTTPException(status_code=400, detail="PAN number is required")

    app_id = f"BIS-MFR-2026-{int(time.time()) % 100000:05d}"
    tx_id = f"TXN-BIS-{int(time.time() * 1000) % 100000000:08d}"

    # Standard lookup
    detection = await detect_manufacturer_standard({"product_name": req.product_name})
    std = detection.get("standard", {})

    report = {
        "application_id": app_id,
        "status": "Application Successfully Approved & Testing Slot Confirmed",
        "approval_eta": "Laboratory Test Results & Final Certificate will be shared after sample analysis",
        "approval_notice": "✅ Your application dossier and statutory fees have been verified and approved. Laboratory testing slot has been confirmed. Laboratory Test Results and Final Certification Certificate will be shared after official sample analysis.",
        "submitted_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "product_details": {
            "name": req.product_name,
            "category": std.get("category", "Industrial/Consumer Goods"),
            "standard_number": std.get("number", "IS Standard"),
            "standard_title": std.get("title", ""),
            "scheme": detection.get("scheme", "Scheme-I (ISI Mark)"),
            "mark": detection.get("required_mark", "ISI Mark"),
        },
        "manufacturer_details": {
            "business_name": req.business_name or "Enterprise Manufacturer",
            "pan_number": req.pan_number.upper(),
            "aadhaar_mask": f"XXXX-XXXX-{req.aadhaar_number[-4:]}" if len(req.aadhaar_number) >= 4 else "XXXX-XXXX-1234",
            "factory_address": req.factory_address or "Industrial Area, Phase-II",
        },
        "lab_booking": {
            "lab_name": req.selected_lab or "Central Laboratory (Sahibabad, Ghaziabad)",
            "slot_date": req.slot_date or time.strftime("%Y-%m-%d", time.localtime(time.time() + 86400 * 3)),
            "slot_time": req.slot_time or "10:30 AM - 01:30 PM",
            "status": "Slot Confirmed",
        },
        "payment_receipt": {
            "transaction_id": tx_id,
            "payment_method": req.payment_method or "UPI",
            "amount_paid": req.payment_amount or 12500.0,
            "payment_status": "SUCCESSFUL (PAID)",
            "paid_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        },
        "official_portal": "https://www.manakonline.in",
        "bis_helpline": "1800-11-4070",
    }

    # Add to mock tracker DB
    TRACKER_MOCK_DATA[app_id] = {
        "app_id": app_id,
        "product": req.product_name,
        "standard": std.get("number", "IS Standard"),
        "scheme": detection.get("scheme", "Scheme-I (ISI Mark)"),
        "applicant": req.business_name or "Enterprise Manufacturer",
        "submitted_on": time.strftime("%Y-%m-%d"),
        "current_stage": 2,
        "stages": [
            {"id": 1, "name": "Application & Documents Submitted", "status": "done", "date": time.strftime("%Y-%m-%d"), "note": "PAN, Aadhaar, Factory info received."},
            {"id": 2, "name": "Lab Slot Reserved & Payment", "status": "done", "date": time.strftime("%Y-%m-%d"), "note": f"Slot booked at {report['lab_booking']['lab_name']}."},
            {"id": 3, "name": "Factory Inspection & Sample Testing", "status": "current", "date": "In Progress", "note": "Scheduled with BIS technical officer."},
            {"id": 4, "name": "Grant of Licence / CM/L Number", "status": "pending", "date": "Within 2 weeks", "note": "Final license certificate issued."},
        ]
    }

    logger.info(f"✅ Manufacturer application processed: {app_id}")
    return report


# ─── Multi-Agent Supervisor Architecture Endpoints ────────────────────────────
@app.post("/api/agents/manufacturer/orchestrate")
async def orchestrate_manufacturer_agents(req: Dict[str, Any]):
    """
    Executes the 8-Agent Manufacturer Certification Pipeline:
    Product -> Standards (RAG) -> QCO -> Document & Testing -> Lab Recommendation -> Fee & Timeline -> Roadmap & Evidence -> HITL Approval Gate
    """
    try:
        from supervisor import mfr_orchestrator
        product_name = req.get("product_name") or req.get("product_input") or "Domestic Pressure Cooker"
        user_city = req.get("city") or req.get("user_city") or "Mumbai"
        user_coords = req.get("user_coords")
        kyc_data = req.get("kyc") or {
            "pan": req.get("pan_number"),
            "business_name": req.get("business_name"),
            "factory_address": req.get("factory_address")
        }

        result = mfr_orchestrator.run_pipeline(
            product_input=product_name,
            user_city=user_city,
            user_coords=user_coords,
            kyc_data=kyc_data
        )
        return result
    except Exception as e:
        logger.error(f"Manufacturer supervisor orchestration error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Manufacturer agent error: {str(e)}")


@app.post("/api/agents/manufacturer/approve-and-submit")
async def approve_and_submit_manufacturer(req: Dict[str, Any]):
    """
    Finalizes human approval gate and issues tracking ID + 2-week fast-track certification certificate.
    """
    try:
        from supervisor import mfr_orchestrator
        approval_token = req.get("approval_token", "HITL-TOKEN-APPROVED")
        signature_name = req.get("signature_name") or req.get("business_name") or "Authorized Signatory"
        payment_ref = req.get("payment_ref") or req.get("payment_method") or "UPI-BharatKosh"

        submission = mfr_orchestrator.hitl_gate.verify_and_submit(
            approval_token=approval_token,
            signature_name=signature_name,
            payment_ref=payment_ref,
            state=req
        )

        app_id = submission["tracking_id"]
        # Save to mock tracker
        TRACKER_MOCK_DATA[app_id] = {
            "app_id": app_id,
            "product": req.get("product_name", "Industrial Product"),
            "standard": req.get("standard_number", "IS Standard"),
            "scheme": req.get("scheme", "Scheme-I (ISI Mark)"),
            "applicant": signature_name,
            "submitted_on": time.strftime("%Y-%m-%d"),
            "current_stage": 2,
            "stages": [
                {"id": 1, "name": "Application & Human Approval Submitted", "status": "done", "date": time.strftime("%Y-%m-%d"), "note": "Multi-agent dossier approved and signed."},
                {"id": 2, "name": "Lab Slot Reserved & Payment Settled", "status": "done", "date": time.strftime("%Y-%m-%d"), "note": f"Transaction {submission['transaction_hash']} recorded."},
                {"id": 3, "name": "Factory Inspection & Testing Audit", "status": "current", "date": "In Progress", "note": "Scheduled with accredited BIS testing laboratory."},
                {"id": 4, "name": "Grant of Licence / CM/L Number", "status": "pending", "date": "Post Lab Results", "note": "Final license certificate issued upon laboratory test clearance."},
            ]
        }

        return {
            "success": True,
            "submission": submission,
            "official_portal": "https://www.manakonline.in",
            "bis_helpline": "1800-11-4070"
        }
    except Exception as e:
        logger.error(f"Approval and submission error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Submission error: {str(e)}")


@app.post("/api/agents/consumer/triage")
async def triage_consumer_complaint(req: Dict[str, Any]):
    """
    Automates consumer complaint triage with photo evidence processing and Section 29 legal draft.
    """
    try:
        from supervisor import consumer_orchestrator
        res = consumer_orchestrator.triage_complaint(
            contact_number=req.get("contact_number") or req.get("contactNumber") or "Not Provided",
            description=req.get("description") or "Product defect reported",
            product_name=req.get("product_name") or req.get("productName"),
            isi_number=req.get("isi_number") or req.get("isiNumber"),
            photo_data=req.get("photo_data") or req.get("photoData"),
            photo_type=req.get("photo_type") or req.get("photoType") or "upload"
        )
        return res
    except Exception as e:
        logger.error(f"Consumer triage error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Consumer triage error: {str(e)}")


@app.post("/api/agents/consumer/verify")
async def verify_consumer_product(req: Dict[str, Any]):
    """
    RAG-grounded verification of ISI CM/L, gold HUID, and CRS R-numbers.
    """
    try:
        from supervisor import consumer_orchestrator
        query = req.get("query") or "ISI mark verification"
        query_type = req.get("query_type") or "auto"
        res = await consumer_orchestrator.verify_product(query=query, query_type=query_type)
        return res
    except Exception as e:
        logger.error(f"Consumer verification error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Consumer verification error: {str(e)}")


@app.post("/api/agents/orchestrate")
async def orchestrate_agents(req: Dict[str, Any]):
    """Legacy alias for manufacturer multi-agent orchestration."""
    return await orchestrate_manufacturer_agents(req)


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    reload = os.environ.get("ENVIRONMENT", "").lower() == "development"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)



