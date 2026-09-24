import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from '../utils/translations'
import { translateNodeTree } from '../utils/domTranslator'

const LanguageContext = createContext(null)

export function changeSiteLanguage(newLang, setLanguageState) {
  const host = window.location.hostname
  const isEn = newLang === 'en'
  const cookieVal = isEn ? '/en/en' : `/en/${newLang}`

  localStorage.setItem('bis_lang', newLang)
  if (setLanguageState) setLanguageState(newLang)
  document.documentElement.lang = newLang

  // Sync cookie
  if (!isEn) {
    document.cookie = `googtrans=${cookieVal}; path=/;`
    if (host) {
      document.cookie = `googtrans=${cookieVal}; path=/; domain=${host};`
      document.cookie = `googtrans=${cookieVal}; path=/; domain=.${host};`
    }
  } else {
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    if (host) {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${host};`
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${host};`
    }
  }

  // Instant in-memory translation across the entire DOM tree (no reload needed)
  const root = document.getElementById('root') || document.body
  if (root) {
    translateNodeTree(root, newLang)
  }

  // Trigger Google Translate gadget if available
  try {
    const combo = document.querySelector('.goog-te-combo')
    if (combo) {
      combo.value = isEn ? '' : newLang
      combo.dispatchEvent(new Event('change', { bubbles: true }))
    }
  } catch (err) {
    console.warn('Google Translate gadget trigger:', err)
  }
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('bis_lang') || 'en'
  })

  const currentLangRef = useRef(language)
  currentLangRef.current = language

  const { t } = useTranslation(language)

  const setLanguage = useCallback((newLang) => {
    changeSiteLanguage(newLang, setLanguageState)
  }, [])

  // On mount: ensure document lang is set and in-memory translation runs
  useEffect(() => {
    const saved = localStorage.getItem('bis_lang') || 'en'
    document.documentElement.lang = saved

    if (saved !== 'en') {
      const timer = setTimeout(() => {
        const root = document.getElementById('root') || document.body
        if (root) {
          translateNodeTree(root, saved)
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translateNodeTree }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLang = () => {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
