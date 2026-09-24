"""
BIS AI V2 — Centralized Configuration
All tunable parameters in one place. No magic numbers scattered through the codebase.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
CHROMA_DIR = BASE_DIR / "chroma_db"


class Settings:
    # ── Paths ──────────────────────────────────────────────────────────────────
    BASE_DIR: Path = BASE_DIR
    DATA_DIR: Path = DATA_DIR
    CHROMA_DIR: Path = CHROMA_DIR

    # ── LLM ───────────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    LLM_PRIMARY_MODEL: str = os.getenv("LLM_MODEL", "qwen/qwen3.8-27b")
    LLM_FALLBACK_MODELS: list = [
        "qwen/qwen3.6-27b",
        "openai/gpt-oss-20b",
    ]
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 800

    # ── Embeddings ─────────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 384

    # ── Retrieval (STEP 5-8: hybrid retrieval parameters) ─────────────────────
    DENSE_TOP_K: int = 8          # Dense retrieval candidates
    BM25_TOP_K: int = 8           # BM25 retrieval candidates
    RERANK_TOP_K: int = 5         # After reranking, keep top-K
    RRF_K: int = 60               # Reciprocal Rank Fusion constant

    # ── Reranker ──────────────────────────────────────────────────────────────
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    RERANKER_ENABLED: bool = True  # Set False on free-tier to save memory

    # ── Confidence thresholds ─────────────────────────────────────────────────
    MIN_EVIDENCE_SCORE: float = 0.25  # Below this → "insufficient evidence"
    HIGH_CONFIDENCE: float = 0.75
    MEDIUM_CONFIDENCE: float = 0.50

    # ── Evaluation ────────────────────────────────────────────────────────────
    EVAL_DATASET_PATH: Path = BASE_DIR / "eval_dataset.json"

    # ── Server ────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://bis-assistant-ai.onrender.com",
        "https://bis-assistant-frontend.onrender.com",
        "*",
    ]
    API_VERSION: str = "v2"
    APP_NAME: str = "BIS AI"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))


settings = Settings()
