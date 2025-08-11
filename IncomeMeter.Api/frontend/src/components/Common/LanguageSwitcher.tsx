import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface LanguageSwitcherProps {
  className?: string;
  showText?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  className = '',
  showText = true 
}) => {
  const { currentLanguage, changeLanguage, t } = useLanguage();

  const languages = [
    { code: 'en-GB', name: t('settings.languages.en-GB'), flag: '🇬🇧' },
    { code: 'zh-HK', name: t('settings.languages.zh-HK'), flag: '🇭🇰' }
  ];

  const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <div>
        <button
          onClick={() => {
            const nextLang = currentLanguage === 'en-GB' ? 'zh-HK' : 'en-GB';
            changeLanguage(nextLang);
          }}
          className="inline-flex items-center justify-center w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        >
          <span className="mr-2">{currentLang.flag}</span>
          {showText && (
            <span className="truncate">{currentLang.name}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default LanguageSwitcher;