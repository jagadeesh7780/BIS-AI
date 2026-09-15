"""
BIS AI V2 — Product Image → Indian Standard Detection (Computer Vision)
STEP 13: CV pipeline — KEEP with refactoring.
Genuine BIS use case: identify product category from image → find applicable IS standard.

Pipeline:
  Input image → CLIP zero-shot classification → RAG standard lookup → Grounded answer

IMPORTANT DISCLAIMER:
Computer vision product detection is AI-assisted guidance only.
This does NOT constitute official BIS product verification or certification.
Always verify products using the official BIS CARE app or at https://www.bis.gov.in.
"""

import io
import uuid
import logging
from typing import List, Tuple, Dict, Any

logger = logging.getLogger("bis.cv")

# ── Expanded product category → IS standard mapping (STEP 13 FIX: expanded from 12 to 30 categories)
CLIP_LABELS: List[str] = [
    # Kitchen & Cooking
    "a domestic pressure cooker on a kitchen stove",
    "a cooking pot or saucepan",
    "a gas stove or cooking range",
    "an electric rice cooker",
    # Safety Equipment
    "a motorcycle helmet or two-wheeler helmet",
    "an industrial safety helmet or hard hat",
    "safety gloves or rubber insulating gloves",
    "a safety belt or fall protection harness",
    # Electrical Appliances
    "a household electric iron",
    "an electric ceiling fan",
    "an LED light bulb or lamp",
    "a room air conditioner unit",
    "a household refrigerator",
    "a washing machine",
    "a laptop computer or desktop PC",
    "a mobile phone charger or adapter",
    # Construction Materials
    "steel rebar or TMT steel bars for construction",
    "a cement bag or building cement",
    "a brick or masonry block",
    "a steel pipe or water pipe",
    # Food & Packaging
    "a water bottle or packaged drinking water",
    "a food package or packaged food product",
    # Precious Metals
    "gold jewellery or gold ornaments",
    # Fire Safety
    "a fire extinguisher",
    # Gas Equipment
    "an LPG gas cylinder",
    "an LPG gas regulator",
    # Toys
    "a toy or children's plaything",
    # Sports/Bicycle
    "a bicycle or cycle",
    # Footwear
    "safety shoes or industrial boots",
    # Audio/Video
    "an audio speaker or television set",
]

LABEL_TO_RAG_QUERY: Dict[str, str] = {
    "a domestic pressure cooker on a kitchen stove": "IS standard for domestic pressure cooker safety",
    "a cooking pot or saucepan": "IS standard for kitchen cookware utensils",
    "a gas stove or cooking range": "IS standard for domestic LPG gas stoves",
    "an electric rice cooker": "IS standard for electric rice cookers household appliances",
    "a motorcycle helmet or two-wheeler helmet": "IS 15410 standard for protective helmets two-wheeler riders",
    "an industrial safety helmet or hard hat": "IS 2925 industrial safety helmet specification",
    "safety gloves or rubber insulating gloves": "IS 4770 rubber gloves electrical insulation specification",
    "a safety belt or fall protection harness": "IS 9167 safety harness working at heights specification",
    "a household electric iron": "IS 302 household electric iron safety requirements",
    "an electric ceiling fan": "IS 374 electric ceiling fan specification",
    "an LED light bulb or lamp": "IS 16102 self-ballasted LED lamp specification CRS",
    "a room air conditioner unit": "IS 1885 room air conditioner specification ISI mark",
    "a household refrigerator": "IS 7752 household refrigerator safety specification",
    "a washing machine": "IS 302 household washing machine safety requirements",
    "a laptop computer or desktop PC": "IS 13252 information technology equipment safety CRS",
    "a mobile phone charger or adapter": "IS 16333 mobile phone charger safety CRS mandatory",
    "steel rebar or TMT steel bars for construction": "IS 1786 high strength deformed steel bars concrete reinforcement",
    "a cement bag or building cement": "IS 269 ordinary portland cement specification",
    "a brick or masonry block": "IS 1077 common burnt clay building bricks specification",
    "a steel pipe or water pipe": "IS 1239 mild steel tubes tubulars specification",
    "a water bottle or packaged drinking water": "IS 14543 packaged drinking water specification ISI mark",
    "a food package or packaged food product": "IS standard for packaged food products BIS certification",
    "gold jewellery or gold ornaments": "IS 1417 gold jewellery hallmarking HUID fineness standard",
    "a fire extinguisher": "IS 14625 portable fire extinguisher specification",
    "an LPG gas cylinder": "IS 3196 LPG cylinder specification ISI mark mandatory",
    "an LPG gas regulator": "IS 9798 LPG pressure regulator domestic use specification",
    "a toy or children's plaything": "IS 9873 toy safety general requirements ISI mark mandatory",
    "a bicycle or cycle": "IS 8090 bicycle safety requirements specification",
    "safety shoes or industrial boots": "IS 15298 leather safety footwear industrial specification",
    "an audio speaker or television set": "IS 616 audio video electronic apparatus safety CRS",
}

