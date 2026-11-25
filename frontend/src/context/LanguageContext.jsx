import { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../config/brand';
import { useAuth } from './AuthContext';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem('janvani_language');
    return SUPPORTED_LANGUAGES.some((item) => item.code === saved) ? saved : 'en';
  });
  const { i18n } = useTranslation();
  const { user } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('janvani_language');
    if (!saved && SUPPORTED_LANGUAGES.some((item) => item.code === user?.language)) {
      setLanguageState(user.language);
    }
  }, [user?.language]);

  useEffect(() => {
    i18n.changeLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr';
  }, [i18n, language]);

  const setLanguage = (code) => {
    if (!SUPPORTED_LANGUAGES.some((item) => item.code === code)) {
      throw new Error(`Unsupported language: ${code}`);
    }
    setLanguageState(code);
    localStorage.setItem('janvani_language', code);
    i18n.changeLanguage(code);
    document.documentElement.lang = code;
    document.documentElement.dir = code === 'ur' ? 'rtl' : 'ltr';
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
