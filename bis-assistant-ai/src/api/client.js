/**
 * BIS AI V2 — Axios API Client
 * STEP 16: Frontend connected to real backend APIs
 * STEP 13: No API keys in frontend code
 * STEP 8 fix: Standards search uses correct /api/standards GET endpoint
 */
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://bis-assistant-backend.onrender.com'

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
)

// ── Chat ──────────────────────────────────────────────────────────────────────
export const sendChatMessage = async (query, language = 'en', role = 'all') =>
  apiClient.post('/api/chat', { query, language, role })

// ── Standards ─────────────────────────────────────────────────────────────────
// STEP 8 FIX: Use dedicated GET /api/standards endpoint (not /api/chat)
export const searchStandards = async (query, category = null, limit = 20) => {
  const params = new URLSearchParams()
  if (query)    params.append('search', query)
  if (category) params.append('category', category)
  params.append('limit', String(limit))
  return apiClient.get(`/api/standards?${params.toString()}`)
}

export const getStandardById   = async (id) => apiClient.get(`/api/standards/${id}`)

export const compareStandards  = async (id1, id2) =>
  apiClient.post('/api/standards/compare', { standard1: id1, standard2: id2 })

export const detectStandardFromImage = async (imageFile) => {
  const formData = new FormData()
  formData.append('image', imageFile)
  return apiClient.post('/api/standards/detect-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ── Certification ─────────────────────────────────────────────────────────────
export const getCertificationSchemes = async () =>
  apiClient.get('/api/certification/schemes')

export const getApplicationStatus = async (applicationId) =>
  apiClient.get(`/api/certification/tracker/${applicationId}`)

// ── Labs ──────────────────────────────────────────────────────────────────────
export const getNearbyLabs = async (city) =>
  apiClient.get(`/api/labs/nearby?city=${encodeURIComponent(city)}`)

// ── Voice ─────────────────────────────────────────────────────────────────────
export const transcribeVoice = async (audioBlob) => {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')
  return apiClient.post('/api/voice/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ── Complaints ────────────────────────────────────────────────────────────────
export const submitComplaint   = async (data) => apiClient.post('/api/complaints', data)
export const getComplaintStatus = async (id)  => apiClient.get(`/api/complaints/${id}`)

// ── Manufacturer ──────────────────────────────────────────────────────────────
export const detectManufacturerStandard = async (productName) =>
  apiClient.post('/api/v1/compliance/analyze', { product_name: productName, city: 'Mumbai', scale: 'MSME' })

export const processManufacturerApp = async (data) =>
  apiClient.post('/api/manufacturer/process', data)

export const orchestrateManufacturer = async (payload) =>
  apiClient.post('/api/agents/manufacturer/orchestrate', payload)

export const orchestrateManufacturerAgents = async (payload) =>
  apiClient.post('/api/agents/manufacturer/orchestrate', payload)

export const approveAndSubmitManufacturer = async (payload) =>
  apiClient.post('/api/agents/manufacturer/approve-and-submit', payload)

// ── Consumer Agents ───────────────────────────────────────────────────────────
export const triageConsumerComplaint = async (payload) =>
  apiClient.post('/api/agents/consumer/triage', payload)

export const verifyConsumerProduct = async (payload) =>
  apiClient.post('/api/agents/consumer/verify', payload)

// ── BIS Services ─────────────────────────────────────────────────────────────
export const getBisServices = async (category = null, search = null) => {
  const params = new URLSearchParams()
  if (category) params.append('category', category)
  if (search)   params.append('search', search)
  const qs = params.toString()
  return apiClient.get(`/api/services${qs ? `?${qs}` : ''}`)
}

// ── Evaluation ────────────────────────────────────────────────────────────────
export const runEvaluation = async () => apiClient.get('/api/v1/evaluation/run')

// ── ML Risk Engine ────────────────────────────────────────────────────────────
export const predictMLRisk = async (payload) =>
  apiClient.post('/api/ml/predict', payload)

export const getMLMetrics = async () =>
  apiClient.get('/api/ml/metrics')

export default apiClient
