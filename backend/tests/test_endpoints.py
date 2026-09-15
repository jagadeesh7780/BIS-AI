"""
BIS AI V2 — FastAPI Endpoint Tests (STEP 17/20)
Tests every major API endpoint for correct status codes and response schemas.
Run: pytest tests/test_endpoints.py -v
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"] = "false"

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ── Health ─────────────────────────────────────────────────────────────────────

def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert "status" in data
    assert "version" in data
    assert "groq_key_set" in data
    assert "trace_id" in data

def test_health_v1():
    r = client.get("/api/v1/health")
    assert r.status_code == 200


# ── Chat ───────────────────────────────────────────────────────────────────────

def test_chat_returns_200():
    r = client.post("/api/chat", json={"query": "What is the ISI mark?", "language": "en"})
    assert r.status_code == 200

def test_chat_response_has_required_fields():
    r = client.post("/api/chat", json={"query": "What IS standard applies to pressure cookers?"})
    assert r.status_code == 200
    data = r.json()
    assert "answer" in data
    assert "agent" in data
    assert "confidence" in data
    assert "citations" in data
    assert "trace_id" in data
    assert len(data["answer"]) > 0

def test_chat_empty_query_returns_400():
    r = client.post("/api/chat", json={"query": "   "})
    assert r.status_code == 400

def test_chat_with_role():
    r = client.post("/api/chat", json={"query": "How to verify ISI mark?", "role": "consumer"})
    assert r.status_code == 200
    data = r.json()
    assert data.get("agent") == "consumer"

def test_chat_v1():
    r = client.post("/api/v1/chat", json={"query": "What is BIS?"})
    assert r.status_code == 200


# ── Standards ──────────────────────────────────────────────────────────────────

def test_standards_list():
    r = client.get("/api/standards?limit=10")
    assert r.status_code == 200
    data = r.json()
    assert "total" in data
    assert "standards" in data
    assert data["total"] >= 50, f"Expected 50+ standards, got {data['total']}"
    assert "trace_id" in data

def test_standards_search():
    r = client.get("/api/standards?search=pressure+cooker")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1

def test_standards_detail_by_id():
    r = client.get("/api/standards/IS-302")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == "IS-302"
    assert "trace_id" in data

def test_standards_detail_by_number():
    r = client.get("/api/standards/IS 2062")
    assert r.status_code == 200
    assert r.json()["id"] == "IS-2062"

def test_standards_detail_not_found():
    r = client.get("/api/standards/IS-99999")
    assert r.status_code == 404

def test_standards_compare():
    r = client.post("/api/standards/compare", json={"standard1": "IS-302", "standard2": "IS-2347"})
    assert r.status_code == 200
    data = r.json()
    assert "differences" in data
    assert "similarity_score" in data
    assert "standard1" in data
    assert "standard2" in data
    assert "trace_id" in data

def test_standards_compare_missing_id():
    r = client.post("/api/standards/compare", json={"standard1": "IS-302"})
    assert r.status_code == 400


# ── Labs ───────────────────────────────────────────────────────────────────────

def test_labs_nearby_mumbai():
    r = client.get("/api/labs/nearby?city=Mumbai")
    assert r.status_code == 200
    data = r.json()
    assert "labs" in data
    assert "count" in data
    assert data["count"] > 0
    assert "trace_id" in data

def test_labs_nearby_ghaziabad():
    r = client.get("/api/labs/nearby?city=Ghaziabad")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] > 0

def test_labs_v1():
    r = client.get("/api/v1/laboratories?city=Chennai")
    assert r.status_code == 200


# ── Certification Schemes ──────────────────────────────────────────────────────

def test_certification_schemes():
    r = client.get("/api/certification/schemes")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 3, f"Expected at least 3 schemes, got {len(data)}"

def test_certification_scheme_crs():
    r = client.get("/api/certification/schemes/crs")
    assert r.status_code == 200
    data = r.json()
    assert "steps" in data
    assert len(data["steps"]) >= 3

def test_certification_scheme_not_found():
    r = client.get("/api/certification/schemes/nonexistent")
    assert r.status_code == 404


# ── Certification Tracker ──────────────────────────────────────────────────────

def test_tracker_demo_001():
    r = client.get("/api/certification/tracker/BIS-2024-001")
    assert r.status_code == 200
    data = r.json()
    assert "app_id" in data or "appId" in data
    assert "stages" in data
    assert "demo_disclaimer" in data, "Demo data must include disclaimer"

def test_tracker_not_found():
    r = client.get("/api/certification/tracker/BIS-9999-999")
    assert r.status_code == 404


# ── FAQs ───────────────────────────────────────────────────────────────────────

def test_faq_consumer():
    r = client.get("/api/faq?role=consumer")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] > 0
    assert "trace_id" in data

def test_faq_manufacturer():
    r = client.get("/api/faq?role=manufacturer")
    assert r.status_code == 200
    assert r.json()["count"] > 0

def test_faq_student():
    r = client.get("/api/faq?role=student")
    assert r.status_code == 200
    assert r.json()["count"] > 0

def test_faq_search():
    r = client.get("/api/faq?search=ISI+mark")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1


# ── Complaints ─────────────────────────────────────────────────────────────────

def test_submit_complaint():
    r = client.post("/api/complaints", json={
        "contact_number": "9876543210",
        "description":    "Found a product with fake ISI mark",
        "product_name":   "Pressure Cooker",
        "isi_number":     "CM/L-0000001",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert "complaint_id" in data
    assert data["complaint_id"].startswith("BIS-CMP-")

def test_submit_complaint_missing_description():
    r = client.post("/api/complaints", json={
        "contact_number": "9876543210",
        "description":    "   ",
    })
    assert r.status_code == 400

def test_submit_complaint_missing_contact():
    r = client.post("/api/complaints", json={
        "contact_number": "",
        "description":    "Some issue",
    })
    assert r.status_code == 400

def test_get_complaint_after_submit():
    # Submit first
    r1 = client.post("/api/complaints", json={
        "contact_number": "9876543210",
        "description":    "Test complaint for retrieval test",
    })
    assert r1.status_code == 200
    cid = r1.json()["complaint_id"]
    # Retrieve
    r2 = client.get(f"/api/complaints/{cid}")
    assert r2.status_code == 200
    assert r2.json()["complaint_id"] == cid


# ── Compliance Analysis ────────────────────────────────────────────────────────

def test_compliance_analyze():
    r = client.post("/api/v1/compliance/analyze", json={
        "product_name": "Domestic Pressure Cooker",
        "city":         "Mumbai",
        "scale":        "MSME",
    })
    assert r.status_code == 200
    data = r.json()
    assert "product_name" in data
    assert "roadmap_steps" in data
    assert "statutory_disclaimer" in data
    disclaimer = data["statutory_disclaimer"]
    assert "BIS AI" in disclaimer or "advisory" in disclaimer.lower()


# ── ML Predict ────────────────────────────────────────────────────────────────

def test_ml_predict():
    r = client.post("/api/v1/ml/predict", json={"product_name": "motorcycle helmet"})
    assert r.status_code == 200
    data = r.json()
    assert "predicted_category" in data
    assert "trace_id" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
