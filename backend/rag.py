"""
BIS Assistant AI — RAG (Retrieval-Augmented Generation) Pipeline.
Ingests & retrieves from all BIS datasets:
- 52 Indian Standards (IS specifications across all categories)
- Manufacturer & MSME Certification FAQs
- Consumer Rights, Verification & Complaint FAQs
- Student, Research & Institutional FAQs
- 7 BIS Certification Schemes (ISI, CRS, Hallmarking, FMCS, ECO Mark, MSCS, Silver/Gold)
- BIS Regional & Central Testing Laboratories
"""

import os
import sys
import re
import json
import time
import math
import logging
import hashlib
from pathlib import Path
from typing import List, Dict, Optional, Any, cast

# Ensure backend directory is in sys.path for direct imports (translate, etc.)
sys.path.insert(0, str(Path(__file__).parent.resolve()))

# Disable telemetry before importing chromadb to prevent PostHog crashes
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"] = "false"

if hasattr(sys.stdout, "reconfigure"):
    try:
        getattr(sys.stdout, "reconfigure")(encoding="utf-8")
    except Exception:
        pass

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("bis.rag")

try:
    # pyrefly: ignore [missing-import]
    import chromadb  # type: ignore # noqa: F401
    # pyrefly: ignore [missing-import]
    from chromadb.config import Settings  # type: ignore # noqa: F401
except ImportError:
    chromadb = None  # type: ignore
    Settings = None  # type: ignore

try:
    # pyrefly: ignore [missing-import]
    from sentence_transformers import SentenceTransformer  # type: ignore # noqa: F401
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    SentenceTransformer = None
    HAS_SENTENCE_TRANSFORMERS = False

try:
    # pyrefly: ignore [missing-import]
    from groq import Groq  # type: ignore # noqa: F401
    HAS_GROQ = True
except ImportError:
    Groq = None
    HAS_GROQ = False

from translate import translate_to_english, translate_from_english

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
CHROMA_DIR = BASE_DIR / "chroma_db"

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# ─── Singletons ───────────────────────────────────────────────────────────────
_embedding_model = None
_chroma_client = None
_collection = None
_groq_client = None
_in_memory_corpus: List[Dict[str, Any]] = []


def get_embedding_model():
    """Load local embedding model or fall back to fast hash-based embedding."""
    global _embedding_model
    if _embedding_model is None:
        if HAS_SENTENCE_TRANSFORMERS and SentenceTransformer is not None:
            try:
                logger.info("Initializing SentenceTransformer (all-MiniLM-L6-v2)...")
                _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("✅ Embedding model loaded.")
            except Exception as e:
                logger.warning(f"SentenceTransformer load failed ({e}). Using fast TF-IDF fallback.")
                _embedding_model = "tfidf_fallback"
        else:
            _embedding_model = "tfidf_fallback"
    return _embedding_model


def _simple_embed(text: str, dim: int = 384) -> List[float]:
    """Fast deterministic TF-IDF / subword hash embedding (384-dimensional)."""
    vec = [0.0] * dim
    words = str(text).lower().replace("-", " ").replace("_", " ").split()
    for word in words:
        if len(word) < 2:
            continue
        h1 = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
        h2 = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
        vec[h1 % dim] += 1.5
        vec[h2 % dim] += 1.0
        # 3-gram subwords for fuzzy match
        for i in range(len(word) - 2):
            sub = word[i:i+3]
            h_sub = int(hashlib.md5(sub.encode("utf-8")).hexdigest(), 16)
            vec[h_sub % dim] += 0.5

    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def embed(text: str) -> List[float]:
    if not text or not str(text).strip():
        return [0.0] * 384
    model_obj: Any = get_embedding_model()
    if model_obj == "tfidf_fallback":
        return _simple_embed(text)
    try:
        encoded = model_obj.encode(str(text))
        tolist_fn = getattr(encoded, "tolist", None)
        if callable(tolist_fn):
            raw = tolist_fn()
            if isinstance(raw, (list, tuple)):
                return [float(x) for x in raw]
        if isinstance(encoded, (list, tuple)):
            return [float(x) for x in encoded]
        return _simple_embed(text)
    except Exception:
        return _simple_embed(text)


