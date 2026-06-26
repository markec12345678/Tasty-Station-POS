import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import sl from './locales/sl.json';
import en from './locales/en.json';

/**
 * i18n konfiguracija za Tasty Station POS.
 *
 * Podprti jeziki:
 *   - sl (slovenščina) — privzeti
 *   - en (angleščina) — rezervna
 *
 * Jezik se lahko preklaplja z useThemeStore podobno kot tema, ali pa
 * preko localStorage 'i18n-lang'.
 */

const savedLang = typeof window !== 'undefined'
    ? localStorage.getItem('i18n-lang') || 'sl'
    : 'sl';

i18n.use(initReactI18next).init({
    resources: {
        sl: { translation: sl },
        en: { translation: en },
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
        escapeValue: false, // React že escape-a
    },
});

export const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') {
        localStorage.setItem('i18n-lang', lang);
    }
};

export const availableLanguages = [
    { code: 'sl', label: 'Slovenščina', flag: '🇸🇮' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default i18n;
