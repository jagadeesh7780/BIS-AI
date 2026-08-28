"""
BIS Assistant AI — Comprehensive Ingestion Script
Embeds and indexes all official datasets into ChromaDB:
- 52 Indian Standards
- 35 Manufacturer & MSME Certification FAQs
- 28 Consumer Rights & Verification FAQs
- 25 Student & Academic FAQs
- 7 Certification Schemes
- 30 BIS 2026 Services

Usage:
    python ingest.py
"""

import sys
import logging
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    try:
        getattr(sys.stdout, "reconfigure")(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("bis.ingest")

load_dotenv()

try:
    # pyrefly: ignore [missing-import]
    import chromadb  # noqa: F401
    # pyrefly: ignore [missing-import]
    from chromadb.config import Settings  # noqa: F401
except ImportError:
    chromadb = None  # type: ignore
    Settings = None  # type: ignore

try:
    # pyrefly: ignore [missing-import]
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

from rag import (
    ingest_all_datasets,
    get_chroma_collection,
    reset_chroma_collection,
    get_embedding_model,
    HAS_SENTENCE_TRANSFORMERS,
)


def main():
    logger.info("=" * 60)
    logger.info("BIS Assistant AI — Comprehensive Knowledge Base Ingestion")
    logger.info("=" * 60)

    # Initialize / verify embedding model
    model = get_embedding_model()
    if HAS_SENTENCE_TRANSFORMERS and SentenceTransformer is not None and isinstance(model, SentenceTransformer):
        logger.info("SentenceTransformer (all-MiniLM-L6-v2) embedding model verified.")
    else:
        logger.info("Using fallback embedding model.")

    # Reset collection for a clean, deterministic index
    reset_chroma_collection()

    logger.info("Starting fresh multi-dataset ingestion...")
    ingest_all_datasets(force_reingest=True)

    collection = get_chroma_collection()
    logger.info("=" * 60)
    logger.info(f"✅ Ingestion complete! Total {collection.count()} knowledge items indexed in ChromaDB.")
    logger.info("=" * 60)
    logger.info("Ready for queries via FastAPI server: uvicorn main:app --reload")


if __name__ == "__main__":
    main()
