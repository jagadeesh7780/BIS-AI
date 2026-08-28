import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitCompare, ChevronDown, ArrowRight, CheckCircle, X,
  Zap, BarChart2, RefreshCw, FileText
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { compareStandards } from '../api/client'
import { mockStandards } from '../utils/mockData'

// ─── Comparison attributes ────────────────────────────────────────────────────
const buildComparison = (s1, s2) => [
  { label: 'Standard Number', key: 'number' },
  { label: 'Title', key: 'title' },
  { label: 'Category', key: 'category' },
  { label: 'Scope', key: 'scope' },
  { label: 'Certification Scheme', key: 'scheme' },
  { label: 'Summary', key: 'summary' },
  { label: 'Keywords', key: 'keywords', transform: (v) => Array.isArray(v) ? v.join(', ') : v },
]

function StandardSelector({ label, value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
      <div className="relative">
        <FileText size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-9 pr-9 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-navy-400 text-sm appearance-none cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.number} — {opt.title}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  )
}

function DiffCell({ val1, val2 }) {
  const isDiff = String(val1).toLowerCase() !== String(val2).toLowerCase()
  return isDiff
    ? <span className="bg-amber-50 text-amber-800 px-1 rounded text-xs font-medium">⚠ Differs</span>
    : <span className="bg-green-50 text-green-700 px-1 rounded text-xs"><CheckCircle size={10} className="inline mr-0.5" />Same</span>
}

