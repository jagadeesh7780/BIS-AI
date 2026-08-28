import { createContext, useContext, useState } from 'react'
import { useTranslation } from '../utils/translations'

const LanguageContext = createContext(null)

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en')
  const { t } = useTranslation(language)

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
