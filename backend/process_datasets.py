import json
from pathlib import Path

downloads_dir = Path("E:/Downloads")
data_dir = Path("e:/BIS-AI/backend/data")
data_dir.mkdir(parents=True, exist_ok=True)

# 1. Process Standards
with open(downloads_dir / "standards_large.json", "r", encoding="utf-8") as f:
    raw_standards = json.load(f)

processed_standards = []
for s in raw_standards:
    std_id = s.get("id", "")
    number = s.get("number", std_id.replace("-", " "))
    title = s.get("title", "")
    category = s.get("category", "General")
    summary = s.get("summary", "")
    scope = s.get("scope", "")
    cert_scheme = s.get("certification_scheme", "ISI Mark")
    
    # Generate relevant search keywords
    keywords = s.get("keywords", [])
    if not keywords:
        kw_set = set()
        for text in [title, category, summary, scope]:
            for w in text.replace(",", " ").replace(".", " ").replace("(", " ").replace(")", " ").split():
                w_clean = w.strip().lower()
                if len(w_clean) > 3 and w_clean not in {"with", "from", "this", "that", "have", "such", "into", "under", "used", "cover", "covers", "including", "requirements", "general"}:
                    kw_set.add(w_clean)
        keywords = sorted(list(kw_set))[:10]
    
    processed_standards.append({
        "id": std_id,
        "number": number,
        "title": title,
        "category": category,
        "summary": summary,
        "scope": scope,
        "certification_scheme": cert_scheme,
        "keywords": keywords,
        "applicable_to": ["manufacturer", "msme", "consumer", "student"]
    })

with open(data_dir / "standards.json", "w", encoding="utf-8") as f:
    json.dump(processed_standards, f, indent=2, ensure_ascii=False)
print(f"Processed {len(processed_standards)} standards into standards.json")

# 2. Process FAQs
for faq_name, filename in [
    ("manufacturer_faq_large.json", "manufacturer_faq.json"),
    ("consumer_faq_large.json", "consumer_faq.json"),
    ("student_faq_large.json", "student_faq.json")
]:
    with open(downloads_dir / faq_name, "r", encoding="utf-8") as f:
        faq_data = json.load(f)
    with open(data_dir / filename, "w", encoding="utf-8") as f:
        json.dump(faq_data, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(faq_data)} items to {filename}")

# 3. Process Schemes
with open(downloads_dir / "schemes_large.json", "r", encoding="utf-8") as f:
    raw_schemes = json.load(f)

schemes_dict = {}
for s in raw_schemes:
    s_id = s.get("id", "").lower()
    steps = s.get("steps", [])
    formatted_steps = []
    for idx, st in enumerate(steps, 1):
        if isinstance(st, str):
            formatted_steps.append({
                "id": idx,
                "title": f"Step {idx}: {st.split(':')[0] if ':' in st else st[:45]}",
                "description": st,
                "duration": s.get("typical_duration", "2-4 weeks") if idx == 1 else "Varies",
                "documents": ["Application form", "Test reports", "Quality manual"] if idx <= 2 else ["Factory audit checklist", "Sample test verification report"]
            })
        else:
            formatted_steps.append(st)

    schemes_dict[s_id] = {
        "id": s_id,
        "name": s.get("name", s_id.upper()),
        "short": s_id.upper(),
        "description": s.get("description", ""),
        "applicable_products": s.get("applicable_to", ""),
        "typical_duration": s.get("typical_duration", "3 to 6 months"),
        "governing_body": "Bureau of Indian Standards (BIS)",
        "legal_basis": "BIS Act 2016, Quality Control Orders (QCOs)",
        "steps": formatted_steps
    }

with open(data_dir / "schemes.json", "w", encoding="utf-8") as f:
    json.dump(schemes_dict, f, indent=2, ensure_ascii=False)
print(f"Saved {len(schemes_dict)} schemes to schemes.json")

# 4. Process Labs
with open(downloads_dir / "labs_large.json", "r", encoding="utf-8") as f:
    raw_labs_large = json.load(f)

existing_labs_file = data_dir / "labs.json"
existing_labs = []
if existing_labs_file.exists():
    try:
        with open(existing_labs_file, "r", encoding="utf-8") as f:
            existing_labs = json.load(f)
    except Exception:
        existing_labs = []

merged_labs = []
seen_names = set()
for lab in raw_labs_large + existing_labs:
    name = lab.get("name", "").strip()
    if not name or name.lower() in seen_names:
        continue
    seen_names.add(name.lower())
    
    city = lab.get("city", "General")
    state = lab.get("state", "")
    address = lab.get("address", f"{city}, India")
    specs = lab.get("specialization", lab.get("specializations", ["General Testing"]))
    
    clean_city = city.lower().replace(" ", "")
    merged_labs.append({
        "id": len(merged_labs) + 1,
        "name": name,
        "city": city,
        "state": state,
        "address": address,
        "phone": lab.get("phone", "+91-11-2323-0131"),
        "email": lab.get("email", f"{clean_city}.lab@bis.gov.in"),
        "specializations": specs if isinstance(specs, list) else [specs],
        "accreditation": lab.get("accreditation", "BIS Recognised Lab / NABL Accredited"),
        "lat": lab.get("lat", 28.6139),
        "lng": lab.get("lng", 77.2090),
        "timings": lab.get("timings", "Mon-Fri: 9:00 AM - 5:30 PM")
    })

with open(data_dir / "labs.json", "w", encoding="utf-8") as f:
    json.dump(merged_labs, f, indent=2, ensure_ascii=False)
print(f"Saved {len(merged_labs)} labs to labs.json")
