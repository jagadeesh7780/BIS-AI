import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Globe, ChevronDown, Zap } from 'lucide-react'
import { useLang } from '../context/LanguageContext'

const LANG_OPTIONS = [
  { code: 'en', label: 'English', flag: '🇮🇳' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', flag: '🇮🇳' },
]

export default function Navbar() {
  const { language, setLanguage, t } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const navigate = useNavigate()

  const navLinks = [
    { to: '/', label: t('nav_home') },
    { to: '/chat', label: t('nav_chat') },
    { to: '/manufacturer', label: t('nav_manufacturer') },
    { to: '/standards', label: t('nav_standards') },
    { to: '/certification', label: t('nav_certification') },
    { to: '/labs', label: t('nav_labs') },
    { to: '/about', label: t('nav_about') },
  ]

  const currentLang = LANG_OPTIONS.find(l => l.code === language)

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md border border-gold-400/40 bg-navy-950 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
              <img src="/logo.png" alt="BIS AI Emblem" className="w-full h-full object-cover" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-navy-900 text-sm sm:text-base tracking-tight flex items-center gap-1.5">
                BIS Assistant <span className="bg-gradient-to-r from-amber-400 to-yellow-400 text-navy-950 font-black text-[10px] px-1.5 py-0.5 rounded-md shadow-xs">AI</span>
              </div>
              <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Bureau of Indian Standards</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-navy-50 text-navy-900 font-semibold'
                      : 'text-slate-600 hover:text-navy-900 hover:bg-slate-50'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:border-navy-300 hover:text-navy-900 transition-colors"
              >
                <Globe size={14} />
                <span>{currentLang?.flag} {currentLang?.label}</span>
                <ChevronDown size={12} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden"
                  >
                    {LANG_OPTIONS.map(opt => (
                      <button
                        key={opt.code}
                        onClick={() => { setLanguage(opt.code); setLangOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-navy-50 transition-colors ${
                          language === opt.code ? 'bg-navy-50 text-navy-900 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        <span>{opt.flag}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CTA button */}
            <button
              onClick={() => navigate('/chat')}
              className="hidden sm:inline-flex btn-primary text-sm py-2 px-4"
            >
              {t('hero_cta')}
            </button>

            {/* Hamburger */}
            <button
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-slate-100 bg-white overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-navy-50 text-navy-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <button
                onClick={() => { navigate('/chat'); setMenuOpen(false) }}
                className="w-full btn-primary text-sm py-2.5 mt-2"
              >
                {t('hero_cta')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
