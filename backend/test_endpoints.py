import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_all():
    print("Testing FastAPI Endpoints...")
    
    # 1. Health
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health failed: {r.text}"
    print("✅ /api/health:", r.json())

    # 2. Standards List
    r = client.get("/api/standards?limit=5")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 50, f"Expected 50+ standards, got {data['total']}"
    print(f"✅ /api/standards: Total={data['total']}, Retrieved={len(data['standards'])}")

    # 3. Standards Detail (both dash and space)
    r1 = client.get("/api/standards/IS-302")
    assert r1.status_code == 200 and r1.json()["id"] == "IS-302"
    r2 = client.get("/api/standards/IS 2062")
    assert r2.status_code == 200 and r2.json()["id"] == "IS-2062"
    print("✅ /api/standards/{id}: IS-302 & IS 2062 verified")

    # 4. Compare
    r = client.post("/api/standards/compare", json={"standard1": "IS-302", "standard2": "IS-2347"})
    assert r.status_code == 200
    comp = r.json()
    assert "differences" in comp and "similarity_score" in comp
    print(f"✅ /api/standards/compare: Similarity={comp['similarity_score']}%, Differences={comp['differences']}")

    # 5. Schemes
    r = client.get("/api/certification/schemes")
    assert r.status_code == 200
    schemes = r.json()
    assert len(schemes) >= 7, f"Expected 7 schemes, got {len(schemes)}"
    print(f"✅ /api/certification/schemes: {len(schemes)} schemes available ({list(schemes.keys())})")

    # 6. Single Scheme
    r = client.get("/api/certification/schemes/crs")
    assert r.status_code == 200 and "steps" in r.json()
    print("✅ /api/certification/schemes/crs: Steps count =", len(r.json()["steps"]))

    # 7. Labs
    r = client.get("/api/labs/nearby?city=Ghaziabad")
    assert r.status_code == 200
    labs = r.json()
    assert labs["count"] > 0, "Expected labs for Ghaziabad"
    print(f"✅ /api/labs/nearby?city=Ghaziabad: Found {labs['count']} labs")

    # 8. FAQs
    for role in ["manufacturer", "consumer", "student"]:
        r = client.get(f"/api/faq?role={role}")
        assert r.status_code == 200
        faq_data = r.json()
        print(f"✅ /api/faq?role={role}: {faq_data['count']} FAQs found")

    print("\nALL 8 ENDPOINT TESTS PASSED SUCCESSFULLY! 🚀")

if __name__ == "__main__":
    test_all()
