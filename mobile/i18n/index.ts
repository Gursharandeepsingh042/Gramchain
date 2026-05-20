import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import hi from './hi'
import en from './en'
import pa from './pa'
import ta from './ta'
import bn from './bn'
import te from './te'
import kn from './kn'

// Initialize i18next configuration
i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      pa: { translation: pa },
      ta: { translation: ta },
      bn: { translation: bn },
      te: { translation: te },
      kn: { translation: kn },
    },
    lng: 'en', // Default to English
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  })

export default i18n
