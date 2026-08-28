# BIS Assistant AI 🇮🇳

An AI-powered conversational assistant for the **Bureau of Indian Standards (BIS)** — helping MSMEs, startups, students, and consumers navigate Indian Standards, certification guidance, and related services.

Built for the **BIS Hackathon 2024** demo.

---

## ✨ Features (All 11 implemented)

| # | Feature | Route |
|---|---------|-------|
| 1 | Text-based Chat with RAG-backed answers | `/chat` |
| 2 | Standard Recommendation from product description | `/standards` |
| 3 | Certification Guide with step-by-step visual process | `/certification` |
| 4 | Multilingual support (English/Telugu/Hindi toggle) | All pages |
| 5 | Clean, professional, polished UI (navy/gold theme) | All pages |
| 6 | Voice input (mic button) + Voice output (TTS) | `/chat` |
| 7 | Confidence score + source citation on every answer | `/chat` |
| 8 | Nearby testing lab finder | `/labs` |
| 9 | Product image upload → standard detection | `/standards` |
| 10 | Certification journey tracker (visual stepper) | `/certification/tracker` |
| 11 | Standard comparison tool (side-by-side table) | `/compare` |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/bis-assistant-ai
cd bis-assistant-ai

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env and set your backend URL

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
VITE_API_URL=http://localhost:8000
```

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Base URL of the backend FastAPI/Flask server | `http://localhost:8000` |

> **Note:** The frontend works fully with mock/demo data if the backend is unavailable. All 11 features are demonstrable without a running backend.

---

## 🏗️ Project Structure

```
src/
├── api/
│   └── client.js           # Axios API client with all endpoints
├── components/
│   ├── Navbar.jsx           # Sticky navbar with language switcher
│   ├── Footer.jsx           # Footer with links and disclaimer
│   └── SkeletonLoader.jsx   # Reusable skeleton loading components
├── context/
│   └── LanguageContext.jsx  # React context for multilingual state
├── pages/
│   ├── Home.jsx             # Landing page with hero, features, CTA
│   ├── Chat.jsx             # AI chat with voice input/output (Features 1, 6, 7)
│   ├── Standards.jsx        # Text/image search (Features 2, 9)
│   ├── StandardDetail.jsx   # Individual standard detail page
│   ├── Certification.jsx    # Certification guide stepper (Feature 3)
│   ├── Tracker.jsx          # Certification journey tracker (Feature 10)
│   ├── Compare.jsx          # Standards comparison tool (Feature 11)
│   ├── Labs.jsx             # Lab finder with map (Feature 8)
│   └── About.jsx            # About page with FAQ
└── utils/
    ├── translations.js      # i18n dictionary for EN/HI/TE (Feature 4)
    └── mockData.js          # Demo data for offline/fallback mode
```

---

## 🎨 Design System

- **Primary color:** Deep Navy `#0b3d91` (BIS/government trust color)
- **Accent color:** Gold/Amber `#f5a623` (CTAs, badges, highlights)
- **Background:** Off-white `#f7f8fa`
- **Cards:** Pure white with subtle shadow (`shadow-card`)
- **Typography:** Inter / Poppins (Google Fonts)
- **Animations:** Framer Motion page transitions + scroll-triggered reveals

---

## 🔌 Backend API Endpoints

The frontend expects these endpoints on `VITE_API_URL`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Chat with RAG — `{ query, language }` |
| POST | `/api/standards/detect-image` | Image → standard detection |
| GET | `/api/standards/{id}` | Get standard details |
| POST | `/api/standards/compare` | Compare two standards |
| GET | `/api/certification/schemes` | Get certification schemes |
| GET | `/api/certification/status/{id}` | Get application status |
| GET | `/api/labs/nearby?city=` | Get labs by city |
| POST | `/api/voice/transcribe` | Voice transcription |

> All endpoints have graceful fallback to mock data if unavailable.

---

## 📱 Supported Languages

| Code | Language | Script |
|------|----------|--------|
| `en` | English | Latin |
| `hi` | Hindi | Devanagari |
| `te` | Telugu | Telugu |

---

## ⚠️ Disclaimer

This is a **hackathon demonstration** project. Data shown is for demo purposes only. Always verify with the official [Bureau of Indian Standards website](https://www.bis.gov.in).

---

## 📜 License

MIT — Built for BIS Hackathon 2024.
