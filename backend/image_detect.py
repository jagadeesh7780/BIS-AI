"""
Product image → Indian Standard detection.
Uses CLIP-based image-text similarity via sentence-transformers
(clip-ViT-B-32 model) to classify the product category,
then maps to a relevant IS standard via RAG.

All local — no cloud API key required.
"""

import io
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

# Product category → IS standard mapping
CATEGORY_STANDARD_MAP = {
    "pressure cooker": ["pressure cooker", "kitchen vessel"],
    "helmet": ["helmet", "motorcycle safety", "two-wheeler protection"],
    "water bottle": ["packaged drinking water", "bottled water"],
    "electrical appliance": ["electrical safety", "household appliance"],
    "led bulb": ["LED lamp", "light bulb", "lighting"],
    "refrigerator": ["refrigerator", "cooling appliance"],
    "steel pipe": ["steel tube", "pipe fitting"],
    "faucet": ["tap", "sanitary ware", "plumbing"],
    "jewellery": ["gold jewellery", "hallmarking"],
    "electronic device": ["electronics", "CRS", "IT product"],
    "bicycle helmet": ["cyclist helmet", "bicycle safety"],
    "cooking pot": ["cookware", "kitchen utensil"],
}

# CLIP category labels for zero-shot classification
CLIP_LABELS = [
    "a pressure cooker in the kitchen",
    "a motorcycle helmet for safety",
    "a water bottle or drinking water container",
    "an electrical household appliance",
    "an LED light bulb",
    "a refrigerator or freezer appliance",
    "a steel pipe or metal tube",
    "a bathroom faucet or water tap",
    "gold jewellery or ornaments",
    "an electronic device or gadget",
    "a bicycle helmet",
    "a cooking pot or pan",
]

LABEL_TO_QUERY = {
    "a pressure cooker in the kitchen": "IS standard for domestic pressure cooker",
    "a motorcycle helmet for safety": "IS standard for motorcycle helmet two-wheeler rider",
    "a water bottle or drinking water container": "IS standard for packaged drinking water bottles",
    "an electrical household appliance": "IS standard for electrical household appliances safety",
    "an LED light bulb": "IS standard for LED lamp lighting",
    "a refrigerator or freezer appliance": "IS standard for household refrigerator",
    "a steel pipe or metal tube": "IS standard for steel tubes and pipes",
    "a bathroom faucet or water tap": "IS standard for sanitary tapware faucet",
    "gold jewellery or ornaments": "IS standard for gold jewellery hallmarking",
    "an electronic device or gadget": "IS standard for electronics CRS registration",
    "a bicycle helmet": "IS standard for cyclist protective helmet",
    "a cooking pot or pan": "IS standard for kitchen cookware utensils",
}

_clip_model = None


def get_clip_model():
    """Lazy-load CLIP model via sentence-transformers."""
    global _clip_model
    if _clip_model is None:
        try:
            # pyrefly: ignore [missing-import]
            from sentence_transformers import SentenceTransformer
            logger.info("Loading CLIP model (clip-ViT-B-32)...")
            _clip_model = SentenceTransformer("clip-ViT-B-32")
            logger.info("CLIP model loaded.")
        except Exception as e:
            logger.warning(f"CLIP model load failed: {e}. Will use fallback.")
            _clip_model = "failed"
    return _clip_model


def classify_image_clip(image_bytes: bytes) -> Tuple[str, float]:
    """
    Use CLIP to find the best matching product label.
    Returns (best_label, confidence_score 0-1).
    """
    from PIL import Image
    import numpy as np

    model = get_clip_model()
    if model == "failed":
        return "an electrical household appliance", 0.5

    try:
        # Load and encode the image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Encode image
        img_embedding = model.encode(img)  # type: ignore

        # Encode all text labels
        text_embeddings = model.encode(CLIP_LABELS)  # type: ignore

        # Compute cosine similarities
        # pyrefly: ignore [missing-import]
        from sentence_transformers import util
        similarities = util.cos_sim(img_embedding, text_embeddings)[0].numpy()  # type: ignore

        best_idx = int(np.argmax(similarities))
        best_label = CLIP_LABELS[best_idx]
        confidence = float(similarities[best_idx])

        logger.info(f"Image classified as: '{best_label}' (confidence: {confidence:.2f})")
        return best_label, confidence

    except Exception as e:
        logger.error(f"CLIP classification error: {e}")
        return "an electrical household appliance", 0.4


async def detect_standards_from_image(image_bytes: bytes) -> dict:
    """
    Full image → standard detection pipeline:
    1. Classify image with CLIP
    2. Use the classification label as a query in the RAG pipeline
    3. Return detected standards with confidence scores
    """
    from rag import generate_rag_answer, retrieve_relevant_standards

    # Step 1: Classify image
    best_label, clip_confidence = classify_image_clip(image_bytes)
    rag_query = LABEL_TO_QUERY.get(best_label, f"IS standard for {best_label}")

    logger.info(f"Image query for RAG: '{rag_query}'")

    # Step 2: Retrieve standards using RAG
    retrieved = retrieve_relevant_standards(rag_query, top_k=4)

    # Step 3: Generate a natural language description
    try:
        result = await generate_rag_answer(rag_query, language="en")
        description = result["answer"]
    except Exception as e:
        logger.warning(f"LLM generation failed for image detect: {e}")
        description = f"Based on image analysis, this appears to be a '{best_label}'. The relevant Indian Standard is shown below."

    # Boost confidence scores slightly based on CLIP confidence
    for r in retrieved:
        r["confidence"] = min(99, round(r["confidence"] * 0.7 + clip_confidence * 30))

    return {
        "detected_category": best_label,
        "clip_confidence": round(clip_confidence * 100),
        "rag_query_used": rag_query,
        "standards": retrieved,
        "description": description,
    }
