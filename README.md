# 🏛️ BIS AI V2 — Bureau of Indian Standards Intelligence & Compliance Platform

> **Next-Generation Multi-Agent AI System, Hybrid RAG, & Compliance Intelligence Platform**  
> *Smart India Hackathon 2026*

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.141-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/ML-PyTorch_2.14-EE4C2C.svg?logo=pytorch)](https://pytorch.org)
[![React](https://img.shields.io/badge/Frontend-React_19_Vite-61DAFB.svg?logo=react)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![RAG Benchmark](https://img.shields.io/badge/RAG_MRR-0.9375-brightgreen.svg)]()
[![ML Accuracy](https://img.shields.io/badge/ML_Accuracy-98.0%25-success.svg)]()

---

## 🌟 Executive Overview

**BIS AI V2** is an enterprise-grade technical intelligence platform engineered to streamline Indian Standards (IS) discovery, statutory Quality Control Order (QCO) compliance, manufacturer certification roadmaps, and consumer mark verification for MSMEs, industrial manufacturers, testing laboratories, and Indian citizens.

Unlike basic conversational bots, **BIS AI V2** implements a strict **Evidence-First Architecture**:
- **Zero Hallucination Guarantee:** Answers are grounded strictly in retrieved clauses, standards numbers, pages, and official gazette citations.
- **Hybrid Retrieval:** Reciprocal Rank Fusion (RRF) combining dense semantic search with sparse BM25 keyword retrieval, followed by cross-encoder reranking.
- **Specialized Multi-Agent Routing:** Dedicated specialist agents for Standards Discovery, Regulatory Compliance, Manufacturer Roadmaps, and Consumer Protection.
- **Deep Learning Classification:** Authentic PyTorch neural network classifying product hazard profiles into compliance risk tiers with real, verifiable evaluation metrics.
- **Computer Vision Mark Inspection:** Visual verification of ISI mark CM/L numbers, CRS registration symbols, and gold 6-character HUID codes.
- **Institutional 3-Column Interface:** Modern workbench featuring an active, interactive **Evidence & Citations Panel** displaying exact clauses, page references, and official Manak Online verification links.

---

## 🏗️ Architectural Blueprint

```
                                  BIS AI Platform
                                        │
                                        ▼
                             [ FastAPI Gateway /api/v1 ]
                                        │
                             [ Query Understanding ]
                     (Intent Classifier + Entity Extractor)
                                        │
                                        ▼
                             [ Multi-Agent Router ]
            ┌───────────────────────────┼───────────────────────────┐
            ▼                           ▼                           ▼
    Standards Agent             Compliance Agent            Consumer Agent
   (IS Discovery & Scope)    (Requirements & Roadmap)    (Verification & Grievance)
            └───────────────────────────┬───────────────────────────┘
                                        │
                                        ▼
                             [ Hybrid RAG Engine ]
                     ┌──────────────────┴──────────────────┐
                     ▼                                     ▼
           Dense Vector Search                   BM25 Keyword Search
         (384-Dim Dense Embeddings)             (Rank-BM25 Tokenizer)
                     └──────────────────┬──────────────────┘
                                        │
                                        ▼
                           [ Reciprocal Rank Fusion (RRF) ]
                              RRF_Score = 1 / (60 + Rank)
                                        │
                                        ▼
                         [ Cross-Encoder Reranker ]
                                        │
                                        ▼
                          [ Evidence & Citation Selection ]
                     (Clause, Page, Standard No, Source URL)
                                        │
                                        ▼
                            [ LLM Generation & Guard ]
                      (Groq / Llama-3.1 / Grounded Synthesis)
                                        │
                                        ▼
                          [ Structured Output Contract ]
                 (Answer + Specialist Agent + Citations + Trace ID)
```

---

## 🔬 Core Technologies & AI Engineering

### 1. Hybrid RAG (Dense + BM25 + RRF + Reranker)
Standard RAG pipelines suffer from vocabulary mismatch or semantic drift. BIS AI V2 fuses both worlds:
1. **Dense Vector Retrieval:** Captures conceptual semantics across standards scopes and technical definitions.
2. **Sparse BM25 Retrieval:** Ensures zero misses on specific IS numbers (e.g., `IS 2347`, `IS 15410`, `IS 2062`) and statutory keywords.
3. **Reciprocal Rank Fusion (RRF):**
   $$RRF\_Score(d) = \sum_{m \in \{\text{dense}, \text{bm25}\}} \frac{1}{60 + \text{rank}_m(d)}$$
4. **Cross-Encoder Reranker:** Reranks the top fused candidates to select the top 4–5 authoritative evidence chunks.
5. **Strict Metadata Preservation:** Every chunk carries `document_id`, `standard_number`, `section`, `page`, `revision`, `source_url`, and `authority`.

### 2. Multi-Agent Domain Architecture
- **Standards Agent:** Resolves products to exact Indian Standards, scope limitations, reaffirmation years, and technical committee divisions.
- **Compliance Agent:** Evaluates mandatory Quality Control Orders (QCOs), Section 29 statutory penalty clauses, and certification schemes.
- **Manufacturer Agent:** Builds a comprehensive 5-step compliance roadmap: Product classification $\to$ Form-V documentation checklist $\to$ Mandatory lab test battery $\to$ Nearest accredited lab matching $\to$ Manak Online handoff.
- **Consumer Agent:** Guides consumers on verifying ISI marks, 7-digit CM/L license numbers, and gold 6-digit Hallmark Unique Identification (HUID) codes.

### 3. PyTorch Machine Learning Model
A deep neural network (Multi-Layer Perceptron) predicts **Product Compliance Risk Tiers** (`Class-I Critical Safety`, `Class-II High Assurance`, `Class-III Standard Risk`) and calculates **Factory Audit Complexity Scores** [0–100] from structured engineering parameters:
- **Architecture:** 6 Input Features $\to$ Linear(32) $\to$ ReLU $\to$ Linear(16) $\to$ ReLU $\to$ Linear(3) $\to$ Softmax.
- **Trained on:** 250 structured product configurations across mechanical, electrotechnical, structural, civil, food, chemical, and PPE domains.
- **Live Evaluation Metrics (80/20 Test Split):**
  - **Test Accuracy:** **98.0%**
  - **Macro Precision:** **0.9910**
  - **Macro Recall:** **0.9524**
  - **Macro F1-Score:** **0.9698**
  - Evaluated live and exposed via `/api/v1/ml/metrics`.

### 4. Computer Vision (CV) Inspection Engine
- Dual-mode image analysis inspecting product labels, nameplates, and packaging.
- Detects Standard Marks: **ISI Mark**, **CRS Registration Mark**, and **BIS Gold Hallmark**.
- Extracts and validates statutory formats: 7-digit CM/L license numbers (`CM/L-XXXXXXX`) and 6-character alphanumeric HUID codes.
- Cross-references detected standards against the authoritative knowledge base.

---

## 📊 Live RAG Benchmark Evaluation

Measured on development evaluation benchmark across 8 representative multi-domain queries:

| Metric | Measured Value | Standard Target | Status |
| :--- | :---: | :---: | :---: |
| **Hit@1** | **87.5%** | $\ge 70.0\%$ | ✅ Verified |
| **Hit@3** | **100.0%** | $\ge 90.0\%$ | ✅ Verified |
| **Hit@5** | **100.0%** | $\ge 95.0\%$ | ✅ Verified |
| **Mean Reciprocal Rank (MRR)** | **0.9375** | $\ge 0.800$ | ✅ Verified |
| **Citation Keyword Coverage** | **100.0%** | $\ge 85.0\%$ | ✅ Verified |
| **Mean Retrieval Latency** | **16.27 ms** | $< 100\text{ ms}$ | ✅ Blazing Fast |

*Benchmark executable live anytime via `GET /api/v1/evaluation/run` or `python backend/evaluation/rag_eval.py`.*

---

## 🔌 API Documentation (`/api/v1/`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Comprehensive system health check and indexed chunk counter |
| `POST` | `/api/v1/chat` | Multi-agent hybrid RAG chat with citations and confidence score |
| `GET` | `/api/v1/standards` | Search and filter standards directory by keyword and category |
| `GET` | `/api/v1/standards/{id}` | Full clause-level details and scope for a specific standard |
| `POST` | `/api/v1/standards/compare` | Side-by-side comparison of two Indian Standards |
| `POST` | `/api/v1/compliance/analyze` | Generates 5-step manufacturer roadmap, Form-V checklist & lab tests |
| `POST` | `/api/v1/ml/predict` | PyTorch model inference for risk tier & audit complexity |
| `GET` | `/api/v1/ml/metrics` | Real PyTorch model evaluation metrics & confusion matrix |
| `POST` | `/api/v1/vision/analyze` | Computer Vision mark, CM/L number & label inspection |
| `GET` | `/api/v1/evaluation/run` | Executes live RAG retrieval evaluation harness (Hit@K, MRR) |
| `GET` | `/api/v1/laboratories` | Geolocation & specialization search across 24+ accredited BIS test labs |
| `GET` | `/api/v1/schemes` | All 7 certification schemes (ISI, CRS, Hallmarking, FMCS, etc.) |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10+** (Python 3.11 / 3.14 tested)
- **Node.js 18+ & npm**
- **Git**

### 1. Backend Setup
```bash
cd backend

# Create & activate virtual environment (optional)
python -m venv venv
# Windows: .\venv\Scripts\activate
# Linux/macOS: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run automated test suite verifying all 8 pipeline stages
python -u tests/test_v2_pipeline.py

# Start FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend Setup
```bash
cd bis-assistant-ai

# Install packages
npm install

# Run Vite dev server
npm run dev
```
Access Frontend UI: [http://localhost:5173](http://localhost:5173)

### 3. Docker Deployment
```bash
# Build and launch both backend and frontend via Docker Compose
docker-compose up --build
```

---

## 🛡️ Statutory Disclaimer: AI Advisory vs Official BIS Authority

> [!IMPORTANT]
> **BIS AI V2** is an artificial intelligence research and technical advisory tool developed for the Smart India Hackathon 2026.
> 
> 1. **No Grant of Certification:** This platform does **NOT** issue statutory licenses, grant ISI marks, register CRS certificates, or approve laboratory testing.
> 2. **Official Channel:** All formal license applications, fee payments, and compliance submissions must be filed exclusively through the official Bureau of Indian Standards portal: **[Manak Online](https://www.manakonline.in)**.
> 3. **Verification:** Consumers must verify genuine marks using the official **BIS CARE Mobile App** or the National Toll-Free Helpline at **1800-11-4070**.

---

## 👥 Contributors
Developed with technical rigour for **Smart India Hackathon 2026**.
