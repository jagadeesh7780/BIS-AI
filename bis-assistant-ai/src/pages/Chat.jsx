import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Mic, MicOff, Volume2, VolumeX, ChevronDown, ChevronUp, ChevronRight,
  Zap, ExternalLink, BarChart2, Bot, User, Square, RefreshCw,
  AlertTriangle, Upload, X, CheckCircle, FileText, ShoppingBag,
  Factory, BookOpen, Sparkles, HelpCircle, ArrowRight, Camera,
  ShieldCheck, Phone, Check, Info, ShieldAlert, Award
} from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { sendChatMessage, transcribeVoice } from '../api/client'
import { mockChatResponses, getDefaultChatResponse } from '../utils/mockData'
import ComplaintModal from '../components/ComplaintModal'

let msgIdCounter = 0
const newId = () => ++msgIdCounter
const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const getMockResponse = (query, role = 'consumer') => {
  const lower = query.toLowerCase()
  const match = mockChatResponses.find(r =>
    r.query_keywords.some(kw => lower.includes(kw))
  )
  return match || getDefaultChatResponse(query)
}

function TypingIndicator({ text }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center flex-shrink-0">
        <Zap size={14} className="text-gold-400" />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-card flex items-center gap-1.5 border border-slate-100">
        <span className="text-sm text-slate-500 mr-1">{text}</span>
        <span className="typing-dot w-2 h-2 rounded-full bg-navy-400 inline-block" />
        <span className="typing-dot w-2 h-2 rounded-full bg-navy-400 inline-block" />
        <span className="typing-dot w-2 h-2 rounded-full bg-navy-400 inline-block" />
      </div>
    </div>
  )
}

function ConfidenceBar({ score }) {
  const color = score >= 85 ? 'bg-green-500' : score >= 65 ? 'bg-amber-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className={`text-xs font-bold ${score >= 85 ? 'text-green-600' : score >= 65 ? 'text-amber-600' : 'text-red-500'}`}>
        {score}%
      </span>
    </div>
  )
}

