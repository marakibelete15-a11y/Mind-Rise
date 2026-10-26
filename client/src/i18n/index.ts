import en from './en/translation.json';
import am from './am/translation.json';

export type Language = 'en' | 'am';

export const translations = {
  en,
  am,
} as const;

export type TranslationKeys = typeof en;

export const getTranslation = (lang: Language) => {
  return translations[lang] || translations.en;
};
