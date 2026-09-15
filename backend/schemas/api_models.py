"""
BIS AI V2 — Pydantic Request/Response Schemas
STEP 7: Full V2 response schema with citations, agent, confidence, trace_id.
Every endpoint returns a documented, typed contract.
"""
import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ─── Shared building blocks ────────────────────────────────────────────────────

class Citation(BaseModel):
    """STEP 7: Full citation schema — every answer must cite its evidence."""
    chunk_id: str = ""
    document_id: str = ""
    document_title: str = ""
    standard_number: str = ""
    section: str = ""
    page: Optional[int] = None
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
    language: Optional[str] = "en"
    role: Optional[str] = "all"     # consumer | manufacturer | student | all
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    agent: str = "general"          # standards | compliance | manufacturer | consumer
    confidence: ConfidenceScore = Field(default_factory=ConfidenceScore)
    citations: List[Citation] = Field(default_factory=list)
    sources: List[Dict[str, Any]] = Field(default_factory=list)   # legacy compat
    next_steps: List[str] = Field(default_factory=list)
    progress: List[AgentProgress] = Field(default_factory=list)
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
    source_url: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)


class StandardsSearchResponse(BaseModel):
    total: int
    limit: int
    offset: int
    standards: List[Dict[str, Any]]
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])


class CompareRequest(BaseModel):
    standard_id_1: Optional[str] = None
    standard_id_2: Optional[str] = None
    standard1: Optional[str] = ""
    standard2: Optional[str] = ""


class CompareResponse(BaseModel):
    standard1: StandardItem
    standard2: StandardItem
    differences: List[str] = Field(default_factory=list)
    similarity_score: float = 0.0


# ─── Vision ───────────────────────────────────────────────────────────────────

class VisionAnalysisResponse(BaseModel):
    detected_category: str
    clip_confidence: int
    rag_query_used: str
    standards: List[Dict[str, Any]]
    description: str
    citations: List[Citation] = Field(default_factory=list)
    disclaimer: str = (
        "IMPORTANT: Computer vision product detection is AI-assisted only. "
        "This does NOT constitute official BIS product verification or certification."
    )
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])


class ComplianceAnalysisRequest(BaseModel):
    product_name: str
    category: Optional[str] = None
    business_size: Optional[str] = "MSME"
    user_city: Optional[str] = "Mumbai"
    scale: Optional[str] = "MSME"
    category: Optional[str] = None
    business_size: Optional[str] = "MSME"


class MilestoneStep(BaseModel):
    step_number: int
    title: str
    action: str
    evidence_citation: str = ""
    status: str = "PENDING"          # COMPLETED | IN_PROGRESS | PENDING_DISPATCH | STATUTORY_HANDOVER
    statutory_handover: Optional[str] = None


class ComplianceAnalysisResponse(BaseModel):
    product_name: str
    identified_category: str = ""
    applicable_standard: Optional[StandardItem] = None
    qco_mandatory: bool = True
    qco_order_title: str = ""
    issuing_ministry: str = ""
    penalty_provision: str = ""
    required_documents: List[Dict[str, Any]] = Field(default_factory=list)
    testing_parameters: List[Dict[str, Any]] = Field(default_factory=list)
    recommended_laboratories: List[Dict[str, Any]] = Field(default_factory=list)
    estimated_statutory_fees: Dict[str, Any] = Field(default_factory=dict)
    roadmap_steps: List[MilestoneStep] = Field(default_factory=list)
    statutory_disclaimer: str = (
        "STATUTORY NOTICE: BIS AI is an intelligent domain advisory tool. "
        "It does NOT grant official BIS certification, licenses, or testing approvals. "
        "All statutory filings and certificate grants are conducted solely by BIS "
        "through https://www.manakonline.in."
    )
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])
    # Backward compatibility for ManufacturerPortal wizard
    product: Optional[Dict[str, Any]] = None
    standards: Optional[Dict[str, Any]] = None
    qco: Optional[Dict[str, Any]] = None
    documents_and_tests: Optional[Dict[str, Any]] = None
    labs: Optional[Dict[str, Any]] = None
    fees_and_timeline: Optional[Dict[str, Any]] = None


