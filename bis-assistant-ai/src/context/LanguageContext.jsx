import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../utils/translations'

const LanguageContext = createContext(null)

export const triggerUniversalTranslation = (langCode) => {
  try {
    const isEn = langCode === 'en'
    const targetCookie = isEn ? '/en/en' : `/en/${langCode}`
    const host = window.location.hostname

    // 1. Set Google Translate cookie
    document.cookie = `googtrans=${targetCookie}; path=/;`
    if (host) {
      document.cookie = `googtrans=${targetCookie}; path=/; domain=${host};`
      document.cookie = `googtrans=${targetCookie}; path=/; domain=.${host};`
    }

    // 2. Manipulate Google Translate combo box if present
    const applyCombo = () => {
      const combo = document.querySelector('.goog-te-combo')
      if (combo) {
        if (isEn) {
          const enOpt = Array.from(combo.options).find(o => o.value === 'en' || o.value === '')
          combo.value = enOpt ? enOpt.value : ''
        } else {
          combo.value = langCode
        }
        combo.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }
      return false
    }

    if (!applyCombo()) {
      let attempts = 0
      const iv = setInterval(() => {
        attempts++
        if (applyCombo() || attempts > 12) {
          clearInterval(iv)
        }
      }, 250)
    }

    // 3. Clean reversion to English
    if (isEn) {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      if (host) {
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${host};`
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${host};`
      }
      try {
        const frame = document.querySelector('.goog-te-banner-frame')
        if (frame && frame.contentDocument) {
          const restoreBtn = frame.contentDocument.querySelector('#\\:1\\.restore, .goog-close-link, button')
          if (restoreBtn) restoreBtn.click()
        }
      } catch (err) {
        // frame cross-origin or inaccessible
      }

      // Check if Google Translate font tags remain; if so, cleanly reload
      setTimeout(() => {
        const fontTags = document.querySelectorAll('font')
        if (fontTags.length > 0) {
          window.location.reload()
        }
      }, 400)
    }
  } catch (err) {
    console.warn('Universal translation trigger error:', err)
  }
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('bis_lang') || 'en'
  })

  const { t } = useTranslation(language)

  const setLanguage = useCallback((newLang) => {
    localStorage.setItem('bis_lang', newLang)
    setLanguageState(newLang)
    triggerUniversalTranslation(newLang)
  }, [])

  // On initial mount or page refresh, ensure translation is applied if not English
  useEffect(() => {
    const saved = localStorage.getItem('bis_lang') || 'en'
    if (saved !== 'en') {
      triggerUniversalTranslation(saved)
    }
  }, [])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLang = () => {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
