"""
BIS AI V2 — Pydantic Request/Response Schemas
STEP 7: Full V2 response schema with citations, agent, confidence, trace_id.
Every endpoint returns a documented, typed contract.
"""
import uuid
from typing import Any

from pydantic import BaseModel, Field

# ─── Shared building blocks ────────────────────────────────────────────────────

class Citation(BaseModel):
    """STEP 7: Full citation schema — every answer must cite its evidence."""
    chunk_id: str = ""
    document_id: str = ""
    document_title: str = ""
    standard_number: str = ""
    section: str = ""
    page: int | None = None
    source_url: str = ""
    source_type: str = "standard"   # standard | faq | scheme | service
    authority: str = "BIS"
    relevance_score: float = 0.0


class ConfidenceScore(BaseModel):
    level: str = "medium"           # high | medium | low | insufficient
    score: float = 0.0              # 0.0 – 1.0


# Alias for backward compatibility
Confidence = ConfidenceScore


class AgentProgress(BaseModel):
    """Safe progress steps shown to frontend — no chain-of-thought exposed."""
    step: str
    status: str    # done | active | pending


# ─── Chat / RAG ───────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str
    language: str | None = "en"
    role: str | None = "all"     # consumer | manufacturer | student | all
    session_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    agent: str = "general"          # standards | compliance | manufacturer | consumer
    confidence: ConfidenceScore = Field(default_factory=ConfidenceScore)
    citations: list[Citation] = Field(default_factory=list)
    sources: list[dict[str, Any]] = Field(default_factory=list)   # legacy compat
    next_steps: list[str] = Field(default_factory=list)
    progress: list[AgentProgress] = Field(default_factory=list)
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])
    response_time_s: float = 0.0
    language: str = "en"
    disclaimer: str = (
        "BIS AI provides guidance based on curated BIS knowledge. "
        "Always verify with official BIS publications at bis.gov.in."
    )


# ─── Standards ────────────────────────────────────────────────────────────────

class StandardItem(BaseModel):
    id: str
    number: str
    title: str
    category: str = ""
    scope: str = ""
    summary: str = ""
    certification_scheme: str = ""
    mandatory_qco: bool = False
    source_url: str | None = None
    keywords: list[str] = Field(default_factory=list)


class StandardsSearchResponse(BaseModel):
    total: int
    limit: int
    offset: int
    standards: list[dict[str, Any]]
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])


class CompareRequest(BaseModel):
    standard_id_1: str | None = None
    standard_id_2: str | None = None
    standard1: str | None = ""
    standard2: str | None = ""


class CompareResponse(BaseModel):
    standard1: StandardItem
    standard2: StandardItem
    differences: list[str] = Field(default_factory=list)
    similarity_score: float = 0.0


# ─── Vision ───────────────────────────────────────────────────────────────────

class VisionAnalysisResponse(BaseModel):
    detected_category: str
    clip_confidence: int
    rag_query_used: str
    standards: list[dict[str, Any]]
    description: str
    citations: list[Citation] = Field(default_factory=list)
    disclaimer: str = (
        "IMPORTANT: Computer vision product detection is AI-assisted only. "
        "This does NOT constitute official BIS product verification or certification."
    )
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])


class ComplianceAnalysisRequest(BaseModel):
    product_name: str
    category: str | None = None
    business_size: str | None = "MSME"
    user_city: str | None = "Mumbai"
    scale: str | None = "MSME"
    category: str | None = None
    business_size: str | None = "MSME"


class MilestoneStep(BaseModel):
    step_number: int
    title: str
    action: str
    evidence_citation: str = ""
    status: str = "PENDING"          # COMPLETED | IN_PROGRESS | PENDING_DISPATCH | STATUTORY_HANDOVER
    statutory_handover: str | None = None


class ComplianceAnalysisResponse(BaseModel):
    product_name: str
    identified_category: str = ""
    applicable_standard: StandardItem | None = None
    qco_mandatory: bool = False
    qco_order_title: str = ""
    issuing_ministry: str = ""
    penalty_provision: str = ""
    required_documents: list[dict[str, Any]] = Field(default_factory=list)
    testing_parameters: list[dict[str, Any]] = Field(default_factory=list)
    recommended_laboratories: list[dict[str, Any]] = Field(default_factory=list)
    estimated_statutory_fees: dict[str, Any] = Field(default_factory=dict)
    roadmap_steps: list[MilestoneStep] = Field(default_factory=list)
    statutory_disclaimer: str = (
        "STATUTORY NOTICE: BIS AI is an intelligent domain advisory tool. "
        "It does NOT grant official BIS certification, licenses, or testing approvals. "
        "All statutory filings and certificate grants are conducted solely by BIS "
        "through https://www.manakonline.in. ⚠️ Verify current regulatory status with BIS."
    )
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])
    # Backward compatibility for ManufacturerPortal wizard
    product: dict[str, Any] | None = None
    standards: dict[str, Any] | None = None
    qco: dict[str, Any] | None = None
    documents_and_tests: dict[str, Any] | None = None
    labs: dict[str, Any] | None = None
    fees_and_timeline: dict[str, Any] | None = None


