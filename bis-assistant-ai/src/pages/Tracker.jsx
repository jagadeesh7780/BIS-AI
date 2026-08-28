import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, Clock, Circle, AlertCircle, Search,
  FileText, Building2, FlaskConical, Award, ChevronDown, ChevronUp,
  ArrowRight, Zap, RefreshCw
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { getApplicationStatus } from '../api/client'
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'

// ─── Mock tracker stages ──────────────────────────────────────────────────────
const DEMO_APPLICATIONS = {
  'BIS-2024-001': {
    appId: 'BIS-2024-001',
    product: 'Domestic Pressure Cooker',
    standard: 'IS 2347',
    scheme: 'ISI Mark',
    applicant: 'Sunrise Industries Pvt. Ltd.',
    submittedOn: '15 Jan 2024',
    currentStage: 3,
    stages: [
      { id: 1, label: 'Application Submitted', icon: FileText, done: true, date: '15 Jan 2024', note: 'Application received and reference number assigned.' },
      { id: 2, label: 'Document Verification', icon: Search, done: true, date: '22 Jan 2024', note: 'All documents verified. Factory inspection scheduled.' },
      { id: 3, label: 'Factory Inspection', icon: Building2, done: false, active: true, date: 'In Progress', note: 'BIS inspector visit scheduled for 30 Jan 2024.' },
      { id: 4, label: 'Sample Testing', icon: FlaskConical, done: false, date: 'Pending', note: 'Awaiting inspection completion.' },
      { id: 5, label: 'Licence Granted', icon: Award, done: false, date: 'Pending', note: 'Final approval and licence issuance.' },
    ],
  },
  'BIS-2024-002': {
    appId: 'BIS-2024-002',
    product: 'LED Bulb (10W)',
    standard: 'IS 16102',
    scheme: 'CRS',
    applicant: 'BrightTech Solutions',
    submittedOn: '10 Feb 2024',
    currentStage: 4,
    stages: [
      { id: 1, label: 'Application Submitted', icon: FileText, done: true, date: '10 Feb 2024', note: 'Online application submitted via CRS portal.' },
      { id: 2, label: 'Document Verification', icon: Search, done: true, date: '14 Feb 2024', note: 'Test reports and Declaration of Conformity accepted.' },
      { id: 3, label: 'Factory Inspection', icon: Building2, done: true, date: '20 Feb 2024', note: 'Remote desk review completed for CRS scheme.' },
      { id: 4, label: 'Sample Testing', icon: FlaskConical, done: false, active: true, date: 'In Progress', note: 'Samples under testing at BIS approved lab.' },
      { id: 5, label: 'Licence Granted', icon: Award, done: false, date: 'Pending', note: 'Awaiting test report clearance.' },
    ],
  },
  'BIS-2024-003': {
    appId: 'BIS-2024-003',
    product: 'Gold Jewellery (22K)',
    standard: 'IS 1417',
    scheme: 'Hallmarking',
    applicant: 'Ramesh Jewellers',
    submittedOn: '01 Mar 2024',
    currentStage: 5,
    stages: [
      { id: 1, label: 'Application Submitted', icon: FileText, done: true, date: '01 Mar 2024', note: 'Jeweller registered on HUID portal.' },
      { id: 2, label: 'Document Verification', icon: Search, done: true, date: '01 Mar 2024', note: 'KYC and GST documents verified.' },
      { id: 3, label: 'Factory Inspection', icon: Building2, done: true, date: '05 Mar 2024', note: 'Jewellery submitted to AHC.' },
      { id: 4, label: 'Sample Testing', icon: FlaskConical, done: true, date: '07 Mar 2024', note: 'Purity testing completed — 22K (916) confirmed.' },
      { id: 5, label: 'Licence Granted', icon: Award, done: true, active: true, date: '10 Mar 2024', note: 'Hallmark stamp applied. HUID: AB1234.' },
    ],
  },
}

