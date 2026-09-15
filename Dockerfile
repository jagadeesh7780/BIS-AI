# ─────────────────────────────────────────────────────────────
# BIS AI V2 — Unified Production Dockerfile
# ─────────────────────────────────────────────────────────────

# Build stage for React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY bis-assistant-ai/package*.json ./
RUN npm ci
COPY bis-assistant-ai/ ./
RUN npm run build

# Runtime stage for FastAPI Backend + Static Frontend
FROM python:3.11-slim
WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist ./backend/static

ENV PORT=8000
ENV ENVIRONMENT=production
EXPOSE 8000

WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