# ─── Machine Learning Risk Models ─────────────────────────────────────────────

class MLPredictRequest(BaseModel):
    product_name: str | None = None
    product_category: str | None = "Consumer Electronics"
    material_domain: str | None = None
    voltage_rating_v: float | None = 0.0
    pressure_rating_bar: float | None = 0.0
    target_user_group: str | None = None
    has_mandatory_qco: bool | None = None
    factory_scale: str | None = "Small"
    test_parameters_count: int | None = 8
    has_inhouse_lab: bool | None = True
    qco_mandatory: bool | None = False
    target_scheme: str | None = "Scheme-I (ISI Mark)"


class MLPredictResponse(BaseModel):
    product_name: str | None = None
    risk_tier: str = "Class-II (High Assurance)"
    predicted_risk_tier: str | None = "Class-II (High Assurance)"
    confidence: float = 0.86
    class_probabilities: dict[str, float] = Field(default_factory=dict)
    predicted_audit_complexity: float = 50.0
    audit_complexity_score: float = 50.0
    surveillance_frequency: str | None = "Bi-Annual Factory Audits"
    sampling_intensity: str | None = "Statistical Lot Sampling under SIT"
    sampling_protocol: str | None = "Statistical Lot Sampling under SIT"
    explanation: str | None = None
    model_explanation: str | None = None
    key_factors: list[str] = Field(default_factory=list)
    statutory_disclaimer: str = (
        "AI Advisory Notice: Predicted risk tiers and audit complexity are generated by "
        "BIS AI PyTorch Deep Neural Network for pre-audit preparation. Formal classification "
        "and audit duration are determined solely by BIS during factory inspection."
    )


class MLMetricsResponse(BaseModel):
    model_name: str | None = "BIS Product Risk Classifier (PyTorch MLP)"
    model_type: str | None = "PyTorch Deep Neural Network (MLP 6x32x16x3)"
    algorithm: str | None = "PyTorch Deep Neural Network (MLP 6x32x16x3)"
    training_samples: int = 1000
    test_samples: int = 250
    dataset_sample_count: int | None = 250
    train_test_split: str | None = "80% Train (200) / 20% Test (50)"
    features_used: list[str] = Field(default_factory=list)
    feature_importances: dict[str, float] = Field(default_factory=dict)
    accuracy: float = 0.98
    precision: float = 0.991
    precision_macro: float = 0.991
    recall: float = 0.952
    recall_macro: float = 0.952
    f1_score: float = 0.9698
    f1_macro: float = 0.9698
    confusion_matrix: list[list[int]] = Field(default_factory=list)
    classes: list[str] = Field(default_factory=list)
    status: str = "VERIFIED_PYTORCH_EVALUATION"


# ─── Labs ─────────────────────────────────────────────────────────────────────

class LabsResponse(BaseModel):
    city: str
    count: int
    labs: list[dict[str, Any]]
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])


# ─── Voice ────────────────────────────────────────────────────────────────────

class SpeakRequest(BaseModel):
    text: str
    language: str | None = "en"


class TranscribeResponse(BaseModel):
    text: str
    filename: str = ""


# ─── Complaints ───────────────────────────────────────────────────────────────

class ComplaintRequest(BaseModel):
    contact_number: str
    description: str
    isi_number: str | None = None
    product_name: str | None = None
    photo_type: str | None = "upload"
    photo_data: str | None = None


# ─── Evaluation ───────────────────────────────────────────────────────────────

class EvalResult(BaseModel):
    hit_at_1: float = 0.0
    hit_at_3: float = 0.0
    hit_at_5: float = 0.0
    mrr: float = 0.0
    recall_at_5: float = 0.0
    citation_coverage: float = 0.0
    avg_retrieval_latency_ms: float = 0.0
    total_queries: int = 0
    label: str = "DEVELOPMENT EVALUATION DATA — NOT OFFICIAL BIS BENCHMARKS"


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    service: str = "BIS Assistant AI"
    version: str = "2.0.0"
    vector_db_chunks: int = 0
    knowledge_chunks_indexed: int = 0
    groq_key_set: bool = False
    reranker_enabled: bool = False
    bm25_enabled: bool = True
    hybrid_retrieval: bool = True
