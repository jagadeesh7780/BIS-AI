"""
BIS AI V2 — Evaluation Framework
STEP 18/19: Real evaluation metrics computed from actual retrieval execution.
Metrics: Hit@K, Recall@K, MRR, Citation Coverage, Retrieval Latency.

⚠️ DEVELOPMENT EVALUATION DATA — NOT OFFICIAL BIS BENCHMARKS
All test cases are manually curated for development testing only.
"""

import json
import logging
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("bis.eval")

EVAL_DATASET_PATH = Path(__file__).parent / "eval_dataset.json"


def _load_eval_dataset() -> list[dict[str, Any]]:
    if not EVAL_DATASET_PATH.exists():
        logger.warning("eval_dataset.json not found.")
        return []
    with open(EVAL_DATASET_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("test_cases", []) if isinstance(data, dict) else data


def _hit_at_k(retrieved_ids: list[str], expected_ids: list[str], k: int) -> float:
    """1 if any expected ID appears in top-K retrieved, else 0."""
    top_k = set(retrieved_ids[:k])
    return 1.0 if any(eid in top_k for eid in expected_ids) else 0.0


def _recall_at_k(retrieved_ids: list[str], expected_ids: list[str], k: int) -> float:
    """Fraction of expected IDs found in top-K."""
    if not expected_ids:
        return 0.0
    top_k = set(retrieved_ids[:k])
    found = sum(1 for eid in expected_ids if eid in top_k)
    return found / len(expected_ids)


def _reciprocal_rank(retrieved_ids: list[str], expected_ids: list[str]) -> float:
    """1/rank of first relevant result. 0 if none found."""
    for rank, rid in enumerate(retrieved_ids, start=1):
        if rid in expected_ids:
            return 1.0 / rank
    return 0.0


def _citation_coverage(result: dict[str, Any]) -> float:
    """Fraction of answer citations that have a standard_number."""
    citations = result.get("citations", [])
    if not citations:
        return 0.0
    with_number = sum(1 for c in citations if c.get("standard_number") or c.get("standard_number") != "")
    return with_number / len(citations)


def run_eval() -> dict[str, Any]:
    """
    Run evaluation on the dev test dataset.
    Returns actual computed metrics.
    ⚠️ DEVELOPMENT EVALUATION DATA — NOT OFFICIAL BIS BENCHMARKS
    """
    from rag import classify_intent, hybrid_retrieve

    test_cases = _load_eval_dataset()
    if not test_cases:
        return {
            "error": "No test cases found in eval_dataset.json",
            "label": "DEVELOPMENT EVALUATION DATA — NOT OFFICIAL BIS BENCHMARKS",
        }

    hit1_scores:    list[float] = []
    hit3_scores:    list[float] = []
    hit5_scores:    list[float] = []
    mrr_scores:     list[float] = []
    recall5_scores: list[float] = []
    cit_scores:     list[float] = []
    latencies:      list[float] = []
    intent_correct: list[int]   = []

    for tc in test_cases:
        query        = tc.get("query", "")
        expected_ids = tc.get("expected_standard_ids", [])
        expected_agent = tc.get("expected_agent", "")

        if not query:
            continue

        # Intent classification
        if expected_agent:
            predicted = classify_intent(query)
            intent_correct.append(1 if predicted == expected_agent else 0)

        # Retrieval with latency measurement
        t_start = time.time()
        try:
            retrieved = hybrid_retrieve(query, top_k=5)
        except Exception as e:
            logger.warning(f"Retrieval failed for '{query[:50]}': {e}")
            retrieved = []
        latency_ms = (time.time() - t_start) * 1000
        latencies.append(latency_ms)

        retrieved_ids = []
        for r in retrieved:
            cid = r.get("chunk_id", r.get("id", ""))
            std_num = r.get("standard_number", r.get("number", ""))
            retrieved_ids.append(cid)
            if std_num:
                retrieved_ids.append(std_num)
                # Also add cleaned version (no spaces/dashes)
                retrieved_ids.append(std_num.replace(" ", "").replace("-", "").lower())

        # Normalize expected IDs for flexible matching
        norm_expected = []
        for eid in expected_ids:
            norm_expected.append(eid)
            norm_expected.append(eid.replace(" ", "").replace("-", "").lower())

        hit1_scores.append(_hit_at_k(retrieved_ids, norm_expected, 1))
        hit3_scores.append(_hit_at_k(retrieved_ids, norm_expected, 3))
        hit5_scores.append(_hit_at_k(retrieved_ids, norm_expected, 5))
        mrr_scores.append(_reciprocal_rank(retrieved_ids, norm_expected))
        recall5_scores.append(_recall_at_k(retrieved_ids, norm_expected, 5))

        # Citation coverage (use mock since we don't run LLM in eval)
        fake_result = {"citations": [
            {"standard_number": r.get("standard_number", "")} for r in retrieved
        ]}
        cit_scores.append(_citation_coverage(fake_result))

    def avg(lst):
        return round(sum(lst) / len(lst), 4) if lst else 0.0

    n = len(hit1_scores)
    return {
        "label":                  "DEVELOPMENT EVALUATION DATA — NOT OFFICIAL BIS BENCHMARKS",
        "total_queries":          n,
        "hit_at_1":               avg(hit1_scores),
        "hit_at_3":               avg(hit3_scores),
        "hit_at_5":               avg(hit5_scores),
        "mrr":                    avg(mrr_scores),
        "recall_at_5":            avg(recall5_scores),
        "citation_coverage":      avg(cit_scores),
        "avg_retrieval_latency_ms": avg(latencies),
        "intent_accuracy":        avg([float(x) for x in intent_correct]) if intent_correct else None,
        "note": (
            "Metrics computed from actual retrieval execution on dev test set. "
            "All test cases are manually curated. "
            "These are NOT official BIS accuracy benchmarks."
        ),
    }


if __name__ == "__main__":
    result = run_eval()
    print(json.dumps(result, indent=2))
