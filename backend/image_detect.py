"""
BIS AI V2 — Computer Vision: Product Image → IS Standard Detection
STEP 16: Expanded from 12 to 30 product categories, graceful fallback,
         proper BIS disclaimer, full citation output.
Uses CLIP (clip-ViT-B-32) via sentence-transformers for zero-shot classification.
"""

import io
import logging
import uuid
from typing import Any

logger = logging.getLogger("bis.image_detect")

# ─── 30-category CLIP label set (expanded from V1's 12) ──────────────────────
CLIP_LABELS = [
    "a domestic pressure cooker on a stove",
    "a motorcycle helmet for rider safety",
    "a sealed water bottle or packaged drinking water",
    "a household electrical appliance like iron or mixer",
    "an LED light bulb or LED lamp",
    "a refrigerator or freezer for home use",
    "a steel pipe or metal tube for plumbing",
    "a bathroom faucet or water tap",
    "gold jewellery or gold ornaments",
    "an electronic gadget like laptop or charger",
    "a bicycle helmet for cyclist safety",
    "a cooking pot or kitchen utensil",
    "a fire extinguisher for safety",
    "steel rebar or construction steel bar",
    "cement bag for construction",
    "a toy or children's plaything",
    "PVC electrical cable or wire",
    "LPG gas cylinder for cooking fuel",
    "LPG gas stove or cooking range",
    "a room air conditioner or split AC",
    "a washing machine for laundry",
    "an electric water heater or geyser",
    "safety shoes or industrial footwear",
    "an industrial safety helmet or hard hat",
    "a mobile phone charger or adapter",
    "a lithium-ion battery or power bank",
    "a smoke detector or fire alarm device",
    "a rubber electrical insulation glove",
    "a safety harness or fall protection belt",
    "a packaged food product or snack item",
]

# Map each label to its most relevant RAG search query
LABEL_TO_RAG_QUERY: dict = {
    "a domestic pressure cooker on a stove": "IS standard for domestic pressure cooker safety requirements",
    "a motorcycle helmet for rider safety": "IS standard for protective helmets two-wheeler riders IS 15410",
    "a sealed water bottle or packaged drinking water": "IS standard for packaged drinking water IS 14543",
    "a household electrical appliance like iron or mixer": "IS standard for household electrical appliances safety IS 302",
    "an LED light bulb or LED lamp": "IS standard for self-ballasted LED lamps IS 16102 CRS",
    "a refrigerator or freezer for home use": "IS standard for household refrigerators IS 7752",
    "a steel pipe or metal tube for plumbing": "IS standard for mild steel tubes plumbing IS 1239",
    "a bathroom faucet or water tap": "IS standard for sanitary tapware faucet plumbing",
    "gold jewellery or gold ornaments": "IS standard for gold jewellery hallmarking HUID IS 1417",
    "an electronic gadget like laptop or charger": "IS standard for electronics IT goods CRS compulsory registration",
    "a bicycle helmet for cyclist safety": "IS standard for cyclist protective helmet bicycle safety",
    "a cooking pot or kitchen utensil": "IS standard for kitchen cookware utensils household products",
    "a fire extinguisher for safety": "IS standard for portable fire extinguishers IS 14625",
    "steel rebar or construction steel bar": "IS standard for high strength deformed steel bars TMT IS 1786",
    "cement bag for construction": "IS standard for ordinary Portland cement IS 269 IS 8112",
    "a toy or children's plaything": "IS standard for toy safety children IS 9873",
    "PVC electrical cable or wire": "IS standard for PVC insulated cables electric power lighting IS 694",
    "LPG gas cylinder for cooking fuel": "IS standard for LPG cylinders domestic IS 3196",
    "LPG gas stove or cooking range": "IS standard for LPG gas stove domestic cooking IS 4246",
    "a room air conditioner or split AC": "IS standard for room air conditioners IS 1885",
    "a washing machine for laundry": "IS standard for household washing machines electrical safety",
    "an electric water heater or geyser": "IS standard for electric water heater geyser household",
    "safety shoes or industrial footwear": "IS standard for leather safety footwear industrial IS 15298",
    "an industrial safety helmet or hard hat": "IS standard for industrial safety helmets IS 2925",
    "a mobile phone charger or adapter": "IS standard for mobile phone chargers CRS IS 16333",
    "a lithium-ion battery or power bank": "IS standard for lithium-ion batteries portable CRS IS 16101",
    "a smoke detector or fire alarm device": "IS standard for fire alarm detection equipment",
    "a rubber electrical insulation glove": "IS standard for rubber gloves electrical insulation IS 4770",
    "a safety harness or fall protection belt": "IS standard for safety belts harnesses working at height IS 9167",
    "a packaged food product or snack item": "IS standard for packaged food products food safety BIS",
}

