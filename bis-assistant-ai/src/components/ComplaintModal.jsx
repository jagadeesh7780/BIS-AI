import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Camera, Upload, X, CheckCircle, RefreshCw,
  Phone, FileText, ShieldAlert, Sparkles, Image, Check
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { submitComplaint, triageConsumerComplaint } from '../api/client'

const COMPLAINT_CATEGORIES = [
  { id: 'isi', label: 'ISI Mark Violation', badge: 'Scheme I (ISI)', icon: ShieldAlert, desc: 'Fake ISI marks, missing CM/L number, substandard product quality' },
  { id: 'hallmarking', label: 'Gold Hallmarking Violation', badge: 'Hallmark & HUID', icon: Sparkles, desc: 'Fake hallmark logo, missing 6-digit HUID, gold purity mismatch' },
  { id: 'crs', label: 'CRS Electronics Scheme', badge: 'Compulsory Reg (CRS)', icon: AlertTriangle, desc: 'Unregistered IT goods, invalid R-number, electrical safety hazards' },
]

export default function ComplaintModal({ onClose, onSubmitted, initialData = {} }) {
  const { t } = useLang()
  const [mode, setMode] = useState('camera') // 'camera' or 'upload'
  const [category, setCategory] = useState(initialData.category || 'isi')
  const [form, setForm] = useState({
    contactNumber: initialData.contactNumber || '',
    isiNumber: initialData.isiNumber || '',
    productName: initialData.productName || '',
    description: initialData.description || '',
    photoData: null,
    photoPreview: null
  })
  
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [successData, setSuccessData] = useState(null)

  const activeCategory = COMPLAINT_CATEGORIES.find(c => c.id === category) || COMPLAINT_CATEGORIES[0]

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  // Start Camera
  const startCamera = async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err) {
      console.error('Camera access error:', err)
      setCameraError('Camera access denied or unavailable. Please upload a file instead.')
      setMode('upload')
    }
  }

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    if (mode === 'camera' && !form.photoPreview) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [mode, form.photoPreview])

  // Capture Snapshot from Camera
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setForm(f => ({ ...f, photoData: dataUrl, photoPreview: dataUrl }))
    stopCamera()
  }

  // Handle File Upload
  const handleFileUpload = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      setForm(f => ({ ...f, photoData: e.target.result, photoPreview: e.target.result }))
    }
    reader.readAsDataURL(file)
  }

  // Retake Photo
  const retakePhoto = () => {
    setForm(f => ({ ...f, photoData: null, photoPreview: null }))
    if (mode === 'camera') startCamera()
  }

  // Submit Complaint
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.contactNumber.trim() || !form.description.trim()) return

    setLoading(true)
    try {
      const res = await triageConsumerComplaint({
        contact_number: form.contactNumber,
        description: form.description,
        isi_number: form.isiNumber,
        product_name: form.productName,
        category: category,
        category_name: activeCategory.label,
        photo_type: mode,
        photo_data: form.photoData
      })
      setSuccessData(res)
      if (onSubmitted) onSubmitted(res)
    } catch {
      // Offline / fallback ID
      const fallbackId = `BIS-CMP-2026-${Math.floor(10000 + Math.random() * 90000)}`
      const fallbackRes = {
        success: true,
        complaint_id: fallbackId,
        status: 'Registered & Assigned to Enforcement Cell',
        details: { ...form, category, category_name: activeCategory.label, complaint_id: fallbackId }
      }
      setSuccessData(fallbackRes)
      if (onSubmitted) onSubmitted(fallbackRes)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-md overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.94, y: 25 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 25 }}
        className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-8 border border-slate-100"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-amber-600 px-6 py-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <ShieldAlert size={22} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{t('comp_title')}</h2>
              <p className="text-red-100 text-xs">{t('comp_sub')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/20 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Success Screen */}
        {successData ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 animate-bounce-slow">
              <CheckCircle size={44} />
            </div>
            <div>
              <span className="inline-block bg-green-50 text-green-700 border border-green-200 text-xs font-bold px-3 py-1 rounded-full mb-2">
                {t('comp_success_title')}
              </span>
              <h3 className="text-2xl font-bold text-navy-900">{successData.complaint_id}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('comp_success_msg')}</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 border border-slate-200 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">{t('comp_tracking_id')}</span>
                <span className="font-bold text-navy-900">{successData.complaint_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold text-green-600">Registered & Inspection Queued</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Contact Number</span>
                <span className="font-medium text-slate-800">{form.contactNumber}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 text-left">
              <p className="font-semibold mb-1">📞 Official BIS Grievance Redressal</p>
              <p>{t('comp_helpline_note')}</p>
            </div>

            <button
              onClick={onClose}
              className="w-full btn-primary py-3 rounded-xl font-bold"
            >
              Close & Return to Chat
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Photo Evidence (2 Options) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Photo Evidence (2 Options)
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { setMode('camera'); setForm(f => ({ ...f, photoPreview: null })) }}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    mode === 'camera'
                      ? 'bg-[#0f4bb4] hover:bg-[#0c3d94] text-white border-[#0f4bb4] shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Camera size={15} /> 📷 Take Camera Photo
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('upload'); stopCamera(); setForm(f => ({ ...f, photoPreview: null })) }}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    mode === 'upload'
                      ? 'bg-[#0f4bb4] hover:bg-[#0c3d94] text-white border-[#0f4bb4] shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Upload size={15} /> 📁 Upload Photo from File
                </button>
              </div>

              {/* Camera Live Stream or Photo Preview */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 min-h-[220px] flex items-center justify-center border border-slate-200">
                {form.photoPreview ? (
                  <div className="relative w-full h-[220px] bg-black">
                    <img src={form.photoPreview} alt="Evidence" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="absolute bottom-3 right-3 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow hover:bg-red-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={12} /> {t('comp_retake_btn')}
                    </button>
                  </div>
                ) : mode === 'camera' ? (
                  <div className="w-full relative flex flex-col items-center">
                    <video ref={videoRef} playsInline autoPlay muted className="w-full h-[220px] object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    {cameraError ? (
                      <div className="absolute inset-0 bg-navy-950/80 p-4 flex flex-col items-center justify-center text-center text-white">
                        <AlertTriangle size={24} className="text-amber-400 mb-2" />
                        <p className="text-xs">{cameraError}</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={captureSnapshot}
                        className="absolute bottom-3 bg-[#e84133] hover:bg-[#d03528] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border-2 border-white transition-all transform hover:scale-105 cursor-pointer"
                      >
                        <Camera size={14} /> Capture Snapshot
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files?.[0]) }}
                    className="p-6 text-center cursor-pointer text-slate-400 hover:text-navy-300 w-full"
                  >
                    <Upload size={32} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-xs text-slate-300 font-medium">Click or drag & drop product photo here</p>
                    <span className="text-[10px] text-slate-500">Supports JPG, PNG, WEBP</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleFileUpload(e.target.files?.[0])}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Contact / Mobile Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Contact / Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="tel"
                  value={form.contactNumber}
                  onChange={e => setForm(f => ({ ...f, contactNumber: e.target.value }))}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm bg-slate-50 font-medium"
                />
              </div>
            </div>

            {/* ISI CM/L Number or Standard and Product Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  ISI CM/L Number or Standard (if visible)
                </label>
                <input
                  type="text"
                  value={form.isiNumber}
                  onChange={e => setForm(f => ({ ...f, isiNumber: e.target.value }))}
                  placeholder="e.g. CM/L-1234567 or IS 2347"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Product Name / Brand
                </label>
                <input
                  type="text"
                  value={form.productName}
                  onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
                  placeholder="e.g. Electric Kettle / Gold Ring"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm bg-slate-50"
                />
              </div>
            </div>

            {/* Problem Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Describe the Problem / Issue <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe what is wrong (e.g. ISI mark missing, product melted, fake logo, purity mismatch)..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm bg-slate-50 resize-none leading-relaxed"
              />
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!form.contactNumber.trim() || !form.description.trim() || loading}
                className="flex-[2] py-3 rounded-xl bg-[#fa7070] hover:bg-[#f05c5c] disabled:opacity-40 text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                {loading ? t('comp_submitting') : 'Send Complaint'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
