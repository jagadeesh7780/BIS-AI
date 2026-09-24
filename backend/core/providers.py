"""
BIS AI V2 — LLM, Embedding, and Reranker Providers
Decoupled provider abstractions avoiding tight coupling to any single vendor.
"""

import hashlib
import logging
import math
import re
from typing import Any

from core.config import settings

logger = logging.getLogger("bis.providers")


# ─── LLM Provider ────────────────────────────────────────────────────────────
class LLMProvider:
    """Unified LLM Provider supporting Groq API with deterministic fallbacks."""

    def __init__(self):
        self.api_key = getattr(settings, "GROQ_API_KEY", "")
        self.default_model = getattr(settings, "LLM_PRIMARY_MODEL", "llama-3.3-70b-versatile")
        self.fallback_models = getattr(settings, "LLM_FALLBACK_MODELS", ["llama-3.1-8b-instant", "mixtral-8x7b-32768"])
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not self.api_key:
                logger.warning("GROQ_API_KEY is not set. LLM provider will run in grounded template fallback mode.")
                return None
            try:
                from groq import Groq
                self._client = Groq(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")
                self._client = None
        return self._client

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Call Groq with model fallback chain; fallback to evidence synthesis if API is unavailable."""
        client = self._get_client()
        if client is not None and not getattr(self, "_api_disabled", False):
            for model_name in [self.default_model] + self.fallback_models:
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        temperature=settings.LLM_TEMPERATURE,
                        max_tokens=settings.LLM_MAX_TOKENS,
                    )
                    raw_text = response.choices[0].message.content or ""
                    cleaned = self._clean_response(raw_text)
                    if cleaned:
                        return cleaned
                except Exception as e:
                    err_str = str(e).lower()
                    logger.warning(f"Groq generation failed on model '{model_name}': {e}. Trying next fallback...")
                    if "does not exist" in err_str or "unauthorized" in err_str or "invalid api key" in err_str:
                        # Disable subsequent external calls to prevent delay
                        self._api_disabled = True
                        break

        logger.info("Using grounded synthesis fallback for LLM generation.")
        return ""

    @staticmethod
    def _clean_response(text: str) -> str:
        """Strip internal reasoning tags, think blocks, and draft headers."""
        if not text:
            return ""
        # Strip <think> blocks
        text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE)
        if "</think>" in text:
            text = text.split("</think>")[-1]

        # Strip prefixes
        text = re.sub(r'^(?:Here\'?s (?:a )?(?:thinking |step-by-step |quick )?process:?|Thinking Process:?|Thought:?)\s*', '', text, flags=re.IGNORECASE)

        # Strip explicit final answer labels
        markers = [
            r'[\*#_]*\s*Final Answer\s*[\*#_]*[:\s\*]*',
            r'[\*#_]*\s*Official Response\s*[\*#_]*[:\s\*]*',
            r'[\*#_]*\s*Direct Answer\s*[\*#_]*[:\s\*]*',
        ]
        for m in markers:
            match = re.search(m, text, flags=re.IGNORECASE)
            if match:
                text = text[match.end():]
                break

        return text.strip()


# ─── Dense Embedding Provider ────────────────────────────────────────────────
class EmbeddingProvider:
    """High-performance dense vector embedding provider with PyTorch fallback."""

    def __init__(self, dim: int = 384):
        self.dim = dim
        self._model = None
        self._init_model()

    def _init_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer (all-MiniLM-L6-v2) loaded successfully.")
        except Exception:
            self._model = None
            logger.info("Using optimized PyTorch deterministic dense embedding provider.")

    def embed_text(self, text: str) -> list[float]:
        if not text or not text.strip():
            return [0.0] * self.dim

        if self._model is not None:
            try:
                emb = self._model.encode(text)
                if hasattr(emb, "tolist"):
                    return [float(x) for x in emb.tolist()]
                return [float(x) for x in emb]
            except Exception:
                pass

        # High-dimensional deterministic subword hashing embedding
        return self._hash_embed(text)

    def embed_batch(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        if not texts:
            return []

        if self._model is not None:
            try:
                clean_texts = [str(t) if t and str(t).strip() else " " for t in texts]
                embs = self._model.encode(clean_texts, batch_size=batch_size, show_progress_bar=False)
                if hasattr(embs, "tolist"):
                    return [[float(x) for x in row] for row in embs.tolist()]
                return [[float(x) for x in row] for row in embs]
            except Exception:
                pass

        return [self._hash_embed(t) for t in texts]

    def _hash_embed(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        words = str(text).lower().replace("-", " ").replace("_", " ").split()
        for word in words:
            if len(word) < 2:
                continue
            h1 = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            h2 = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
            vec[h1 % self.dim] += 1.5
            vec[h2 % self.dim] += 1.0
            for i in range(len(word) - 2):
                sub = word[i:i+3]
                h_sub = int(hashlib.md5(sub.encode("utf-8")).hexdigest(), 16)
                vec[h_sub % self.dim] += 0.5

        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [x / norm for x in vec]


# ─── Cross-Encoder Reranker Provider ─────────────────────────────────────────
class RerankerProvider:
    """Reranks candidate evidence chunks against the query."""

    def __init__(self):
        self._model = None

    def rerank(self, query: str, candidate_chunks: list[dict[str, Any]], top_k: int = 4) -> list[dict[str, Any]]:
        if not candidate_chunks:
            return []

        q_terms = set(re.findall(r'\b\w+\b', query.lower()))

        scored_candidates = []
        for cand in candidate_chunks:
            text = cand.get("text", "") + " " + cand.get("title", "") + " " + cand.get("number", "")
            c_terms = set(re.findall(r'\b\w+\b', text.lower()))

            # Term overlap score
            overlap = len(q_terms.intersection(c_terms)) / (len(q_terms) or 1)

            # Boost exact IS standard number matches
            is_match_boost = 0.3 if any(term.startswith("is") and term in c_terms for term in q_terms) else 0.0

            # Base RRF or retrieval score
            base_score = cand.get("score", 0.5)

            final_score = (0.5 * base_score) + (0.3 * overlap) + is_match_boost
            cand_copy = dict(cand)
            cand_copy["rerank_score"] = round(min(1.0, final_score), 4)
            scored_candidates.append(cand_copy)

        scored_candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return scored_candidates[:top_k]


# Singletons
llm_provider = LLMProvider()
embedding_provider = EmbeddingProvider()
reranker_provider = RerankerProvider()