_clip_model = None


def get_clip_model():
    global _clip_model
    if _clip_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading CLIP model (clip-ViT-B-32)...")
            _clip_model = SentenceTransformer("clip-ViT-B-32")
            logger.info("✅ CLIP model loaded.")
        except Exception as e:
            logger.warning(f"CLIP model unavailable: {e}")
            _clip_model = "failed"
    return _clip_model


def classify_image_clip(image_bytes: bytes) -> tuple[str, float]:
    """
    Zero-shot image classification using CLIP.
    Returns (best_label, confidence 0.0-1.0).
    Falls back gracefully if CLIP is unavailable.
    """
    model: Any = get_clip_model()
    if model == "failed" or model is None:
        logger.warning("CLIP unavailable — returning default fallback category.")
        return "a household electrical appliance like iron or mixer", 0.3

    try:
        from PIL import Image
        from sentence_transformers import util

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_emb: Any = model.encode(img)
        text_embs: Any = model.encode(CLIP_LABELS)
        sims = util.cos_sim(img_emb, text_embs)[0].cpu().numpy()
        best_idx = int(sims.argmax())
        best_label = CLIP_LABELS[best_idx]
        confidence = float(sims[best_idx])
        logger.info(f"CLIP classified: '{best_label}' | confidence={confidence:.3f}")
        return best_label, confidence
    except Exception as e:
        logger.error(f"CLIP classification error: {e}")
        return "a household electrical appliance like iron or mixer", 0.25


async def detect_standards_from_image(image_bytes: bytes) -> dict:
    """
    Full image → IS standard detection pipeline:
    1. CLIP zero-shot product classification
    2. RAG retrieval using classification result
    3. Structured response with disclaimer
    """
    from rag import _build_citations, generate_rag_answer, hybrid_retrieve

    trace_id = str(uuid.uuid4())[:12]

    # Step 1: Classify image
    best_label, clip_confidence = classify_image_clip(image_bytes)
    rag_query = LABEL_TO_RAG_QUERY.get(best_label, f"IS standard for {best_label}")
    logger.info(f"[{trace_id}] Image RAG query: '{rag_query}'")

    # Step 2: Retrieve standards
    retrieved = hybrid_retrieve(rag_query, top_k=4)

    # Step 3: LLM description (optional — graceful if fails)
    description = (
        f"This image appears to show: {best_label}. "
        f"The applicable Indian Standards are listed below."
    )
    try:
        result = await generate_rag_answer(rag_query, language="en")
        if result.get("answer"):
            description = result["answer"]
    except Exception as e:
        logger.warning(f"[{trace_id}] LLM generation skipped: {e}")

    # Format standards output
    standards_out = []
    for r in retrieved:
        score = round(
            (r.get("rerank_score") or r.get("rrf_score") or r.get("score", 0.0)) * 100
        )
        standards_out.append({
            "id": r.get("id", ""),
            "number": r.get("standard_number", r.get("number", "")),
            "title": r.get("document_title", r.get("title", "")),
            "category": r.get("category", ""),
            "certification_scheme": r.get("certification_scheme", ""),
            "confidence": score,
            "source_url": r.get("source_url", "https://www.bis.gov.in"),
        })

    citations = _build_citations(retrieved)

    return {
        "detected_category": best_label,
        "clip_confidence": round(clip_confidence * 100),
        "rag_query_used": rag_query,
        "standards": standards_out,
        "description": description,
        "citations": citations,
        "disclaimer": (
            "IMPORTANT: AI-based product image detection is for guidance only. "
            "This does NOT constitute official BIS product verification or certification. "
            "Verify standards at bis.gov.in."
        ),
        "trace_id": trace_id,
    }
