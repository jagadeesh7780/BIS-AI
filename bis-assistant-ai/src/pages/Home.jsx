import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Search, Award, MapPin, Mic, MicOff, BarChart2,
  ArrowRight, ChevronRight, Shield, FileText, Zap, Star,
  CheckCircle, Building2, Users, BookOpen, Factory,
  ShoppingBag, GraduationCap, Briefcase, FlaskConical, GitCompare,
  AlertTriangle, Upload, X, RefreshCw
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import ComplaintModal from '../components/ComplaintModal'

// ─── Inline AlertTriangle for UserTypeCard (avoid naming conflict) ────────────
function AlertTriangleIcon({ size, className }) {
  return <AlertTriangle size={size} className={className} />
}

// ─── Animation helpers ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

function AnimatedSection({ children, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, to, color = 'navy' }) {
  const navigate = useNavigate()
  return (
    <motion.div
      variants={fadeUp}
      onClick={() => navigate(to)}
      className="card cursor-pointer group hover:scale-[1.02] transition-all duration-300"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(to)}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
        color === 'gold' ? 'bg-gold-50' : 'bg-navy-50'
      }`}>
        <Icon size={22} className={color === 'gold' ? 'text-gold-500' : 'text-navy-700'} />
      </div>
      <h3 className="font-bold text-navy-900 text-base mb-2">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
      <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-navy-600 group-hover:text-navy-900 transition-colors">
        Learn more <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </motion.div>
  )
}

function StatBadge({ icon: Icon, value, label }) {
  return (
    <motion.div variants={fadeUp} className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-gold-400" />
      </div>
      <div>
        <div className="font-bold text-white text-sm">{value}</div>
        <div className="text-navy-200 text-xs">{label}</div>
      </div>
    </motion.div>
  )
}

// ─── User Type Card ───────────────────────────────────────────────────────────
function UserTypeCard({ icon: Icon, title, subtitle, color, queries, navigate, roleKey, btnLabel, onAction }) {
  return (
    <motion.div
      variants={fadeUp}
      className={`relative overflow-hidden rounded-2xl border-2 p-6 flex flex-col justify-between ${color.border} ${color.bg}`}
    >
      <div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${color.iconBg}`}>
          <Icon size={26} className={color.iconColor} />
        </div>
        <h3 className={`font-bold text-xl mb-1 ${color.title}`}>{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed mb-5">{subtitle}</p>
        <div className="space-y-2">
          {queries.map((q, i) => (
            <button
              key={i}
              onClick={() => navigate(`/chat?role=${roleKey || 'consumer'}&q=${encodeURIComponent(q.query)}`)}
              className={`w-full text-left text-xs font-medium px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition-all ${color.queryBg} ${color.queryText} hover:opacity-80`}
            >
              <span>{q.label}</span>
              <ChevronRight size={12} className="flex-shrink-0 opacity-60" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-200/60 space-y-2 relative z-10">
        {btnLabel && (
          <button
            onClick={onAction}
            className="w-full py-2.5 px-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5"
          >
            <span>{btnLabel}</span>
          </button>
        )}
      </div>

      {/* Decorative corner */}
      <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10 pointer-events-none ${color.decoration}`} />
    </motion.div>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { t, language } = useLang()
  const navigate = useNavigate()
  const [heroQuery, setHeroQuery] = useState('')
  const [showComplaint, setShowComplaint] = useState(false)
  const [heroRecording, setHeroRecording] = useState(false)
  const [heroVoiceStatus, setHeroVoiceStatus] = useState('')
  const heroSpeechRecognitionRef = useRef(null)

  const langCodeMap = {
    en: 'en-IN',
    hi: 'hi-IN',
    te: 'te-IN',
    ta: 'ta-IN',
    kn: 'kn-IN',
    mr: 'mr-IN'
  }

  const toggleHeroVoice = (e) => {
    if (e) e.preventDefault()
    if (heroRecording) {
      if (heroSpeechRecognitionRef.current) {
        try { heroSpeechRecognitionRef.current.stop() } catch (err) { console.warn(err) }
        heroSpeechRecognitionRef.current = null
      }
      setHeroRecording(false)
      setHeroVoiceStatus('')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition()
        heroSpeechRecognitionRef.current = recognition
        recognition.lang = langCodeMap[language] || 'en-IN'
        recognition.interimResults = true
        recognition.continuous = false

        recognition.onstart = () => {
          setHeroRecording(true)
          setHeroVoiceStatus('Listening...')
        }

        recognition.onresult = (event) => {
          let transcript = ''
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript
          }
          if (transcript.trim()) {
            setHeroQuery(transcript)
            setHeroVoiceStatus(`Heard: "${transcript}"`)
          }
        }

        recognition.onerror = (event) => {
          if (event.error !== 'no-speech') {
            setHeroVoiceStatus(`Voice: ${event.error}`)
          }
        }

        recognition.onend = () => {
          setHeroRecording(false)
          setHeroVoiceStatus('')
        }

        recognition.start()
      } catch (err) {
        console.warn('Hero speech recognition error:', err)
        setHeroRecording(false)
      }
    } else {
      alert('Speech recognition is not supported in this browser. Please use Chrome/Edge or type your question.')
    }
  }

  const handleHeroSearch = (e) => {
    e.preventDefault()
    if (heroQuery.trim()) {
      navigate(`/chat?role=consumer&q=${encodeURIComponent(heroQuery.trim())}`)
    }
  }

  const featureCards = [
    { icon: MessageSquare, title: t('feat_chat_title'), desc: t('feat_chat_desc'), to: '/chat' },
    { icon: Search, title: t('feat_standards_title'), desc: t('feat_standards_desc'), to: '/standards' },
    { icon: Award, title: t('feat_cert_title'), desc: t('feat_cert_desc'), to: '/certification' },
    { icon: MapPin, title: t('feat_labs_title'), desc: t('feat_labs_desc'), to: '/labs' },
    { icon: Mic, title: t('feat_voice_title'), desc: t('feat_voice_desc'), to: '/chat', color: 'gold' },
    { icon: Building2, title: t('about_title'), desc: t('about_subtitle'), to: '/about', color: 'gold' },
  ]

  const quickQueries = [
    'What IS standard applies to pressure cookers?',
    'How do I get ISI Mark certification?',
    'Find labs for electrical testing in Mumbai',
    'How to verify 6-digit HUID Hallmark on gold jewellery?',
  ]

  const userTypeCards = [
    {
      roleKey: 'manufacturer',
      icon: Factory,
      title: t('role_mfr_title'),
      subtitle: t('role_mfr_sub'),
      color: {
        bg: 'bg-navy-50',
        border: 'border-navy-200',
        iconBg: 'bg-navy-900',
        iconColor: 'text-white',
        title: 'text-navy-900',
        queryBg: 'bg-white',
        queryText: 'text-navy-700',
        decoration: 'bg-navy-900',
      },
      btnLabel: t('role_mfr_btn'),
      onAction: () => navigate('/manufacturer'),
      queries: [
        { label: 'Which IS standard applies to my product?', query: 'Which IS standard applies to domestic pressure cooker?' },
        { label: 'Start 5-Step Manufacturer Certification', query: 'What is the 5-step manufacturer certification pipeline?' },
        { label: 'Find nearby testing labs & book slots', query: 'Where are BIS recognised testing labs in Mumbai?' },
        { label: 'What documents are needed (Form V)?', query: 'What documents are required for BIS certification?' },
      ],
    },
    {
      roleKey: 'consumer',
      icon: ShoppingBag,
      title: t('role_consumer_title'),
      subtitle: t('role_consumer_sub'),
      color: {
        bg: 'bg-gold-50',
        border: 'border-gold-200',
        iconBg: 'bg-gold-400',
        iconColor: 'text-navy-900',
        title: 'text-navy-900',
        queryBg: 'bg-white',
        queryText: 'text-gold-700',
        decoration: 'bg-gold-400',
      },
      btnLabel: 'Ask Consumer AI Agent →',
      onAction: () => navigate('/chat?role=consumer'),
      queries: [
        { label: 'How to verify ISI Mark on products?', query: 'How can I verify if an ISI Mark is genuine?' },
        { label: 'Is hallmarked gold genuine (HUID)?', query: 'How to check if gold jewellery hallmarking is genuine?' },
        { label: 'Which products must have ISI mark?', query: 'Which products are mandatory to have ISI mark in India?' },
        { label: 'Report a fake ISI marked product', query: 'How to report a product with fake or missing ISI Mark?' },
      ],
    },
    {
      roleKey: 'helper',
      icon: BookOpen,
      title: t('role_student_title'),
      subtitle: t('role_student_sub'),
      color: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        iconBg: 'bg-emerald-600',
        iconColor: 'text-white',
        title: 'text-navy-900',
        queryBg: 'bg-white',
        queryText: 'text-emerald-700',
        decoration: 'bg-emerald-500',
      },
      btnLabel: t('role_student_btn'),
      onAction: () => navigate('/chat?role=helper'),
      queries: [
        { label: 'What is the BIS Act 2016?', query: 'Explain the Bureau of Indian Standards Act 2016' },
        { label: 'How does the ISI Mark scheme work?', query: 'Explain how the ISI Mark certification scheme works' },
        { label: 'What is the CRS scheme for electronics?', query: 'What is Compulsory Registration Scheme CRS for electronics?' },
        { label: 'Standards Clubs in Colleges & Universities', query: 'How do Standards Clubs work in colleges?' },
      ],
    },
  ]

  return (
    <div className="min-h-screen">
      {/* ─── Consumer Complaint Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showComplaint && (
          <ComplaintModal
            onClose={() => setShowComplaint(false)}
            onSubmitted={(comp) => {
              setShowComplaint(false)
              navigate(`/chat?q=${encodeURIComponent('Consumer Complaint tracking ID: ' + comp.complaint_id)}`)
            }}
          />
        )}
      </AnimatePresence>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-navy-800/50 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-gold-400/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-navy-700/30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full border border-navy-700/20" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            {/* Badge with Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-full pl-2 pr-4 py-1.5 text-xs sm:text-sm font-medium mb-8 shadow-lg"
            >
              <img src="/logo.png" alt="BIS AI Seal" className="w-6 h-6 rounded-full border border-gold-400/60 object-cover shadow-xs" />
              <span>AI-Powered • Official 2026 BIS Data • 6 Languages</span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              {t('hero_headline')}
            </h1>
            <p className="text-lg md:text-xl text-navy-200 leading-relaxed mb-10 max-w-2xl mx-auto">
              {t('hero_sub')}
            </p>

            {/* Search bar with Live Voice Mic */}
            <div className="max-w-2xl mx-auto space-y-2">
              <form onSubmit={handleHeroSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    value={heroQuery}
                    onChange={e => setHeroQuery(e.target.value)}
                    placeholder={heroRecording ? 'Listening... Speak now...' : t('hero_placeholder')}
                    className={`w-full pl-5 pr-12 py-4 rounded-xl text-navy-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm shadow-lg font-medium transition-all ${
                      heroRecording ? 'ring-2 ring-red-400 bg-red-50/50' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={toggleHeroVoice}
                    title={heroRecording ? 'Stop Voice Recording' : 'Speak Your Question'}
                    className={`absolute right-3 p-2 rounded-lg transition-all ${
                      heroRecording
                        ? 'bg-red-500 text-white animate-pulse shadow-md'
                        : 'text-slate-400 hover:text-navy-900 hover:bg-slate-100'
                    }`}
                  >
                    {heroRecording ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                </div>
                <button type="submit" className="btn-gold flex items-center justify-center gap-2 py-4 px-6 whitespace-nowrap font-bold">
                  <MessageSquare size={16} />
                  {t('hero_cta')}
                </button>
              </form>

              {heroVoiceStatus && (
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/20 px-3.5 py-1 rounded-full text-xs text-gold-300 font-semibold shadow-xs">
                  <span className={`w-2 h-2 rounded-full ${heroRecording ? 'bg-red-400 animate-ping' : 'bg-emerald-400'}`} />
                  {heroVoiceStatus}
                </div>
              )}
            </div>

            {/* Quick queries */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {quickQueries.map((q, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  onClick={() => navigate(`/chat?q=${encodeURIComponent(q)}`)}
                  className="text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full px-3 py-1.5 transition-colors font-medium"
                >
                  {q}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-navy-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <AnimatedSection className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <StatBadge icon={BookOpen} value="23,293+" label={t('stat_standards')} />
              <StatBadge icon={Users} value="6 Languages" label={t('stat_multilingual')} />
              <StatBadge icon={Zap} value="5-Step Process" label={t('stat_instant')} />
              <StatBadge icon={Building2} value="51,500+" label={t('stat_certified')} />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ─── Who is this for? (Three User Types) ───────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-navy-50 text-navy-700 border border-navy-100 rounded-full px-3 py-1 text-xs font-semibold mb-4">
                <Users size={12} /> Tailored Portals
              </div>
              <h2 className="section-heading">Multi-Agent Specialized Workflows</h2>
              <p className="section-subheading max-w-2xl mx-auto">
                Select your role to access dedicated AI pipelines, complaint registration, and laboratory certification workflows.
              </p>
            </motion.div>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {userTypeCards.map((card) => (
              <UserTypeCard key={card.title} {...card} navigate={navigate} />
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ─── Feature Cards ────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#f7f8fa]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="section-heading">Everything you need, in one place</h2>
              <p className="section-subheading max-w-2xl mx-auto">
                From finding the right IS standard to tracking your certification journey — BIS Assistant AI covers it all.
              </p>
            </motion.div>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureCards.map((card) => (
              <FeatureCard key={card.to + card.title} {...card} />
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="text-center mb-14">
              <h2 className="section-heading">How it works</h2>
              <p className="section-subheading">Get accurate BIS guidance in three simple steps</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-navy-100 via-navy-300 to-navy-100" />

              {[
                {
                  step: '01',
                  icon: MessageSquare,
                  title: 'Ask Your Question',
                  desc: 'Type or speak your query about products, standards, or certification in English, Hindi, or Telugu.',
                },
                {
                  step: '02',
                  icon: Zap,
                  title: 'AI Searches BIS Database',
                  desc: 'Our RAG-powered AI searches through 10,000+ official IS standards to find the most relevant information.',
                },
                {
                  step: '03',
                  icon: CheckCircle,
                  title: 'Get Sourced Answers',
                  desc: 'Receive precise answers with cited IS standards, confidence scores, and links to official documents.',
                },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeUp} className="relative text-center">
                  <div className="w-20 h-20 rounded-2xl bg-navy-50 border-2 border-navy-100 flex items-center justify-center mx-auto mb-5 relative z-10">
                    <item.icon size={28} className="text-navy-700" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gold-400 text-navy-900 text-xs font-bold flex items-center justify-center">
                      {item.step.slice(-1)}
                    </span>
                  </div>
                  <h3 className="font-bold text-navy-900 text-lg mb-2">{item.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── Trust section ────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#f7f8fa]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div variants={fadeUp}>
                <div className="inline-flex items-center gap-2 bg-navy-50 text-navy-700 border border-navy-100 rounded-full px-3 py-1 text-xs font-semibold mb-4">
                  <Shield size={12} /> Trusted & Transparent
                </div>
                <h2 className="section-heading mb-4">Built on official BIS documents</h2>
                <p className="text-slate-500 leading-relaxed mb-6">
                  BIS Assistant AI is powered by a Retrieval-Augmented Generation (RAG) system trained exclusively on official Bureau of Indian Standards publications, circulars, and scheme documents.
                </p>
                <ul className="space-y-3">
                  {[
                    'Every answer cites the source IS standard',
                    'Confidence scores shown for every recommendation',
                    'Multilingual answers via the same AI engine',
                    'Free for MSMEs, startups, and students',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/about')}
                  className="btn-outline mt-8 flex items-center gap-2"
                >
                  Learn more about the data <ArrowRight size={14} />
                </button>
              </motion.div>

              <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4">
                {[
                  { icon: FileText, label: 'IS Standards Covered', value: '10,000+' },
                  { icon: Users, label: 'User Queries Supported', value: 'Unlimited' },
                  { icon: Award, label: 'Certification Schemes', value: '3 Major' },
                  { icon: Star, label: 'Response Accuracy', value: 'RAG-Backed' },
                ].map((stat, i) => (
                  <div key={i} className="card text-center">
                    <stat.icon size={24} className="text-navy-600 mx-auto mb-3" />
                    <div className="text-2xl font-bold text-navy-900 mb-1">{stat.value}</div>
                    <div className="text-xs text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="py-16 bg-navy-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to navigate Indian Standards?
            </h2>
            <p className="text-navy-200 mb-8 text-lg">
              Join thousands of MSMEs, startups, and students already using BIS Assistant AI.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => navigate('/chat')} className="btn-gold flex items-center justify-center gap-2">
                <MessageSquare size={16} /> Start Chatting Free
              </button>
              <button onClick={() => navigate('/standards')} className="btn-outline border-white text-white hover:bg-white hover:text-navy-900 flex items-center justify-center gap-2">
                <Search size={16} /> Browse Standards
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

// Inline Globe icon
function GlobeIcon({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}
