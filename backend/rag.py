"""
BIS AI V2 — Hybrid RAG Pipeline
FIXES from V1 audit:
  STEP 2:  Valid Groq model names (llama-3.3-70b-versatile etc.)
  STEP 4:  Correct confidence formula: (1 - dist) not (1 - dist/2)
  STEP 5:  BM25 keyword retrieval via rank_bm25
  STEP 6:  Reciprocal Rank Fusion (RRF)
  STEP 7:  Full citation schema (chunk_id, standard_number, section, source_url, authority)
  STEP 8:  Cross-encoder reranker (cross-encoder/ms-marco-MiniLM-L-6-v2)
  STEP 9:  Intent classifier for agent routing
  STEP 10: Full chunk metadata on every ingested document
  STEP 11: Hallucination guard — "Insufficient evidence" when retrieval is weak
  STEP 12: trace_id on every response
"""

import json
import logging
import math
import os
import re
import sys
import time
import uuid
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.resolve()))
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"] = "false"

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("bis.rag")

# ── Optional dependencies with graceful fallback ───────────────────────────────
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    HAS_CHROMA = True
except ImportError:
    chromadb = None
    ChromaSettings = None
    HAS_CHROMA = False
    logger.warning("chromadb not installed — using in-memory vector store.")

try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    SentenceTransformer = None
    HAS_SENTENCE_TRANSFORMERS = False
    logger.warning("sentence-transformers not installed.")

try:
    from sentence_transformers import CrossEncoder
    HAS_CROSS_ENCODER = True
except ImportError:
    CrossEncoder = None
    HAS_CROSS_ENCODER = False

try:
    from rank_bm25 import BM25Okapi
    HAS_BM25 = True
except ImportError:
    BM25Okapi = None
    HAS_BM25 = False
    logger.warning("rank_bm25 not installed — BM25 retrieval disabled.")

try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    Groq = None
    HAS_GROQ = False

from translate import translate_from_english, translate_to_english

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
CHROMA_DIR = BASE_DIR / "chroma_db"

# ── Config ─────────────────────────────────────────────────────────────────────
try:
    from core.config import settings
    DENSE_TOP_K        = settings.DENSE_TOP_K
    BM25_TOP_K         = settings.BM25_TOP_K
    RERANK_TOP_K       = settings.RERANK_TOP_K
    RRF_K              = settings.RRF_K
    MIN_EVIDENCE_SCORE = settings.MIN_EVIDENCE_SCORE
    HIGH_CONF          = settings.HIGH_CONFIDENCE
    MED_CONF           = settings.MEDIUM_CONFIDENCE
    RERANKER_ENABLED   = settings.RERANKER_ENABLED
    GROQ_API_KEY       = settings.GROQ_API_KEY
    PRIMARY_MODEL      = settings.LLM_PRIMARY_MODEL
    FALLBACK_MODELS    = settings.LLM_FALLBACK_MODELS
except Exception:
    DENSE_TOP_K        = 8
    BM25_TOP_K         = 8
    RERANK_TOP_K       = 5
    RRF_K              = 60
    MIN_EVIDENCE_SCORE = 0.25
    HIGH_CONF          = 0.75
    MED_CONF           = 0.50
    RERANKER_ENABLED   = True
    GROQ_API_KEY       = os.getenv("GROQ_API_KEY", "")
    # STEP 2 FIX: Valid Groq model IDs
    PRIMARY_MODEL      = "llama-3.3-70b-versatile"
    FALLBACK_MODELS    = [
        "llama-3.1-70b-versatile",
        "llama3-70b-8192",
        "gemma2-9b-it",
        "llama3-8b-8192",
    ]

# ── Singletons ─────────────────────────────────────────────────────────────────
_embedding_model = None
_reranker_model  = None
_chroma_client   = None
_collection      = None
_groq_client     = None
_bm25_index      = None
_bm25_corpus: list[dict[str, Any]]      = []
_in_memory_corpus: list[dict[str, Any]] = []


# ══════════════════════════════════════════════════════════════════════════════
# EMBEDDING
# ══════════════════════════════════════════════════════════════════════════════

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        if HAS_SENTENCE_TRANSFORMERS and SentenceTransformer is not None:
            try:
                logger.info("Loading SentenceTransformer all-MiniLM-L6-v2…")
                _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("✅ Embedding model ready.")
            except Exception as e:
                logger.error(f"Embedding model load failed: {e}")
                _embedding_model = "unavailable"
        else:
            _embedding_model = "unavailable"
    return _embedding_model


def embed(text: str) -> list[float]:
    if not text or not str(text).strip():
        return [0.0] * 384
    m = get_embedding_model()
    if m == "unavailable":
        return [0.0] * 384
    try:
        v = m.encode(str(text))
        return [float(x) for x in (v.tolist() if hasattr(v, "tolist") else list(v))]
    except Exception:
        return [0.0] * 384