def embed_batch(texts: List[str], batch_size: int = 32) -> List[List[float]]:
    """Embed a list of text strings in fast vectorized batches."""
    if not texts:
        return []
    clean_texts = [str(t) if t and str(t).strip() else " " for t in texts]
    model_obj: Any = get_embedding_model()
    if model_obj == "tfidf_fallback":
        return [_simple_embed(t) for t in clean_texts]
    try:
        encoded = model_obj.encode(clean_texts, batch_size=batch_size, show_progress_bar=False)
        tolist_fn = getattr(encoded, "tolist", None)
        if callable(tolist_fn):
            raw = tolist_fn()
            if isinstance(raw, (list, tuple)):
                return [[float(x) for x in item] for item in raw]
        if isinstance(encoded, (list, tuple)):
            return [[float(x) for x in item] for item in encoded]
        return [_simple_embed(t) for t in clean_texts]
    except Exception as e:
        logger.warning(f"Batch embedding failed ({e}), using TF-IDF fallback.")
        return [_simple_embed(t) for t in clean_texts]


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        if chromadb is None or Settings is None:
            raise RuntimeError("ChromaDB is not installed.")
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False)
        )
    return _chroma_client


def get_chroma_collection():
    global _collection
    client = get_chroma_client()
    try:
        _collection = client.get_or_create_collection(
            name="bis_standards",
            metadata={"hnsw:space": "cosine"}
        )
    except Exception:
        _collection = client.get_collection("bis_standards")
    return _collection


def reset_chroma_collection():
    """Reset and recreate the 'bis_standards' ChromaDB collection."""
    global _collection
    client = get_chroma_client()
    try:
        client.delete_collection("bis_standards")
        logger.info("Purged older collection 'bis_standards'.")
    except Exception:
        pass
    _collection = client.get_or_create_collection(
        name="bis_standards",
        metadata={"hnsw:space": "cosine"}
    )
    return _collection


def get_groq_client():
    global _groq_client
    if _groq_client is None:
        key = os.getenv("GROQ_API_KEY") or GROQ_API_KEY
        if not key:
            raise RuntimeError("GROQ_API_KEY missing. Please configure .env file.")
        if not HAS_GROQ or Groq is None:
            raise RuntimeError("groq library is not installed.")
        _groq_client = Groq(api_key=key)
        logger.info("Groq client ready.")
    return _groq_client


