'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage, TranslationDictionary, translations, isRTL } from './i18n';

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationDictionary;
  rtl: boolean;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en,
  rtl: false,
});

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashshafi_lang', lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ashshafi_lang') as SupportedLanguage;
      if (saved && translations[saved]) {
        setLanguageState(saved);
        document.documentElement.lang = saved;
        document.documentElement.dir = isRTL(saved) ? 'rtl' : 'ltr';
      }
    }
  }, []);

  const value = {
    language,
    setLanguage,
    t: translations[language] || translations.en,
    rtl: isRTL(language),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