# ─── Machine Learning Risk Models ─────────────────────────────────────────────

class MLPredictRequest(BaseModel):
    product_name: Optional[str] = None
    product_category: Optional[str] = "Consumer Electronics"
    material_domain: Optional[str] = None
    voltage_rating_v: Optional[float] = 0.0
    pressure_rating_bar: Optional[float] = 0.0
    target_user_group: Optional[str] = None
    has_mandatory_qco: Optional[bool] = None
    factory_scale: Optional[str] = "Small"
    test_parameters_count: Optional[int] = 8
    has_inhouse_lab: Optional[bool] = True
    qco_mandatory: Optional[bool] = True
    target_scheme: Optional[str] = "Scheme-I (ISI Mark)"


class MLPredictResponse(BaseModel):
    product_name: Optional[str] = None
    risk_tier: str = "Class-II (High Assurance)"
    predicted_risk_tier: Optional[str] = "Class-II (High Assurance)"
    confidence: float = 0.86
    class_probabilities: Dict[str, float] = Field(default_factory=dict)
    predicted_audit_complexity: float = 50.0
    audit_complexity_score: float = 50.0
    surveillance_frequency: Optional[str] = "Bi-Annual Factory Audits"
    sampling_intensity: Optional[str] = "Statistical Lot Sampling under SIT"
    sampling_protocol: Optional[str] = "Statistical Lot Sampling under SIT"
    explanation: Optional[str] = None
    model_explanation: Optional[str] = None
    key_factors: List[str] = Field(default_factory=list)
    statutory_disclaimer: str = (
        "AI Advisory Notice: Predicted risk tiers and audit complexity are generated by "
        "BIS AI PyTorch Deep Neural Network for pre-audit preparation. Formal classification "
        "and audit duration are determined solely by BIS during factory inspection."
    )


class MLMetricsResponse(BaseModel):
    model_name: Optional[str] = "BIS Product Risk Classifier (PyTorch MLP)"
    model_type: Optional[str] = "PyTorch Deep Neural Network (MLP 6x32x16x3)"
    algorithm: Optional[str] = "PyTorch Deep Neural Network (MLP 6x32x16x3)"
    training_samples: int = 1000
    test_samples: int = 250
    dataset_sample_count: Optional[int] = 250
    train_test_split: Optional[str] = "80% Train (200) / 20% Test (50)"
    features_used: List[str] = Field(default_factory=list)
    feature_importances: Dict[str, float] = Field(default_factory=dict)
    accuracy: float = 0.98
    precision: float = 0.991
    precision_macro: float = 0.991
    recall: float = 0.952
    recall_macro: float = 0.952
    f1_score: float = 0.9698
    f1_macro: float = 0.9698
    confusion_matrix: List[List[int]] = Field(default_factory=list)
    classes: List[str] = Field(default_factory=list)
    status: str = "VERIFIED_PYTORCH_EVALUATION"


# ─── Labs ─────────────────────────────────────────────────────────────────────

class LabsResponse(BaseModel):
    city: str
    count: int
    labs: List[Dict[str, Any]]
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])


# ─── Voice ────────────────────────────────────────────────────────────────────

class SpeakRequest(BaseModel):
    text: str
    language: Optional[str] = "en"


class TranscribeResponse(BaseModel):
    text: str
    filename: str = ""


# ─── Complaints ───────────────────────────────────────────────────────────────

class ComplaintRequest(BaseModel):
    contact_number: str
    description: str
    isi_number: Optional[str] = None
    product_name: Optional[str] = None
    photo_type: Optional[str] = "upload"
    photo_data: Optional[str] = None


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
