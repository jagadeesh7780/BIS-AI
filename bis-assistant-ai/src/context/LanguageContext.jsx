import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from '../utils/translations'
import { translateNodeTree } from '../utils/domTranslator'

const LanguageContext = createContext(null)

export function changeSiteLanguage(newLang) {
  const host = window.location.hostname
  const isEn = newLang === 'en'
  const cookieVal = isEn ? '/en/en' : `/en/${newLang}`

  localStorage.setItem('bis_lang', newLang)

  // Clear existing googtrans cookies across domain levels
  const expired = '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  document.cookie = 'googtrans' + expired
  document.cookie = 'googtrans' + expired + ' domain=' + host + ';'
  document.cookie = 'googtrans' + expired + ' domain=.' + host + ';'

  const parts = host.split('.')
  if (parts.length > 1) {
    const rootDomain = '.' + parts.slice(-2).join('.')
    document.cookie = 'googtrans' + expired + ' domain=' + rootDomain + ';'
  }

  // Set active cookie
  if (!isEn) {
    document.cookie = `googtrans=${cookieVal}; path=/;`
    document.cookie = `googtrans=${cookieVal}; path=/; domain=${host};`
    document.cookie = `googtrans=${cookieVal}; path=/; domain=.${host};`
    if (parts.length > 1) {
      const rootDomain = '.' + parts.slice(-2).join('.')
      document.cookie = `googtrans=${cookieVal}; path=/; domain=${rootDomain};`
    }
  }

  // Reload the window so Google Translate translates 100% of all fields, cards, and paragraphs
  window.location.reload()
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('bis_lang') || 'en'
  })

  const currentLangRef = useRef(language)
  currentLangRef.current = language

  const { t } = useTranslation(language)

  const setLanguage = useCallback((newLang) => {
    changeSiteLanguage(newLang)
  }, [])

  // On mount: ensure document lang is set and exact full matches are applied
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
