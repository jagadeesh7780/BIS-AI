import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://bis-assistant-backend.onrender.com'

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Silently fail — pages use mock fallback data
    return Promise.reject(error)
  }
)

// ─── Chat API ───────────────────────────────────────────────────────────────
export const sendChatMessage = async (query, language = 'en', role = 'all') => {
  return apiClient.post('/api/chat', { query, language, role })
}

// ─── Standards API ───────────────────────────────────────────────────────────
export const searchStandards = async (query, language = 'en') => {
  return apiClient.post('/api/chat', { query, language })
}

export const detectStandardFromImage = async (imageFile) => {
  const formData = new FormData()
  formData.append('image', imageFile)
  return apiClient.post('/api/standards/detect-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getStandardById = async (id) => {
  return apiClient.get(`/api/standards/${id}`)
}

export const compareStandards = async (id1, id2) => {
  return apiClient.post('/api/standards/compare', { standard1: id1, standard2: id2 })
}

// ─── Certification API ────────────────────────────────────────────────────────
export const getCertificationSchemes = async () => {
  return apiClient.get('/api/certification/schemes')
}

export const getApplicationStatus = async (applicationId) => {
  return apiClient.get(`/api/certification/status/${applicationId}`)
}

// ─── Labs API ─────────────────────────────────────────────────────────────────
export const getNearbyLabs = async (city) => {
  return apiClient.get(`/api/labs/nearby?city=${encodeURIComponent(city)}`)
}

// ─── Voice API ────────────────────────────────────────────────────────────────
export const transcribeVoice = async (audioBlob) => {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')
  return apiClient.post('/api/voice/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ─── Complaints API ──────────────────────────────────────────────────────────
export const submitComplaint = async (complaintData) => {
  return apiClient.post('/api/complaints', complaintData)
}

export const getComplaintStatus = async (complaintId) => {
  return apiClient.get(`/api/complaints/${complaintId}`)
}

// ─── Manufacturer Process API ────────────────────────────────────────────────
export const detectManufacturerStandard = async (productName) => {
  return apiClient.post('/api/manufacturer/detect', { product_name: productName })
}

export const processManufacturerApp = async (applicationData) => {
  return apiClient.post('/api/manufacturer/process', applicationData)
}

// ─── BIS Services API ────────────────────────────────────────────────────────
export const getBisServices = async (category = null, search = null) => {
  let url = '/api/services'
  const params = []
  if (category) params.push(`category=${encodeURIComponent(category)}`)
  if (search) params.push(`search=${encodeURIComponent(search)}`)
  if (params.length) url += `?${params.join('&')}`
  return apiClient.get(url)
}

// ─── Multi-Agent Supervisor API ──────────────────────────────────────────────
export const orchestrateManufacturer = async (payload) => {
  return apiClient.post('/api/agents/manufacturer/orchestrate', payload)
}

export const approveAndSubmitManufacturer = async (payload) => {
  return apiClient.post('/api/agents/manufacturer/approve-and-submit', payload)
}

export const triageConsumerComplaint = async (payload) => {
  return apiClient.post('/api/agents/consumer/triage', payload)
}

export const verifyConsumerProduct = async (payload) => {
  return apiClient.post('/api/agents/consumer/verify', payload)
}

export const orchestrateManufacturerAgents = async (payload) => {
  return apiClient.post('/api/agents/manufacturer/orchestrate', payload)
}

export default apiClient

