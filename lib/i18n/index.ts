import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import en from './en';
import es from './es';

const LANG_KEY = 'user_language';

const deviceLang = getLocales()[0]?.languageCode ?? 'en';
const defaultLang = deviceLang.startsWith('es') ? 'es' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: defaultLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Load saved language preference (async, will update after init)
if (Platform.OS !== 'web') {
  SecureStore.getItemAsync(LANG_KEY).then((saved) => {
    if (saved && (saved === 'en' || saved === 'es') && saved !== i18n.language) {
      i18n.changeLanguage(saved);
    }
  });
}

// Persist language changes
i18n.on('languageChanged', (lng) => {
  if (Platform.OS !== 'web') {
    SecureStore.setItemAsync(LANG_KEY, lng);
  }
});

export default i18n;
