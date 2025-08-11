import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from './SettingsContext';

interface LanguageContextType {
  currentLanguage: string;
  changeLanguage: (language: string) => Promise<void>;
  t: (key: string, options?: any) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings } = useSettings();

  // Initialize language from settings or localStorage
  useEffect(() => {
    const initLanguage = async () => {
      let languageToUse = settings?.language || 'en-GB';
      
      // Check localStorage if settings not available
      if (!settings?.language) {
        const storedLanguage = localStorage.getItem('language');
        if (storedLanguage && ['en-GB', 'zh-HK'].includes(storedLanguage)) {
          languageToUse = storedLanguage;
        }
      }

      if (i18n.language !== languageToUse) {
        await i18n.changeLanguage(languageToUse);
      }
    };

    initLanguage();
  }, [settings?.language, i18n]);

  const changeLanguage = async (language: string) => {
    try {
      // Change i18n language
      await i18n.changeLanguage(language);
      
      // Store in localStorage
      localStorage.setItem('language', language);
      
      // Update settings if available
      if (settings) {
        await updateSettings({ language: language as 'en-GB' | 'zh-HK' });
      }

      // Update document language attribute
      document.documentElement.lang = language;
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  const value: LanguageContextType = {
    currentLanguage: i18n.language || 'en-GB',
    changeLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};