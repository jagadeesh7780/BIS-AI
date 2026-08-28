import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award, CheckCircle, Clock, FileText, ChevronRight,
  ChevronDown, ChevronUp, Zap, ArrowRight, Building2,
  Shield, BookOpen, BarChart2
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { getCertificationSchemes } from '../api/client'
import { mockCertificationSchemes } from '../utils/mockData'

function StepCard({ step, isLast }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="relative">
      {/* Connector */}
      {!isLast && (
        <div className="absolute left-5 top-16 bottom-0 w-0.5 bg-slate-200 z-0" />
      )}
      <motion.div
        initial={{ opacity: 0, x: -15 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: step.id * 0.1 }}
        className="relative z-10 flex gap-4"
      >
        {/* Step indicator */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-sm shadow-md">
          {step.id}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-card mb-4 overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-navy-900">{step.title}</h3>
                <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                  <Clock size={10} /> {step.duration}
                </span>
              </div>
              <p className="text-sm text-slate-500">{step.description}</p>
            </div>
            <div className="ml-3 flex-shrink-0">
              {expanded ? <ChevronUp size={16} className="text-navy-500" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-700 mt-3 mb-2 flex items-center gap-2">
                    <FileText size={13} /> Required Documents:
                  </p>
                  <ul className="space-y-1.5">
                    {step.documents?.map((doc, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

function SchemeCard({ scheme, isActive, onClick }) {
  const schemeColors = {
    isi: { bg: 'bg-navy-900', border: 'border-navy-900', text: 'text-navy-900', light: 'bg-navy-50' },
    hallmarking: { bg: 'bg-amber-600', border: 'border-amber-500', text: 'text-amber-700', light: 'bg-amber-50' },
    crs: { bg: 'bg-emerald-700', border: 'border-emerald-600', text: 'text-emerald-700', light: 'bg-emerald-50' },
  }
  const c = schemeColors[scheme.id] || schemeColors.isi

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
        isActive
          ? `${c.border} ${c.light} shadow-md`
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-card'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${isActive ? c.bg : 'bg-slate-100'} flex items-center justify-center transition-colors`}>
          <Award size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
        </div>
        <div className="flex-1">
          <div className={`font-bold text-sm ${isActive ? c.text : 'text-slate-700'}`}>{scheme.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">{scheme.steps.length} steps</div>
        </div>
        <ChevronRight size={14} className={isActive ? c.text : 'text-slate-300'} />
      </div>
    </button>
  )
}

export default function Certification() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [schemes, setSchemes] = useState(null)
  const [activeSchemeId, setActiveSchemeId] = useState('isi')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await getCertificationSchemes()
        setSchemes(data)
      } catch {
        await new Promise(r => setTimeout(r, 500))
        setSchemes(mockCertificationSchemes)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const activeScheme = schemes?.[activeSchemeId]

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-gold-50 text-gold-700 border border-gold-200 rounded-full px-3 py-1 text-xs font-semibold mb-4">
              <Award size={12} /> Certification Guide
            </div>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="section-heading mb-2">{t('cert_title')}</h1>
                <p className="section-subheading">{t('cert_subtitle')}</p>
              </div>
              <button
                onClick={() => navigate('/certification/tracker')}
                className="btn-gold flex items-center gap-2"
              >
                <BarChart2 size={15} /> {t('cert_tracker_btn')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
            </div>
            <div className="lg:col-span-3 space-y-4">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Scheme selector */}
            <div className="space-y-3">
              <h2 className="font-bold text-navy-900 text-sm uppercase tracking-wider mb-3">
                Select Scheme
              </h2>
              {schemes && Object.values(schemes).map(scheme => (
                <SchemeCard
                  key={scheme.id}
                  scheme={scheme}
                  isActive={activeSchemeId === scheme.id}
                  onClick={() => setActiveSchemeId(scheme.id)}
                />
              ))}

              {/* Info box */}
              <div className="bg-navy-50 border border-navy-100 rounded-2xl p-4 mt-4">
                <p className="text-xs text-navy-700 font-medium mb-2 flex items-center gap-1.5">
                  <Shield size={12} /> Need help?
                </p>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Our AI assistant can answer specific certification questions.
                </p>
                <button
                  onClick={() => navigate('/chat?q=How to apply for ISI Mark certification?')}
                  className="text-xs text-navy-700 font-semibold flex items-center gap-1 hover:underline"
                >
                  Ask AI <ArrowRight size={10} />
                </button>
              </div>
            </div>

            {/* Steps */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                {activeScheme && (
                  <motion.div
                    key={activeSchemeId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="font-bold text-navy-900 text-xl">{activeScheme.name}</h2>
                        <p className="text-slate-500 text-sm mt-1">{activeScheme.description}</p>
                      </div>
                      <span className="bg-navy-900 text-white text-sm font-bold px-3 py-1 rounded-full">
                        {activeScheme.steps.length} Steps
                      </span>
                    </div>

                    <div className="pl-2">
                      {activeScheme.steps.map((step, idx) => (
                        <StepCard
                          key={step.id}
                          step={step}
                          isLast={idx === activeScheme.steps.length - 1}
                        />
                      ))}
                    </div>

                    {/* CTA */}
                    <div className="mt-6 bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white">
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                          <h3 className="font-bold text-lg mb-1">Ready to start?</h3>
                          <p className="text-navy-200 text-sm">Apply for {activeScheme.name} certification on the official BIS portal.</p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => navigate('/certification/tracker')}
                            className="btn-gold text-sm py-2 flex items-center gap-2"
                          >
                            <Building2 size={14} /> Track Application
                          </button>
                          <a
                            href="https://www.manakonline.in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border border-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
                          >
                            <BookOpen size={14} /> BIS Portal
                          </a>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


