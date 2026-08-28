import { Link } from 'react-router-dom'
import { Zap, Mail, ExternalLink } from 'lucide-react'
import { useLang } from '../context/LanguageContext'

// GitHub icon SVG inline since lucide-react version may not export it
function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

export default function Footer() {
  const { t } = useLang()

  return (
    <footer className="bg-navy-950 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl overflow-hidden shadow-lg border border-gold-400/40 bg-navy-900 flex items-center justify-center flex-shrink-0">
                <img src="/logo.png" alt="BIS Assistant AI Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="font-bold text-white text-base">BIS Assistant AI</div>
                <div className="text-xs text-gold-400 font-medium">Bureau of Indian Standards Intelligence Platform</div>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              An AI-powered assistant to help MSMEs, startups, students, and consumers navigate Indian Standards and BIS certification services.
            </p>
            <div className="mt-4 p-3 bg-navy-900 border border-navy-800 rounded-lg">
              <p className="text-xs text-amber-400 font-medium">⚠️ {t('disclaimer')}</p>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Features</h4>
            <ul className="space-y-2.5">
              {[
                { to: '/chat', label: 'AI Chat Assistant' },
                { to: '/standards', label: 'Standards Search' },
                { to: '/certification', label: 'Certification Guide' },
                { to: '/labs', label: 'Lab Finder' },
                { to: '/about', label: 'About BIS Platform' },
                { to: '/certification/tracker', label: 'Journey Tracker' },
              ].map(link => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* External */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2.5">
              {[
                { href: 'https://www.bis.gov.in', label: 'BIS Official Website' },
                { href: 'https://www.manakonline.in', label: 'Manak Online Portal' },
                { href: 'https://www.bis.gov.in/index.php/certification/', label: 'Certification Portal' },
                { href: 'https://hallmarking.bis.gov.in', label: 'Hallmarking Portal' },
              ].map(link => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1"
                  >
                    {link.label} <ExternalLink size={10} />
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
                aria-label="GitHub"
              >
                <GithubIcon />
              </a>
              <a
                href="mailto:demo@bisassistant.ai"
                className="p-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
                aria-label="Email"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-navy-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-slate-500 text-xs">
            © 2024 BIS Assistant AI. Built for the BIS Hackathon. Not an official BIS product.
          </p>
          <div className="flex items-center gap-2">
            <span className="badge-ai text-xs">
              <Zap size={10} /> Powered by AI
            </span>
            <span className="badge-source text-xs">
              Source: Official BIS Documents
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
