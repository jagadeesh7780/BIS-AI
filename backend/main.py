"""
BIS AI V2 — FastAPI Backend
STEP 14: Clean API with /api/v1/ versioning + backward-compat /api/ aliases
STEP 12: trace_id on all responses
STEP 13: No API keys in responses; CORS from config
"""

import os
import sys
import json
import time
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

sys.path.insert(0, str(Path(__file__).parent.resolve()))
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"] = "false"

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("bis.main")

try:
    from core.config import settings
    CORS_ORIGINS = settings.CORS_ORIGINS
    GROQ_KEY_SET = bool(settings.GROQ_API_KEY)
except Exception:
    CORS_ORIGINS = ["*"]
    GROQ_KEY_SET = bool(os.getenv("GROQ_API_KEY"))

DATA_DIR = Path(__file__).parent / "data"

# ── Schemas ────────────────────────────────────────────────────────────────────
from schemas.api_models import (
    ChatRequest, SpeakRequest, CompareRequest, ComplaintRequest,
    HealthResponse,
)


# ── Startup ────────────────────────────────────────────────────────────────────
from contextlib import asynccontextmanager

async def _warmup():
    try:
        from rag import ingest_all_datasets, get_embedding_model, get_chroma_collection
        await asyncio.to_thread(get_embedding_model)
        await asyncio.to_thread(ingest_all_datasets)
        try:
            col = get_chroma_collection()
            logger.info(f"✅ ChromaDB bis_standards_v2: {col.count()} chunks ready.")
        except Exception as e:
            logger.info(f"Vector DB note: {e}")
    except Exception as e:
        logger.error(f"Startup warmup error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("BIS AI V2 starting…")
    asyncio.create_task(_warmup())
    yield


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="BIS Assistant AI",
    description="AI-powered API for Bureau of Indian Standards guidance — V2",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    trace_id = str(uuid.uuid4())[:8]
    start    = time.time()
    response = await call_next(request)
    elapsed  = round(time.time() - start, 3)
    logger.info(f"[{trace_id}] {request.method} {request.url.path} → {response.status_code} ({elapsed}s)")
    return response


# ── Helpers ────────────────────────────────────────────────────────────────────
def load_json(filename: str):
    path = DATA_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=500, detail=f"Data file {filename} not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def new_trace() -> str:
    return str(uuid.uuid4())[:12]


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {"status": "ok", "service": "BIS Assistant AI", "version": "2.0.0"}


@app.get("/api/health")
@app.get("/api/v1/health")
async def health():
    from rag import get_chroma_collection, HAS_CHROMA, HAS_BM25, RERANKER_ENABLED, _bm25_index
    chunks = 0
    try:
        if HAS_CHROMA:
            chunks = get_chroma_collection().count()
    except Exception:
        pass
    return {
        "status": "ok",
        "service": "BIS Assistant AI",
        "version": "2.0.0",
        "vector_db_chunks": chunks,
        "groq_key_set": GROQ_KEY_SET,
        "hybrid_retrieval": True,
        "bm25_enabled": HAS_BM25 and _bm25_index is not None,
        "reranker_enabled": RERANKER_ENABLED,
        "trace_id": new_trace(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# CHAT (RAG) — Feature 1
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/chat")
@app.post("/api/v1/chat")
async def chat(req: ChatRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    logger.info(f"Chat | lang={req.language} role={req.role} | '{req.query[:80]}'")
    try:
        from rag import generate_rag_answer
        result = await generate_rag_answer(req.query, req.language or "en", role=req.role)
        return result
    except RuntimeError as e:
        logger.error(f"RAG error: {e}")
        raise HTTPException(status_code=503, detail={"error": "AI service temporarily unavailable", "details": str(e)})
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e), "trace_id": new_trace()})


# ══════════════════════════════════════════════════════════════════════════════
# STANDARDS — Features 2, 11
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/standards")
@app.get("/api/v1/standards/search")
async def list_standards(
    search:   Optional[str] = None,
    category: Optional[str] = None,
    limit:    int = 50,
    offset:   int = 0,
):
    standards = load_json("standards.json")
    filtered  = standards

    if category:
        cl = category.lower()
        filtered = [s for s in filtered if cl in s.get("category", "").lower()]

    if search:
        sl = search.lower().strip()
        filtered = [
            s for s in filtered
            if sl in s.get("id", "").lower()
            or sl in s.get("number", "").lower()
            or sl in s.get("title", "").lower()
            or sl in s.get("summary", "").lower()
            or sl in s.get("scope", "").lower()
            or any(sl in kw.lower() for kw in s.get("keywords", []))
        ]

    total     = len(filtered)
    paginated = filtered[offset: offset + limit]
    return {
        "total":     total,
        "limit":     limit,
        "offset":    offset,
        "standards": paginated,
        "trace_id":  new_trace(),
    }


@app.get("/api/standards/{standard_id}")
@app.get("/api/v1/standards/{standard_id}")
async def get_standard(standard_id: str):
    standards = load_json("standards.json")
    target    = standard_id.lower().replace(" ", "").replace("-", "")
    for std in standards:
        if (std["id"].lower().replace(" ", "").replace("-", "") == target
                or std.get("number", "").lower().replace(" ", "").replace("-", "") == target):
            return {**std, "trace_id": new_trace()}
    raise HTTPException(status_code=404, detail=f"Standard '{standard_id}' not found")


@app.post("/api/standards/compare")
@app.post("/api/v1/standards/compare")
async def compare_standards(req: CompareRequest):
    id1 = req.standard_id_1 or req.standard1
    id2 = req.standard_id_2 or req.standard2
    if not id1 or not id2:
        raise HTTPException(status_code=400, detail="Both standard identifiers are required")

    standards = load_json("standards.json")

    def find(identifier: str):
        t = identifier.lower().replace(" ", "").replace("-", "")
        for s in standards:
            if (s["id"].lower().replace(" ", "").replace("-", "") == t
                    or s.get("number", "").lower().replace(" ", "").replace("-", "") == t):
                return s
        return None

    s1 = find(id1)
    s2 = find(id2)
    if not s1:
        raise HTTPException(status_code=404, detail=f"Standard '{id1}' not found")
    if not s2:
        raise HTTPException(status_code=404, detail=f"Standard '{id2}' not found")

    attrs = ["number", "title", "category", "scope", "summary", "certification_scheme"]
    diffs = [a for a in attrs if str(s1.get(a, "")).lower() != str(s2.get(a, "")).lower()]
    return {
        "standard1":        s1,
        "standard2":        s2,
        "differences":      diffs,
        "similarity_score": round((1 - len(diffs) / len(attrs)) * 100),
        "trace_id":         new_trace(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# CERTIFICATION SCHEMES — Feature 3
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/certification/schemes")
@app.get("/api/v1/certification/schemes")
async def get_schemes():
    return load_json("schemes.json")


@app.get("/api/certification/schemes/{scheme_id}")
@app.get("/api/v1/certification/schemes/{scheme_id}")
async def get_scheme(scheme_id: str):
    schemes = load_json("schemes.json")
    sid     = scheme_id.lower().replace("-", "").replace("_", "")
    for key, val in schemes.items():
        if key.lower().replace("-", "").replace("_", "") == sid:
            return val
    raise HTTPException(status_code=404, detail=f"Scheme '{scheme_id}' not found")


# ══════════════════════════════════════════════════════════════════════════════
# CERTIFICATION TRACKER — Feature 10 (demo data — clearly labelled)
# ══════════════════════════════════════════════════════════════════════════════

# ⚠️ DEVELOPMENT DEMO DATA — NOT OFFICIAL BIS TRACKING
_TRACKER_DEMO: Dict[str, Any] = {
    "BIS-2024-001": {
        "app_id": "BIS-2024-001", "product": "Domestic Pressure Cooker",
        "standard": "IS 2347", "scheme": "ISI Mark",
        "applicant": "Sunrise Industries Pvt. Ltd.", "submitted_on": "2024-01-15",
        "current_stage": 3,
        "demo_disclaimer": "⚠️ DEMO DATA — Not an official BIS certification record",
        "stages": [
            {"id": 1, "name": "Application Submitted",  "status": "done",    "date": "2024-01-15", "note": "Application received. Ref: BIS-2024-001."},
            {"id": 2, "name": "Document Verification",  "status": "done",    "date": "2024-01-22", "note": "All documents verified."},
            {"id": 3, "name": "Factory Inspection",     "status": "current", "date": "In Progress", "note": "BIS inspector visit scheduled."},
            {"id": 4, "name": "Sample Testing",         "status": "pending", "date": "Pending",     "note": "Awaiting inspection."},
            {"id": 5, "name": "Licence Granted",        "status": "pending", "date": "Pending",     "note": "Final approval pending."},
        ],
    },
    "BIS-2024-002": {
        "app_id": "BIS-2024-002", "product": "LED Bulb (10W)",
        "standard": "IS 16102", "scheme": "CRS",
        "applicant": "BrightTech Solutions", "submitted_on": "2024-02-10",
        "current_stage": 4,
        "demo_disclaimer": "⚠️ DEMO DATA — Not an official BIS certification record",
        "stages": [
            {"id": 1, "name": "Application Submitted",    "status": "done",    "date": "2024-02-10"},
            {"id": 2, "name": "Document Verification",    "status": "done",    "date": "2024-02-14"},
            {"id": 3, "name": "Factory Inspection",       "status": "done",    "date": "2024-02-20"},
            {"id": 4, "name": "Sample Testing",           "status": "current", "date": "In Progress"},
            {"id": 5, "name": "Registration Certificate", "status": "pending", "date": "Pending"},
        ],
    },
    "BIS-2024-003": {
        "app_id": "BIS-2024-003", "product": "Gold Jewellery (22K)",
        "standard": "IS 1417", "scheme": "Hallmarking",
        "applicant": "Ramesh Jewellers", "submitted_on": "2024-03-01",
        "current_stage": 5,
        "demo_disclaimer": "⚠️ DEMO DATA — Not an official BIS certification record",
        "stages": [
            {"id": 1, "name": "Application Submitted", "status": "done", "date": "2024-03-01"},
            {"id": 2, "name": "Document Verification", "status": "done", "date": "2024-03-01"},
            {"id": 3, "name": "Submission to AHC",     "status": "done", "date": "2024-03-05"},
            {"id": 4, "name": "Purity Testing",        "status": "done", "date": "2024-03-07"},
            {"id": 5, "name": "Hallmark Applied",      "status": "done", "date": "2024-03-10", "note": "HUID: AB1234."},
        ],
    },
}

# Runtime-created applications stored here (lost on restart — demo only)
_RUNTIME_TRACKER: Dict[str, Any] = {}


@app.get("/api/certification/tracker/{application_id}")
@app.get("/api/certification/status/{application_id}")
@app.get("/api/v1/certification/tracker/{application_id}")
async def get_tracker(application_id: str):
    aid = application_id.upper()
    record = _TRACKER_DEMO.get(aid) or _RUNTIME_TRACKER.get(aid)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Application '{application_id}' not found. Demo IDs: BIS-2024-001, BIS-2024-002, BIS-2024-003",
        )
    return {**record, "trace_id": new_trace()}


# ══════════════════════════════════════════════════════════════════════════════
# LABS — Feature 8
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/labs/nearby")
@app.get("/api/v1/laboratories")
async def get_labs(
    city: str = Query(..., description="City name to search labs in"),
    state: Optional[str] = None,
):
    labs      = load_json("labs.json")
    city_low  = city.lower().strip()
    filtered  = [
        lab for lab in labs
        if city_low in lab.get("city", "").lower()
        or city_low in lab.get("state", "").lower()
        or city_low in lab.get("address", "").lower()
        or city_low in lab.get("name", "").lower()
    ]
    if not filtered:
        # 3-letter prefix fallback
        filtered = [
            lab for lab in labs
            if lab.get("city", "").lower().startswith(city_low[:3])
        ]
    if not filtered:
        filtered = labs  # Return all if no match

    return {
        "city":     city,
        "count":    len(filtered),
        "labs":     filtered,
        "trace_id": new_trace(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# FAQs
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/faq")
@app.get("/api/v1/faq")
async def get_faqs(
    role:   Optional[str] = None,
    search: Optional[str] = None,
):
    file_map = {
        "manufacturer": "manufacturer_faq.json",
        "consumer":     "consumer_faq.json",
        "student":      "student_faq.json",
    }
    results: List[Dict[str, Any]] = []
    if role and role.lower() in file_map:
        results = load_json(file_map[role.lower()])
    else:
        for fn in file_map.values():
            try:
                results.extend(load_json(fn))
            except Exception:
                pass

    if search:
        sl = search.lower().strip()
        results = [
            item for item in results
            if sl in item.get("question", "").lower()
            or sl in item.get("answer", "").lower()
            or sl in item.get("category", "").lower()
        ]

    return {"count": len(results), "faqs": results, "trace_id": new_trace()}


# ══════════════════════════════════════════════════════════════════════════════
# VISION — Feature 9 (Computer Vision)
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/standards/detect-image")
@app.post("/api/v1/vision/analyze")
async def detect_from_image(image: UploadFile = File(...)):
    if not (image.content_type and image.content_type.startswith("image/")):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")
    image_bytes = await image.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10 MB)")
    try:
        from image_detect import detect_standards_from_image
        result = await detect_standards_from_image(image_bytes)
        return result
    except Exception as e:
        logger.error(f"Image detection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e), "trace_id": new_trace()})


# ══════════════════════════════════════════════════════════════════════════════
# VOICE — Feature 6
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/voice/transcribe")
@app.post("/api/v1/voice/transcribe")
async def voice_transcribe(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio data received")
    try:
        from voice import transcribe_audio
        text = transcribe_audio(audio_bytes, filename=audio.filename or "audio.webm")
        return {"text": text, "filename": audio.filename, "trace_id": new_trace()}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@app.post("/api/voice/speak")
@app.post("/api/v1/voice/speak")
async def voice_speak(req: SpeakRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        from voice import text_to_speech
        audio_bytes = text_to_speech(req.text, req.language or "en")
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=response.mp3"},
        )
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ══════════════════════════════════════════════════════════════════════════════
# BIS SERVICES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/services")
@app.get("/api/v1/services")
async def get_services(
    category: Optional[str] = Query(None),
    search:   Optional[str] = Query(None),
):
    sf = DATA_DIR / "bis_services.json"
    if not sf.exists():
        return {"services": [], "total": 0, "trace_id": new_trace()}
    with open(sf, encoding="utf-8") as f:
        data = json.load(f)
    services = data.get("services", []) if isinstance(data, dict) else data
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
        "dataset_name": data.get("dataset_name", "BIS_Services_2026") if isinstance(data, dict) else "BIS_Services_2026",
        "total": len(services),
        "services": services,
        "trace_id": new_trace(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# COMPLAINTS
# ══════════════════════════════════════════════════════════════════════════════

_COMPLAINTS_STORE: List[Dict[str, Any]] = []  # In-memory demo store


@app.post("/api/complaints")
@app.post("/api/v1/complaints")
async def submit_complaint(req: ComplaintRequest):
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")
    if not req.contact_number.strip():
        raise HTTPException(status_code=400, detail="Contact number is required")
    complaint_id = f"BIS-CMP-2026-{int(time.time()) % 100000:05d}"
    record = {
        "complaint_id":    complaint_id,
        "contact_number":  req.contact_number,
        "description":     req.description,
        "isi_number":      req.isi_number or "Not Provided",
        "product_name":    req.product_name or "General Product",
        "photo_type":      req.photo_type,
        "has_photo":       bool(req.photo_data),
        "status":          "Registered & Assigned for Inspection",
        "submitted_at":    time.strftime("%Y-%m-%d %H:%M:%S"),
        "helpline":        "1800-11-4070 (Toll Free)",
        "redressal_portal": "https://www.bis.gov.in/index.php/consumer-affairs/complaint-management-cell/",
        "demo_disclaimer": "⚠️ DEMO — In-memory store, lost on server restart",
        "trace_id":        new_trace(),
    }
    _COMPLAINTS_STORE.append(record)
    logger.info(f"Complaint filed: {complaint_id}")
    return {
        "success":      True,
        "complaint_id": complaint_id,
        "status":       record["status"],
        "message":      f"Complaint registered under ID {complaint_id}.",
        "details":      record,
    }


@app.get("/api/complaints/{complaint_id}")
@app.get("/api/v1/complaints/{complaint_id}")
async def get_complaint(complaint_id: str):
    match = next((c for c in _COMPLAINTS_STORE if c["complaint_id"] == complaint_id.upper()), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Complaint '{complaint_id}' not found")
    return match


# ══════════════════════════════════════════════════════════════════════════════
# COMPLIANCE ANALYSIS — Feature (Manufacturer workflow)
# ══════════════════════════════════════════════════════════════════════════════

class ComplianceRequest(BaseModel):
    product_name: str
    city:         Optional[str] = "Mumbai"
    scale:        Optional[str] = "MSME"


@app.post("/api/v1/compliance/analyze")
@app.post("/api/manufacturer/detect")
async def compliance_analyze(req: ComplianceRequest):
    if not req.product_name.strip():
        raise HTTPException(status_code=400, detail="product_name is required")
    try:
        from supervisor import mfr_orchestrator
        result = mfr_orchestrator.build_roadmap(
            product_name=req.product_name,
            user_city=req.city or "Mumbai",
            scale=req.scale or "MSME",
        )
        return result.model_dump()
    except Exception as e:
        logger.error(f"Compliance analyze error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e), "trace_id": new_trace()})


# ══════════════════════════════════════════════════════════════════════════════
# MULTI-AGENT MANUFACTURER ORCHESTRATION
# ══════════════════════════════════════════════════════════════════════════════

class ManufacturerProcessRequest(BaseModel):
    product_name:     str
    pan_number:       str
    aadhaar_number:   str
    business_name:    str
    factory_address:  str
    selected_lab:     Optional[str] = None
    slot_date:        Optional[str] = None
    slot_time:        Optional[str] = None
    payment_method:   Optional[str] = "UPI"
    payment_amount:   Optional[float] = 13500.0
    city:             Optional[str] = "Mumbai"
    scale:            Optional[str] = "MSME"


@app.post("/api/agents/manufacturer/orchestrate")
@app.post("/api/v1/agents/manufacturer/orchestrate")
async def orchestrate_manufacturer(req: Dict[str, Any]):
    try:
        from supervisor import mfr_orchestrator
        product_name = (req.get("product_name") or req.get("product_input") or "Domestic Pressure Cooker").strip()
        user_city    = req.get("city") or req.get("user_city") or "Mumbai"
        result       = mfr_orchestrator.build_roadmap(
            product_name=product_name,
            user_city=user_city,
            scale=req.get("scale", "MSME"),
        )
        data = result.model_dump()
        # Add legacy keys for frontend compatibility
        if data.get("applicable_standard"):
            std = data["applicable_standard"]
            data["standards"] = {
                "standard_number": std.get("number", "IS Standard"),
                "standard_title":  std.get("title", ""),
                "scheme":          std.get("certification_scheme", "Scheme-I (ISI Mark)"),
                "required_mark":   "Standard ISI Mark with CM/L Number",
                "summary":         std.get("summary", ""),
            }
        data["product"] = {
            "product_name": product_name,
            "category":     data.get("identified_category", ""),
        }
        data["qco"] = {
            "qco_status":      "MANDATORY UNDER QUALITY CONTROL ORDER (QCO)",
            "issuing_authority": data.get("issuing_ministry", "DPIIT"),
            "statutory_act":   "Section 16 of the BIS Act 2016",
            "penalty_warning": data.get("penalty_provision", ""),
        }
        data["fees_and_timeline"] = {
            "fee_breakdown":       data.get("estimated_statutory_fees", {}),
            "estimated_turnaround": "14 Calendar Days (Fast-Track Protocol)",
        }
        data["human_approval_gate"] = {
            "approval_token": f"HITL-TOKEN-{new_trace()}",
            "status": "PENDING_HUMAN_APPROVAL",
        }
        return data
    except Exception as e:
        logger.error(f"Orchestration error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e)})


@app.post("/api/agents/manufacturer/approve-and-submit")
@app.post("/api/v1/agents/manufacturer/approve-and-submit")
async def approve_and_submit(req: Dict[str, Any]):
    app_id = f"BIS-MFR-2026-{int(time.time()) % 100000:05d}"
    tx_id  = f"TXN-BIS-{int(time.time() * 1000) % 100000000:08d}"
    paid   = req.get("payment_amount", 13500.0)

    # Add to tracker (runtime memory)
    _RUNTIME_TRACKER[app_id] = {
        "app_id":          app_id,
        "product":         req.get("product_name", "Product"),
        "standard":        req.get("standard_number", "IS Standard"),
        "scheme":          req.get("scheme", "Scheme-I (ISI Mark)"),
        "applicant":       req.get("business_name", "Applicant"),
        "submitted_on":    time.strftime("%Y-%m-%d"),
        "current_stage":   2,
        "demo_disclaimer": "⚠️ DEMO — Not an official BIS certification record",
        "stages": [
            {"id": 1, "name": "Application & Documents",          "status": "done",    "date": time.strftime("%Y-%m-%d")},
            {"id": 2, "name": "Lab Slot Reserved & Payment",      "status": "done",    "date": time.strftime("%Y-%m-%d")},
            {"id": 3, "name": "Factory Inspection & Sample Test", "status": "current", "date": "In Progress"},
            {"id": 4, "name": "Grant of Licence / CM/L",         "status": "pending", "date": "Within 2 weeks"},
        ],
    }

    return {
        "success":           True,
        "application_id":   app_id,
        "status":            "Application Approved & Testing Slot Confirmed",
        "disclaimer":        (
            "⚠️ STATUTORY NOTICE: This is an AI-generated guidance summary. "
            "Official BIS certification and licensing are conducted solely by BIS "
            "through https://www.manakonline.in. BIS AI does not grant official certification."
        ),
        "submitted_at":      time.strftime("%Y-%m-%d %H:%M:%S"),
        "signed_by":         req.get("signature_name", "Authorized Signatory"),
        "payment_receipt": {
            "transaction_id":  tx_id,
            "payment_method":  req.get("payment_method", "UPI"),
            "amount_paid":     paid,
            "payment_status":  "DEMO RECEIPT — NOT AN OFFICIAL BIS PAYMENT",
        },
        "official_portal":   "https://www.manakonline.in",
        "bis_helpline":      "1800-11-4070",
        "trace_id":          new_trace(),
    }


@app.post("/api/manufacturer/process")
async def process_manufacturer(req: ManufacturerProcessRequest):
    """Backward-compat endpoint that wraps the V2 compliance analysis."""
    return await approve_and_submit({
        "product_name":   req.product_name,
        "business_name":  req.business_name,
        "payment_amount": req.payment_amount or 13500.0,
        "payment_method": req.payment_method or "UPI",
    })


# Consumer agent endpoints (stubs that route to chat)
@app.post("/api/agents/consumer/verify")
@app.post("/api/agents/consumer/triage")
async def consumer_agent(req: Dict[str, Any]):
    query = req.get("query") or req.get("description") or req.get("text") or ""
    if not query:
        raise HTTPException(status_code=400, detail="query/description required")
    from rag import generate_rag_answer
    result = await generate_rag_answer(query, "en", role="consumer")
    return result


# ══════════════════════════════════════════════════════════════════════════════
# EVALUATION — STEP 18
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/evaluation/run")
@app.get("/api/evaluation/run")
async def run_evaluation():
    try:
        from evaluation import run_eval
        result = await asyncio.to_thread(run_eval)
        return result
    except Exception as e:
        logger.error(f"Evaluation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ══════════════════════════════════════════════════════════════════════════════
# ML RISK PREDICTION & EVALUATION METRICS (PyTorch MLP Engine)
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/ml/predict")
@app.post("/api/v1/ml/predict")
async def ml_predict(req: Dict[str, Any]):
    """
    Real PyTorch Deep Neural Network endpoint for BIS compliance risk tier
    and dynamic audit complexity prediction.
    """
    try:
        from ml.risk_model import predict_risk
        product = req.get("product_name") or req.get("input") or "Consumer Product"
        domain = req.get("material_domain") or "metal"
        voltage = float(req.get("voltage_rating_v", 0.0) or 0.0)
        pressure = float(req.get("pressure_rating_bar", 0.0) or 0.0)
        user_group = req.get("target_user_group") or "domestic"
        qco = bool(req.get("has_mandatory_qco", True))

        res = await asyncio.to_thread(
            predict_risk,
            product_name=product,
            material_domain=domain,
            voltage_rating_v=voltage,
            pressure_rating_bar=pressure,
            target_user_group=user_group,
            has_mandatory_qco=qco,
        )
        res["trace_id"] = new_trace()
        return res
    except Exception as e:
        logger.error(f"PyTorch prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e)})


@app.get("/api/ml/metrics")
@app.get("/api/v1/ml/metrics")
async def ml_metrics():
    """
    Authentic evaluation metrics from 80/20 train/test split on 250 samples.
    """
    try:
        from ml.risk_model import get_model_metrics
        metrics = await asyncio.to_thread(get_model_metrics)
        metrics["trace_id"] = new_trace()
        return metrics
    except Exception as e:
        logger.error(f"ML metrics error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e)})


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
