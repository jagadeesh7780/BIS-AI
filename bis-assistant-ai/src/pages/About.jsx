import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown, ChevronUp, Shield, Database, Zap, Globe as GlobeIcon,
  MessageSquare, Award, FlaskConical, FileText, Mic,
  Image, BarChart2, CheckCircle, ExternalLink, Search
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'

const faqs = [
  {
    q: 'What is BIS Assistant AI?',
    a: 'BIS Assistant AI is an AI-powered conversational assistant that helps MSMEs, startups, students, and consumers navigate Indian Standards (IS), BIS certification processes, testing labs, and related services. It uses Retrieval-Augmented Generation (RAG) trained on official BIS documents.',
  },
  {
    q: 'Is the data from official BIS sources?',
    a: 'Yes, the AI system is trained on official Bureau of Indian Standards publications, scheme documents, and IS standard summaries. Each answer includes source citations with confidence scores. However, always verify critical information with the official BIS website (bis.gov.in) for compliance purposes.',
  },
  {
    q: 'Which certification schemes are covered?',
    a: 'The system covers Scheme-I (ISI Mark for domestic manufacturers), Scheme-II (CRS for electronics & IT products), Scheme-IV (Foreign Manufacturers Certification Scheme - FMCS), and Hallmarking for gold & silver jewellery with 6-digit HUID tracking.',
  },
  {
    q: 'How does the real-time voice input feature work?',
    a: 'The voice input feature uses the Web Speech Recognition API to capture live speech and transcribe it directly into the search bar without default fake questions. You can speak in English, Hindi, Telugu, Tamil, Kannada, or Marathi.',
  },
  {
    q: 'Can this replace the official BIS portal?',
    a: 'No. BIS Assistant AI is an intelligent guide to help you find information faster and prepare your application. Official license applications and fee payments must be submitted through Manak Online (manakonline.in).',
  },
  {
    q: 'Which languages are supported?',
    a: 'BIS Assistant AI currently supports 6 languages: English, Hindi, Telugu, Tamil, Kannada, and Marathi — with both text and live voice capabilities.',
  },
]

function FAQItem({ item, index }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border border-slate-200 rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-navy-900 text-sm pr-4">{item.q}</span>
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-navy-50 flex items-center justify-center">
          {open ? <ChevronUp size={13} className="text-navy-600" /> : <ChevronDown size={13} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="px-5 pb-5 bg-white"
        >
          <p className="text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-4">{item.a}</p>
        </motion.div>
      )}
    </motion.div>
  )
}

const features = [
  { icon: MessageSquare, label: 'Text-based Chat (RAG)', desc: 'AI answers sourced from BIS documents', color: 'text-blue-600 bg-blue-50' },
  { icon: Search, label: 'Standard Recommendation', desc: 'By product description or image', color: 'text-purple-600 bg-purple-50' },
  { icon: Award, label: 'Certification Guide', desc: 'Step-by-step visual process', color: 'text-gold-600 bg-gold-50' },
  { icon: GlobeIcon, label: 'Multilingual Support', desc: '6 Indian languages (EN, HI, TE, TA, KN, MR)', color: 'text-green-600 bg-green-50' },
  { icon: Shield, label: 'Professional UI', desc: 'Navy/gold BIS-themed design', color: 'text-navy-600 bg-navy-50' },
  { icon: Mic, label: 'Voice Input + Output', desc: 'Speak queries, hear answers in real-time', color: 'text-red-500 bg-red-50' },
  { icon: BarChart2, label: 'Confidence Scores', desc: 'Source citation on every answer', color: 'text-orange-600 bg-orange-50' },
  { icon: FlaskConical, label: 'Lab Finder', desc: 'Nearby BIS testing labs with Google Maps', color: 'text-teal-600 bg-teal-50' },
  { icon: Image, label: 'Image → Standard Detection', desc: 'Product photo to IS standard', color: 'text-pink-600 bg-pink-50' },
  { icon: CheckCircle, label: 'Certification Tracker', desc: 'Journey dashboard with stepper', color: 'text-emerald-600 bg-emerald-50' },
  { icon: FileText, label: 'Consumer Complaint & Proof', desc: 'Lodge grievances with camera photo proof', color: 'text-indigo-600 bg-indigo-50' },
]

export default function About() {
  const { t } = useLang()

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Header */}
      <div className="bg-navy-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl border-2 border-gold-400/50 bg-navy-950 mb-5 p-1 flex items-center justify-center">
              <img src="/logo.png" alt="BIS AI Seal" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-white border border-white/20 rounded-full px-3.5 py-1 text-xs font-semibold mb-4">
              <Zap size={12} className="text-gold-400" /> BIS Hackathon Demo • Official Bureau of Indian Standards
            </div>
            <h1 className="text-4xl font-bold mb-3">{t('about_title')}</h1>
            <p className="text-navy-200 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">{t('about_subtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* About section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-14">
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="font-bold text-navy-900 text-xl mb-4 flex items-center gap-2">
                <Database size={18} /> About This Project
              </h2>
              <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                <p>
                  <strong className="text-navy-900">BIS Assistant AI</strong> is an AI-powered web application built for the Bureau of Indian Standards Hackathon. It aims to make BIS standards, certification guidance, and related services accessible to everyone — MSMEs, startups, students, and consumers.
                </p>
                <p>
                  The application uses a <strong className="text-navy-900">Retrieval-Augmented Generation (RAG)</strong> architecture, where an AI model retrieves relevant information from a database of official BIS documents before generating an answer. This ensures responses are grounded in actual standards content rather than AI hallucinations.
                </p>
                <p>
                  The UI is designed to instill trust through its navy/gold color scheme (reflecting BIS's official branding), transparent source citations, and confidence scores displayed alongside every AI response.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                  <p className="text-amber-800 text-xs font-medium">⚠️ {t('disclaimer')}</p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="card">
              <h3 className="font-bold text-navy-900 mb-4 text-sm uppercase tracking-wider">Data Sources</h3>
              <ul className="space-y-3">
                {[
                  { label: 'BIS.gov.in', desc: 'Official standards portal' },
                  { label: 'Manak Online', desc: 'Certification portal' },
                  { label: 'IS Standards DB', desc: '10,000+ standards' },
                  { label: 'BIS Scheme Docs', desc: 'ISI, Hallmarking, CRS' },
                ].map((src, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-navy-900">{src.label}</div>
                      <div className="text-xs text-slate-500">{src.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href="https://www.bis.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center gap-1.5 text-xs text-navy-600 font-semibold hover:underline"
              >
                Visit bis.gov.in <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

        {/* 11 Features grid */}
        <div className="mb-14">
          <h2 className="section-heading mb-3">All 11 Features</h2>
          <p className="text-slate-500 text-sm mb-8">Every feature from the hackathon specification is implemented and functional.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-card flex items-start gap-3"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}`}>
                  <f.icon size={16} />
                </div>
                <div>
                  <div className="font-semibold text-navy-900 text-sm">
                    <span className="text-xs text-slate-400 mr-1.5">#{i+1}</span>
                    {f.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="section-heading mb-8">{t('faq_title')}</h2>
          <div className="space-y-3">
            {faqs.map((item, i) => <FAQItem key={i} item={item} index={i} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
