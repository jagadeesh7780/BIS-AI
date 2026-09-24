"""
BIS AI V2 — RAG Unit Tests (STEP 17/20)
Tests: dense retrieval, BM25, hybrid, reranking, intent, citations, hallucination guard, trace_id.
Run: pytest tests/test_rag.py -v
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"] = "false"


# ── Fixtures ────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def ingested_corpus():
    """Ensure corpus is ingested before running retrieval tests."""
    from rag import _in_memory_corpus, ingest_all_datasets
    ingest_all_datasets(force_reingest=False)
    return _in_memory_corpus


# ── EMBEDDING TESTS ────────────────────────────────────────────────────────────

def test_embed_returns_384_dims():
    from rag import embed
    v = embed("IS standard for pressure cooker")
    assert len(v) == 384

def test_embed_empty_returns_zeros():
    from rag import embed
    v = embed("")
    assert len(v) == 384
    assert all(x == 0.0 for x in v)

def test_embed_batch():
    from rag import embed_batch
    texts = ["pressure cooker standard", "gold hallmarking HUID", "LED lamp CRS"]
    vecs = embed_batch(texts)
    assert len(vecs) == 3
    assert all(len(v) == 384 for v in vecs)


# ── STEP 4 FIX: CONFIDENCE FORMULA ────────────────────────────────────────────

def test_confidence_never_negative(ingested_corpus):
    from rag import _dense_retrieve
    results = _dense_retrieve("test query for confidence check", top_k=5)
    for r in results:
        assert r.get("confidence_score", 0.0) >= 0.0, "Confidence score must not be negative"

def test_confidence_never_over_100(ingested_corpus):
    from rag import _dense_retrieve
    results = _dense_retrieve("IS standard domestic pressure cooker", top_k=5)
    for r in results:
        cs = r.get("confidence_score", 0.0)
        assert cs <= 1.0, f"confidence_score {cs} exceeds 1.0 — formula is wrong"


# ── STEP 5: BM25 TESTS ────────────────────────────────────────────────────────

def test_bm25_returns_results_when_available(ingested_corpus):
    from rag import HAS_BM25, _bm25_index, _bm25_retrieve
    if not HAS_BM25 or _bm25_index is None:
        pytest.skip("BM25 not available")
    results = _bm25_retrieve("pressure cooker IS 2347 safety valve", top_k=5)
    assert len(results) > 0, "BM25 should return results for known query"

def test_bm25_results_have_required_fields(ingested_corpus):
    from rag import HAS_BM25, _bm25_index, _bm25_retrieve
    if not HAS_BM25 or _bm25_index is None:
        pytest.skip("BM25 not available")
    results = _bm25_retrieve("gold jewellery hallmark HUID", top_k=3)
    for r in results:
        assert "chunk_id" in r or "id" in r
        assert "text" in r
        assert "confidence_score" in r


# ── DENSE RETRIEVAL TESTS ──────────────────────────────────────────────────────

def test_dense_retrieval_returns_results(ingested_corpus):
    from rag import _dense_retrieve
    results = _dense_retrieve("IS standard for motorcycle helmet", top_k=5)
    assert len(results) > 0

def test_dense_retrieval_has_required_fields(ingested_corpus):
    from rag import _dense_retrieve
    results = _dense_retrieve("BIS certification for LED bulbs", top_k=3)
    required = ["chunk_id", "document_title", "standard_number", "source_url",
                "source_type", "authority", "text", "confidence_score"]
    for r in results:
        for field in required:
            assert field in r, f"Missing field '{field}' in dense retrieval result"

def test_dense_retrieval_authority_is_bis(ingested_corpus):
    from rag import _dense_retrieve
    results = _dense_retrieve("structural steel specification", top_k=3)
    for r in results:
        assert r.get("authority") == "BIS", "All chunks must have authority=BIS"


# ── STEP 6: HYBRID / RRF TESTS ────────────────────────────────────────────────

def test_hybrid_retrieve_returns_results(ingested_corpus):
    from rag import hybrid_retrieve
    results = hybrid_retrieve("pressure cooker safety IS standard", top_k=5)
    assert len(results) > 0

def test_hybrid_retrieve_better_than_chance(ingested_corpus):
    from rag import hybrid_retrieve
    results = hybrid_retrieve("IS 2347 domestic pressure cooker specification", top_k=3)
    assert len(results) > 0
    top = results[0]
    # Should find something related to pressure cooker or IS 2347
    text_content = (top.get("text", "") + top.get("document_title", "") + top.get("standard_number", "")).lower()
    assert any(kw in text_content for kw in ["pressure", "cooker", "2347", "kitchen"]), \
        f"Top result doesn't seem relevant. Got: {text_content[:200]}"

def test_rrf_fusion_deduplicates():
    from rag import _rrf_fusion
    dense = [{"chunk_id": "A", "text": "a"}, {"chunk_id": "B", "text": "b"}]
    bm25  = [{"chunk_id": "B", "text": "b"}, {"chunk_id": "C", "text": "c"}]
    fused = _rrf_fusion(dense, bm25)
    ids = [r["chunk_id"] for r in fused]
    assert len(ids) == len(set(ids)), "RRF fusion must deduplicate results"


# ── STEP 8: RERANKER TEST ──────────────────────────────────────────────────────

def test_rerank_preserves_all_items_or_top_k(ingested_corpus):
    from rag import hybrid_retrieve, rerank
    candidates = hybrid_retrieve("IS standard pressure cooker", top_k=8)
    reranked   = rerank("IS standard pressure cooker", candidates, top_k=5)
    assert len(reranked) <= min(5, len(candidates))

def test_rerank_does_not_crash_without_model():
    """Reranker must degrade gracefully if model unavailable."""
    from rag import rerank
    candidates = [
        {"chunk_id": "A", "text": "pressure cooker IS 2347", "confidence_score": 0.8},
        {"chunk_id": "B", "text": "gold hallmarking IS 1417", "confidence_score": 0.6},
    ]
    result = rerank("pressure cooker standard", candidates, top_k=2)
    assert len(result) >= 1


# ── STEP 9: INTENT CLASSIFIER ──────────────────────────────────────────────────

@pytest.mark.parametrize("query,expected_agent", [
    ("How to verify ISI mark using BIS CARE app?",             "consumer"),
    ("How to check HUID gold jewellery hallmark?",             "consumer"),
    ("What documents are needed for BIS certification Form V?","manufacturer"),
    ("How to apply for ISI mark on Manak Online portal?",      "manufacturer"),
    ("What IS standard applies to pressure cookers?",          "standards"),
    ("Tell me about IS 2062 structural steel scope",           "standards"),
    ("Is BIS certification mandatory under QCO?",              "compliance"),
    ("What penalty for non-certified products Section 29?",    "compliance"),
])
def test_intent_classifier(query, expected_agent):
    from rag import classify_intent
    predicted = classify_intent(query)
    assert predicted == expected_agent, \
        f"Intent mismatch for '{query}': expected={expected_agent}, got={predicted}"

def test_intent_role_hint_overrides():
    from rag import classify_intent
    # Even a standards-looking query should route to consumer if role hint is consumer
    predicted = classify_intent("What IS standard applies to toys?", role_hint="consumer")
    assert predicted == "consumer"


# ── STEP 7: CITATION SCHEMA ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_citations_have_required_fields(ingested_corpus):
    from rag import generate_rag_answer
    result = await generate_rag_answer("What IS standard applies to pressure cookers?", "en")
    citations = result.get("citations", [])
    assert len(citations) > 0, "Should have at least one citation"
    required = ["chunk_id", "document_title", "standard_number", "source_url",
                "source_type", "authority", "relevance_score"]
    for c in citations:
        for field in required:
            assert field in c, f"Citation missing field: {field}"

@pytest.mark.asyncio
async def test_citations_authority_is_bis(ingested_corpus):
    from rag import generate_rag_answer
    result = await generate_rag_answer("IS 15410 helmet specification", "en")
    for c in result.get("citations", []):
        assert c.get("authority") == "BIS"


# ── STEP 11: HALLUCINATION GUARD ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_hallucination_guard_on_nonsense_query():
    from rag import generate_rag_answer
    result = await generate_rag_answer(
        "xyzzy zork nonsense gibberish no real meaning at all qwerty123456",
        "en"
    )
    conf = result.get("confidence", {})
    # Either confidence should be insufficient OR the answer should mention "insufficient evidence"
    is_insufficient = (
        conf.get("level") in ("insufficient", "low")
        or "insufficient" in result.get("answer", "").lower()
        or "bis.gov.in" in result.get("answer", "").lower()
    )
    assert is_insufficient, \
        f"Hallucination guard failed: conf={conf}, answer={result.get('answer', '')[:100]}"


# ── STEP 12: TRACE_ID ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_trace_id_present(ingested_corpus):
    from rag import generate_rag_answer
    result = await generate_rag_answer("What is BIS?", "en")
    assert "trace_id" in result
    assert len(result["trace_id"]) > 0

@pytest.mark.asyncio
async def test_trace_id_unique_per_call(ingested_corpus):
    from rag import generate_rag_answer
    r1 = await generate_rag_answer("IS standard for helmets", "en")
    r2 = await generate_rag_answer("IS standard for helmets", "en")
    assert r1["trace_id"] != r2["trace_id"], "Each call must produce a unique trace_id"


# ── FULL RESPONSE SCHEMA ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_full_response_schema(ingested_corpus):
    from rag import generate_rag_answer
    result = await generate_rag_answer("What IS standard applies to LED bulbs?", "en")
    required_keys = ["answer", "agent", "confidence", "citations", "sources",
                     "next_steps", "trace_id", "response_time_s", "language"]
    for key in required_keys:
        assert key in result, f"Response missing required key: {key}"
    assert isinstance(result["answer"], str)
    assert isinstance(result["agent"], str)
    assert isinstance(result["confidence"], dict)
    assert "level" in result["confidence"]
    assert "score" in result["confidence"]
    assert isinstance(result["citations"], list)
    assert isinstance(result["next_steps"], list)
    assert result["response_time_s"] > 0


# ── Run with asyncio ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
