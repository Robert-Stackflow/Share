import { setCookie } from "cookies-next";
import { DEFAULT_LOCALE, LOCALES } from "../i18n/locales";
import englishMessages from "../i18n/translations/en-US";

const reportedMissingMessages = new Set<string>();

const missingMessage = (code: string, id: string): string => {
  const reportId = `${code}:${id}`;
  if (!reportedMissingMessages.has(reportId)) {
    reportedMissingMessages.add(reportId);
    console.error(`Missing translation: ${reportId}`);
  }
  return code.startsWith("zh") ? "内容暂不可用" : "Text unavailable";
};

const loadedMessages = new Map<
  string,
  Awaited<ReturnType<(typeof LOCALES)[keyof typeof LOCALES]["load"]>>
>();

const getLocaleByCode = (code: string) => {
  return Object.values(LOCALES).find((l) => l.code === code) ?? LOCALES.ENGLISH;
};

const loadMessages = async (code: string) => {
  const locale = getLocaleByCode(code);
  const cached = loadedMessages.get(locale.code);
  if (cached) return cached;
  const messages = await locale.load();
  loadedMessages.set(locale.code, messages);
  return messages;
};

const getLoadedMessages = (code: string) =>
  loadedMessages.get(getLocaleByCode(code).code) ?? englishMessages;

// Parse the Accept-Language header and return the first supported language
const getLanguageFromAcceptHeader = (acceptLanguage?: string) => {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const languages = acceptLanguage.split(",").map((l) => l.split(";")[0]);
  const supportedLanguages = Object.values(LOCALES).map((l) => l.code);
  const supportedLanguagesWithoutRegion = supportedLanguages.map(
    (l) => l.split("-")[0],
  );

  for (const language of languages) {
    // Try to match the full language code first, then the language code without the region
    if (supportedLanguages.includes(language)) {
      return language;
    } else if (
      supportedLanguagesWithoutRegion.includes(language.split("-")[0])
    ) {
      const similarLanguage = supportedLanguages.find((l) =>
        l.startsWith(language.split("-")[0]),
      );
      return similarLanguage ?? DEFAULT_LOCALE;
    }
  }
  return DEFAULT_LOCALE;
};

const isLanguageSupported = (code: string) => {
  return Object.values(LOCALES).some((l) => l.code === code);
};

const setLanguageCookie = (code: string) => {
  setCookie("language", code, {
    sameSite: "lax",
    expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
  });
};

export default {
  getLocaleByCode,
  loadMessages,
  getLoadedMessages,
  missingMessage,
  getLanguageFromAcceptHeader,
  isLanguageSupported,
  setLanguageCookie,
};
