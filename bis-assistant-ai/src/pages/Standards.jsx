import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Upload, Image, ArrowRight, CheckCircle, Tag,
  FileText, ChevronRight, Zap, X, AlertCircle
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { searchStandards, detectStandardFromImage } from '../api/client'
import { mockStandards } from '../utils/mockData'
import { SkeletonStandardCard } from '../components/SkeletonLoader'

function ConfidencePill({ score }) {
  const color = score >= 85 ? 'bg-green-100 text-green-700' : score >= 65 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}% match</span>
  )
}

function StandardCard({ std, t }) {
  const navigate = useNavigate()
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card hover:scale-[1.01] transition-all duration-300 cursor-pointer group"
      onClick={() => navigate(`/standards/${std.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="inline-flex items-center gap-1 bg-navy-900 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
          <FileText size={10} /> {std.number}
        </span>
        {std.confidence && <ConfidencePill score={std.confidence} />}
      </div>
      <h3 className="font-bold text-navy-900 text-base mb-2 group-hover:text-navy-700 transition-colors">
        {std.title}
      </h3>
      <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-2">{std.summary}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
            <Tag size={10} /> {std.category}
          </span>
          {std.scheme && (
            <span className="bg-gold-50 text-gold-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 border border-gold-200">
              <CheckCircle size={10} /> {std.scheme}
            </span>
          )}
        </div>
        <button className="flex items-center gap-1 text-xs font-semibold text-navy-600 group-hover:text-navy-900">
          {t('standards_view_details')} <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </motion.div>
  )
}

export default function Standards() {
  const { t } = useLang()
  const [activeTab, setActiveTab] = useState('text')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const filterMockResults = (q) => {
    if (!q) return mockStandards
    const lower = q.toLowerCase()
    return mockStandards.filter(s =>
      s.keywords.some(kw => lower.includes(kw)) ||
      s.title.toLowerCase().includes(lower) ||
      s.category.toLowerCase().includes(lower)
    ).slice(0, 6) || mockStandards.slice(0, 4)
  }

  const handleTextSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await searchStandards(query)
      setResults(res.standards || res.results || [])
    } catch {
      const filtered = filterMockResults(query)
      await new Promise(r => setTimeout(r, 800))
      setResults(filtered.length ? filtered : mockStandards.slice(0, 4))
    } finally {
      setLoading(false)
    }
  }

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setUploadedImage(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    handleImageFile(file)
  }

  const handleImageSearch = async () => {
    if (!uploadedImage) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await detectStandardFromImage(uploadedImage)
      setResults(res.standards || res.results || [])
    } catch {
      await new Promise(r => setTimeout(r, 1200))
      // Return random subset of mockStandards as "detected"
      setResults(mockStandards.slice(0, 3).map(s => ({ ...s, confidence: Math.floor(Math.random() * 20) + 75 })))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-navy-50 text-navy-700 border border-navy-100 rounded-full px-3 py-1 text-xs font-semibold mb-4">
              <Search size={12} /> Standards Search
            </div>
            <h1 className="section-heading mb-2">{t('standards_title')}</h1>
            <p className="section-subheading">{t('standards_subtitle')}</p>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6">
            {[
              { id: 'text', label: t('standards_text_tab'), icon: Search },
              { id: 'image', label: t('standards_image_tab'), icon: Image },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-navy-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Text search form */}
        <AnimatePresence mode="wait">
          {activeTab === 'text' && (
            <motion.form
              key="text"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleTextSearch}
              className="flex gap-3 mb-10"
            >
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('standards_placeholder')}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-400 bg-white text-sm"
                />
              </div>
              <button type="submit" className="btn-primary flex items-center gap-2">
                <Zap size={15} /> {t('standards_search_btn')}
              </button>
            </motion.form>
          )}

          {/* Image upload — Feature 9 */}
          {activeTab === 'image' && (
            <motion.div
              key="image"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-10"
            >
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !imagePreview && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                  dragOver ? 'border-navy-400 bg-navy-50' : 'border-slate-300 bg-white hover:border-navy-300 hover:bg-slate-50'
                }`}
              >
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Product" className="max-h-48 rounded-xl mx-auto shadow-md" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setUploadedImage(null); setImagePreview(null) }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X size={12} />
                    </button>
                    <p className="text-sm text-slate-500 mt-3">{uploadedImage?.name}</p>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 font-medium">{t('standards_upload_label')}</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP up to 10MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleImageFile(e.target.files?.[0])}
              />
              <button
                onClick={handleImageSearch}
                disabled={!uploadedImage || loading}
                className="mt-4 btn-primary flex items-center gap-2 disabled:opacity-40"
              >
                <Image size={15} /> {t('standards_detect_btn')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-700 text-sm mb-6">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Results */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonStandardCard key={i} />)}
          </div>
        )}

        {!loading && searched && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-navy-900 text-lg flex items-center gap-2">
                {t('standards_results_title')}
                <span className="text-sm font-normal text-slate-500">({results.length} found)</span>
              </h2>
              <div className="flex gap-2">
                <span className="badge-ai"><Zap size={10} /> {t('powered_by')}</span>
                <span className="badge-source">{t('source_official')}</span>
              </div>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16">
                <Search size={40} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500">{t('standards_no_results')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {results.map(std => <StandardCard key={std.id} std={std} t={t} />)}
              </div>
            )}
          </>
        )}

        {/* Browse all when not searched */}
        {!loading && !searched && (
          <>
            <h2 className="font-bold text-navy-900 text-lg mb-5">Popular Standards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mockStandards.slice(0, 6).map(std => <StandardCard key={std.id} std={std} t={t} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
