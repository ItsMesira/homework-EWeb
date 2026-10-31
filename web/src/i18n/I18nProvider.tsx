// i18n/I18nProvider.tsx — Language context provider

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { th, TranslationKey } from './th';
import { en } from './en';

type Lang = 'th' | 'en';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'th',
  setLang: () => {},
  t: (key) => th[key],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('emble-lang');
    return (saved === 'en' || saved === 'th') ? saved : 'th';
  });

  useEffect(() => {
    localStorage.setItem('emble-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (newLang: Lang) => setLangState(newLang);
  const t = (key: TranslationKey) => (lang === 'th' ? th : en)[key];

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
