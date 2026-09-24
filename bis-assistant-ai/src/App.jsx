import React, { Component, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LanguageProvider, useLang } from './context/LanguageContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Chat from './pages/Chat'
import Standards from './pages/Standards'
import StandardDetail from './pages/StandardDetail'
import Certification from './pages/Certification'
import Tracker from './pages/Tracker'
import Labs from './pages/Labs'
import About from './pages/About'
import ManufacturerPortal from './pages/ManufacturerPortal'
import MLRiskAnalysis from './pages/MLRiskAnalysis'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a192f] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 text-2xl mb-4">
            ⚠️
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-300 max-w-md mb-6">{this.state.error?.message || 'An unexpected error occurred while loading this view.'}</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
            className="px-5 py-2.5 rounded-xl bg-gold-400 hover:bg-gold-300 text-navy-950 font-bold text-sm transition-colors shadow-lg"
          >
            Reload Home Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Page transition wrapper
function PageWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

function AppRoutes() {
  const location = useLocation()
  const { language, translateNodeTree } = useLang()
  const isChatPage = location.pathname === '/chat'

  // Seamlessly re-translate newly mounted navigation pages when route changes
  useEffect(() => {
    if (language && language !== 'en') {
      const timer = setTimeout(() => {
        const root = document.getElementById('root') || document.body
        if (root && translateNodeTree) {
          translateNodeTree(root, language)
        }
      }, 40)
      return () => clearTimeout(timer)
    }
  }, [location.pathname, language, translateNodeTree])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/compliance" element={<PageWrapper><ManufacturerPortal /></PageWrapper>} />
            <Route path="/manufacturer" element={<Navigate to="/compliance" replace />} />
            <Route path="/ml-risk" element={<PageWrapper><MLRiskAnalysis /></PageWrapper>} />
            <Route path="/standards" element={<PageWrapper><Standards /></PageWrapper>} />
            <Route path="/standards/:id" element={<PageWrapper><StandardDetail /></PageWrapper>} />
            <Route path="/certification" element={<PageWrapper><Certification /></PageWrapper>} />
            <Route path="/certification/tracker" element={<PageWrapper><Tracker /></PageWrapper>} />
            <Route path="/compare" element={<Navigate to="/standards" replace />} />
            <Route path="/labs" element={<PageWrapper><Labs /></PageWrapper>} />
            <Route path="/about" element={<PageWrapper><About /></PageWrapper>} />
          </Routes>
        </AnimatePresence>
      </main>
      {!isChatPage && <Footer />}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <AppRoutes />
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
