import type { IntlConfig } from "react-intl";

export type Messages = NonNullable<IntlConfig["messages"]>;

type LocaleDefinition = {
  name: string;
  code: string;
  load: () => Promise<Messages>;
};

const locale = (
  name: string,
  code: string,
  load: () => Promise<{ default: Messages }>,
): LocaleDefinition => ({
  name,
  code,
  load: async () => ({
    ...(await import("./translations/en-US")).default,
    ...(await load()).default,
  }),
});

// Keep locale metadata in the main bundle, but split each message catalog into
// its own chunk. The old eager imports retained every translation in both the
// browser and the Next.js server process.
export const LOCALES = {
  ENGLISH: locale("English", "en-US", () => import("./translations/en-US")),
  GERMAN: locale("Deutsch", "de-DE", () => import("./translations/de-DE")),
  FRENCH: locale("Français", "fr-FR", () => import("./translations/fr-FR")),
  PORTUGUESE_BRAZIL: locale(
    "Português (Brasil)",
    "pt-BR",
    () => import("./translations/pt-BR"),
  ),
  DANISH: locale("Dansk", "da-DK", () => import("./translations/da-DK")),
  SPANISH: locale("Español", "es-ES", () => import("./translations/es-ES")),
  CHINESE_SIMPLIFIED: locale(
    "简体中文",
    "zh-CN",
    () => import("./translations/zh-CN"),
  ),
  CHINESE_TRADITIONAL: locale(
    "正體中文",
    "zh-TW",
    () => import("./translations/zh-TW"),
  ),
  FINNISH: locale("Suomi", "fi-FI", () => import("./translations/fi-FI")),
  RUSSIAN: locale("Русский", "ru-RU", () => import("./translations/ru-RU")),
  UKRAINIAN: locale(
    "Українська",
    "uk-UA",
    () => import("./translations/uk-UA"),
  ),
  THAI: locale("ไทย", "th-TH", () => import("./translations/th-TH")),
  SERBIAN: locale("Српски", "sr-SP", () => import("./translations/sr-SP")),
  SERBIAN_LATIN: locale(
    "Srpski",
    "sr-CS",
    () => import("./translations/sr-CS"),
  ),
  DUTCH: locale("Nederlands", "nl-BE", () => import("./translations/nl-BE")),
  JAPANESE: locale("日本語", "ja-JP", () => import("./translations/ja-JP")),
  POLISH: locale("Polski", "pl-PL", () => import("./translations/pl-PL")),
  SWEDISH: locale("Svenska", "sv-SE", () => import("./translations/sv-SE")),
  ITALIAN: locale("Italiano", "it-IT", () => import("./translations/it-IT")),
  GREEK: locale("Ελληνικά", "el-GR", () => import("./translations/el-GR")),
  SLOVENIAN: locale(
    "Slovenščina",
    "sl-SI",
    () => import("./translations/sl-SI"),
  ),
  ARABIC: locale("العربية", "ar-EG", () => import("./translations/ar-EG")),
  BULGARIAN: locale("Български", "bg-BG", () => import("./translations/bg-BG")),
  HUNGARIAN: locale("Hungarian", "hu-HU", () => import("./translations/hu-HU")),
  KOREAN: locale("한국어", "ko-KR", () => import("./translations/ko-KR")),
  TURKISH: locale("Türkçe", "tr-TR", () => import("./translations/tr-TR")),
  CZECH: locale("Čeština", "cs-CZ", () => import("./translations/cs-CZ")),
  VIATNAMESE: locale(
    "Tiếng Việt",
    "vi-VN",
    () => import("./translations/vi-VN"),
  ),
  CROATIAN: locale("Hrvatski", "hr-HR", () => import("./translations/hr-HR")),
  ESTONIAN: locale("Eesti", "et-EE", () => import("./translations/et-EE")),
  CATALAN: locale("Català", "ca-ES", () => import("./translations/ca-ES")),
} as const;

export const DEFAULT_LOCALE = LOCALES.ENGLISH.code;