def embed_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    if not texts:
        return []
    clean = [str(t) if t and str(t).strip() else " " for t in texts]
    m = get_embedding_model()
    if m == "unavailable":
        return [[0.0] * 384 for _ in clean]
    try:
        enc = m.encode(clean, batch_size=batch_size, show_progress_bar=False)
        raw = enc.tolist() if hasattr(enc, "tolist") else list(enc)
        return [[float(x) for x in row] for row in raw]
    except Exception as e:
        logger.warning(f"embed_batch failed ({e}), single-pass fallback")
        return [embed(t) for t in clean]


# ══════════════════════════════════════════════════════════════════════════════
# STEP 8: CROSS-ENCODER RERANKER
# ══════════════════════════════════════════════════════════════════════════════

def get_reranker():
    global _reranker_model
    if not RERANKER_ENABLED or not HAS_CROSS_ENCODER or CrossEncoder is None:
        return None
    if _reranker_model is None:
        try:
            logger.info("Loading cross-encoder reranker…")
            _reranker_model = CrossEncoder(
                "cross-encoder/ms-marco-MiniLM-L-6-v2", max_length=512
            )
            logger.info("✅ Reranker ready.")
        except Exception as e:
            logger.warning(f"Reranker load failed: {e}")
            _reranker_model = "unavailable"
    return None if _reranker_model == "unavailable" else _reranker_model


def rerank(query: str, candidates: list[dict[str, Any]], top_k: int = 5) -> list[dict[str, Any]]:
    """Rerank using cross-encoder. Falls back to original order."""
    if not candidates:
        return candidates
    ranker = get_reranker()
    if ranker is None:
        return candidates[:top_k]
    try:
        pairs = [
            (query, c.get("text", c.get("document_title", ""))[:512])
            for c in candidates
        ]
        scores = ranker.predict(pairs)
        ranked = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
        result = []
        for score, item in ranked[:top_k]:
            item = dict(item)
            item["rerank_score"] = float(score)
            # Normalize cross-encoder score [-10, 10] → [0, 1]
            item["confidence_score"] = max(0.0, min(1.0, (float(score) + 10) / 20))
            item["confidence"] = round(item["confidence_score"] * 100)
            result.append(item)
        return result
    except Exception as e:
        logger.warning(f"Reranking failed: {e}")
        return candidates[:top_k]


# ══════════════════════════════════════════════════════════════════════════════
# CHROMADB
# ══════════════════════════════════════════════════════════════════════════════

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        if not HAS_CHROMA:
            raise RuntimeError("ChromaDB not installed.")
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_chroma_collection():
    global _collection
    client = get_chroma_client()
    _collection = client.get_or_create_collection(
        name="bis_standards_v2",
        metadata={"hnsw:space": "cosine"},
    )
    return _collection


def reset_chroma_collection():
    global _collection
    client = get_chroma_client()
    try:
        client.delete_collection("bis_standards_v2")
        logger.info("Purged collection bis_standards_v2.")
    except Exception:
        pass
    _collection = client.get_or_create_collection(
        name="bis_standards_v2",
        metadata={"hnsw:space": "cosine"},
    )
    return _collection


# ══════════════════════════════════════════════════════════════════════════════
# GROQ CLIENT
# ══════════════════════════════════════════════════════════════════════════════

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        key = GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
        if not key:
            raise RuntimeError("GROQ_API_KEY not set in .env")
        if not HAS_GROQ or Groq is None:
            raise RuntimeError("groq library not installed.")
        _groq_client = Groq(api_key=key)
        logger.info("Groq client initialized.")
    return _groq_client


# ══════════════════════════════════════════════════════════════════════════════
# STEP 10: INGESTION WITH FULL CHUNK METADATA
# ══════════════════════════════════════════════════════════════════════════════

def _make_chunk(doc_id: str, text: str, meta: dict[str, Any]) -> dict[str, Any]:
    """Return a chunk with every required metadata field populated."""
    return {
        "chunk_id":           doc_id,
        "document_id":        meta.get("id", doc_id),
        "document_title":     f"{meta.get('number', '')} — {meta.get('title', '')}".strip(" — "),
        "standard_number":    meta.get("number", meta.get("id", "")),
        "section":            meta.get("section", "General"),
        "page":               meta.get("page", None),
        "source_url":         meta.get("source_url", "https://www.bis.gov.in"),
        "source_type":        meta.get("type", "standard"),
        "authority":          "BIS",
        "category":           meta.get("category", "General"),
        "certification_scheme": meta.get("certification_scheme", ""),
        "role":               meta.get("role", "all"),
        "text":               text,
        # legacy aliases
        "id":                 meta.get("id", doc_id),
        "number":             meta.get("number", meta.get("id", "")),
        "title":              meta.get("title", ""),
    }


