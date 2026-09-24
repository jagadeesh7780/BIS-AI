/**
 * BIS AI V2 — Chat Page
 * STEP 15/16: 3-column layout with always-visible Evidence Panel
 * STEP 7: Citations rendered as structured cards in evidence panel
 * STEP 16: Real backend API — mock fallback labelled as DEMO DATA
 * STEP 13: No API keys in frontend
 */
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Mic, MicOff, Volume2, VolumeX, ChevronDown, ChevronUp,
  Zap, ExternalLink, Bot, User, RefreshCw, AlertTriangle,
  Factory, BookOpen, ShoppingBag, FileText, Shield,
  CheckCircle, ArrowRight, Info, AlertCircle, Link2, Camera, ShieldAlert
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { translatePhrase } from '../utils/domTranslator'
import { sendChatMessage, transcribeVoice } from '../api/client'
import { mockChatResponses, getDefaultChatResponse } from '../utils/mockData'
import ComplaintModal from '../components/ComplaintModal'

let msgId = 0
const newId  = () => ++msgId
const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// ── Confidence display ─────────────────────────────────────────────────────────
function ConfidencePill({ level, score }) {
  const pct = typeof score === 'number' ? Math.round(score * 100) : 0
  const cfg = {
    high:         'bg-green-100 text-green-700 border-green-300',
    medium:       'bg-amber-100 text-amber-700 border-amber-300',
    low:          'bg-orange-100 text-orange-700 border-orange-300',
    insufficient: 'bg-red-100 text-red-600 border-red-300',
  }[level] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg}`}>
      {level?.toUpperCase()} {pct > 0 ? `${pct}%` : ''}
    </span>
  )
}

// ── Evidence panel — STEP 15 ──────────────────────────────────────────────────
function EvidencePanel({ activeMsg }) {
  const { language } = useLang()
  if (!activeMsg) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
        <div className="w-12 h-12 rounded-2xl bg-navy-50 flex items-center justify-center mb-3">
          <Shield size={22} className="text-navy-400" />
        </div>
        <p className="text-xs font-semibold text-navy-700 mb-1">{translatePhrase('Evidence Panel', language)}</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          {translatePhrase('Citations and source documents will appear here for each AI response.', language)}
        </p>
      </div>
    )
  }

  const { confidence, citations = [], sources = [], next_steps = [], agent, trace_id } = activeMsg

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-navy-800 flex items-center gap-1.5">
            <Shield size={13} className="text-navy-600" /> {translatePhrase('Evidence', language)}
          </span>
          {confidence && <ConfidencePill level={confidence.level} score={confidence.score} />}
        </div>
        {agent && (
          <span className="text-[10px] text-slate-400 font-mono">
            Agent: {agent} {trace_id ? `• ${trace_id}` : ''}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Citations — STEP 7 */}
        {citations.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {translatePhrase('Sources', language)} ({citations.length})
            </p>
            <div className="space-y-2">
              {citations.map((c, i) => (
                <div key={i} className="bg-navy-50 border border-navy-100 rounded-xl p-3">
                  {c.standard_number && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold bg-navy-900 text-white px-2 py-0.5 rounded">
                        {c.standard_number}
                      </span>
                      <span className="text-[10px] text-navy-600 font-medium">{c.source_type?.toUpperCase()}</span>
                    </div>
                  )}
                  <p className="text-xs font-semibold text-navy-800 leading-tight mb-1">
                    {c.document_title || c.standard_number || 'BIS Document'}
                  </p>
                  {c.section && (
                    <p className="text-[10px] text-slate-500">§ {c.section}</p>
                  )}
                  {c.relevance_score !== undefined && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-navy-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(c.relevance_score * 100)}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1 }}
                          className="h-full bg-navy-500 rounded-full"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {Math.round(c.relevance_score * 100)}%
                      </span>
                    </div>
                  )}
                  {c.source_url && (
                    <a
                      href={c.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 flex items-center gap-1 text-[10px] text-navy-500 hover:text-navy-700 font-medium"
                    >
                      <Link2 size={9} /> {c.authority || 'BIS'} {translatePhrase('BIS Source', language)}
                      <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : sources.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {translatePhrase('Sources', language)} ({sources.length})
            </p>
            <div className="space-y-2">
              {sources.map((s, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-navy-800 leading-tight mb-1">{s.title}</p>
                  {s.category && <p className="text-[10px] text-slate-500">{s.category}</p>}
                  {s.confidence !== undefined && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-navy-400 rounded-full" style={{ width: `${s.confidence}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400">{s.confidence}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertCircle size={20} className="text-amber-400 mx-auto mb-2" />
            <p className="text-xs text-slate-400">{translatePhrase('No citations available for this response.', language)}</p>
          </div>
        )}

        {/* Next Steps */}
        {next_steps?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {translatePhrase('Recommended Next Steps', language)}
            </p>
            <div className="space-y-1.5">
              {next_steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-600 bg-gold-50 border border-gold-100 rounded-lg p-2">
                  <ArrowRight size={11} className="text-gold-500 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <p className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-1.5">
            <Info size={10} className="flex-shrink-0 mt-0.5" />
            BIS AI provides guidance based on curated BIS knowledge. Always verify with official BIS publications at{' '}
            <a href="https://www.bis.gov.in" target="_blank" rel="noopener noreferrer" className="text-navy-500 font-medium hover:underline">
              bis.gov.in
            </a>.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Message bubble — Bot ───────────────────────────────────────────────────────
function BotMessage({ msg, role, onEvidenceSelect, isSelected }) {
  const [speaking, setSpeaking] = useState(false)
  const { language } = useLang()

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const utt = new SpeechSynthesisUtterance(msg.text.replace(/\*\*/g, ''))
    const langMap = { hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN', mr: 'mr-IN', en: 'en-IN' }
    utt.lang = langMap[language] || 'en-IN'
    utt.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(utt)
    setSpeaking(true)
  }

  const renderText = (text) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="font-semibold text-navy-900">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    )

  if (msg.isComplaintReceipt) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-gradient-to-br from-green-950 via-slate-900 to-emerald-950 border-2 border-green-500/50 rounded-3xl p-5 text-white shadow-2xl space-y-3"
      >
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-7 h-7 rounded-xl bg-green-500 flex items-center justify-center">
            <CheckCircle size={16} />
          </div>
          <div>
            <h4 className="font-bold text-xs text-white">Official BIS Complaint Registered</h4>
            <span className="text-[10px] text-green-300">Consumer Grievance Cell</span>
          </div>
          <span className="ml-auto bg-green-500/20 text-green-300 border border-green-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">CONFIRMED</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
            <span className="text-slate-400 block mb-0.5 text-[10px]">Complaint ID</span>
            <span className="font-mono font-bold text-green-400">{msg.complaint_id}</span>
          </div>
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
            <span className="text-slate-400 block mb-0.5 text-[10px]">Status</span>
            <span className="font-bold text-emerald-300 text-[11px]">Assigned for Investigation</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 border-t border-white/10 pt-2">
          BIS Toll-Free: 1800-11-4070 · Section 29, BIS Act 2016
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-2.5 max-w-[95%]"
    >
      <div className="w-7 h-7 rounded-full bg-navy-900 flex items-center justify-center flex-shrink-0 mt-1">
        <Zap size={13} className="text-gold-400" />
      </div>
      <div className="flex-1">
        <div
          className={`bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border cursor-pointer transition-all duration-200 ${
            isSelected ? 'border-navy-300 shadow-navy-100 shadow-md' : 'border-slate-100 hover:border-slate-200'
          }`}
          onClick={() => onEvidenceSelect && onEvidenceSelect(msg)}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Bot size={11} className="text-navy-600" />
              <span className="text-[11px] font-semibold text-navy-800">
                {role === 'consumer' ? translatePhrase('Consumer Protection AI', language)
                  : role === 'manufacturer' ? translatePhrase('Manufacturer Licensing AI', language)
                  : translatePhrase('BIS Assistant AI', language)}
              </span>
              {msg.agent && msg.agent !== 'general' && (
                <span className="text-[10px] bg-navy-50 border border-navy-100 text-navy-600 px-1.5 py-0.5 rounded-full font-medium">
                  {msg.agent}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {msg.confidence && (
                <ConfidencePill level={msg.confidence.level} score={msg.confidence.score} />
              )}
              <button onClick={(e) => { e.stopPropagation(); handleSpeak() }} className="p-1 rounded hover:bg-slate-100">
                {speaking
                  ? <VolumeX size={12} className="text-navy-600" />
                  : <Volume2 size={12} className="text-slate-400" />}
              </button>
            </div>
          </div>
          <div className="text-sm text-slate-700 leading-relaxed space-y-0.5">
            {translatePhrase(msg.text, language).split('\n').map((line, i) => (
              <p key={i} className={line.startsWith('- ') || /^\d+\./.test(line.trim()) ? 'ml-2' : ''}>
                {renderText(line)}
              </p>
            ))}
          </div>
          {(msg.citations?.length > 0 || msg.sources?.length > 0) && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <FileText size={10} className="text-navy-400" />
              <span className="text-[10px] text-navy-500 font-medium">
                {msg.citations?.length || msg.sources?.length} {translatePhrase('sources cited', language)}
              </span>
              <span className="text-[10px] text-slate-400">· {translatePhrase('Click to view evidence →', language)}</span>
            </div>
          )}
          {msg.isDemoFallback && (
            <div className="mt-2 pt-2 border-t border-amber-100">
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                ⚠️ DEMO DATA — Backend offline
              </span>
            </div>
          )}
        </div>
        <span className="text-[10px] text-slate-400 mt-1 ml-1 block">{msg.time}</span>
      </div>
    </motion.div>
  )
}

function UserMessage({ msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-end justify-end gap-2"
    >
      <div className="max-w-[80%]">
        <div className="bg-navy-900 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-md">
          <p className="text-sm leading-relaxed">{msg.text}</p>
        </div>
        <span className="text-[10px] text-slate-400 mt-1 mr-1 block text-right">{msg.time}</span>
      </div>
      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-4">
        <User size={13} className="text-slate-600" />
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-full bg-navy-900 flex items-center justify-center flex-shrink-0">
        <Zap size={13} className="text-gold-400" />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100 flex items-center gap-1.5">
        <span className="text-xs text-slate-400 mr-1">Searching BIS knowledge…</span>
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-navy-400 inline-block"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main Chat Component ────────────────────────────────────────────────────────
export default function Chat() {
  const { t, language } = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const normalizeRole = (r) => {
    if (!r) return 'consumer'
    if (r === 'helper' || r === 'student') return 'student'
    if (r === 'manufacturer' || r === 'mfr') return 'manufacturer'
    return 'consumer'
  }

  const [role, setRole]                     = useState(normalizeRole(searchParams.get('role')))
  const [messages, setMessages]             = useState([])
  const [input, setInput]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [recording, setRecording]           = useState(false)
  const [voiceStatus, setVoiceStatus]       = useState('')
  const [showComplaint, setShowComplaint]   = useState(false)
  const [complaintData, setComplaintData]   = useState({})
  const [selectedMsg, setSelectedMsg]       = useState(null)   // for evidence panel

  const endRef          = useRef(null)
  const inputRef        = useRef(null)
  const speechRef       = useRef(null)
  const sentUrlQ        = useRef(false)
  const isLoadingRef    = useRef(false)

  const welcomeText = (r, lang = language) => {
    let raw = ''
    if (r === 'consumer')     raw = `Hello! I am your dedicated Consumer Protection AI Agent.\n\nAsk me about verifying ISI marks (CM/L number via BIS CARE app), gold HUID hallmarking, identifying fake marks, mandatory ISI products, or filing complaints. Every answer includes source citations.`
    else if (r === 'manufacturer') raw = `Hello! I am your dedicated Manufacturer & MSME Licensing AI Agent.\n\nAsk me about applicable IS standards, Form-V documentation, Manak Online portal, factory audits, laboratory testing, Quality Control Orders (QCOs), and FMCS foreign certification. Every answer includes citations.`
    else raw = `Hello! I am your dedicated BIS Helper & Research AI Agent.\n\nAsk me about Indian Standards formulation, the BIS Act 2016, ISO/IEC international committees, Standards Clubs in colleges, academic internships, and technical specifications. Every answer includes citations.`
    return translatePhrase(raw, lang)
  }

  useEffect(() => {
    const r = normalizeRole(searchParams.get('role'))
    setRole(r)
  }, [searchParams])

  useEffect(() => {
    setMessages(prev => {
      if (!prev.length || (prev.length === 1 && prev[0].isWelcome)) {
        return [{
          id: newId(), role: 'bot', isWelcome: true,
          text: welcomeText(role, language), time: getTime(), sources: [], citations: []
        }]
      }
      return prev
    })
    setSelectedMsg(null)
  }, [role, language])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (sentUrlQ.current) return
    const q = searchParams.get('q')
    if (q?.trim()) {
      sentUrlQ.current = true
      doSend(q.trim(), role)
    }
  }, [])

  const handleRoleChange = (r) => {
    setRole(r)
    setSearchParams({ role: r === 'student' ? 'helper' : r })
  }

  const doSend = async (text, activeRole = role) => {
    if (!text?.trim() || isLoadingRef.current) return
    isLoadingRef.current = true
    setLoading(true)
    setMessages(prev => [...prev, { id: newId(), role: 'user', text: text.trim(), time: getTime() }])
    setInput('')

    try {
      const res = await sendChatMessage(text.trim(), language, activeRole)
      const rawAnswer = res.answer || res.response || res.message || ''
      const answer = (language && language !== 'en') ? translatePhrase(rawAnswer, language) : rawAnswer
      const botMsg = {
        id:         newId(),
        role:       'bot',
        text:       answer,
        sources:    res.sources || [],
        citations:  res.citations || [],
        confidence: res.confidence || null,
        agent:      res.agent || activeRole,
        next_steps: res.next_steps || [],
        trace_id:   res.trace_id || '',
        time:       getTime(),
      }
      setMessages(prev => [...prev, botMsg])
      setSelectedMsg(botMsg)
    } catch {
      // DEMO fallback — clearly labelled
      await new Promise(r => setTimeout(r, 500))
      const mock    = mockChatResponses?.find(r => r.query_keywords?.some(kw => text.toLowerCase().includes(kw)))
                      || getDefaultChatResponse?.(text)
                      || { answer: `I'm unable to connect to the BIS knowledge base right now. Please try again shortly or visit https://www.bis.gov.in`, sources: [] }
      const rawAnswer = mock.answer
      const answer = (language && language !== 'en') ? translatePhrase(rawAnswer, language) : rawAnswer
      const botMsg  = {
        id:           newId(),
        role:         'bot',
        text:         answer,
        sources:      mock.sources || [],
        citations:    [],
        isDemoFallback: true,
        time:         getTime(),
      }
      setMessages(prev => [...prev, botMsg])
      setSelectedMsg(botMsg)
    } finally {
      isLoadingRef.current = false
      setLoading(false)
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading) return
    doSend(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const langCodeMap = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN', mr: 'mr-IN' }

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Speech recognition not supported. Please use Chrome or Edge.'); return }
    const recognition = new SR()
    speechRef.current = recognition
    recognition.lang              = langCodeMap[language] || 'en-IN'
    recognition.interimResults    = true
    recognition.continuous        = false
    recognition.onstart           = () => { setRecording(true); setVoiceStatus('Listening…') }
    recognition.onresult          = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      if (t.trim()) { setInput(t); setVoiceStatus(`"${t.slice(-40)}"`) }
    }
    recognition.onerror           = (e) => { if (e.error !== 'no-speech') setVoiceStatus(`Error: ${e.error}`) }
    recognition.onend             = () => { setRecording(false); setVoiceStatus(''); inputRef.current?.focus() }
    recognition.start()
  }

  const stopRecording = () => {
    if (speechRef.current) { try { speechRef.current.stop() } catch (e) {} speechRef.current = null }
    setRecording(false); setVoiceStatus('')
  }

  const toggleVoice = () => recording ? stopRecording() : startRecording()

  const clearChat = () => {
    setMessages([{
      id: newId(), role: 'bot', isWelcome: true,
      text: welcomeText(role, language), time: getTime(), sources: [], citations: []
    }])
    setSelectedMsg(null)
    setInput('')
    sentUrlQ.current = true
  }

  const roleQuestions = {
    consumer:     ['How to verify ISI mark using BIS CARE app?', 'How to check 6-digit HUID on gold jewellery?', 'Which products must have ISI mark in India?', 'How to report a fake ISI mark product?'],
    manufacturer: ['What documents are needed for BIS ISI mark (Form V)?', 'Procedure for foreign manufacturers under FMCS?', 'What is CRS scheme for IT goods?', 'BIS-recognized labs in Mumbai for testing?'],
    student:      ['What is the BIS Act 2016?', 'How does BIS formulate Indian Standards?', 'What are Standards Clubs in colleges?', "What is India's role in ISO and IEC?"],
  }

  return (
    <>
      <AnimatePresence>
        {showComplaint && (
          <ComplaintModal
            initialData={complaintData}
            onClose={() => { setShowComplaint(false); setComplaintData({}) }}
            onSubmitted={(comp) => {
              setShowComplaint(false)
              const receipt = {
                id: newId(), role: 'bot', isComplaintReceipt: true,
                complaint_id: comp.complaint_id,
                text: `BIS Complaint Registered: ${comp.complaint_id}`,
                time: getTime(),
              }
              setMessages(prev => [...prev, receipt])
            }}
          />
        )}
      </AnimatePresence>

      {/* STEP 15: 3-column layout */}
      <div className="flex h-[calc(100vh-64px)] bg-[#f7f8fa] overflow-hidden">

        {/* ── LEFT PANEL: Agent & Role ─────────────────────────────────────── */}
        <div className="hidden lg:flex w-64 xl:w-72 bg-white border-r border-slate-200 flex-col flex-shrink-0">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-xl bg-navy-900 flex items-center justify-center">
                <Zap size={14} className="text-gold-400" />
              </div>
              <div>
                <h2 className="font-extrabold text-navy-900 text-sm leading-tight">{translatePhrase('BIS Assistant AI', language)}</h2>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {translatePhrase('V2 · Hybrid RAG', language)}
                </span>
              </div>
            </div>
          </div>

          {/* Role switcher */}
          <div className="p-3 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{translatePhrase('Switch Agent', language)}</p>
            <div className="space-y-1">
              {[
                { id: 'consumer',     label: 'Consumer',     sub: 'Verify & Complaints', icon: ShoppingBag },
                { id: 'manufacturer', label: 'Manufacturer', sub: 'Certification & Labs',  icon: Factory },
                { id: 'student',      label: 'Helper',       sub: 'Research & Standards', icon: BookOpen },
              ].map(({ id, label, sub, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleRoleChange(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                    role === id
                      ? 'bg-navy-900 text-white shadow-sm'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Icon size={15} className={role === id ? 'text-gold-400' : 'text-slate-400'} />
                  <div>
                    <p className="text-xs font-bold leading-tight">{translatePhrase(label, language)}</p>
                    <p className={`text-[10px] ${role === id ? 'text-slate-300' : 'text-slate-400'}`}>{translatePhrase(sub, language)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Suggested questions */}
          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{translatePhrase('Quick Questions', language)}</p>
            <div className="space-y-1.5">
              {(roleQuestions[role] || roleQuestions.consumer).map((q, i) => (
                <button
                  key={i}
                  onClick={() => doSend(translatePhrase(q, language))}
                  className="w-full text-left text-xs text-slate-600 bg-slate-50 hover:bg-navy-50 hover:text-navy-700 border border-slate-100 hover:border-navy-100 rounded-xl px-3 py-2 transition-all leading-relaxed"
                >
                  {translatePhrase(q, language)}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-4 space-y-2">
              {role === 'consumer' && (
                <button
                  onClick={() => setShowComplaint(true)}
                  className="w-full flex items-center gap-2 text-xs text-red-600 font-bold bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl px-3 py-2.5 transition-colors"
                >
                  <AlertTriangle size={13} /> {translatePhrase('Lodge Official Complaint', language)}
                </button>
              )}
              {role === 'manufacturer' && (
                <button
                  onClick={() => navigate('/manufacturer')}
                  className="w-full flex items-center gap-2 text-xs text-navy-700 font-bold bg-navy-50 hover:bg-navy-100 border border-navy-200 rounded-xl px-3 py-2.5 transition-colors"
                >
                  <Factory size={13} /> {translatePhrase('5-Step Certification Wizard', language)}
                </button>
              )}
              <button
                onClick={clearChat}
                className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-3 py-2 transition-colors"
              >
                <RefreshCw size={12} /> {translatePhrase('Clear Chat', language)}
              </button>
            </div>
          </div>
        </div>

        {/* ── CENTRE PANEL: Conversation ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Chat Header Bar with Active Agent Indicator & Right-Side Action Buttons */}
          <div className="bg-white border-b border-slate-200 px-4 py-2.5 sm:py-3 flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              <span className="text-xs font-extrabold text-navy-900 tracking-wider uppercase">
                {role === 'consumer'
                  ? translatePhrase('CONSUMER PROTECTION AGENT', language)
                  : role === 'manufacturer'
                  ? translatePhrase('MANUFACTURER & MSME AGENT', language)
                  : translatePhrase('RESEARCH & STANDARDS AGENT', language)}
              </span>
              <span className="text-slate-400 text-xs font-medium">• {translatePhrase('Active', language)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setComplaintData({
                    category: role === 'consumer' ? 'isi' : role === 'manufacturer' ? 'crs' : 'isi'
                  })
                  setShowComplaint(true)
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#e81123] hover:bg-[#c90e1e] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Lodge an official complaint"
              >
                <AlertTriangle size={13} className="text-white" />
                <span>{translatePhrase('File Complaint', language)}</span>
              </button>

              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                title="Start a new chat session"
              >
                <RefreshCw size={12} className="text-slate-500" />
                <span>{translatePhrase('New Chat', language)}</span>
              </button>
            </div>
          </div>

          {/* Consumer Action Banner */}
          {role === 'consumer' && (
            <div className="mx-4 mt-3 p-3.5 bg-red-50/80 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="font-bold text-xs sm:text-sm text-red-950">
                    {translatePhrase('Not satisfied or found a fake ISI mark / substandard product?', language)}
                  </p>
                  <p className="text-[11px] sm:text-xs text-red-700">
                    {translatePhrase('Click the complaint button to submit live camera proof, product details, and mobile number to BIS Enforcement.', language)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setComplaintData({ category: 'isi' })
                  setShowComplaint(true)
                }}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
              >
                <Camera size={14} /> {translatePhrase('Take Photo & File Complaint', language)}
              </button>
            </div>
          )}

          {/* Mobile role bar */}
          <div className="lg:hidden flex items-center gap-2 p-3 bg-white border-b border-slate-200 overflow-x-auto">
            {[
              { id: 'consumer', label: 'Consumer', icon: ShoppingBag },
              { id: 'manufacturer', label: 'Manufacturer', icon: Factory },
              { id: 'student', label: 'Helper', icon: BookOpen },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleRoleChange(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  role === id ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
            <button onClick={clearChat} className="ml-auto flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600">
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {messages.map(msg =>
              msg.role === 'bot'
                ? <BotMessage
                    key={msg.id}
                    msg={msg}
                    role={role}
                    isSelected={selectedMsg?.id === msg.id}
                    onEvidenceSelect={setSelectedMsg}
                    onFileComplaint={(d) => { setComplaintData(d); setShowComplaint(true) }}
                  />
                : <UserMessage key={msg.id} msg={msg} />
            )}
            {loading && <TypingIndicator />}
            <div ref={endRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-slate-200 bg-white p-3">
            {voiceStatus && (
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                {voiceStatus}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={recording ? translatePhrase('Listening… speak now', language) : translatePhrase('Ask about BIS standards, certification, or compliance…', language)}
                  className={`w-full pl-4 pr-4 py-3 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy-400 bg-white transition-all ${
                    recording ? 'border-red-300 ring-2 ring-red-300' : 'border-slate-200'
                  }`}
                  style={{ maxHeight: '120px', minHeight: '48px' }}
                />
              </div>
              <button
                type="button"
                onClick={toggleVoice}
                className={`p-3 rounded-xl transition-all flex-shrink-0 ${
                  recording ? 'bg-red-500 text-white animate-pulse shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {recording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0 shadow-sm"
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Evidence (STEP 15) ─────────────────────────────── */}
        <div className="hidden xl:flex w-72 2xl:w-80 bg-white border-l border-slate-200 flex-col flex-shrink-0">
          <EvidencePanel activeMsg={selectedMsg} />
        </div>
      </div>
    </>
  )
}
