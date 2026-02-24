import i18n from "i18next";
import { initReactI18next } from "react-i18next";
// import { getLocales } from "react-native-localize";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import te from "./locales/te.json";

export const i18nConfig = {
  supportedLanguages: ['en', 'hi', 'te'],
  defaultLanguage: 'en',
};

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  te: { translation: te },
};

const defaultLanguage = 'en';//getLocales()[0].languageCode;

i18n
  .use(initReactI18next)
  // .use(languageDetectorPlugin)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;