def ingest_all_datasets(force_reingest: bool = False) -> None:
    global _in_memory_corpus, _bm25_corpus, _bm25_index

    if not force_reingest and len(_in_memory_corpus) >= 130:
        logger.info(f"Knowledge base already has {len(_in_memory_corpus)} items. Skipping.")
        return

    logger.info("Ingesting all BIS datasets (V2)…")
    ids: list[str]              = []
    docs: list[str]             = []
    flat_metas: list[dict]      = []
    chunks: list[dict[str, Any]] = []

    def _add(doc_id, blob, meta):
        ids.append(doc_id)
        docs.append(blob)
        flat_metas.append({
            k: (str(v) if v is not None else "")
            for k, v in meta.items()
            if isinstance(v, (str, int, float, bool)) or v is None
        })
        chunks.append(_make_chunk(doc_id, blob, meta))

    # 1. Standards
    sf = DATA_DIR / "standards.json"
    if sf.exists():
        with open(sf, encoding="utf-8") as f:
            stds = json.load(f)
        for s in stds:
            blob = (
                f"Standard: {s.get('number', s['id'])} — {s['title']}. "
                f"Category: {s.get('category', 'General')}. "
                f"Scope: {s.get('scope', '')}. "
                f"Summary: {s.get('summary', '')}. "
                f"Certification Scheme: {s.get('certification_scheme', 'ISI Mark')}. "
                f"Keywords: {', '.join(s.get('keywords', []))}."
            )
            _add(f"STD-{s['id']}", blob, {
                **s,
                "type": "standard", "role": "all",
                "section": "Full Standard",
                "source_url": "https://www.bis.gov.in/index.php/standardsdata/",
            })
        logger.info(f"Loaded {len(stds)} standards.")

    # 2. Manufacturer FAQs
    mf = DATA_DIR / "manufacturer_faq.json"
    if mf.exists():
        with open(mf, encoding="utf-8") as f:
            faqs = json.load(f)
        for item in faqs:
            blob = (
                f"[Manufacturer & MSME Certification — {item.get('category', 'General')}]\n"
                f"Q: {item['question']}\nA: {item['answer']}"
            )
            _add(f"FAQ-MFR-{item['id']}", blob, {
                "id": item["id"], "number": item["id"],
                "title": item["question"],
                "category": item.get("category", "Manufacturer FAQ"),
                "certification_scheme": "Manufacturer / MSME",
                "type": "faq", "role": "manufacturer",
                "section": item.get("category", "FAQ"),
                "source_url": "https://www.manakonline.in",
            })
        logger.info(f"Loaded {len(faqs)} manufacturer FAQs.")

    # 3. Consumer FAQs
    cf = DATA_DIR / "consumer_faq.json"
    if cf.exists():
        with open(cf, encoding="utf-8") as f:
            faqs = json.load(f)
        for item in faqs:
            blob = (
                f"[Consumer Rights & Verification — {item.get('category', 'General')}]\n"
                f"Q: {item['question']}\nA: {item['answer']}"
            )
            _add(f"FAQ-CON-{item['id']}", blob, {
                "id": item["id"], "number": item["id"],
                "title": item["question"],
                "category": item.get("category", "Consumer FAQ"),
                "certification_scheme": "Consumer",
                "type": "faq", "role": "consumer",
                "section": item.get("category", "FAQ"),
                "source_url": "https://www.bis.gov.in/index.php/consumer-affairs/",
            })
        logger.info(f"Loaded {len(faqs)} consumer FAQs.")

    # 4. Student FAQs
    stuf = DATA_DIR / "student_faq.json"
    if stuf.exists():
        with open(stuf, encoding="utf-8") as f:
            faqs = json.load(f)
        for item in faqs:
            blob = (
                f"[BIS Academic & Research — {item.get('category', 'General')}]\n"
                f"Q: {item['question']}\nA: {item['answer']}"
            )
            _add(f"FAQ-STU-{item['id']}", blob, {
                "id": item["id"], "number": item["id"],
                "title": item["question"],
                "category": item.get("category", "Student FAQ"),
                "certification_scheme": "Student / Academia",
                "type": "faq", "role": "student",
                "section": item.get("category", "FAQ"),
                "source_url": "https://www.bis.gov.in/index.php/about-bis/",
            })
        logger.info(f"Loaded {len(faqs)} student FAQs.")

    # 5. Schemes
    schf = DATA_DIR / "schemes.json"
    if schf.exists():
        with open(schf, encoding="utf-8") as f:
            raw = json.load(f)
        scheme_list = list(raw.values()) if isinstance(raw, dict) else raw
        for s in scheme_list:
            steps_text = " | ".join([
                (st.get("description") or st.get("title") or "") if isinstance(st, dict) else str(st)
                for st in s.get("steps", [])
            ])
            blob = (
                f"[BIS Certification Scheme: {s.get('name', '')}]\n"
                f"Description: {s.get('description', '')}\n"
                f"Applicable Products: {s.get('applicable_products', '')}\n"
                f"Duration: {s.get('typical_duration', '')}\n"
                f"Legal Basis: {s.get('legal_basis', '')}\n"
                f"Steps: {steps_text}"
            )
            _add(f"SCHEME-{s.get('id', '')}", blob, {
                "id": s.get("id", ""),
                "number": s.get("short", s.get("id", "").upper()),
                "title": s.get("name", ""),
                "category": "Certification Scheme",
                "certification_scheme": s.get("name", ""),
                "type": "scheme", "role": "all",
                "section": "Scheme Overview",
                "source_url": "https://www.bis.gov.in/index.php/certification/",
            })
        logger.info(f"Loaded {len(scheme_list)} certification schemes.")

    # 6. BIS Services
    srvf = DATA_DIR / "bis_services.json"
    if srvf.exists():
        with open(srvf, encoding="utf-8") as f:
            raw = json.load(f)
        srv_list = raw.get("services", []) if isinstance(raw, dict) else raw
        for srv in srv_list:
            blob = (
                f"[BIS Service: {srv.get('service_category', '')} — {srv.get('service_subcategory', '')}]\n"
                f"Description: {srv.get('description', '')}\n"
                f"Target Users: {srv.get('target_users', '')}\n"
                f"Key Features: {srv.get('key_features', '')}\n"
                f"Details: {srv.get('additional_details', '')}"
            )
            sid = srv.get("id", srv.get("service_subcategory", ""))
            _add(f"SRV-{sid}", blob, {
                "id": sid,
                "number": sid,
                "title": f"{srv.get('service_category', '')} — {srv.get('service_subcategory', '')}",
                "category": srv.get("service_category", "BIS Service"),
                "certification_scheme": srv.get("service_category", ""),
                "type": "service", "role": "all",
                "section": srv.get("service_category", "Service"),
                "source_url": "https://www.bis.gov.in",
            })
        logger.info(f"Loaded {len(srv_list)} BIS services.")

    if not ids:
        logger.error("No data files found!")
        return

    # Embeddings
    logger.info(f"Generating embeddings for {len(docs)} docs…")
    embeddings = embed_batch(docs, batch_size=32)

    # In-memory corpus
    _in_memory_corpus = [
        {**chunks[i], "embedding": embeddings[i]}
        for i in range(len(ids))
    ]

    # STEP 5: BM25 index
    if HAS_BM25 and BM25Okapi is not None:
        tokenized = [d.lower().split() for d in docs]
        _bm25_index = BM25Okapi(tokenized)
        _bm25_corpus = list(chunks)
        logger.info(f"✅ BM25 index built ({len(docs)} docs).")

    # ChromaDB
    if HAS_CHROMA:
        try:
            col = get_chroma_collection()
            col.upsert(ids=ids, documents=docs, embeddings=embeddings, metadatas=flat_metas)
            logger.info(f"✅ ChromaDB bis_standards_v2: {col.count()} chunks.")
        except Exception as e:
            logger.warning(f"ChromaDB upsert failed ({e}). In-memory will be used.")
    else:
        logger.info(f"✅ In-memory corpus: {len(_in_memory_corpus)} chunks.")