const DEMO_IDS = Object.keys(DEMO_APPLICATIONS)

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProgressStepper({ stages, currentStage }) {
  const [expandedStep, setExpandedStep] = useState(currentStage)
  const completedCount = stages.filter(s => s.done).length
  const progressPct = Math.round((completedCount / stages.length) * 100)

  return (
    <div>
      {/* Progress overview */}
      <div className="flex items-center gap-4 mb-8 p-4 bg-navy-50 border border-navy-100 rounded-2xl">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.8" />
            <motion.circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="#0b3d91" strokeWidth="3.8"
              strokeLinecap="round"
              strokeDasharray="100"
              initial={{ strokeDashoffset: 100 }}
              animate={{ strokeDashoffset: 100 - progressPct }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-navy-900">
            {progressPct}%
          </span>
        </div>
        <div>
          <div className="font-bold text-navy-900 text-lg">{completedCount} of {stages.length} stages complete</div>
          <div className="text-slate-500 text-sm">
            {completedCount === stages.length
              ? '🎉 All stages complete! Your certification is granted.'
              : `Currently at: ${stages[currentStage - 1]?.label}`}
          </div>
        </div>
      </div>

      {/* Horizontal stepper */}
      <div className="relative mb-8 overflow-x-auto">
        <div className="flex items-center min-w-max px-2">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              <div
                className={`flex flex-col items-center cursor-pointer`}
                onClick={() => setExpandedStep(expandedStep === stage.id ? null : stage.id)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  stage.done
                    ? 'bg-green-500 border-green-500 text-white'
                    : stage.active
                    ? 'bg-navy-900 border-navy-900 text-white animate-pulse'
                    : 'bg-white border-slate-300 text-slate-400'
                }`}>
                  {stage.done
                    ? <CheckCircle size={18} />
                    : stage.active
                    ? <Clock size={16} />
                    : <Circle size={16} />}
                </div>
                <div className={`text-xs mt-2 font-medium text-center max-w-20 leading-tight ${
                  stage.done ? 'text-green-600' : stage.active ? 'text-navy-900' : 'text-slate-400'
                }`}>
                  {stage.label}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{stage.date}</div>
              </div>
              {idx < stages.length - 1 && (
                <div className={`h-0.5 w-12 md:w-16 mx-2 mb-8 flex-shrink-0 rounded transition-colors ${
                  stages[idx + 1]?.done || stages[idx + 1]?.active ? 'bg-green-400' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expanded stage details */}
      <AnimatePresence>
        {expandedStep && stages.find(s => s.id === expandedStep) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {(() => {
              const s = stages.find(st => st.id === expandedStep)
              return (
                <div className={`rounded-2xl p-4 border mb-4 ${
                  s.done ? 'bg-green-50 border-green-200' :
                  s.active ? 'bg-navy-50 border-navy-200' :
                  'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon size={16} className={s.done ? 'text-green-600' : s.active ? 'text-navy-700' : 'text-slate-400'} />
                    <span className="font-semibold text-sm">{s.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.done ? 'bg-green-100 text-green-700' :
                      s.active ? 'bg-navy-100 text-navy-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {s.done ? 'Completed' : s.active ? 'In Progress' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{s.note}</p>
                  <p className="text-xs text-slate-400 mt-1">📅 {s.date}</p>
                </div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Tracker() {
  const { t } = useLang()
  const [appIdInput, setAppIdInput] = useState('')
  const [application, setApplication] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)

  const handleSearch = async (e) => {
    e?.preventDefault()
    if (!appIdInput.trim()) return
    setLoading(true)
    setError(null)
    setNotFound(false)
    setApplication(null)

    try {
      const res = await getApplicationStatus(appIdInput.trim())
      setApplication(res)
    } catch {
      await new Promise(r => setTimeout(r, 800))
      const found = DEMO_APPLICATIONS[appIdInput.trim().toUpperCase()]
      if (found) {
        setApplication(found)
      } else {
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadDemo = (id) => {
    setAppIdInput(id)
    setTimeout(() => {
      setApplication(DEMO_APPLICATIONS[id])
    }, 300)
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-gold-50 text-gold-700 border border-gold-200 rounded-full px-3 py-1 text-xs font-semibold mb-4">
              <Award size={12} /> Feature 10: Certification Tracker
            </div>
            <h1 className="section-heading mb-2">{t('tracker_title')}</h1>
            <p className="section-subheading">{t('tracker_subtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Search */}
        <div className="card mb-8">
          <h2 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
            <Search size={16} /> {t('tracker_app_id')}
          </h2>
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={appIdInput}
              onChange={e => setAppIdInput(e.target.value)}
              placeholder="e.g. BIS-2024-001"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-400 text-sm bg-slate-50"
            />
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
              {t('tracker_check')}
            </button>
          </form>

          {/* Demo IDs */}
          <div className="mt-4">
            <p className="text-xs text-slate-400 font-medium mb-2">Try demo application IDs:</p>
            <div className="flex gap-2 flex-wrap">
              {DEMO_IDS.map(id => (
                <button
                  key={id}
                  onClick={() => loadDemo(id)}
                  className="text-xs bg-navy-50 border border-navy-100 text-navy-700 hover:bg-navy-100 rounded-full px-3 py-1.5 transition-colors font-mono"
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="card space-y-4">
            <div className="skeleton h-5 w-48 rounded" />
            <div className="flex justify-between">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton w-12 h-12 rounded-full" />)}
            </div>
          </div>
        )}

        {/* Not found */}
        {notFound && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="card text-center py-10"
          >
            <AlertCircle size={36} className="text-amber-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">Application not found</p>
            <p className="text-sm text-slate-500 mt-1">Try one of the demo IDs: {DEMO_IDS.join(', ')}</p>
          </motion.div>
        )}

        {/* Application details */}
        {application && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary card */}
            <div className="card">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Application ID', value: application.appId },
                  { label: 'Product', value: application.product },
                  { label: 'Standard', value: application.standard },
                  { label: 'Scheme', value: application.scheme },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{item.label}</div>
                    <div className="text-sm font-bold text-navy-900">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-1">Applicant</div>
                  <div className="text-sm font-semibold text-slate-700">{application.applicant}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-1">Submitted On</div>
                  <div className="text-sm font-semibold text-slate-700">{application.submittedOn}</div>
                </div>
              </div>
            </div>

            {/* Stepper */}
            <div className="card">
              <h2 className="font-bold text-navy-900 mb-6 flex items-center gap-2">
                <Zap size={16} className="text-gold-500" /> Certification Progress
              </h2>
              <ProgressStepper stages={application.stages} currentStage={application.currentStage} />
            </div>

            {/* Ask AI */}
            <div className="bg-navy-900 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-white font-semibold">Have questions about your application?</p>
                <p className="text-navy-200 text-sm">Our AI can explain each stage and what to do next.</p>
              </div>
              <a
                href={`/chat?q=What should I do in the ${application.stages[application.currentStage - 1]?.label} stage for ${application.scheme}?`}
                className="btn-gold whitespace-nowrap flex items-center gap-2 text-sm"
              >
                <Zap size={14} /> Ask AI
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
