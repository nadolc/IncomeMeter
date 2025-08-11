import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enGB from './locales/en-GB.json';
import zhHK from './locales/zh-HK.json';

// Initialize i18next
i18n
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
    }
  });

export default i18n;