function SourcesCitation({ sources, t }) {
  const [open, setOpen] = useState(false)
  if (!sources?.length) return null
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-700 transition-colors"
      >
        <BarChart2 size={12} />
        {t('chat_sources')} ({sources.length})
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 space-y-2 overflow-hidden"
          >
            {sources.map((src, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-navy-800">{src.id}</span>
                  <span className="text-xs text-slate-500">{t('chat_confidence')}</span>
                </div>
                <p className="text-xs text-slate-600 mb-2">{src.title}</p>
                <ConfidenceBar score={src.confidence} />
              </div>
            ))}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="badge-source"><ExternalLink size={9} /> {t('source_official')}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BotMessage({ msg, t, language, role, onFileComplaint }) {
  const [speaking, setSpeaking] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const utt = new SpeechSynthesisUtterance(msg.text.replace(/\*\*/g, ''))
    
    const langMap = {
      'hi': 'hi-IN',
      'te': 'te-IN',
      'ta': 'ta-IN',
      'kn': 'kn-IN',
      'mr': 'mr-IN',
      'en': 'en-IN'
    }
    utt.lang = langMap[language] || 'en-IN'
    utt.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(utt)
    setSpeaking(true)
  }

  const copyTracking = () => {
    if (msg.complaint_id) {
      navigator.clipboard.writeText(msg.complaint_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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
        className="w-full max-w-2xl bg-gradient-to-br from-green-950 via-slate-900 to-emerald-950 border-2 border-green-500/50 rounded-3xl p-6 text-white shadow-2xl space-y-4 my-2"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center text-white">
              <CheckCircle size={18} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Official BIS Complaint Registered</h4>
              <span className="text-[10px] text-green-300">Enforcement & Consumer Grievance Cell</span>
            </div>
          </div>
          <span className="bg-green-500/20 text-green-300 border border-green-500/30 text-[11px] px-3 py-0.5 rounded-full font-bold">
            CONFIRMED
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-black/30 p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block mb-0.5">Complaint Tracking ID</span>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-green-400 text-sm">{msg.complaint_id}</span>
              <button onClick={copyTracking} className="text-[10px] text-slate-300 hover:text-white bg-white/10 px-2 py-0.5 rounded">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="bg-black/30 p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block mb-0.5">Status</span>
            <span className="font-bold text-emerald-300">Logged & Assigned for Investigation</span>
          </div>
          {msg.contact && (
            <div className="bg-black/30 p-3 rounded-xl border border-white/10">
              <span className="text-slate-400 block mb-0.5">Registered Contact</span>
              <span className="font-medium text-white">{msg.contact}</span>
            </div>
          )}
          {msg.description && (
            <div className="bg-black/30 p-3 rounded-xl border border-white/10">
              <span className="text-slate-400 block mb-0.5">Issue Reported</span>
              <span className="font-medium text-slate-200 truncate block">{msg.description}</span>
            </div>
          )}
        </div>

        {msg.photo && (
          <div className="bg-black/30 p-3 rounded-xl border border-white/10 flex items-center gap-3">
            <img src={msg.photo} alt="Attached Evidence" className="w-16 h-16 rounded-lg object-cover border border-white/20" />
            <div className="text-xs">
              <span className="font-bold text-white block">Photo Evidence Attached</span>
              <span className="text-slate-400 text-[11px]">Timestamped & Submitted to BIS Technical Officer</span>
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 pt-2 border-t border-white/10 flex items-center justify-between">
          <span>BIS Toll-Free Helpline: 1800-11-4070</span>
          <span>Logged under Section 29, BIS Act 2016</span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-3 max-w-[90%]"
    >
      <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center flex-shrink-0 mt-1">
        <Zap size={14} className="text-gold-400" />
      </div>
      <div className="flex-1">
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-card border border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-navy-800 flex items-center gap-1">
              <Bot size={12} />
              {role === 'consumer' ? 'Consumer Protection AI' : role === 'manufacturer' ? 'Manufacturer Licensing AI' : 'Helper & Research AI'}
            </span>
            <div className="flex items-center gap-2">
              <span className="badge-ai"><Zap size={9} /> {t('powered_by')}</span>
              <button onClick={handleSpeak} className="p-1 rounded-md hover:bg-slate-100 transition-colors" title={t('chat_speak')}>
                {speaking ? <VolumeX size={13} className="text-navy-700" /> : <Volume2 size={13} className="text-slate-400" />}
              </button>
            </div>
          </div>
          <div className="text-sm text-slate-700 leading-relaxed space-y-1">
            {msg.text.split('\n').map((line, i) => (
              <p key={i} className={`${line.startsWith('- ') || /^\d+\./.test(line.trim()) ? 'ml-2' : ''}`}>
                {renderText(line)}
              </p>
            ))}
          </div>
          {msg.sources && <SourcesCitation sources={msg.sources} t={t} />}

          {/* Consumer Mode: Not Satisfied? File Complaint Option */}
          {role === 'consumer' && !msg.isWelcome && !msg.isComplaintReceipt && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">Not satisfied with this answer or suspect a fake product?</span>
              <button
                onClick={() => onFileComplaint && onFileComplaint({ description: `Query related to: ${msg.text.slice(0, 120)}...` })}
                className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
              >
                <AlertTriangle size={11} /> 🚨 File Official Complaint
              </button>
            </div>
          )}
        </div>
        <span className="text-xs text-slate-400 mt-1 ml-1 block">{msg.time}</span>
      </div>
    </motion.div>
  )
}

function UserMessage({ msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-end justify-end gap-3"
    >
      <div className="max-w-[80%]">
        <div className="bg-navy-900 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-md">
          <p className="text-sm leading-relaxed">{msg.text}</p>
        </div>
        <span className="text-xs text-slate-400 mt-1 mr-1 block text-right">{msg.time}</span>
      </div>
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-5">
        <User size={14} className="text-slate-600" />
      </div>
    </motion.div>
  )
}

export default function Chat() {
  const { t, language } = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // Normalize initial role from query parameter
  const initialRoleParam = searchParams.get('role')
  const initialRole = (initialRoleParam === 'helper' || initialRoleParam === 'student')
    ? 'student'
    : (initialRoleParam === 'manufacturer' || initialRoleParam === 'mfr')
      ? 'manufacturer'
      : 'consumer'

  const [role, setRole] = useState(initialRole)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [showComplaint, setShowComplaint] = useState(false)
  const [complaintInitialData, setComplaintInitialData] = useState({})

  const messagesEndRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const speechRecognitionRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const inputRef = useRef(null)
  const sentUrlQuery = useRef(false)
  const isLoadingRef = useRef(false)

  // Welcome message generators tailored strictly per agent
  const getWelcomeText = (activeRole) => {
    if (activeRole === 'consumer') {
      return `Hello! I am your dedicated Consumer Protection AI Agent.\n\nAsk me any question about verifying genuine ISI marks, checking 6-digit gold HUID hallmarking, identifying mandatory ISI products, or exercising your consumer rights. If you found a counterfeit product or are not satisfied with an answer, click the "File Complaint" button at the top to register an official grievance.`
    } else if (activeRole === 'manufacturer') {
      return `Hello! I am your dedicated Manufacturer & MSME Licensing AI Agent.\n\nAsk me about applicable Indian Standards, Form V document preparation, Foreign Manufacturer Certification (FMCS), CRS scheme for electronics, laboratory sample testing, or Quality Control Orders (QCOs). You can also click the 5-Step Process button to start automated licensing.`
    } else {
      return `Hello! I am your dedicated Helper & Research AI Agent.\n\nAsk me about Indian Standards formulation across 17 technical division councils, the BIS Act 2016, ISO/IEC international technical committees, educational Standards Clubs, academic internships, or technical specifications.`
    }
  }

  // Update role if URL search params change
  useEffect(() => {
    const r = searchParams.get('role')
    if (r) {
      const normalized = (r === 'helper' || r === 'student') ? 'student' : (r === 'manufacturer' || r === 'mfr') ? 'manufacturer' : 'consumer'
      if (normalized !== role) {
        setRole(normalized)
      }
    }
  }, [searchParams])

  // Reset messages when role changes (Strict Role Isolation)
  useEffect(() => {
    setMessages([{
      id: newId(),
      role: 'bot',
      isWelcome: true,
      text: getWelcomeText(role),
      time: getTime(),
      sources: null,
    }])
  }, [role])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Handle URL query ?q= on initial mount
  useEffect(() => {
    if (sentUrlQuery.current) return
    const q = searchParams.get('q')
    if (q && q.trim()) {
      sentUrlQuery.current = true
      doSendMessage(q.trim(), role)
    }
  }, [])

  const handleRoleChange = (newRole) => {
    setRole(newRole)
    const roleParam = newRole === 'student' ? 'helper' : newRole
    setSearchParams({ role: roleParam })
  }

  const doSendMessage = async (text, activeRole = role) => {
    if (!text?.trim() || isLoadingRef.current) return
    isLoadingRef.current = true
    setLoading(true)

    const userMsg = { id: newId(), role: 'user', text: text.trim(), time: getTime() }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    try {
      const res = await sendChatMessage(text.trim(), language, activeRole)
      const answer = res.answer || res.response || res.message || ''
      setMessages(prev => [...prev, {
        id: newId(),
        role: 'bot',
        text: answer,
        sources: res.sources || [],
        time: getTime(),
      }])
    } catch {
      await new Promise(r => setTimeout(r, 600))
      const mock = getMockResponse(text, activeRole)
      setMessages(prev => [...prev, {
        id: newId(),
        role: 'bot',
        text: mock.answer,
        sources: mock.sources,
        time: getTime(),
      }])
    } finally {
      isLoadingRef.current = false
      setLoading(false)
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading) return
    doSendMessage(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    sentUrlQuery.current = true
    setMessages([{
      id: newId(),
      role: 'bot',
      isWelcome: true,
      text: getWelcomeText(role),
      time: getTime(),
      sources: null,
    }])
    setInput('')
  }

  const openComplaintModal = (initialData = {}) => {
    setComplaintInitialData(initialData)
    setShowComplaint(true)
  }

  const langCodeMap = {
    en: 'en-IN',
    hi: 'hi-IN',
    te: 'te-IN',
    ta: 'ta-IN',
    kn: 'kn-IN',
    mr: 'mr-IN'
  }

  const startRecording = () => {
    // 1. Primary: Browser Native Web Speech API for real-time live transcription
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition()
        speechRecognitionRef.current = recognition
        recognition.lang = langCodeMap[language] || 'en-IN'
        recognition.interimResults = true
        recognition.continuous = true

        recognition.onstart = () => {
          setRecording(true)
          setVoiceStatus('Listening... speak into your microphone')
          setRecordingTime(0)
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = setInterval(() => setRecordingTime(n => n + 1), 1000)
        }

        recognition.onresult = (event) => {
          let currentTranscript = ''
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript
          }
          if (currentTranscript.trim()) {
            setInput(currentTranscript)
            setVoiceStatus(`Recognized: "${currentTranscript.slice(-35)}"`)
          }
        }

        recognition.onerror = (event) => {
          console.warn('Speech recognition error event:', event.error)
          if (event.error === 'not-allowed') {
            setVoiceStatus('Microphone permission denied.')
          } else if (event.error !== 'no-speech') {
            setVoiceStatus(`Voice status: ${event.error}`)
          }
        }

        recognition.onend = () => {
          setRecording(false)
          clearInterval(recordingTimerRef.current)
          setRecordingTime(0)
          setVoiceStatus('')
          inputRef.current?.focus()
        }

        recognition.start()
        return
      } catch (err) {
        console.warn('Web Speech start exception:', err)
      }
    }

    // 2. Secondary fallback: MediaRecorder + Backend Whisper (Without ANY fake default questions)
    startMediaRecorderFallback()
  }

  const startMediaRecorderFallback = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setVoiceStatus('Transcribing audio...')
        try {
          const res = await transcribeVoice(blob)
          const txt = res.text || res.transcription || ''
          if (txt && txt.trim()) {
            setInput(txt.trim())
            inputRef.current?.focus()
            setVoiceStatus('')
          } else {
            setVoiceStatus('No speech recognized. Please speak clearly.')
            setTimeout(() => setVoiceStatus(''), 3000)
          }
        } catch {
          setVoiceStatus('Voice service unavailable. Please type your query.')
          setTimeout(() => setVoiceStatus(''), 3000)
        }
        clearInterval(recordingTimerRef.current)
        setRecordingTime(0)
      }
      recorder.start()
      setRecording(true)
      setVoiceStatus('Recording audio...')
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = setInterval(() => setRecordingTime(n => n + 1), 1000)
    } catch {
      alert('Microphone access denied or not available.')
      setRecording(false)
    }
  }

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop()
      } catch (e) {
        console.warn(e)
      }
      speechRecognitionRef.current = null
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    clearInterval(recordingTimerRef.current)
    setRecordingTime(0)
    inputRef.current?.focus()
  }

  // Role-specific suggested questions (Strict isolation)
  const roleQuestions = {
    consumer: [
      'How to verify ISI mark using BIS CARE mobile app?',
      'How to check 6-digit HUID code in gold jewellery?',
      'Which products are mandatory to have ISI mark?',
      'How do I report a fake ISI mark product?'
    ],
    manufacturer: [
      'What documents are required for BIS license (Form V)?',
      'Procedure for foreign manufacturers under FMCS?',
      'What is Compulsory Registration Scheme (CRS) for IT goods?',
      'Where are BIS recognized testing laboratories in Mumbai?'
    ],
    student: [
      'What is the Bureau of Indian Standards Act 2016?',
      'How does BIS formulate new Indian Standards across 17 sectors?',
      'How do Standards Clubs work in schools and colleges?',
      'What is India’s role in ISO and IEC international committees?'
    ]
  }

  return (
    <>
      <AnimatePresence>
        {showComplaint && (
          <ComplaintModal
            initialData={complaintInitialData}
            onClose={() => {
              setShowComplaint(false)
              setComplaintInitialData({})
            }}
            onSubmitted={(comp) => {
              setShowComplaint(false)
              setComplaintInitialData({})
              const receipt = {
                id: newId(),
                role: 'bot',
                isComplaintReceipt: true,
                complaint_id: comp.complaint_id,
                contact: comp.details?.contactNumber || comp.contact_number,
                description: comp.details?.description,
                photo: comp.details?.photoData || comp.details?.photo_data,
                time: getTime(),
                text: `Official BIS Complaint Registered: ${comp.complaint_id}`
              }
              setMessages(prev => [...prev, receipt])
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] bg-[#f7f8fa] overflow-hidden">
        {/* ─── LEFT PANEL: Dedicated Agent Workspace & Role Controls ─────────── */}
        <div className="w-full lg:w-80 xl:w-96 bg-white border-r border-slate-200 flex flex-col justify-between p-4 sm:p-5 overflow-y-auto">
          <div className="space-y-5">
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-navy-900 flex items-center justify-center shadow-sm">
                  <Zap size={16} className="text-gold-400" />
                </div>
                <div>
                  <h2 className="font-extrabold text-navy-900 text-base leading-tight">
                    {role === 'consumer' ? 'Consumer Protection AI' : role === 'manufacturer' ? 'Manufacturer Licensing AI' : 'Helper & Research AI'}
                  </h2>
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Dedicated Agent Active
                  </span>
                </div>
              </div>
            </div>

            {/* Agent Role Switcher Tabs */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Switch AI Agent
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
                {[
                  { id: 'consumer', label: 'Consumer', icon: ShoppingBag },
                  { id: 'manufacturer', label: 'Manufacturer', icon: Factory },
                  { id: 'student', label: 'Helper', icon: BookOpen },
                ].map(r => {
                  const Icon = r.icon
                  const active = role === r.id
                  return (
                    <button
                      key={r.id}
                      onClick={() => handleRoleChange(r.id)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                        active
                          ? 'bg-navy-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-navy-900 hover:bg-white/60'
                      }`}
                    >
                      <Icon size={14} className={active ? 'text-gold-400' : 'text-slate-500'} />
                      <span className="text-[11px] leading-tight">{r.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ─── ISOLATED AGENT WORKSPACE PANEL ─── */}
            {role === 'consumer' && (
              <div className="space-y-4 bg-gold-50/50 border border-gold-200/60 rounded-2xl p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-gold-600" /> Consumer Safety Toolkit
                  </span>
                  <span className="text-[10px] bg-gold-200 text-navy-900 font-bold px-2 py-0.5 rounded-full">
                    BIS CARE
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => openComplaintModal()}
                    className="w-full text-left bg-white p-2.5 rounded-xl border border-red-200 hover:border-red-400 transition-colors flex items-center justify-between group shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-500 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-red-700">Lodge Official Complaint</span>
                    </div>
                    <ArrowRight size={12} className="text-red-400" />
                  </button>

                  <button
                    onClick={() => doSendMessage('How to verify ISI mark using BIS CARE mobile app?')}
                    className="w-full text-left bg-white p-2.5 rounded-xl border border-gold-200/80 hover:border-gold-300 transition-colors flex items-center justify-between group shadow-sm text-slate-700"
                  >
                    <span className="font-medium">Verify ISI Mark (CM/L)</span>
                    <ChevronRight size={12} className="text-slate-400" />
                  </button>

                  <button
                    onClick={() => doSendMessage('How to check 6-digit HUID code in gold jewellery?')}
                    className="w-full text-left bg-white p-2.5 rounded-xl border border-gold-200/80 hover:border-gold-300 transition-colors flex items-center justify-between group shadow-sm text-slate-700"
                  >
                    <span className="font-medium">Check Gold HUID Purity</span>
                    <ChevronRight size={12} className="text-slate-400" />
                  </button>
                </div>
              </div>
            )}

            {role === 'manufacturer' && (
              <div className="space-y-3 bg-navy-50/70 border border-navy-200/60 rounded-2xl p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                    <Factory size={14} className="text-navy-700" /> Manufacturer Fast-Track
                  </span>
                  <span className="text-[10px] bg-navy-200 text-navy-900 font-bold px-2 py-0.5 rounded-full">
                    Lab Testing Protocol
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => navigate('/manufacturer')}
                    className="w-full text-left bg-navy-900 text-white p-2.5 rounded-xl font-bold hover:bg-navy-800 transition-all flex items-center justify-between shadow-sm"
                  >
                    <span>Launch 5-Step Process →</span>
                    <Zap size={12} className="text-gold-400" />
                  </button>

                  <button
                    onClick={() => doSendMessage('What documents are required for BIS license (Form V)?')}
                    className="w-full text-left bg-white p-2.5 rounded-xl border border-slate-200 hover:border-navy-300 transition-colors flex items-center justify-between group shadow-sm text-slate-700"
                  >
                    <span className="font-medium">Form V Checklist</span>
                    <ChevronRight size={12} className="text-slate-400" />
                  </button>
                </div>
              </div>
            )}

            {role === 'student' && (
              <div className="space-y-3 bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-emerald-700" /> Helper & Research Desk
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                    Academic
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => doSendMessage('How does BIS formulate new Indian Standards across 17 sectors?')}
                    className="w-full text-left bg-white p-2.5 rounded-xl border border-emerald-200 hover:border-emerald-300 transition-colors flex items-center justify-between group shadow-sm text-slate-700"
                  >
                    <span className="font-medium">17 Technical Divisions</span>
                    <ChevronRight size={12} className="text-slate-400" />
                  </button>

                  <button
                    onClick={() => doSendMessage('What is the Bureau of Indian Standards Act 2016?')}
                    className="w-full text-left bg-white p-2.5 rounded-xl border border-emerald-200 hover:border-emerald-300 transition-colors flex items-center justify-between group shadow-sm text-slate-700"
                  >
                    <span className="font-medium">BIS Act 2016 Overview</span>
                    <ChevronRight size={12} className="text-slate-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Role Suggested Questions */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Suggested Prompts
              </label>
              <div className="space-y-1.5">
                {(roleQuestions[role] || roleQuestions.consumer).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => doSendMessage(q)}
                    className="w-full text-left text-xs font-medium text-slate-600 hover:text-navy-900 bg-slate-50 hover:bg-navy-50 hover:border-navy-200 p-2.5 rounded-xl border border-slate-200 transition-colors flex items-start justify-between gap-1"
                  >
                    <span className="line-clamp-2">{q}</span>
                    <ArrowRight size={12} className="flex-shrink-0 mt-0.5 opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Action: Top Complaint / Helpline */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <button
              onClick={() => openComplaintModal()}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02]"
            >
              <AlertTriangle size={15} /> 🚨 Lodge Grievance / Complaint
            </button>
            <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
              <Phone size={10} /> Helpline: 1800-11-4070 (Toll Free)
            </p>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Conversational AI Feed ─────────────────────────── */}
        <div className="flex-1 flex flex-col h-full bg-[#f7f8fa]">
          {/* Feed Header with Prominent Top Complaint Button */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                {role === 'consumer' ? 'Consumer Protection Agent' : role === 'manufacturer' ? 'Manufacturer Licensing Agent' : 'Helper & Research Agent'}
              </span>
              <span className="text-xs text-slate-400">• Active</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Top Complaint Button */}
              <button
                onClick={() => openComplaintModal()}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow transition-all hover:scale-105 border border-red-500"
                title="Lodge an official grievance with photo or details"
              >
                <AlertTriangle size={13} className="text-white" />
                <span>🚨 File Complaint</span>
              </button>
              
              <button
                onClick={clearChat}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-navy-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors font-medium"
                title="Reset conversation"
              >
                <RefreshCw size={12} /> New Chat
              </button>
            </div>
          </div>

          {/* Consumer Action Sticky Banner */}
          {role === 'consumer' && (
            <div className="mx-4 sm:mx-6 mt-3 bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 border border-red-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-navy-900 leading-tight">
                    Not satisfied or found a fake ISI mark / substandard product?
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
                    Click the complaint button to submit live camera proof, product details, and mobile number to BIS Enforcement.
                  </p>
                </div>
              </div>
              <button
                onClick={() => openComplaintModal()}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow transition-all hover:scale-105 flex-shrink-0 whitespace-nowrap"
              >
                <Camera size={13} /> Take Photo & File Complaint
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            <AnimatePresence>
              {messages.map(msg =>
                msg.role === 'user'
                  ? <UserMessage key={msg.id} msg={msg} />
                  : (
                    <BotMessage
                      key={msg.id}
                      msg={msg}
                      t={t}
                      language={language}
                      role={role}
                      onFileComplaint={openComplaintModal}
                    />
                  )
              )}
            </AnimatePresence>

            {loading && <TypingIndicator text={t('chat_thinking')} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice recording & live speech status banner */}
          <AnimatePresence>
            {(recording || voiceStatus) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                className={`mx-4 mb-2 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-xs border ${
                  recording ? 'bg-red-50/90 border-red-200 text-red-900' : 'bg-blue-50/90 border-blue-200 text-blue-900'
                }`}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${recording ? 'bg-red-500 animate-ping' : 'bg-blue-500'}`} />
                  <span className="text-xs font-bold truncate">
                    {voiceStatus || t('chat_listening')}
                  </span>
                  {recording && (
                    <span className="text-xs text-red-500 font-mono font-bold flex-shrink-0">
                      {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
                {recording ? (
                  <button
                    onClick={stopRecording}
                    className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-red-200 shadow-2xs flex-shrink-0"
                  >
                    <Square size={10} fill="currentColor" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={() => setVoiceStatus('')}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-0.5 flex-shrink-0"
                  >
                    ✕
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Bar */}
          <div className="bg-white border-t border-slate-200 p-4">
            <div className="max-w-4xl mx-auto flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask ${role === 'consumer' ? 'Consumer' : role === 'manufacturer' ? 'Manufacturer' : 'Helper & Research'} AI anything...`}
                  rows={1}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-400 text-sm resize-none leading-relaxed bg-slate-50 font-medium"
                  style={{ minHeight: '46px', maxHeight: '120px' }}
                  onInput={e => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                />
              </div>

              {/* Voice Mic Button */}
              <button
                onClick={recording ? stopRecording : startRecording}
                title={recording ? t('chat_mic_stop') : t('chat_mic_start')}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${
                  recording
                    ? 'bg-red-500 text-white shadow-lg animate-pulse'
                    : 'bg-slate-100 text-slate-600 hover:bg-navy-50 hover:text-navy-900'
                }`}
              >
                {recording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-11 h-11 rounded-2xl bg-navy-900 text-white flex items-center justify-center flex-shrink-0 hover:bg-navy-800 disabled:opacity-40 shadow-md transition-all hover:scale-105 active:scale-95"
                title={t('chat_send')}
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2">{t('disclaimer')}</p>
          </div>
        </div>
      </div>
    </>
  )
}