export default function Compare() {
  const { t } = useLang()
  const [searchParams] = useSearchParams()
  const [s1Id, setS1Id] = useState(searchParams.get('s1') || '')
  const [s2Id, setS2Id] = useState(searchParams.get('s2') || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const s1Data = mockStandards.find(s => s.id === s1Id)
  const s2Data = mockStandards.find(s => s.id === s2Id)

  const handleCompare = async () => {
    if (!s1Id || !s2Id || s1Id === s2Id) return
    setLoading(true)
    try {
      const res = await compareStandards(s1Id, s2Id)
      setResult(res)
    } catch {
      await new Promise(r => setTimeout(r, 700))
      setResult({ standard1: s1Data, standard2: s2Data })
    } finally {
      setLoading(false)
    }
  }

  const compareRows = result
    ? buildComparison(result.standard1, result.standard2)
    : []

  const std1 = result?.standard1 || s1Data
  const std2 = result?.standard2 || s2Data

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-navy-50 text-navy-700 border border-navy-100 rounded-full px-3 py-1 text-xs font-semibold mb-4">
              <GitCompare size={12} /> Feature 11: Comparison Tool
            </div>
            <h1 className="section-heading mb-2">{t('compare_title')}</h1>
            <p className="section-subheading">{t('compare_subtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Selectors */}
        <div className="card mb-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2">
              <StandardSelector
                label={t('compare_select1')}
                value={s1Id}
                onChange={setS1Id}
                options={mockStandards.filter(s => s.id !== s2Id)}
                placeholder="Select first standard..."
              />
            </div>
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full bg-navy-50 border-2 border-navy-100 flex items-center justify-center">
                <ArrowRight size={16} className="text-navy-600" />
              </div>
            </div>
            <div className="md:col-span-2">
              <StandardSelector
                label={t('compare_select2')}
                value={s2Id}
                onChange={setS2Id}
                options={mockStandards.filter(s => s.id !== s1Id)}
                placeholder="Select second standard..."
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div className="flex gap-2">
              {/* Quick preset pairs */}
              <button
                onClick={() => { setS1Id('IS-2347'); setS2Id('IS-302') }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full px-3 py-1.5 transition-colors"
              >
                IS 2347 vs IS 302
              </button>
              <button
                onClick={() => { setS1Id('IS-14543'); setS2Id('IS-9431') }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full px-3 py-1.5 transition-colors"
              >
                IS 14543 vs IS 9431
              </button>
            </div>
            <button
              onClick={handleCompare}
              disabled={!s1Id || !s2Id || s1Id === s2Id || loading}
              className="btn-primary flex items-center gap-2 disabled:opacity-40"
            >
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <GitCompare size={15} />}
              {t('compare_btn')}
            </button>
          </div>

          {s1Id === s2Id && s1Id !== '' && (
            <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
              <X size={11} /> Please select two different standards to compare.
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="card">
            <div className="skeleton h-10 w-full rounded-xl mb-3" />
            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-14 w-full rounded-xl mb-2" />)}
          </div>
        )}

        {/* Comparison table */}
        <AnimatePresence>
          {result && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-navy-900 text-lg flex items-center gap-2">
                  <BarChart2 size={18} /> Comparison Results
                </h2>
                <div className="flex gap-2">
                  <span className="badge-ai"><Zap size={10} /> {t('powered_by')}</span>
                </div>
              </div>

              {/* Standard headers */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-card border border-slate-100">
                <div className="grid grid-cols-3 bg-navy-900 text-white">
                  <div className="p-4 text-sm font-semibold text-navy-200">{t('compare_attribute')}</div>
                  <div className="p-4 border-l border-navy-800">
                    <div className="text-xs text-navy-300 mb-0.5">Standard 1</div>
                    <div className="font-bold text-sm">{std1?.number}</div>
                    <div className="text-xs text-navy-300 truncate">{std1?.title}</div>
                  </div>
                  <div className="p-4 border-l border-navy-800">
                    <div className="text-xs text-navy-300 mb-0.5">Standard 2</div>
                    <div className="font-bold text-sm">{std2?.number}</div>
                    <div className="text-xs text-navy-300 truncate">{std2?.title}</div>
                  </div>
                </div>

                {compareRows.map((row, idx) => {
                  const v1 = row.transform ? row.transform(std1?.[row.key]) : std1?.[row.key]
                  const v2 = row.transform ? row.transform(std2?.[row.key]) : std2?.[row.key]
                  const isDiff = String(v1 || '').toLowerCase() !== String(v2 || '').toLowerCase()
                  return (
                    <div
                      key={row.key}
                      className={`grid grid-cols-3 border-t border-slate-100 ${
                        isDiff ? 'bg-amber-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <div className="p-4 flex items-start gap-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-700">{row.label}</div>
                          {isDiff && <DiffCell val1={v1} val2={v2} />}
                        </div>
                      </div>
                      <div className={`p-4 border-l border-slate-100 text-sm text-slate-700 leading-relaxed ${isDiff ? 'font-medium' : ''}`}>
                        {v1 || <span className="text-slate-300 italic">—</span>}
                      </div>
                      <div className={`p-4 border-l border-slate-100 text-sm text-slate-700 leading-relaxed ${isDiff ? 'font-medium' : ''}`}>
                        {v2 || <span className="text-slate-300 italic">—</span>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    label: 'Total Attributes',
                    value: compareRows.length,
                    icon: BarChart2,
                    color: 'bg-slate-50 border-slate-200',
                  },
                  {
                    label: 'Identical Attributes',
                    value: compareRows.filter(r => {
                      const v1 = r.transform ? r.transform(std1?.[r.key]) : std1?.[r.key]
                      const v2 = r.transform ? r.transform(std2?.[r.key]) : std2?.[r.key]
                      return String(v1 || '').toLowerCase() === String(v2 || '').toLowerCase()
                    }).length,
                    icon: CheckCircle,
                    color: 'bg-green-50 border-green-200',
                  },
                  {
                    label: 'Different Attributes',
                    value: compareRows.filter(r => {
                      const v1 = r.transform ? r.transform(std1?.[r.key]) : std1?.[r.key]
                      const v2 = r.transform ? r.transform(std2?.[r.key]) : std2?.[r.key]
                      return String(v1 || '').toLowerCase() !== String(v2 || '').toLowerCase()
                    }).length,
                    icon: GitCompare,
                    color: 'bg-amber-50 border-amber-200',
                  },
                ].map((stat, i) => (
                  <div key={i} className={`rounded-2xl border p-4 flex items-center gap-3 ${stat.color}`}>
                    <stat.icon size={20} className="text-slate-500 flex-shrink-0" />
                    <div>
                      <div className="text-2xl font-bold text-navy-900">{stat.value}</div>
                      <div className="text-xs text-slate-500">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!result && !loading && (
          <div className="text-center py-16">
            <GitCompare size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Select two standards above and click "Compare Now"</p>
          </div>
        )}
      </div>
    </div>
  )
}
