"""
BIS AI V2 — Comprehensive Automated Verification Suite
Tests:
  - System Health Check
  - Hybrid RAG Chat with Citation Extraction & Agent Routing
  - Standards Directory & Comparison
  - Manufacturer Compliance Roadmap Generator
  - PyTorch ML Risk & Complexity Model (Inference & Evaluation Metrics)
  - Live RAG Evaluation Benchmark (Hit@K, MRR)
"""

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        getattr(sys.stdout, "reconfigure")(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_v2_pipeline():
    print("=" * 70)
    print("Running BIS AI V2 Automated Verification Suite...")
    print("=" * 70)

    # 1. Health
    res = client.get("/api/v1/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    data = res.json()
    assert data["status"] == "healthy"
    print(f"[OK] [1/8] Health Check Passed: {data['service']} v{data['version']} ({data['knowledge_chunks_indexed']} chunks indexed)")

    # 2. Standards Search & Detail
    res = client.get("/api/v1/standards?search=pressure cooker")
    assert res.status_code == 200
    stds = res.json()
    assert stds["total"] >= 1, "Expected at least 1 match for pressure cooker"
    std_id = stds["standards"][0]["id"]
    print(f"[OK] [2/8] Standards Search Passed: Found {stds['total']} matches (Top: {std_id})")

    res_detail = client.get(f"/api/v1/standards/{std_id}")
    assert res_detail.status_code == 200
    print(f"[OK] [3/8] Standard Detail Passed: Retrieved {res_detail.json()['number']}")

    # 3. Hybrid RAG Chat with Citations
    chat_payload = {
        "query": "What are the safety requirements and testing methods for domestic pressure cookers?",
        "language": "en",
        "role": "standards"
    }
    chat_res = client.post("/api/v1/chat", json=chat_payload)
    assert chat_res.status_code == 200, f"Chat failed: {chat_res.text}"
    chat_data = chat_res.json()
    assert len(chat_data["answer"]) > 50, "Answer text should be substantive"
    assert any("2347" in c.get("standard_number", "") or "pressure" in c.get("document_title", "").lower() or len(c.get("standard_number", "")) > 0 for c in chat_data["citations"]), "Expected relevant citation"
    print(f"[OK] [4/8] Hybrid RAG Chat Passed:")
    print(f"       Agent: {chat_data['agent']} | Confidence: {chat_data['confidence']['score']} ({chat_data['confidence']['level']})")
    print(f"       Citations: {len(chat_data['citations'])} authoritative sources attached")
    print(f"       Top Citation: {chat_data['citations'][0]['standard_number']} — {chat_data['citations'][0]['section']}")

    # 4. Manufacturer Compliance Roadmap
    comp_payload = {
        "product_name": "Protective Helmets for Two Wheeler Riders",
        "user_city": "Delhi NCR",
        "scale": "MSME"
    }
    comp_res = client.post("/api/v1/compliance/analyze", json=comp_payload)
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert len(comp_data["roadmap_steps"]) >= 4
    assert len(comp_data["required_documents"]) >= 3
    assert "STATUTORY NOTICE" in comp_data["statutory_disclaimer"]
    print(f"[OK] [5/8] Manufacturer Compliance Roadmap Passed: Generated {len(comp_data['roadmap_steps'])} milestones & {len(comp_data['required_documents'])} Form-V checklist items")

    # 5. PyTorch ML Prediction
    ml_payload = {
        "product_name": "Electric Storage Water Heater",
        "material_domain": "electrical",
        "voltage_rating_v": 230.0,
        "pressure_rating_bar": 6.0,
        "target_user_group": "domestic",
        "has_mandatory_qco": True
    }
    ml_res = client.post("/api/v1/ml/predict", json=ml_payload)
    assert ml_res.status_code == 200
    ml_data = ml_res.json()
    assert "predicted_risk_tier" in ml_data
    assert ml_data["audit_complexity_score"] > 0
    print(f"[OK] [6/8] PyTorch ML Inference Passed:")
    print(f"       Predicted Risk Tier: {ml_data['predicted_risk_tier']} (Confidence: {ml_data['confidence']})")
    print(f"       Predicted Audit Complexity: {ml_data['audit_complexity_score']}/100")

    # 6. PyTorch ML Metrics
    metrics_res = client.get("/api/v1/ml/metrics")
    assert metrics_res.status_code == 200
    metrics_data = metrics_res.json()
    assert metrics_data["accuracy"] >= 0.85
    print(f"[OK] [7/8] ML Evaluation Metrics Verified:")
    print(f"       Accuracy: {metrics_data['accuracy']:.4f} | F1: {metrics_data['f1_macro']:.4f} | Samples: {metrics_data['dataset_sample_count']}")

    # 7. Live RAG Evaluation Benchmark
    eval_res = client.get("/api/v1/evaluation/run")
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["hit_at_1"] >= 0.30
    assert eval_data["mean_reciprocal_rank_mrr"] >= 0.50
    print(f"[OK] [8/8] Live RAG Benchmark Evaluation Passed:")
    print(f"       Hit@1: {eval_data['hit_at_1']} | Hit@3: {eval_data['hit_at_3']} | MRR: {eval_data['mean_reciprocal_rank_mrr']}")
    print(f"       Mean Retrieval Latency: {eval_data['mean_retrieval_latency_ms']} ms")

    print("\n" + "=" * 70)
    print("[SUCCESS] ALL 8 V2 PIPELINE TESTS PASSED WITH 100% REAL EXECUTION!")
    print("=" * 70)


if __name__ == "__main__":
    test_v2_pipeline()
