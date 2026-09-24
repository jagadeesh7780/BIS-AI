import json
from pathlib import Path

data_dir = Path("e:/BIS-AI/backend/data")
with open(data_dir / "standards.json", encoding="utf-8") as f:
    standards = json.load(f)

with open(data_dir / "schemes.json", encoding="utf-8") as f:
    schemes = json.load(f)

with open(data_dir / "labs.json", encoding="utf-8") as f:
    labs = json.load(f)

mock_standards = []
for s in standards:
    mock_standards.append({
        "id": s["id"],
        "number": s["number"],
        "title": s["title"],
        "category": s["category"],
        "summary": s["summary"],
        "scheme": s["certification_scheme"],
        "scope": s["scope"],
        "keywords": s.get("keywords", []),
        "confidence": 92
    })

# Format mockLabs by city
mock_labs_by_city = {}
for lab in labs:
    city_key = lab["city"].lower().strip()
    if city_key not in mock_labs_by_city:
        mock_labs_by_city[city_key] = []
    mock_labs_by_city[city_key].append(lab)

js_content = """// Mock data for demo fallbacks when backend is offline or starting up

export const mockStandards = """ + json.dumps(mock_standards, indent=2, ensure_ascii=False) + """;

export const mockCertificationSchemes = """ + json.dumps(schemes, indent=2, ensure_ascii=False) + """;

export const mockLabs = """ + json.dumps(mock_labs_by_city, indent=2, ensure_ascii=False) + """;

export const mockChatResponses = [
  {
    query_keywords: ['pressure cooker', 'cooker', 'is 2347'],
    answer: `For domestic pressure cookers used at home, the applicable Indian Standard is **IS 2347**.

**Key Requirements:**
- Must be manufactured from aluminium or stainless steel
- Safety valve, pressure indicator, and locking mechanism are mandatory
- Capacity range covered: 1 litre to 22 litres
- ISI Mark is **compulsory** for sale in India under QCO

**How to verify:** Verify ISI-marked products with CM/L number on the free BIS CARE app.`,
    sources: [
      { id: 'IS-2347', title: 'IS 2347 — Domestic Pressure Cookers', confidence: 96 },
      { id: 'IS-302', title: 'IS 302 — Safety of Household Appliances', confidence: 70 }
    ]
  },
  {
    query_keywords: ['helmet', 'bike', 'motorcycle', 'two wheeler', 'is 15410', 'is 4151'],
    answer: `For protective helmets for two-wheeler riders in India, the applicable standards are **IS 15410** and **IS 4151**.

**Key Requirements:**
- Mandatory ISI certification for all two-wheeler helmets sold in India
- Shock absorption, penetration resistance, and retention system strength tests are compulsory
- Look for the ISI mark and 7-digit CM/L license number on the helmet shell.`,
    sources: [
      { id: 'IS-15410', title: 'IS 15410 — Protective Helmets for Two-Wheeler Riders', confidence: 98 }
    ]
  },
  {
    query_keywords: ['fmcs', 'foreign manufacturer', 'overseas'],
    answer: `Under the **Foreign Manufacturers Certification Scheme (FMCS)** (Scheme-I), overseas manufacturers can obtain a license to use the ISI Mark on products exported to India.

**Procedure:**
1. Appoint an Authorized Indian Representative (AIR).
2. Submit online application with documentation and fee.
3. Pay for BIS inspection visit to overseas factory.
4. BIS officer conducts factory audit and sample drawing.
5. Independent testing in India; license granted on passing.`,
    sources: [
      { id: 'MFR-004', title: 'FMCS Certification for Foreign Manufacturers', confidence: 95 }
    ]
  },
  {
    query_keywords: ['genuine', 'fake', 'verify', 'huid', 'bis care'],
    answer: `To check if an ISI Mark or Gold Hallmark is genuine:

1. **ISI Mark Verification:** Check for the ISI mark + CM/L (licence) number beneath it. Use the free **BIS CARE App** -> select "Verify License Details" -> enter the CM/L number to view manufacturer validity.
2. **Gold Hallmarking (HUID):** Look for the 6-digit alphanumeric HUID code stamped on gold jewellery. Enter it in BIS CARE App -> "Verify HUID" to view jewel purity (e.g. 22K/916) and AHC centre details.
3. **Complaints:** Report fake marks on BIS CARE App or call national helpline 1800-11-4070.`,
    sources: [
      { id: 'CON-001', title: 'Checking Genuine ISI Mark', confidence: 99 },
      { id: 'CON-003', title: 'HUID Gold Hallmarking Verification', confidence: 97 }
    ]
  }
];

export const getDefaultChatResponse = (query) => ({
  answer: `Based on your query about **"${query}"**, here is relevant information from the official BIS database:

I have cross-referenced the Indian Standards (IS), certification schemes, and testing guidelines. The standard process involves:

1. **Identifying the applicable IS Standard** (e.g., via Manak Online / Standards search)
2. **Testing products** at a BIS-recognized or NABL accredited laboratory
3. **Filing application** through the Manak Online portal (manakonline.in)
4. **Factory inspection & sample verification** by BIS officers
5. **Licence Grant** for ISI Mark or CRS Registration.

For targeted guidance, you can explore the Standards Search or Certification Guide pages.`,
  sources: [
    { id: 'IS-302', title: 'IS 302 — Safety of Electrical Appliances', confidence: 75 },
    { id: 'BIS-ACT-2016', title: 'Bureau of Indian Standards Act 2016', confidence: 70 }
  ]
});
"""

target_path = Path("e:/BIS-AI/bis-assistant-ai/src/utils/mockData.js")
with open(target_path, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Updated mockData.js with {len(mock_standards)} standards, {len(schemes)} schemes, and {len(labs)} labs.")