# ─── Dataset Ingestion ────────────────────────────────────────────────────────
def ingest_all_datasets(force_reingest: bool = False):
    """
    Ingests all 6 datasets in fast vectorized batches:
    1. Standards (52+ Indian Standards)
    2. Manufacturer FAQs (35 items)
    3. Consumer FAQs (28 items)
    4. Student FAQs (25 items)
    5. Certification Schemes (7 schemes)
    6. BIS 2026 Services (30 services)
    """
    global _in_memory_corpus

    if not force_reingest and len(_in_memory_corpus) >= 130:
        logger.info(f"Knowledge base already has {len(_in_memory_corpus)} items. Skipping ingestion.")
        return

    logger.info("Ingesting comprehensive BIS datasets...")
    ids: List[str] = []
    docs: List[str] = []
    metadatas: List[Dict[str, Any]] = []

    # 1. Ingest Standards
    standards_file = DATA_DIR / "standards.json"
    if standards_file.exists():
        with open(standards_file, "r", encoding="utf-8") as f:
            standards = json.load(f)
        for std in standards:
            blob = (
                f"Standard: {std.get('number', std['id'])} — {std['title']}. "
                f"Category: {std.get('category', 'General')}. "
                f"Scope: {std.get('scope', '')}. "
                f"Summary: {std.get('summary', '')}. "
                f"Certification Scheme: {std.get('certification_scheme', 'ISI Mark')}. "
                f"Keywords: {', '.join(std.get('keywords', []))}."
            )
            doc_id = f"STD-{std['id']}"
            ids.append(doc_id)
            docs.append(blob)
            metadatas.append({
                "id": std["id"],
                "number": std.get("number", std["id"]),
                "title": std["title"],
                "category": std.get("category", "General"),
                "certification_scheme": std.get("certification_scheme", "ISI Mark"),
                "type": "standard",
                "role": "all"
            })
        logger.info(f"Loaded {len(standards)} standards.")

    # 2. Ingest Manufacturer FAQs
    mfr_faq_file = DATA_DIR / "manufacturer_faq.json"
    if mfr_faq_file.exists():
        with open(mfr_faq_file, "r", encoding="utf-8") as f:
            mfr_faqs = json.load(f)
        for item in mfr_faqs:
            blob = (
                f"[Manufacturer & MSME Certification Guidance - {item.get('category', 'General')}]\n"
                f"Question: {item['question']}\n"
                f"Answer: {item['answer']}"
            )
            doc_id = f"FAQ-MFR-{item['id']}"
            ids.append(doc_id)
            docs.append(blob)
            metadatas.append({
                "id": item["id"],
                "number": item["id"],
                "title": item["question"],
                "category": item.get("category", "Manufacturer FAQ"),
                "certification_scheme": "Manufacturer / MSME",
                "type": "faq",
                "role": "manufacturer"
            })
        logger.info(f"Loaded {len(mfr_faqs)} manufacturer FAQs.")

    # 3. Ingest Consumer FAQs
    con_faq_file = DATA_DIR / "consumer_faq.json"
    if con_faq_file.exists():
        with open(con_faq_file, "r", encoding="utf-8") as f:
            con_faqs = json.load(f)
        for item in con_faqs:
            blob = (
                f"[Consumer Rights & ISI / Hallmarking Verification - {item.get('category', 'General')}]\n"
                f"Question: {item['question']}\n"
                f"Answer: {item['answer']}"
            )
            doc_id = f"FAQ-CON-{item['id']}"
            ids.append(doc_id)
            docs.append(blob)
            metadatas.append({
                "id": item["id"],
                "number": item["id"],
                "title": item["question"],
                "category": item.get("category", "Consumer FAQ"),
                "certification_scheme": "Consumer",
                "type": "faq",
                "role": "consumer"
            })
        logger.info(f"Loaded {len(con_faqs)} consumer FAQs.")

    # 4. Ingest Student FAQs
    stu_faq_file = DATA_DIR / "student_faq.json"
    if stu_faq_file.exists():
        with open(stu_faq_file, "r", encoding="utf-8") as f:
            stu_faqs = json.load(f)
        for item in stu_faqs:
            blob = (
                f"[BIS Academic, Career & Institutional Knowledge - {item.get('category', 'General')}]\n"
                f"Question: {item['question']}\n"
                f"Answer: {item['answer']}"
            )
            doc_id = f"FAQ-STU-{item['id']}"
            ids.append(doc_id)
            docs.append(blob)
            metadatas.append({
                "id": item["id"],
                "number": item["id"],
                "title": item["question"],
                "category": item.get("category", "Student FAQ"),
                "certification_scheme": "Student / Academia",
                "type": "faq",
                "role": "student"
            })
        logger.info(f"Loaded {len(stu_faqs)} student FAQs.")

    # 5. Ingest Certification Schemes
    schemes_file = DATA_DIR / "schemes.json"
    if schemes_file.exists():
        with open(schemes_file, "r", encoding="utf-8") as f:
            schemes_data = json.load(f)
        schemes_list = schemes_data.values() if isinstance(schemes_data, dict) else schemes_data
        for s in schemes_list:
            steps_text = " | ".join([
                str(st.get("description") or st.get("title") or "") if isinstance(st, dict) else str(st)
                for st in s.get("steps", [])
            ])
            blob = (
                f"[BIS Certification Scheme: {s.get('name', s.get('id', ''))}]\n"
                f"Description: {s.get('description', '')}\n"
                f"Applicable Products: {s.get('applicable_products', '')}\n"
                f"Duration: {s.get('typical_duration', '')}\n"
                f"Legal Basis: {s.get('legal_basis', '')}\n"
                f"Step-by-Step Procedure: {steps_text}"
            )
            doc_id = f"SCHEME-{s.get('id', '')}"
            ids.append(doc_id)
            docs.append(blob)
            metadatas.append({
                "id": s.get("id", ""),
                "number": s.get("short", s.get("id", "").upper()),
                "title": s.get("name", ""),
                "category": "Certification Scheme",
                "certification_scheme": s.get("name", ""),
                "type": "scheme",
                "role": "all"
            })
        logger.info(f"Loaded {len(schemes_list)} certification schemes.")

    # 6. Ingest 2026 BIS Services Dataset
    services_file = DATA_DIR / "bis_services.json"
    if services_file.exists():
        with open(services_file, "r", encoding="utf-8") as f:
            services_data = json.load(f)
        srv_list = services_data.get("services", []) if isinstance(services_data, dict) else services_data
        for srv in srv_list:
            blob = (
                f"[BIS Service 2026: {srv.get('service_category', '')} — {srv.get('service_subcategory', '')}]\n"
                f"Description: {srv.get('description', '')}\n"
                f"Governing Act: {srv.get('governing_act', 'BIS Act 2016')}\n"
                f"Target Users: {srv.get('target_users', '')}\n"
                f"Key Features: {srv.get('key_features', '')}\n"
                f"Additional Details: {srv.get('additional_details', '')}\n"
                f"Contact Point: {srv.get('contact_point', '')}\n"
                f"2025/2026 Update & Statistics: {srv.get('update_2025', '')} | {srv.get('real_data_statistics', '')}"
            )
            doc_id = f"SRV-{srv.get('id', srv.get('service_subcategory', ''))}"
            ids.append(doc_id)
            docs.append(blob)
            metadatas.append({
                "id": srv.get("id", ""),
                "number": srv.get("id", srv.get("service_subcategory", "")),
                "title": f"{srv.get('service_category', '')} — {srv.get('service_subcategory', '')}",
                "category": srv.get("service_category", "BIS Service"),
                "certification_scheme": srv.get("service_category", "BIS Service"),
                "type": "service",
                "role": "all"
            })
        logger.info(f"Loaded {len(srv_list)} BIS 2026 services.")

    if ids:
        logger.info(f"Generating batch embeddings for {len(docs)} documents...")
        embeddings = embed_batch(docs, batch_size=32)
        _in_memory_corpus = [
            {"id": ids[i], "doc": docs[i], "metadata": metadatas[i], "embedding": embeddings[i]}
            for i in range(len(ids))
        ]
        try:
            collection = get_chroma_collection()
            cast(Any, collection).upsert(
                ids=ids,
                documents=docs,
                embeddings=cast(Any, embeddings),
                metadatas=cast(Any, metadatas)
            )
            logger.info(f"✅ Successfully indexed {len(ids)} knowledge chunks into ChromaDB (Total: {collection.count()}).")
        except Exception as e:
            logger.info(f"✅ Indexed {len(_in_memory_corpus)} knowledge chunks into in-memory vector store ({e}).")


