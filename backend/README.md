# BIS Assistant AI — Backend

FastAPI + RAG backend powering all 11 features of BIS Assistant AI.

## Tech Stack (all free, except Groq)

| Component | Library | Cost |
|-----------|---------|------|
| Web framework | FastAPI + Uvicorn | Free |
| LLM (RAG generation) | Groq — llama-3.3-70b-versatile | Free tier |
| Vector DB | ChromaDB (local, persistent) | Free |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) | Free |
| Speech-to-text | openai-whisper (local) | Free |
| Text-to-speech | gTTS | Free |
| Translation | deep-translator | Free |
| Image classification | sentence-transformers CLIP | Free |

---

## Setup

### 1. Create a Python virtual environment

```bash
cd backend
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> Note: First install may take several minutes — downloads PyTorch, sentence-transformers, and Whisper model files.

### 3. Set environment variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Groq API key (free at console.groq.com)
# GROQ_API_KEY=gsk_...
```

### 4. Run the ingestion script (ONCE — builds the vector database)

```bash
python ingest.py
```

You should see:
```
✅ Ingestion complete! 15 standards stored in ChromaDB.
```

### 5. Start the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Server runs at: **http://localhost:8000**  
API docs at: **http://localhost:8000/docs**

---

## Feature → Endpoint Mapping

| # | Feature | Method | Endpoint |
|---|---------|--------|---------|
| 1 | Text Chat (RAG) | POST | `/api/chat` |
| 2 | Standard Recommendation | POST | `/api/chat` (reuses chat) |
| 3 | Certification Guide | GET | `/api/certification/schemes` |
| 3 | Single Scheme Detail | GET | `/api/certification/schemes/{id}` |
| 4 | Multilingual | — | Built into `/api/chat` via `language` param |
| 5 | Professional UI | — | Frontend concern |
| 6 | Voice Transcription | POST | `/api/voice/transcribe` |
| 6 | Voice TTS | POST | `/api/voice/speak` |
| 7 | Confidence Scores | — | Built into `/api/chat` response |
| 8 | Lab Finder | GET | `/api/labs/nearby?city=Mumbai` |
| 9 | Image → Standard | POST | `/api/standards/detect-image` |
| 10 | Certification Tracker | GET | `/api/certification/tracker/{id}` |
| 11 | Compare Standards | POST | `/api/standards/compare` |

Demo tracker IDs: `BIS-2024-001`, `BIS-2024-002`, `BIS-2024-003`

---

## API Examples

### Chat (Feature 1)
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What IS standard applies to pressure cookers?", "language": "en"}'
```

### Hindi Chat (Feature 4)
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "प्रेशर कुकर के लिए कौन सा IS मानक लागू होता है?", "language": "hi"}'
```

### Lab Finder (Feature 8)
```bash
curl "http://localhost:8000/api/labs/nearby?city=Mumbai"
```

### Tracker (Feature 10)
```bash
curl "http://localhost:8000/api/certification/tracker/BIS-2024-001"
```

---

## Notes

- The Whisper model downloads ~150MB on first use of `/api/voice/transcribe`
- The CLIP model downloads ~350MB on first use of `/api/standards/detect-image`  
- Both models are cached locally after first download
- The ChromaDB vector database is stored in `backend/chroma_db/`
- All data in `data/` folder is demo/placeholder data — replace with official BIS data for production