def ingest_standards():
    ingest_all_datasets(force_reingest=False)


# ══════════════════════════════════════════════════════════════════════════════
# STEPS 5 & 6: DENSE + BM25 + RRF HYBRID RETRIEVAL
# ══════════════════════════════════════════════════════════════════════════════

def _dense_retrieve(query: str, top_k: int = 8, role_filter: str | None = None) -> list[dict[str, Any]]:
    q_emb = embed(query)
    if all(v == 0.0 for v in q_emb):
        return []

    # ChromaDB path
    if HAS_CHROMA:
        try:
            col = get_chroma_collection()
            count = col.count()
            if count == 0:
                ingest_all_datasets()
                count = col.count()
            if count > 0:
                n = max(1, min(top_k * 2, count))
                res = col.query(
                    query_embeddings=[q_emb],
                    n_results=n,
                    include=["documents", "metadatas", "distances"],
                )
                out = []
                if res and res.get("ids"):
                    for i, cid in enumerate(res["ids"][0]):
                        dist  = res["distances"][0][i] if res.get("distances") else 1.0
                        meta  = res["metadatas"][0][i] if res.get("metadatas") else {}
                        text  = res["documents"][0][i] if res.get("documents") else ""
                        role  = meta.get("role", "all") if isinstance(meta, dict) else "all"
                        if role_filter and role_filter != "all" and role not in (role_filter, "all"):
                            continue
                        # STEP 4 FIX: correct cosine similarity
                        cs = max(0.0, min(1.0, 1.0 - float(dist)))
                        m  = meta if isinstance(meta, dict) else {}
                        out.append({
                            "chunk_id":           cid,
                            "document_id":        m.get("id", ""),
                            "document_title":     f"{m.get('number', '')} — {m.get('title', '')}".strip(" — "),
                            "standard_number":    m.get("number", m.get("id", "")),
                            "section":            m.get("section", "General"),
                            "source_url":         m.get("source_url", "https://www.bis.gov.in"),
                            "source_type":        m.get("type", "standard"),
                            "authority":          "BIS",
                            "category":           m.get("category", ""),
                            "certification_scheme": m.get("certification_scheme", ""),
                            "role":               role,
                            "text":               text,
                            "confidence_score":   cs,
                            "confidence":         round(cs * 100),
                            "id":                 m.get("id", ""),
                            "number":             m.get("number", ""),
                            "title":              m.get("title", ""),
                        })
                if out:
                    return out
        except Exception as e:
            logger.warning(f"ChromaDB query failed: {e}")

    # In-memory fallback
    if not _in_memory_corpus:
        ingest_all_datasets()
    scored = []
    for item in _in_memory_corpus:
        r = item.get("role", "all")
        if role_filter and role_filter != "all" and r not in (role_filter, "all"):
            continue
        v2 = item.get("embedding", [])
        if not v2:
            continue
        dot = sum(a * b for a, b in zip(q_emb, v2))
        n1  = math.sqrt(sum(a * a for a in q_emb)) or 1.0
        n2  = math.sqrt(sum(b * b for b in v2))    or 1.0
        sim = dot / (n1 * n2)
        scored.append((sim, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    result = []
    for sim, item in scored[:top_k]:
        d = dict(item)
        d["confidence_score"] = max(0.0, min(1.0, sim))
        d["confidence"]       = round(d["confidence_score"] * 100)
        result.append(d)
    return result


def _bm25_retrieve(query: str, top_k: int = 8, role_filter: str | None = None) -> list[dict[str, Any]]:
    """STEP 5: BM25 keyword retrieval."""
    if not HAS_BM25 or _bm25_index is None or not _bm25_corpus:
        return []
    try:
        tokens = query.lower().split()
        scores = _bm25_index.get_scores(tokens)
        ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
        result = []
        for idx, score in ranked:
            if len(result) >= top_k:
                break
            if idx >= len(_bm25_corpus):
                continue
            item = dict(_bm25_corpus[idx])
            r = item.get("role", "all")
            if role_filter and role_filter != "all" and r not in (role_filter, "all"):
                continue
            ns = min(1.0, max(0.0, score / 20.0))
            item["confidence_score"] = ns
            item["confidence"]       = round(ns * 100)
            result.append(item)
        return result
    except Exception as e:
        logger.warning(f"BM25 retrieval failed: {e}")
        return []


def _rrf_fusion(dense: list[dict], bm25: list[dict], k: int = 60) -> list[dict]:
    """STEP 6: Reciprocal Rank Fusion."""
    scores: dict[str, float]      = {}
    items:  dict[str, dict]       = {}
    for rank, item in enumerate(dense):
        cid = item.get("chunk_id", item.get("id", str(rank)))
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
        items[cid]  = item
    for rank, item in enumerate(bm25):
        cid = item.get("chunk_id", item.get("id", str(rank)))
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
        if cid not in items:
            items[cid] = item
    fused = []
    for cid in sorted(scores, key=scores.__getitem__, reverse=True):
        it = dict(items[cid])
        it["rrf_score"]        = scores[cid]
        it["confidence_score"] = min(1.0, scores[cid] * 30)
        it["confidence"]       = round(it["confidence_score"] * 100)
        fused.append(it)
    return fused


def hybrid_retrieve(query: str, top_k: int = 5, role_filter: str | None = None) -> list[dict[str, Any]]:
    """Full hybrid pipeline: Dense + BM25 → RRF → Rerank."""
    if not _in_memory_corpus:
        ingest_all_datasets()
    dense = _dense_retrieve(query, top_k=DENSE_TOP_K, role_filter=role_filter)
    bm25  = _bm25_retrieve(query,  top_k=BM25_TOP_K,  role_filter=role_filter)
    if dense and bm25:
        fused = _rrf_fusion(dense, bm25, k=RRF_K)
    elif dense:
        fused = dense
    elif bm25:
        fused = bm25
    else:
        return []
    return rerank(query, fused, top_k=max(top_k, RERANK_TOP_K))[:top_k]


# Backward-compat aliases
def retrieve(query: str, top_k: int = 5, role_filter: str | None = None) -> list[dict]:
    return hybrid_retrieve(query, top_k=top_k, role_filter=role_filter)

def retrieve_relevant_standards(query: str, top_k: int = 4) -> list[dict]:
    return hybrid_retrieve(query, top_k=top_k)

def retrieve_relevant_chunks(query: str, top_k: int = 5) -> list[dict]:
    return hybrid_retrieve(query, top_k=top_k)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 9: INTENT CLASSIFIER
# ══════════════════════════════════════════════════════════════════════════════

def classify_intent(query: str, role_hint: str | None = None) -> str:
    if role_hint:
        r = role_hint.lower()
        if r in ("consumer", "consumer_protection"):   return "consumer"
        if r in ("manufacturer", "msme"):              return "manufacturer"
        if r in ("student", "helper", "researcher"):   return "standards"

    q = query.lower()
    consumer_kw     = ["verify", "genuine", "fake", "huid", "hallmark", "complaint",
                       "cm/l", "r-number", "bis care", "counterfeit", "how to check",
                       "is this certified", "report fake"]
    manufacturer_kw = ["certif", "licens", "apply", "form v", "form-v", "manak",
                       "qco", "quality control order", "factory audit", "fmcs",
                       "manufacturer", "get isi mark", "apply for", "how to get certified",
                       "testing lab slot", "batch testing", "production"]
    compliance_kw   = ["mandatory", "compulsory", "penalty", "fine", "imprisonment",
                       "section 29", "bis act", "gazette", "regulatory", "prohibited"]
    standards_kw    = ["is ", "is-", "standard", "specification", "scope", "clause",
                       "what standard", "which standard", "indian standard"]

    if any(kw in q for kw in consumer_kw):     return "consumer"
    if any(kw in q for kw in manufacturer_kw): return "manufacturer"
    if any(kw in q for kw in compliance_kw):   return "compliance"
    if any(kw in q for kw in standards_kw):    return "standards"
    return "standards"


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEM PROMPTS
# ══════════════════════════════════════════════════════════════════════════════

_BASE_PROMPT = """You are BIS Assistant AI — official AI domain assistant for the Bureau of Indian Standards (BIS), Government of India.

ABSOLUTE RULES:
1. Use ONLY the retrieved context to answer. Never invent standard numbers, clauses, fees, labs, or procedures.
2. If context is insufficient, say: "Insufficient authoritative evidence was retrieved. Please consult https://www.bis.gov.in."
3. Always cite IS standard numbers (e.g., IS 302, IS 2347) when referencing standards.
4. No chain-of-thought, no thinking steps, no meta-commentary. Direct answer only.
5. Be concise and precise. Use bullet points for multi-step procedures."""

_AGENT_PROMPTS = {
    "consumer": (
        "You are the Consumer Protection AI Agent. "
        "Focus on: verifying ISI marks via CM/L number and BIS CARE app, "
        "gold hallmarking HUID verification, identifying fake marks, "
        "mandatory ISI products, and complaints via 1800-11-4070."
    ),
    "manufacturer": (
        "You are the Manufacturer & MSME Licensing AI Agent. "
        "Focus on: IS standard identification, Form-V documents, Manak Online portal, "
        "factory audit, BIS-recognized lab testing, QCOs, and FMCS. "
        "Clarify: official licensing is at https://www.manakonline.in."
    ),
    "compliance": (
        "You are the Compliance & Regulatory AI Agent. "
        "Focus on: QCO mandates, BIS Act 2016 sections, Section 29 penalties, "
        "gazette notifications, and regulatory obligations. Cite legal provisions."
    ),
    "standards": (
        "You are the Standards Discovery AI Agent. "
        "Focus on: finding applicable IS standards, explaining scope, "
        "certification schemes, testing requirements. Cite number and title precisely."
    ),
}

def _build_prompt(agent: str) -> str:
    return f"{_BASE_PROMPT}\n\nAGENT ROLE:\n{_AGENT_PROMPTS.get(agent, _AGENT_PROMPTS['standards'])}"


def _normalize_score(r: dict[str, Any]) -> float:
    """Extract and normalize confidence score in 0.0 - 1.0 from retrieved record."""
    if not isinstance(r, dict):
        return 0.5
    cs = r.get("confidence_score")
    if cs is not None:
        try:
            return float(cs)
        except (ValueError, TypeError):
            pass
    conf = r.get("confidence")
    if conf is not None:
        try:
            f = float(conf)
            return f / 100.0 if f > 1.0 else f
        except (ValueError, TypeError):
            pass
    rrf = r.get("rrf_score")
    if rrf is not None:
        try:
            return min(1.0, float(rrf) * 30.0)
        except (ValueError, TypeError):
            pass
    return 0.5


def _build_citations(retrieved: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build standardized citations list from retrieved records."""
    citations, seen = [], set()
    for r in retrieved:
        cid = r.get("chunk_id", r.get("id", ""))
        if not cid or cid in seen:
            continue
        seen.add(cid)
        cs = _normalize_score(r)
        if cs < 0.05:
            continue
        citations.append({
            "chunk_id":       cid,
            "document_id":    r.get("document_id", r.get("id", "")),
            "document_title": r.get("document_title", r.get("title", "")),
            "standard_number": r.get("standard_number", r.get("number", "")),
            "section":        r.get("section", "General"),
            "page":           r.get("page", None),
            "source_url":     r.get("source_url", "https://www.bis.gov.in"),
            "source_type":    r.get("source_type", r.get("type", "standard")),
            "authority":      "BIS",
            "relevance_score": round(cs, 3),
        })
    return citations


# ══════════════════════════════════════════════════════════════════════════════
# LLM CLEANING
# ══════════════════════════════════════════════════════════════════════════════

def _clean_llm(text: str) -> str:
    if not text:
        return ""
    if "</think>" in text:
        text = text.split("</think>")[-1].strip()
    elif "<think>" in text:
        text = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
    for pat in [
        r"[\*#_]*\s*Final Answer\s*[\*#_]*[:\s\*]*",
        r"[\*#_]*\s*Official Response\s*[\*#_]*[:\s\*]*",
        r"^\s*[\*#_]*\s*Answer\s*[\*#_]*[:\s\*]*",
    ]:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            text = text[m.end():].strip()
            break
    return text.strip()


# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 + 11 + 12: GENERATE ANSWER
# ══════════════════════════════════════════════════════════════════════════════

async def generate_rag_answer(
    query: str,
    language: str = "en",
    role: str | None = None,
) -> dict[str, Any]:
    t0       = time.time()
    trace_id = str(uuid.uuid4())[:12]

    # 1. Translate query to English
    en_query = translate_to_english(query, language)
    logger.info(f"[{trace_id}] query='{en_query[:80]}' role={role}")

    # 2. Agent routing (STEP 9)
    agent       = classify_intent(en_query, role_hint=role)
    role_filter = role if role in ("consumer", "manufacturer", "student") else None

    progress = [
        {"step": "Understanding your question",         "status": "done"},
        {"step": f"Routing to {agent.title()} Agent",   "status": "done"},
        {"step": "Searching BIS knowledge base",        "status": "active"},
    ]

    # 3. Hybrid retrieval
    retrieved = hybrid_retrieve(en_query, top_k=RERANK_TOP_K, role_filter=role_filter)
    if not retrieved and role_filter:
        retrieved = hybrid_retrieve(en_query, top_k=RERANK_TOP_K)

    progress.append({"step": "Verifying evidence", "status": "done" if retrieved else "warning"})

    # 4. STEP 11: Hallucination guard
    top_score = _normalize_score(retrieved[0]) if retrieved else 0.0
    sufficient = len(retrieved) > 0 and top_score >= 0.15

    # 5. Context
    if retrieved:
        blocks = []
        for r in retrieved:
            sn  = r.get("standard_number", r.get("number", ""))
            ttl = r.get("document_title", r.get("title", ""))
            st  = r.get("source_type", r.get("type", "Item")).upper()
            hdr = f"[{st}: {sn} — {ttl}]".replace(" — ]", "]") if sn else f"[{st}: {ttl}]"
            blocks.append(f"{hdr}\n{r.get('text', '')}")
        context = "\n\n---\n\n".join(blocks)
    else:
        context = "No relevant records found."

    # 6. LLM generation
    answer_en  = None
    last_err   = None
    groq_ok    = False
    try:
        groq_client = get_groq_client()
        groq_ok     = True
    except Exception as e:
        groq_client = None
        last_err    = e

    if groq_ok and sufficient and groq_client:
        sys_prompt = _build_prompt(agent)
        for model_name in [PRIMARY_MODEL] + FALLBACK_MODELS:
            try:
                completion = groq_client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": sys_prompt},
                        {"role": "user",   "content": (
                            f"Official BIS Knowledge Context:\n{context}\n\n"
                            f"User Question: {en_query}\n\n"
                            f"Answer directly citing IS standard numbers where applicable:"
                        )},
                    ],
                    temperature=0.2,
                    max_tokens=2048,
                )
                raw      = completion.choices[0].message.content or ""
                cleaned  = _clean_llm(raw)
                answer_en = cleaned or raw.strip()
                if answer_en:
                    logger.info(f"[{trace_id}] LLM OK via {model_name}")
                    break
            except Exception as e:
                logger.warning(f"[{trace_id}] {model_name} failed: {e}")
                last_err = e

    # 7. STEP 11: Fallback answers
    if not answer_en:
        if not sufficient:
            answer_en = (
                "Insufficient authoritative evidence was retrieved to answer this reliably. "
                "Please consult the official Bureau of Indian Standards at https://www.bis.gov.in "
                "or call the BIS helpline: 1800-11-4070 (Toll Free)."
            )
        elif retrieved:
            top = retrieved[0]
            answer_en = (
                f"Based on official BIS records:\n\n"
                f"**{top.get('standard_number', top.get('number', ''))} — "
                f"{top.get('document_title', top.get('title', ''))}**\n\n"
                f"{top.get('text', '')[:500]}\n\n"
                f"For official details, visit https://www.manakonline.in or call 1800-11-4070."
            )
        else:
            answer_en = (
                "Insufficient authoritative evidence. "
                "Please visit https://www.bis.gov.in or call 1800-11-4070."
            )
        if last_err:
            logger.error(f"[{trace_id}] LLM unavailable: {last_err}")

    # 8. Translate back
    final_answer = translate_from_english(answer_en, language)

    # 9. STEP 7: Build citations
    citations = _build_citations(retrieved)
    sources, seen_src = [], set()
    for r in retrieved:
        cid = r.get("chunk_id", r.get("id", ""))
        if not cid or cid in seen_src:
            continue
        seen_src.add(cid)
        cs = _normalize_score(r)
        num = r.get("standard_number", r.get("number", ""))
        title = r.get("document_title", r.get("title", ""))
        sources.append({
            "id":         r.get("id", cid),
            "title":      f"{num} — {title}".strip(" — "),
            "category":   r.get("category", ""),
            "confidence": round(cs * 100),
        })

    # 10. Confidence level
    if top_score >= HIGH_CONF:    conf_level = "high"
    elif top_score >= MED_CONF:   conf_level = "medium"
    elif sufficient:              conf_level = "low"
    else:                         conf_level = "insufficient"

    # 11. Next steps
    if agent == "manufacturer":
        next_steps = [
            "File your application at https://www.manakonline.in",
            "Book a sample testing slot at your nearest BIS-recognized lab",
            "Prepare Form-V: factory layout, machinery list, calibration records",
        ]
    elif agent == "consumer":
        next_steps = [
            "Download the free BIS CARE app to verify ISI marks and HUID codes",
            "Call BIS helpline 1800-11-4070 for complaints (Toll Free)",
            "Visit https://www.bis.gov.in/consumer-affairs/ for guidance",
        ]
    elif agent == "compliance":
        next_steps = [
            "Review the QCO on the Gazette of India",
            "Contact a BIS-recognized testing lab for pre-compliance testing",
            "Consult https://www.bis.gov.in for regulatory clarifications",
        ]
    else:
        next_steps = [
            "Search the full IS standard at https://www.bis.gov.in/standardsdata/",
            "Use BIS CARE app or call 1800-11-4070 for product verification",
        ]

    progress.append({"step": "Preparing answer", "status": "done"})
    elapsed = round(time.time() - t0, 2)
    logger.info(f"[{trace_id}] Done {elapsed}s agent={agent} conf={conf_level}({top_score:.2f})")

    return {
        "answer":         final_answer,
        "agent":          agent,
        "confidence":     {"level": conf_level, "score": round(top_score, 3)},
        "citations":      citations[:5],
        "sources":        sources[:4],
        "next_steps":     next_steps,
        "progress":       progress,
        "trace_id":       trace_id,
        "response_time_s": elapsed,
        "language":       language,
        "disclaimer": (
            "BIS AI provides guidance based on curated BIS knowledge. "
            "Always verify with official BIS publications at bis.gov.in."
        ),
    }


def answer_query(query: str, top_k: int = 5, role: str | None = None) -> dict[str, Any]:
    import asyncio
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, generate_rag_answer(query, "en", role=role)).result()
    return asyncio.run(generate_rag_answer(query, "en", role=role))


if __name__ == "__main__":
    print("BIS AI V2 — Ingesting…")
    ingest_all_datasets(force_reingest=True)
    if HAS_CHROMA:
        print(f"ChromaDB: {get_chroma_collection().count()} chunks")
    print(f"In-memory: {len(_in_memory_corpus)}")
    print(f"BM25: {'enabled' if _bm25_index else 'disabled'}")
    r = answer_query("What IS standard applies to domestic pressure cookers?")
    print(f"\nTest answer [{r['trace_id']}] agent={r['agent']} conf={r['confidence']}")
    print(r["answer"][:300])