# Backward compatibility alias
def ingest_standards():
    ingest_all_datasets(force_reingest=False)


# ─── Retrieval ────────────────────────────────────────────────────────────────
def retrieve(query: str, top_k: int = 5, role_filter: Optional[str] = None) -> List[Dict]:
    """Retrieve the most relevant knowledge items (standards, FAQs, schemes) for a query."""
    q_emb = embed(query)

    # Try ChromaDB first if available
    try:
        collection = get_chroma_collection()
        count = collection.count()
        if count == 0:
            ingest_all_datasets()
            count = collection.count()

        if count > 0:
            n_res = max(1, min(top_k, count))
            kwargs: Dict[str, Any] = {
                "query_embeddings": [q_emb],
                "n_results": n_res,
                "include": ["documents", "metadatas", "distances"]
            }
            results = cast(Any, collection).query(**kwargs)
            out = []
            if results and results.get("ids") and len(results["ids"]) > 0:
                ids_group = results["ids"][0]
                distances_group = results.get("distances") or [[]]
                metadatas_group = results.get("metadatas") or [[]]
                documents_group = results.get("documents") or [[]]
                for i in range(len(ids_group)):
                    dist = distances_group[0][i] if len(distances_group[0]) > i else 0.0
                    confidence = max(0, min(100, round((1.0 - (dist / 2.0)) * 100)))
                    meta = metadatas_group[0][i] if (len(metadatas_group[0]) > i and metadatas_group[0][i]) else {}
                    item_role = meta.get("role", "all") if isinstance(meta, dict) else "all"
                    if role_filter and role_filter != "all" and item_role not in (role_filter, "all"):
                        continue
                    doc_text = documents_group[0][i] if len(documents_group[0]) > i else ""
                    out.append({
                        "id": meta.get("id", "") if isinstance(meta, dict) else "",
                        "number": meta.get("number", meta.get("id", "")) if isinstance(meta, dict) else "",
                        "title": meta.get("title", "") if isinstance(meta, dict) else "",
                        "category": meta.get("category", "") if isinstance(meta, dict) else "",
                        "certification_scheme": meta.get("certification_scheme", "") if isinstance(meta, dict) else "",
                        "type": meta.get("type", "standard") if isinstance(meta, dict) else "standard",
                        "confidence": confidence,
                        "text": doc_text,
                    })
            if out:
                return out
    except Exception:
        pass

    # In-memory vector similarity fallback
    if not _in_memory_corpus:
        ingest_all_datasets()

    scored = []
    for item in _in_memory_corpus:
        meta = item["metadata"]
        item_role = meta.get("role", "all") if isinstance(meta, dict) else "all"
        if role_filter and role_filter != "all" and item_role not in (role_filter, "all"):
            continue
        v1 = q_emb
        v2 = item["embedding"]
        dot = sum(a * b for a, b in zip(v1, v2))
        norm1 = math.sqrt(sum(a * a for a in v1)) or 1.0
        norm2 = math.sqrt(sum(b * b for b in v2)) or 1.0
        sim = dot / (norm1 * norm2)
        confidence = max(0, min(100, round(sim * 100)))
        scored.append((confidence, item))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_items = scored[:top_k]
    return [
        {
            "id": it["metadata"].get("id", ""),
            "number": it["metadata"].get("number", it["metadata"].get("id", "")),
            "title": it["metadata"].get("title", ""),
            "category": it["metadata"].get("category", ""),
            "certification_scheme": it["metadata"].get("certification_scheme", ""),
            "type": it["metadata"].get("type", "standard"),
            "confidence": conf,
            "text": it["doc"],
        }
        for conf, it in top_items
    ]


