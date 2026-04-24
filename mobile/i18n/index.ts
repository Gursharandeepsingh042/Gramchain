import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import hi from './hi'
import en from './en'

// Initialize i18next configuration
i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    lng: 'hi', // Default to Hindi
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  })

export default i18n
