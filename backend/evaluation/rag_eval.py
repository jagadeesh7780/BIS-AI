"""
BIS AI V2 — Evaluation Framework for Hybrid RAG Engine
Computes REAL execution metrics on DEVELOPMENT EVALUATION DATA:
  - Hit@1, Hit@3, Hit@5
  - Mean Reciprocal Rank (MRR)
  - Citation Coverage
  - Mean Retrieval Latency (ms)
No fabricated numbers.
"""

import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag import hybrid_retrieve, index_knowledge_base

logger = logging.getLogger("bis.eval")

# DEVELOPMENT EVALUATION DATA — NOT OFFICIAL BIS BENCHMARK
EVALUATION_DATASET: list[dict[str, Any]] = [
    {
        "query": "What Indian Standard specifies domestic pressure cookers and safety relief valves?",
        "expected_standard": "IS 2347",
        "expected_keywords": ["pressure cooker", "valve", "hydrostatic"],
        "category": "Mechanical / Kitchenware"
    },
    {
        "query": "Which BIS standard governs protective helmets for two-wheeler motorcycle riders?",
        "expected_standard": "IS 15410",
        "expected_keywords": ["helmet", "impact", "retention"],
        "category": "PPE"
    },
    {
        "query": "What standard prescribes microbiological and heavy metal limits for packaged drinking water?",
        "expected_standard": "IS 14543",
        "expected_keywords": ["packaged drinking water", "coliform", "reverse osmosis"],
        "category": "Food & Water"
    },
    {
        "query": "What is the structural steel specification for medium and high tensile plates and sections?",
        "expected_standard": "IS 2062",
        "expected_keywords": ["structural steel", "e250", "tensile"],
        "category": "Civil & Metallurgical"
    },
    {
        "query": "Under which scheme and standard are self-ballasted LED lamps certified for electrical safety?",
        "expected_standard": "IS 16102",
        "expected_keywords": ["led", "self-ballasted", "crs"],
        "category": "Electronics"
    },
    {
        "query": "What are the recognized purity fineness grades and HUID rules for gold jewellery hallmarking?",
        "expected_standard": "IS 1417",
        "expected_keywords": ["gold", "hallmark", "huid", "916"],
        "category": "Precious Metals"
    },
    {
        "query": "What standard covers TMT high strength deformed steel bars for concrete reinforcement?",
        "expected_standard": "IS 1786",
        "expected_keywords": ["tmt", "deformed steel", "fe 500d"],
        "category": "Civil Engineering"
    },
    {
        "query": "General electrical safety requirements for household appliances against electric shock and leakage current",
        "expected_standard": "IS 302",
        "expected_keywords": ["household", "electrical", "leakage current"],
        "category": "Electrical Appliances"
    }
]


def run_rag_evaluation(top_k: int = 5) -> dict[str, Any]:
    """Executes real queries and calculates actual retrieval metrics."""
    index_knowledge_base()

    hit_at_1 = 0
    hit_at_3 = 0
    hit_at_5 = 0
    reciprocal_ranks = []
    citation_coverages = []
    latencies = []

    results_detail = []

    for item in EVALUATION_DATASET:
        q = item["query"]
        expected = item["expected_standard"]

        t0 = time.time()
        retrieved = hybrid_retrieve(q, top_k=top_k)
        elapsed_ms = (time.time() - t0) * 1000
        latencies.append(elapsed_ms)

        found_rank = None
        for rank, chunk in enumerate(retrieved, 1):
            std_no = chunk.get("standard_number", "")
            doc_title = chunk.get("document_title", "")
            chunk_id = chunk.get("chunk_id", "")
            if expected in std_no or expected in doc_title or expected in chunk_id:
                found_rank = rank
                break

        if found_rank == 1:
            hit_at_1 += 1
        if found_rank is not None and found_rank <= 3:
            hit_at_3 += 1
        if found_rank is not None and found_rank <= 5:
            hit_at_5 += 1

        rr = (1.0 / found_rank) if found_rank is not None else 0.0
        reciprocal_ranks.append(rr)

        # Keyword citation coverage in top 3 chunks
        top_text = " ".join([c.get("text", "") for c in retrieved[:3]]).lower()
        matched_kws = [kw for kw in item["expected_keywords"] if kw in top_text]
        coverage = len(matched_kws) / len(item["expected_keywords"])
        citation_coverages.append(coverage)

        results_detail.append({
            "query": q,
            "expected_standard": expected,
            "retrieved_top_standard": retrieved[0].get("standard_number", "") if retrieved else "None",
            "found_rank": found_rank,
            "latency_ms": round(elapsed_ms, 2),
            "keyword_coverage": round(coverage, 2)
        })

    n = len(EVALUATION_DATASET)
    metrics = {
        "dataset": "DEVELOPMENT EVALUATION DATA — NOT OFFICIAL BIS BENCHMARK",
        "sample_count": n,
        "hit_at_1": round(hit_at_1 / float(n), 4),
        "hit_at_3": round(hit_at_3 / float(n), 4),
        "hit_at_5": round(hit_at_5 / float(n), 4),
        "mean_reciprocal_rank_mrr": round(sum(reciprocal_ranks) / float(n), 4),
        "mean_citation_coverage": round(sum(citation_coverages) / float(n), 4),
        "mean_retrieval_latency_ms": round(sum(latencies) / float(n), 2),
        "query_results": results_detail
    }

    logger.info(f"✅ RAG Evaluation: Hit@1={metrics['hit_at_1']}, MRR={metrics['mean_reciprocal_rank_mrr']}, Latency={metrics['mean_retrieval_latency_ms']}ms")
    return metrics


if __name__ == "__main__":
    report = run_rag_evaluation()
    print(json.dumps(report, indent=2))