# Aliases for different components
def retrieve_relevant_standards(query: str, top_k: int = 4) -> List[Dict]:
    return retrieve(query, top_k=top_k)


def retrieve_relevant_chunks(query: str, top_k: int = 5) -> List[Dict]:
    return retrieve(query, top_k=top_k)


# ─── System Prompt ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are BIS Assistant AI — the authoritative official domain assistant for the Bureau of Indian Standards (BIS), Ministry of Consumer Affairs, Food & Public Distribution, Government of India.

Your mission is to provide 100% accurate, precise, and practical guidance to MSMEs, manufacturers, importers, consumers, researchers, and students based on the official BIS datasets and Indian Standards (IS).

STRICT ANSWERING GUIDELINES:
1. CITATIONS & ACCURACY:
   - Always cite exact IS Standard numbers (e.g., IS 302, IS 2347, IS 16102, IS 15410, IS 1417, IS 2062, IS 1239, etc.) whenever applicable.
   - Mention the applicable certification scheme (e.g., ISI Mark Scheme-I, CRS Scheme-II, Hallmarking Scheme-IV, FMCS).
   - Use the retrieved context as the primary source of truth.

2. FOR MANUFACTURERS & APPLICANTS:
   - Detail the exact step-by-step procedure: online application via Manak Online (manakonline.in), submission of test reports from BIS-recognized labs, factory audit by BIS officers, sample verification, and license grant.
   - Clearly state requirements for Quality Control Orders (QCOs), documentation (Form V), factory lab testing, and foreign manufacturers (FMCS).

3. FOR CONSUMERS:
   - Explain how to verify authenticity using the free BIS CARE Mobile App (Android/iOS) via "Verify License Details" or HUID (6-character alphanumeric code for gold hallmarking).
   - Guide them on identifying fake ISI marks (must have CM/L license number and IS standard number).
   - Provide the official grievance redressal channels: BIS National Toll-Free Helpline (1800-11-4070), bis.gov.in/complaint, or the BIS CARE app.

4. FOR STUDENTS & GENERAL PUBLIC:
   - Explain BIS's founding under the BIS Act 2016, national role in ISO/IEC international committees, BIS Standards Clubs in colleges/schools, internships, and educational portals.

