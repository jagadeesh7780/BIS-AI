# 🏛️ BIS Assistant AI — Intelligent Bureau of Indian Standards Intelligence Platform

> **Next-Generation Multi-Agent AI System & Verified Indian Standards Directory**  
> *Built for the Bureau of Indian Standards (BIS) Hackathon*

---

## 🌟 Overview

**BIS Assistant AI** is an intelligent web application designed to make Indian Standards (IS), certification processes, testing laboratories, and consumer grievance systems instantly accessible to MSMEs, domestic & foreign manufacturers, researchers, students, and Indian consumers.

The platform integrates:
- **Retrieval-Augmented Generation (RAG)** powered by **ChromaDB** and **Sentence-Transformers (ll-MiniLM-L6-v2)**.
- **Multi-Agent Orchestrator** specializing across 3 isolated roles: **Consumer Protection Agent**, **Manufacturer & MSME Agent**, and **Helper & Research Agent**.
- **Real-Time Live Voice Recognition** (Web Speech API) supporting 6 Indian languages with **zero hardcoded fallback questions**.
- **Automated 5-Step Manufacturer Pipeline**: Product classification, document verification, laboratory slot booking, payment processing, and official testing approval.
- **Consumer Grievance Lodging**: Live camera capture or file upload with ISI / HUID hallmark fraud tracking.
- **Interactive Testing Laboratory Finder**: Geolocation and Google Maps navigation across 24+ accredited BIS laboratories.
- **Full 6-Language Localization**: English, Hindi, Telugu, Tamil, Kannada, and Marathi.

---

## 🏗️ Architecture

`mermaid
graph TD
    User([User / Browser]) <--> React[React + Vite Frontend]
    React <--> FastAPI[FastAPI Backend Server]
    FastAPI <--> Supervisor[Multi-Agent Supervisor Engine]
    Supervisor <--> Chroma[ChromaDB Vector Store - 180 Verified Datasets]
    Supervisor <--> Groq[Groq / Llama-3.3-70B LLM]
    Supervisor <--> SentenceTransformers[SentenceTransformer Embeddings]
    React <--> WebSpeech[Browser Native Web Speech API]
`

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm**
- **Git**

### 2. Backend Setup
`ash
cd backend
python -m venv venv
.\venv\Scripts\activate      # On Windows
# source venv/bin/activate   # On Linux/macOS

pip install -r requirements.txt

# Ingest datasets into ChromaDB (180 items)
python ingest.py

# Start FastAPI server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
`
API Documentation: http://127.0.0.1:8000/docs

### 3. Frontend Setup
`ash
cd bis-assistant-ai
npm install
npm run dev
`
Access Frontend UI: http://localhost:5173/

---

## 📁 Repository Structure

`
BIS-AI/
├── backend/
│   ├── data/                   # 180 curated BIS datasets & JSON schemas
│   ├── ingest.py               # ChromaDB embedding & vector indexing
│   ├── main.py                 # FastAPI endpoints & REST routes
│   ├── rag.py                  # Semantic search & LLM RAG pipelines
│   ├── supervisor.py           # Multi-agent orchestrator & manufacturer logic
│   ├── voice.py                # Audio handling & Whisper fallback
│   ├── translate.py            # Multilingual translation utilities
│   ├── requirements.txt        # Backend Python dependencies
│   └── .env.example            # Environment variables template
├── bis-assistant-ai/
│   ├── src/
│   │   ├── components/         # Navbar, Footer, Modal, Skeleton loaders
│   │   ├── context/            # LanguageContext & multilingual state
│   │   ├── pages/              # Home, Chat, Manufacturer, Standards, Labs, About
│   │   ├── utils/              # Translations (6 languages) & API clients
│   │   └── index.css           # Design system tokens & Tailwind CSS
│   ├── package.json            # Frontend dependencies
│   └── vite.config.js          # Vite build configuration
├── .gitignore                  # Git exclusions for venv, node_modules, keys
└── README.md                   # Project documentation
`

---

## 🛡️ License & Disclaimer

This project was developed for demonstration and hackathon evaluation. Official certification filings, statutory fee payments, and compliance submissions must be conducted through the official [Manak Online Portal](https://www.manakonline.in) and [Bureau of Indian Standards](https://www.bis.gov.in).
