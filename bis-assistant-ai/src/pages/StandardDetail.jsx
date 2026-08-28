import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, FileText, Tag, Award, BarChart2, GitCompare,
  ExternalLink, CheckCircle, AlertCircle, Zap
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { getStandardById } from '../api/client'
import { mockStandards } from '../utils/mockData'
import { SkeletonText } from '../components/SkeletonLoader'

export default function StandardDetail() {
  const { id } = useParams()
  const { t } = useLang()
  const navigate = useNavigate()
  const [standard, setStandard] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await getStandardById(id)
        setStandard(data)
      } catch {
        // Use mock data
        const found = mockStandards.find(s => s.id === id)
        await new Promise(r => setTimeout(r, 600))
        setStandard(found || mockStandards[0])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-[#f7f8fa] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="skeleton h-5 w-32 rounded mb-8" />
        <div className="card">
          <div className="skeleton h-8 w-24 rounded-lg mb-4" />
          <div className="skeleton h-7 w-2/3 rounded mb-4" />
          <SkeletonText lines={5} />
        </div>
      </div>
    </div>
  )

  if (!standard) return null

  const detailRows = [
    { label: 'Standard Number', value: standard.number },
    { label: 'Category', value: standard.category },
    { label: 'Certification Scheme', value: standard.scheme },
    { label: 'Scope', value: standard.scope },
  ]

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-navy-700 mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Standards
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header card */}
          <div className="card mb-6">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-navy-900 flex items-center justify-center">
                  <FileText size={20} className="text-white" />
                </div>
                <div>
                  <span className="text-xs font-bold text-navy-600 uppercase tracking-wider">{standard.number}</span>
                  <h1 className="text-xl font-bold text-navy-900">{standard.title}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge-ai"><Zap size={10} /> {t('powered_by')}</span>
                <span className="badge-source">{t('source_official')}</span>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed mb-6">{standard.summary}</p>

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => navigate(`/compare?s1=${standard.id}`)}
                className="btn-outline flex items-center gap-2 py-2 text-sm"
              >
                <GitCompare size={15} /> Compare with another standard
              </button>
              <button
                onClick={() => navigate(`/chat?q=Tell me more about ${standard.number}`)}
                className="btn-primary flex items-center gap-2 py-2 text-sm"
              >
                <Zap size={15} /> Ask AI about this standard
              </button>
            </div>
          </div>

          {/* Details table */}
          <div className="card mb-6">
            <h2 className="font-bold text-navy-900 text-base mb-4 flex items-center gap-2">
              <BarChart2 size={16} /> Standard Details
            </h2>
            <div className="divide-y divide-slate-100">
              {detailRows.map((row, i) => (
                <div key={i} className="py-3 grid grid-cols-5 gap-4">
                  <dt className="col-span-2 text-sm font-medium text-slate-500">{row.label}</dt>
                  <dd className="col-span-3 text-sm text-navy-900 font-medium">{row.value}</dd>
                </div>
              ))}
            </div>
          </div>

          {/* Certification info */}
          <div className="card mb-6">
            <h2 className="font-bold text-navy-900 text-base mb-4 flex items-center gap-2">
              <Award size={16} /> Certification Information
            </h2>
            <div className="bg-navy-50 rounded-xl p-4 border border-navy-100">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-navy-600" />
                <span className="font-semibold text-navy-900">{standard.scheme}</span>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                This standard falls under the {standard.scheme} certification scheme. Manufacturers must obtain certification before marketing their products in India.
              </p>
              <div className="flex gap-3">
                <Link
                  to="/certification"
                  className="text-sm text-navy-700 font-semibold hover:underline flex items-center gap-1"
                >
                  View certification guide <ExternalLink size={11} />
                </Link>
                <Link
                  to="/certification/tracker"
                  className="text-sm text-navy-700 font-semibold hover:underline flex items-center gap-1"
                >
                  Track application <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          </div>

          {/* Keywords / tags */}
          {standard.keywords?.length > 0 && (
            <div className="card">
              <h2 className="font-bold text-navy-900 text-base mb-4 flex items-center gap-2">
                <Tag size={16} /> Keywords
              </h2>
              <div className="flex flex-wrap gap-2">
                {standard.keywords.map(kw => (
                  <span key={kw} className="bg-slate-100 text-slate-600 text-sm px-3 py-1.5 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
