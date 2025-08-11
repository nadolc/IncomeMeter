import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enGB from './locales/en-GB.json';
import zhHK from './locales/zh-HK.json';

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-GB': {
        translation: enGB
      },
      'zh-HK': {
        translation: zhHK
      }
    },
    lng: 'en-GB', // default language
    fallbackLng: 'en-GB',
    interpolation: {
      escapeValue: false // React already escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    },
    debug: import.meta.env.DEV // Enable debug in development
  });

export default i18n;