import { getCookie } from "cookies-next";
import { createIntl, createIntlCache, useIntl } from "react-intl";
import { useCallback } from "react";
import i18nUtil from "../utils/i18n.util";
import { DEFAULT_LOCALE } from "../i18n/locales";

const useTranslate = () => {
  const intl = useIntl();
  return useCallback(
    (
      id: string,
      values?: Parameters<typeof intl.formatMessage>[1],
      opts?: Parameters<typeof intl.formatMessage>[2],
    ) => {
      if (!Object.prototype.hasOwnProperty.call(intl.messages, id)) {
        return i18nUtil.missingMessage(intl.locale, id);
      }
      const result = intl.formatMessage({ id }, values, opts);
      return typeof result === "string" ? result : String(result);
    },
    [intl],
  );
};

const cache = createIntlCache();

export const translateOutsideContext = () => {
  const locale =
    getCookie("language")?.toString() ??
    i18nUtil.getLanguageFromAcceptHeader(navigator.language);
  const supportedLocale = i18nUtil.isLanguageSupported(locale)
    ? locale
    : DEFAULT_LOCALE;
  const messages = i18nUtil.getLoadedMessages(supportedLocale);

  const intl = createIntl(
    {
      locale: supportedLocale,
      messages,
      defaultLocale: DEFAULT_LOCALE,
    },
    cache,
  );
  return (
    id: string,
    values?: Parameters<typeof intl.formatMessage>[1],
    opts?: Parameters<typeof intl.formatMessage>[2],
  ) => {
    if (!Object.prototype.hasOwnProperty.call(messages, id)) {
      return i18nUtil.missingMessage(supportedLocale, id);
    }
    const result = intl.formatMessage({ id }, values, opts);
    return typeof result === "string" ? result : String(result);
  };
};

export default useTranslate;