5. FORMATTING & TONE:
   - Provide ONLY the direct, clear, and professional answer.
   - Do NOT include internal thoughts, thinking process, analysis headers, or planning steps.
   - Avoid generic fluff; give actionable, accurate details."""


def _clean_llm_response(text: str) -> str:
    """Strip reasoning artifacts, think blocks, and draft markers from LLM output."""
    if not text:
        return ""
        
    # 1. Standard think tags
    if "</think>" in text:
        text = text.split("</think>")[-1].strip()
    elif "<think>" in text:
        text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE)
        if "<think>" in text:
            parts = text.split("<think>")
            text = parts[0].strip() or parts[-1].strip()
            
    # 2. Check for explicit final answer marker
    final_markers = [
        r'[\*#_]*\s*Final Answer\s*[\*#_]*[:\s\*]*',
        r'[\*#_]*\s*Official Response\s*[\*#_]*[:\s\*]*',
        r'[\*#_]*\s*Final Response\s*[\*#_]*[:\s\*]*',
        r'[\*#_]*\s*Direct Answer\s*[\*#_]*[:\s\*]*',
        r'^\s*[\*#_]*\s*Answer\s*[\*#_]*[:\s\*]*',
    ]
    for m in final_markers:
        match = re.search(m, text, flags=re.IGNORECASE)
        if match:
            text = text[match.end():].strip()
            break

    # 3. Strip leading thinking intros
    text = re.sub(r'^(?:Here\'?s (?:a )?(?:thinking |step-by-step |quick )?process:?|Thinking Process:?|Thought:?)\s*', '', text, flags=re.IGNORECASE).strip()

    # 4. Strip repeated numbered analysis blocks
    while True:
        m = re.match(
            r'^(?:[0-9]+\.\s*[\*#_]*(?:Analyze|Analysis|Understand|Identify|Formulate|Review|Extract|Determine|Evaluate|Draft)[^*#_\n]*[\*#_]*[\s\S]*?(?=\n\s*(?:[0-9]+\.\s*[\*#_]*|[A-Z]|\Z)))',
            text,
            flags=re.IGNORECASE
        )
        if m:
            text = text[m.end():].strip()
        else:
            break

    return text.strip()


# ─── LLM Generation ───────────────────────────────────────────────────────────
async def generate_rag_answer(query: str, language: str = "en", role: Optional[str] = None) -> Dict:
    t0 = time.time()

    # 1. Translate query to English if needed
    en_query = translate_to_english(query, language)
    logger.info(f"RAG query (EN) [role={role}]: '{en_query[:80]}...'")

    # Determine role filter and prompt specialization
    role_filter = None
    role_instruction = ""
    if role:
        r_clean = role.lower().strip()
        if r_clean in ("consumer", "consumer_protection"):
            role_filter = "consumer"
            role_instruction = (
                "You are acting strictly as the dedicated Consumer Protection AI Agent for BIS. "
                "Focus directly on consumer rights, product authenticity verification (ISI mark CM/L checking, HUID gold hallmarking), "
                "identifying fake ISI marks, and filing grievances/complaints with BIS (National Helpline 1800-11-4070 or BIS CARE App). "
                "Do not discuss manufacturer licensing procedures unless explicitly asked."
            )
        elif r_clean in ("manufacturer", "msme"):
            role_filter = "manufacturer"
            role_instruction = (
                "You are acting strictly as the dedicated Manufacturer & MSME Licensing AI Agent for BIS. "
                "Focus directly on manufacturer application procedures, Form V documentation, factory audits, "
                "laboratory sample testing, Quality Control Orders (QCOs), and FMCS foreign manufacturer licensing."
            )
        elif r_clean in ("student", "helper", "researcher", "academic"):
            role_filter = "student"
            role_instruction = (
                "You are acting strictly as the dedicated Helper & Research AI Agent for BIS. "
                "Focus directly on Indian Standards formulation across 17 technical divisions, the BIS Act 2016, "
                "ISO/IEC international technical committees, Standards Clubs in schools and colleges, academic research, and internships."
            )

    # 2. Retrieve top-k context across relevant datasets
    retrieved = retrieve(en_query, top_k=6, role_filter=role_filter)
    if not retrieved and role_filter:
        retrieved = retrieve(en_query, top_k=6)

    # 3. Format context
    if retrieved:
        context_blocks = []
        for r in retrieved:
            context_blocks.append(f"[{r.get('type', 'Item').upper()}: {r['number']} — {r['title']}]\n{r['text']}")
        context = "\n\n---\n\n".join(context_blocks)
    else:
        context = "No specific match found in database."

    # 4. Generate answer using Groq
    answer_en = None
    last_err = None
    try:
        groq = get_groq_client()
    except Exception as g_err:
        groq = None
        last_err = g_err

    if groq:
        groq_any: Any = groq
        candidate_models = [
            "qwen/qwen3.8-27b",
            "openai/gpt-oss-120b",
            "qwen/qwen3.6-27b",
            "openai/gpt-oss-20b",
        ]

        sys_prompt = SYSTEM_PROMPT
        if role_instruction:
            sys_prompt = f"{SYSTEM_PROMPT}\n\nSPECIALIZED AGENT DIRECTIVE:\n{role_instruction}"

        for model_name in candidate_models:
            try:
                completion = groq_any.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": (
                            f"Official BIS Knowledge Context:\n{context}\n\n"
                            f"User Question: {en_query}\n\n"
                            f"Provide a clear, accurate, and structured answer directly citing specific IS standards, portal steps, and verification procedures where applicable. Do NOT output thinking steps:"
                        )}
                    ],
                    temperature=0.2,
                    max_tokens=2048,
                )
                raw_text = completion.choices[0].message.content or ""
                cleaned = _clean_llm_response(raw_text)
                answer_en = cleaned or raw_text.strip()
                if answer_en:
                    break
            except Exception as e:
                logger.warning(f"Model {model_name} failed: {e}. Trying next model...")
                last_err = e

    if not answer_en:
        if retrieved:
            top = retrieved[0]
            answer_en = (
                f"Based on official BIS records:\n\n"
                f"**Standard / Reference**: {top.get('number', '')} — {top.get('title', '')}\n"
                f"**Category / Scheme**: {top.get('category', '')} ({top.get('certification_scheme', 'ISI Mark')})\n\n"
                f"{top.get('text', '')}\n\n"
                f"For official verification and application submission, visit the BIS Manak Online portal (https://www.manakonline.in) or call the National Toll-Free Helpline (1800-11-4070)."
            )
        else:
            logger.error(f"All Groq models failed: {last_err}")
            raise RuntimeError(f"AI service unavailable: {last_err}")

    # 5. Translate back to requested language
    final_answer = translate_from_english(answer_en, language)

    elapsed = round(time.time() - t0, 2)
    logger.info(f"RAG generation complete in {elapsed}s")

    # Filter sources to unique top standards/faqs
    sources = []
    seen_ids = set()
    for r in retrieved:
        if r["id"] not in seen_ids and r["confidence"] > 30:
            seen_ids.add(r["id"])
            sources.append({
                "id": r["id"],
                "title": f"{r['number']} — {r['title']}" if r.get("number") and r["number"] != r["title"] else r["title"],
                "category": r.get("category", ""),
                "confidence": r["confidence"]
            })

    return {
        "answer": final_answer,
        "sources": sources[:4],
        "response_time_s": elapsed,
    }


def answer_query(query: str, top_k: int = 5, role: Optional[str] = None) -> Dict:
    """Synchronous helper for standalone scripts."""
    import asyncio
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, generate_rag_answer(query, "en", role=role)).result()
    else:
        return asyncio.run(generate_rag_answer(query, "en", role=role))


if __name__ == "__main__":
    print("Ingesting all datasets into ChromaDB...")
    ingest_all_datasets(force_reingest=True)
    collection = get_chroma_collection()
    print(f"Total items in ChromaDB: {collection.count()}")

    test_queries = [
        "What is the IS standard for domestic pressure cookers?",
        "How do I check if an ISI mark is genuine?",
        "What is the application process for foreign manufacturers under FMCS?",
        "What is the role of BIS in international standards like ISO and IEC?"
    ]
    for q in test_queries:
        print(f"\n--- Query: {q} ---")
        res = answer_query(q)
        print(f"Answer: {res['answer'][:250]}...")
        print(f"Sources: {res['sources']}")
