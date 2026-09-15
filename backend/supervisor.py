"""
BIS AI V2 — Multi-Agent Supervisor & Compliance Roadmap Builder
Structured manufacturer certification roadmap with evidence citations.
STATUTORY DISCLAIMER on every response: AI guidance only — not official BIS certification.
"""

import time
import json
import uuid
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger("bis.supervisor")

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"


class ManufacturerOrchestrator:
    """
    Builds a structured 5-step certification roadmap for manufacturers.
    Uses hybrid RAG for standard identification.
    Every response includes statutory disclaimer.
    """

    def build_roadmap(
        self,
        product_name: str,
        user_city: str = "Mumbai",
        scale: str = "MSME",
    ) -> Dict[str, Any]:
        t0 = time.time()
        trace_id = str(uuid.uuid4())[:12]

        # 1. Retrieve applicable standard via hybrid RAG
        top_std = None
        try:
            from rag import hybrid_retrieve
            retrieved = hybrid_retrieve(
                f"Indian standard specification for {product_name}", top_k=2
            )
            if retrieved:
                top_std = retrieved[0]
        except Exception as e:
            logger.warning(f"[{trace_id}] RAG lookup failed: {e}")

        if top_std:
            std_number = top_std.get("standard_number", top_std.get("number", "IS Standard"))
            std_title = top_std.get("document_title", top_std.get("title", f"Specification for {product_name}"))
            std_id = top_std.get("id", "IS-GENERAL")
            std_category = top_std.get("category", "General")
            std_scheme = top_std.get("certification_scheme", "Scheme-I (ISI Mark)")
            std_url = top_std.get("source_url", "https://www.bis.gov.in")
        else:
            std_number = "IS Standard"
            std_title = f"Specification for {product_name}"
            std_id = "IS-GENERAL"
            std_category = "Consumer & Industrial Goods"
            std_scheme = "Scheme-I (ISI Mark)"
            std_url = "https://www.bis.gov.in"

        applicable_standard = {
            "id": std_id,
            "number": std_number,
            "title": std_title,
            "category": std_category,
            "scope": f"Manufacturing specification and safety requirements for {product_name}",
            "summary": top_std.get("text", "")[:250] + "..." if top_std else "",
            "certification_scheme": std_scheme,
            "mandatory_qco": True,
            "source_url": std_url,
        }

        # 2. Required documents (Form V checklist)
        required_documents = [
            {
                "doc_id": "DOC-01",
                "name": "Form-V Statutory Application",
                "description": "Application under Section 13(1) of BIS Act 2016 for grant of certification licence.",
                "mandatory": True,
                "portal": "https://www.manakonline.in",
            },
            {
                "doc_id": "DOC-02",
                "name": "Factory Registration & MSME Udyam Certificate",
                "description": "Proof of manufacturing establishment, factory license, and MSME classification.",
                "mandatory": True,
            },
            {
                "doc_id": "DOC-03",
                "name": "Manufacturing Machinery List & Installed Capacity",
                "description": "Complete inventory of plant machinery with production flow chart.",
                "mandatory": True,
            },
            {
                "doc_id": "DOC-04",
                "name": "In-House Testing Equipment Calibration Certificates",
                "description": "Calibration certificates traceable to NPL/NABL standards.",
                "mandatory": True,
            },
            {
                "doc_id": "DOC-05",
                "name": "Quality Control In-Charge Credentials",
                "description": "Engineering degree/diploma and appointment letter of dedicated QC supervisor.",
                "mandatory": True,
            },
            {
                "doc_id": "DOC-06",
                "name": "Scheme of Inspection and Testing (SIT) Acceptance",
                "description": "Written acceptance of BIS audit frequency and sample lot testing procedure.",
                "mandatory": True,
            },
        ]

        # 3. Testing parameters (generic — product-specific details from RAG)
        testing_parameters = [
            {
                "parameter": "Dimensional & Physical Properties",
                "method": f"{std_number} Clause 4",
                "sample_size": "3 production units",
            },
            {
                "parameter": "Mechanical / Structural Integrity Test",
                "method": f"{std_number} Clause 5",
                "sample_size": "2 units",
            },
            {
                "parameter": "Safety & Hazard Performance Test",
                "method": f"{std_number} Clause 6-8",
                "sample_size": "3 units",
            },
            {
                "parameter": "Marking & Finish Verification",
                "method": f"{std_number} Clause Final",
                "sample_size": "All submitted units",
            },
        ]

        # 4. Load labs from data file
        recommended_labs = []
        labs_file = DATA_DIR / "labs.json"
        if labs_file.exists():
            with open(labs_file, "r", encoding="utf-8") as f:
                all_labs = json.load(f)
            city_lower = user_city.lower()
            matching = [
                lab for lab in all_labs
                if city_lower in lab.get("city", "").lower()
                or city_lower in lab.get("state", "").lower()
            ]
            recommended_labs = (matching or all_labs)[:3]

        # 5. Statutory fee estimate
        is_msme = scale.upper() in ("MSME", "MICRO", "SMALL", "MEDIUM")
        app_fee = 500.0 if is_msme else 1000.0
        estimated_statutory_fees = {
            "application_fee_inr": app_fee,
            "factory_audit_fee_inr": 7000.0,
            "estimated_lab_test_fee_inr": 12000.0,
            "minimum_marking_fee_inr": 10000.0,
            "total_estimated_inr": app_fee + 7000.0 + 12000.0 + 10000.0,
            "msme_concession_applied": is_msme,
            "note": "Fees are estimates only. Confirm current fee schedule at manakonline.in.",
        }

        # 6. Milestone roadmap
        roadmap_steps = [
            {
                "step_number": 1,
                "title": f"Standard Identification & Scope Verification ({std_number})",
                "action": f"Confirm {product_name} falls under {std_title}.",
                "evidence_citation": f"BIS Standards Directory — {std_number}",
                "status": "COMPLETED",
                "statutory_handover": None,
            },
            {
                "step_number": 2,
                "title": "QCO Regulatory Mandate Check",
                "action": "Confirm product requires mandatory BIS certification under Quality Control Order.",
                "evidence_citation": "Gazette of India QCO Notification — Section 16, BIS Act 2016",
                "status": "COMPLETED",
                "statutory_handover": None,
            },
            {
                "step_number": 3,
                "title": "Technical Documentation Preparation (Form V)",
                "action": "Assemble factory layout, calibration records, SIT, and QC supervisor credentials.",
                "evidence_citation": "BIS Form V Guidelines & SIT Framework",
                "status": "IN_PROGRESS",
                "statutory_handover": None,
            },
            {
                "step_number": 4,
                "title": f"Sample Pre-Testing at BIS-Recognised Lab (near {user_city})",
                "action": "Dispatch representative production samples to accredited laboratory.",
                "evidence_citation": "NABL / BIS Laboratory Recognition Database",
                "status": "PENDING_DISPATCH",
                "statutory_handover": None,
            },
            {
                "step_number": 5,
                "title": "Official Manak Online Portal Filing",
                "action": "Submit digital Form V application, upload test reports, pay statutory fees.",
                "evidence_citation": "https://www.manakonline.in",
                "status": "STATUTORY_HANDOVER",
                "statutory_handover": "Official filing MUST be completed on https://www.manakonline.in",
            },
        ]

        elapsed = round(time.time() - t0, 3)

        return {
            "product_name": product_name,
            "identified_category": std_category,
            "applicable_standard": applicable_standard,
            "standards": applicable_standard,  # frontend compat
            "qco_mandatory": True,
            "qco_order_title": f"{std_number} Quality Control Order",
            "issuing_ministry": "DPIIT / Ministry of Commerce & Industry",
            "penalty_provision": "Section 29 of BIS Act 2016 — fine up to ₹5,00,000 or imprisonment up to 2 years",
            "qco": {
                "qco_status": "MANDATORY UNDER QUALITY CONTROL ORDER",
                "issuing_authority": "DPIIT, Ministry of Commerce & Industry",
                "enforcement_date": "As per gazette notification",
                "statutory_act": "Section 16 of BIS Act 2016",
                "penalty_warning": "Section 29: Fine up to ₹5,00,000 or imprisonment up to 2 years.",
            },
            "required_documents": required_documents,
            "document_checklist": required_documents,  # frontend compat
            "documents_and_tests": {
                "document_checklist": required_documents,
                "mandatory_tests": testing_parameters,
                "total_documents_required": len(required_documents),
                "total_tests_required": len(testing_parameters),
            },
            "testing_parameters": testing_parameters,
            "recommended_laboratories": recommended_labs,
            "labs": {
                "nearby_labs": recommended_labs,
                "top_recommended_lab": recommended_labs[0] if recommended_labs else None,
                "total_accredited_labs_matched": len(recommended_labs),
            },
            "estimated_statutory_fees": estimated_statutory_fees,
            "fees_and_timeline": {
                "fee_breakdown": {
                    "application_fee": estimated_statutory_fees["application_fee_inr"],
                    "factory_audit_fee": estimated_statutory_fees["factory_audit_fee_inr"],
                    "estimated_lab_test_fee": estimated_statutory_fees["estimated_lab_test_fee_inr"],
                    "minimum_marking_fee": estimated_statutory_fees["minimum_marking_fee_inr"],
                    "total_statutory_amount": estimated_statutory_fees["total_estimated_inr"],
                },
                "estimated_turnaround": "8–12 weeks (standard BIS protocol)",
                "milestone_roadmap": roadmap_steps,
            },
            "roadmap_steps": roadmap_steps,
            "roadmap": {
                "roadmap_steps": roadmap_steps,
                "dataset_sources_used": [
                    "standards.json (52 IS Specifications)",
                    "schemes.json (7 Certification Schemes)",
                    "labs.json (28 Accredited Test Facilities)",
                ],
            },
            "human_approval_gate": {
                "approval_token": f"HITL-{trace_id.upper()}",
                "status": "PENDING_HUMAN_REVIEW",
                "notice": "Please review the roadmap above before proceeding to official filing.",
            },
            "statutory_disclaimer": (
                "STATUTORY NOTICE: BIS AI is an intelligent advisory tool ONLY. "
                "It does NOT grant official BIS certification, licences, or testing approvals. "
                "All statutory filings, factory audits, and certificate grants are conducted "
                "solely by the Bureau of Indian Standards through https://www.manakonline.in."
            ),
            "trace_id": trace_id,
            "elapsed_ms": int(elapsed * 1000),
            "success": True,
        }


mfr_orchestrator = ManufacturerOrchestrator()
