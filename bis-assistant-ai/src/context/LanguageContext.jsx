import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from '../utils/translations'
import { translateNodeTree, setupUniversalDomTranslator } from '../utils/domTranslator'

const LanguageContext = createContext(null)

export const triggerUniversalTranslation = (langCode) => {
  try {
    const isEn = langCode === 'en'
    const targetCookie = isEn ? '/en/en' : `/en/${langCode}`
    const host = window.location.hostname

    // 1. Set Google Translate cookie as enhancement
    document.cookie = `googtrans=${targetCookie}; path=/;`
    if (host) {
      document.cookie = `googtrans=${targetCookie}; path=/; domain=${host};`
      document.cookie = `googtrans=${targetCookie}; path=/; domain=.${host};`
    }

    // 2. Manipulate Google Translate combo box if present
    const combo = document.querySelector('.goog-te-combo')
    if (combo) {
      if (isEn) {
        const enOpt = Array.from(combo.options).find(o => o.value === 'en' || o.value === '')
        combo.value = enOpt ? enOpt.value : ''
      } else {
        combo.value = langCode
      }
      combo.dispatchEvent(new Event('change', { bubbles: true }))
    }
  } catch (err) {
    console.warn('Universal translation trigger error:', err)
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
    localStorage.setItem('bis_lang', newLang)
    setLanguageState(newLang)
    currentLangRef.current = newLang
    document.documentElement.lang = newLang

    // Apply immediate built-in full DOM translation across all page nodes
    const root = document.getElementById('root') || document.body
    if (root) {
      translateNodeTree(root, newLang)
    }

    // Also trigger external translation if available
    triggerUniversalTranslation(newLang)
  }, [])

  // On mount: setup the continuous DOM translator observer and apply saved language
  useEffect(() => {
    const saved = localStorage.getItem('bis_lang') || 'en'
    document.documentElement.lang = saved

    const cleanup = setupUniversalDomTranslator(() => currentLangRef.current)

    // Initial pass after React completes first paint
    const timer = setTimeout(() => {
      const root = document.getElementById('root') || document.body
      if (root && saved !== 'en') {
        translateNodeTree(root, saved)
      }
    }, 50)

    return () => {
      if (cleanup) cleanup()
      clearTimeout(timer)
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