# ── Lazy-loaded CLIP model ──────────────────────────────────────────────────────
_clip_model = None


def get_clip_model():
    """Lazy-load CLIP via sentence-transformers. Returns None on failure."""
    global _clip_model
    if _clip_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading CLIP model (clip-ViT-B-32)...")
            _clip_model = SentenceTransformer("clip-ViT-B-32")
            logger.info("✅ CLIP model loaded.")
        except Exception as e:
            logger.warning(f"CLIP model unavailable: {e}. Will use text-based fallback.")
            _clip_model = "unavailable"
    return None if _clip_model == "unavailable" else _clip_model


def classify_image_clip(image_bytes: bytes) -> Tuple[str, float]:
    """
    CLIP zero-shot image classification.
    Returns (best_label, confidence 0-1).
    Falls back to default category if CLIP unavailable.
    """
    model = get_clip_model()
    if model is None:
        logger.warning("CLIP unavailable — using default category fallback.")
        return "a household electric iron", 0.40

    try:
        from PIL import Image
        import numpy as np

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_embedding = model.encode(img)
        text_embeddings = model.encode(CLIP_LABELS)

        from sentence_transformers import util
        similarities = util.cos_sim(img_embedding, text_embeddings)[0].numpy()

        best_idx = int(np.argmax(similarities))
        best_label = CLIP_LABELS[best_idx]
        confidence = float(similarities[best_idx])

        # Log top-3 for transparency
        top3 = sorted(enumerate(similarities), key=lambda x: x[1], reverse=True)[:3]
        logger.info(
            f"CLIP top-3: " +
            " | ".join(f"'{CLIP_LABELS[i][:30]}' ({s:.3f})" for i, s in top3)
        )
        return best_label, confidence

    except Exception as e:
        logger.error(f"CLIP classification error: {e}")
        return "a household electric iron", 0.35


async def detect_standards_from_image(image_bytes: bytes) -> Dict[str, Any]:
    """
    Full CV pipeline:
    1. CLIP image classification
    2. RAG hybrid retrieval for applicable IS standards
    3. LLM grounded answer
    Returns structured response with citations and disclaimer.
    """
    from rag import hybrid_retrieve, generate_rag_answer, _normalize_score, _build_citations

    trace_id = str(uuid.uuid4())[:12]

    # Step 1: Classify image
    best_label, clip_confidence = classify_image_clip(image_bytes)
    rag_query = LABEL_TO_RAG_QUERY.get(best_label, f"IS standard for {best_label}")

    logger.info(f"[{trace_id}] CV: '{best_label}' (conf={clip_confidence:.2f}) → RAG: '{rag_query}'")

    # Step 2: Retrieve applicable standards
    retrieved = hybrid_retrieve(rag_query, top_k=4)

    # Step 3: Generate answer
    description = ""
    citations = []
    try:
        result = await generate_rag_answer(rag_query, language="en")
        description = result.get("answer", "")
        citations = result.get("citations", [])
    except Exception as e:
        logger.warning(f"[{trace_id}] LLM generation failed: {e}")
        if retrieved:
            top = retrieved[0]
            description = (
                f"Based on image analysis, this appears to be '{best_label}'. "
                f"The applicable Indian Standard is {top.get('standard_number', top.get('number', ''))} — "
                f"{top.get('document_title', top.get('title', ''))}."
            )

    # Format standards list with CV-adjusted confidence
    standards = []
    for r in retrieved:
        cs = _normalize_score(r)
        # Blend CV confidence with retrieval score
        blended = round((cs * 0.6 + clip_confidence * 0.4) * 100)
        standards.append({
            "id": r.get("id", r.get("document_id", "")),
            "number": r.get("standard_number", r.get("number", "")),
            "title": r.get("document_title", r.get("title", "")),
            "category": r.get("category", ""),
            "certification_scheme": r.get("certification_scheme", ""),
            "confidence": min(99, max(50, blended)),
            "source_url": r.get("source_url", "https://www.bis.gov.in"),
        })

    if not citations:
        citations = _build_citations(retrieved)

    return {
        "detected_category": best_label,
        "clip_confidence": round(clip_confidence * 100),
        "rag_query_used": rag_query,
        "standards": standards,
        "description": description,
        "citations": citations[:3],
        "disclaimer": (
            "⚠️ IMPORTANT: Computer vision product detection is AI-assisted guidance only. "
            "This does NOT constitute official BIS product verification or certification. "
            "Always verify using the official BIS CARE app or at https://www.bis.gov.in."
        ),
        "trace_id": trace_id,
    }
