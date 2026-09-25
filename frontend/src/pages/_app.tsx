import {
  Container,
  MantineColorScheme,
  MantineProvider,
  MantineThemeOverride,
  Stack,
  mergeThemeOverrides,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import "../styles/global.css";
import { getCookie, setCookie } from "cookies-next";
import moment from "moment";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { IntlProvider } from "react-intl";
import Header from "../components/header/Header";
import { ConfigContext } from "../hooks/config.hook";
import { UserContext } from "../hooks/user.hook";
import { LocaleContext } from "../hooks/locale.hook";
import { DEFAULT_LOCALE } from "../i18n/locales";
import type { Messages } from "../i18n/locales";
import authService from "../services/auth.service";
import configService from "../services/config.service";
import userService from "../services/user.service";
import theme from "../styles/theme";
import Config from "../types/config.type";
import { CurrentUser } from "../types/user.type";
import i18nUtil from "../utils/i18n.util";
import userPreferences from "../utils/userPreferences.util";
import { cookieColorSchemeManager } from "../utils/colorSchemeManager.util";
import Footer from "../components/footer/Footer";
import { getDefaultConfig } from "../utils/defaultConfig.util";
import CenterLoader from "../components/core/CenterLoader";
import englishMessages from "../i18n/translations/en-US";

const excludeDefaultLayoutRoutes = ["/admin/config/[category]"];
const availableMantineColors = [
  "dark",
  "gray",
  "red",
  "pink",
  "grape",
  "violet",
  "indigo",
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "yellow",
  "orange",
  "victoria",
] as const;
const availableMantineRadii = ["xs", "sm", "md", "lg", "xl"] as const;
const hexColorPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const normalizeHexColor = (value: string): string | null => {
  if (!hexColorPattern.test(value)) return null;
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return value.toLowerCase();
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((channel) =>
      Math.min(255, Math.max(0, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

const mixHexColors = (
  baseHex: string,
  mixHex: string,
  weight: number,
): string => {
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHex);
  const inverseWeight = 1 - weight;

  return rgbToHex(
    base.r * inverseWeight + mix.r * weight,
    base.g * inverseWeight + mix.g * weight,
    base.b * inverseWeight + mix.b * weight,
  );
};

const createMantineScaleFromHex = (hex: string) =>
  [
    mixHexColors(hex, "#ffffff", 0.92),
    mixHexColors(hex, "#ffffff", 0.82),
    mixHexColors(hex, "#ffffff", 0.68),
    mixHexColors(hex, "#ffffff", 0.54),
    mixHexColors(hex, "#ffffff", 0.36),
    hex,
    mixHexColors(hex, "#000000", 0.1),
    mixHexColors(hex, "#000000", 0.22),
    mixHexColors(hex, "#000000", 0.34),
    mixHexColors(hex, "#000000", 0.46),
  ] as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [route, setRoute] = useState<string>(router.pathname);

  const [configVariables, setConfigVariables] =
    useState<Config[]>(getDefaultConfig());
  const [localeState, setLocaleState] = useState<{
    language: string;
    messages: Messages;
    ready: boolean;
  }>({ language: DEFAULT_LOCALE, messages: englishMessages, ready: false });
  const changeLanguage = useCallback(
    async (language: string): Promise<boolean> => {
      if (!i18nUtil.isLanguageSupported(language)) return false;
      try {
        const loaded = await i18nUtil.loadMessages(language);
        i18nUtil.setLanguageCookie(language);
        moment.locale(language.toLowerCase());
        setLocaleState({ language, messages: loaded, ready: true });
        return true;
      } catch (error) {
        console.error(`Failed to load translations for ${language}:`, error);
        return false;
      }
    },
    [],
  );
  const getStringConfigValue = (key: string, fallback = ""): string => {
    const config = configVariables?.find((item) => item.key === key);
    return (config?.value ?? config?.defaultValue ?? fallback).trim();
  };

  const customCss = getStringConfigValue("appearance.customCss");
  const themePrimaryColorRaw = getStringConfigValue(
    "appearance.themePrimaryColor",
    "victoria",
  );
  const themePrimaryColorOverrideRaw = getStringConfigValue(
    "appearance.themePrimaryColorOverride",
  );
  const themeRadiusRaw = getStringConfigValue("appearance.themeRadius", "sm");
  const themeColorSchemeRaw = getStringConfigValue(
    "appearance.themeColorScheme",
    "system",
  );

  const normalizedPrimaryColorOverrideHex = normalizeHexColor(
    themePrimaryColorOverrideRaw,
  );
  const useCustomPrimaryColor = themePrimaryColorRaw === "custom";

  const effectivePrimaryHex = useCustomPrimaryColor
    ? normalizedPrimaryColorOverrideHex
    : null;

  const themePrimaryColor = effectivePrimaryHex
    ? "adminPrimary"
    : (availableMantineColors as readonly string[]).includes(
          themePrimaryColorRaw,
        )
      ? themePrimaryColorRaw
      : "victoria";

  const themeRadius = (availableMantineRadii as readonly string[]).includes(
    themeRadiusRaw,
  )
    ? themeRadiusRaw
    : "sm";

  const adminDefaultColorScheme =
    themeColorSchemeRaw === "light" || themeColorSchemeRaw === "dark"
      ? themeColorSchemeRaw
      : "system";

  const adminTheme: MantineThemeOverride = {
    ...(effectivePrimaryHex
      ? {
          colors: {
            adminPrimary: createMantineScaleFromHex(effectivePrimaryHex),
          },
        }
      : {}),
    primaryColor: themePrimaryColor,
    defaultRadius: themeRadius,
  };

  const mergedTheme: MantineThemeOverride = mergeThemeOverrides(
    theme,
    adminTheme,
  );

  const userColorPreference = userPreferences.get("colorScheme");
  // Mantine v8 uses "auto" to follow the system color scheme; the app/admin
  // config still uses the legacy "system" value, so map it here.
  const toMantineColorScheme = (value?: string): MantineColorScheme =>
    value === "light" || value === "dark" ? value : "auto";

  const defaultColorScheme: MantineColorScheme = user
    ? toMantineColorScheme(userColorPreference)
    : toMantineColorScheme(adminDefaultColorScheme);

  useEffect(() => {
    setRoute(router.pathname);
  }, [router.pathname]);

  useEffect(() => {
    let active = true;

    Promise.all([configService.list(), userService.getCurrentUser()])
      .then(async ([configs, currentUser]) => {
        if (!active) return;
        setConfigVariables(configs);
        setUser(currentUser);

        const configuredLanguage = configs.find(
          (item) => item.key === "general.defaultLanguage",
        )?.value;
        const requestedLanguage = i18nUtil.getLanguageFromAcceptHeader(
          navigator.languages?.join(",") || navigator.language,
        );
        const selectedLanguage =
          getCookie("language")?.toString() ||
          configuredLanguage ||
          requestedLanguage ||
          DEFAULT_LOCALE;
        const supportedLanguage = i18nUtil.isLanguageSupported(selectedLanguage)
          ? selectedLanguage
          : DEFAULT_LOCALE;

        if (!getCookie("language")) {
          i18nUtil.setLanguageCookie(supportedLanguage);
        }
        const loaded = await i18nUtil.loadMessages(supportedLanguage);
        if (!active) return;
        moment.locale(supportedLanguage.toLowerCase());
        setLocaleState({
          language: supportedLanguage,
          messages: loaded,
          ready: true,
        });
      })
      .catch((error) => {
        if (active) {
          console.error("Failed to initialize app translations:", error);
          moment.locale(DEFAULT_LOCALE.toLowerCase());
          setLocaleState({
            language: DEFAULT_LOCALE,
            messages: englishMessages,
            ready: true,
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(
      async () => await authService.refreshAccessToken(),
      2 * 60 * 1000, // 2 minutes
    );

    return () => clearInterval(interval);
  }, []);

  // Self-heal the color-scheme cookie so SSR (ColorSchemeScript reads the cookie)
  // matches the client's resolved preference and there is no first-paint flash.
  useEffect(() => {
    const resolved = user
      ? toMantineColorScheme(userPreferences.get("colorScheme"))
      : toMantineColorScheme(adminDefaultColorScheme);
    const current = getCookie("mantine-color-scheme");
    if (current !== resolved) {
      setCookie("mantine-color-scheme", resolved, { sameSite: "lax" });
    }
  }, [user, adminDefaultColorScheme]);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </Head>
      <IntlProvider
        messages={localeState.messages}
        locale={localeState.language}
        defaultLocale={DEFAULT_LOCALE}
      >
        <LocaleContext.Provider
          value={{ language: localeState.language, changeLanguage }}
        >
          <MantineProvider
            theme={mergedTheme}
            defaultColorScheme={defaultColorScheme}
            colorSchemeManager={cookieColorSchemeManager()}
          >
            {customCss && (
              <style id="admin-custom-css">
                {customCss.replace(/<\/style/gi, "<\\/style")}
              </style>
            )}
            <Notifications />
            <ModalsProvider>
              <ConfigContext.Provider
                value={{
                  configVariables,
                  refresh: async () => {
                    setConfigVariables(await configService.list());
                  },
                }}
              >
                <UserContext.Provider
                  value={{
                    user,
                    refreshUser: async () => {
                      const user = await userService.getCurrentUser();
                      setUser(user);
                      return user;
                    },
                  }}
                >
                  {!localeState.ready ? (
                    <CenterLoader />
                  ) : excludeDefaultLayoutRoutes.includes(route) ? (
                    <Component {...pageProps} />
                  ) : (
                    <Stack className="appShell" justify="space-between" mih="100vh">
                      <div>
                        <Header />
                        <Container className="appContent" size={1200}>
                          <Component {...pageProps} />
                        </Container>
                      </div>
                      <Footer />
                    </Stack>
                  )}
                </UserContext.Provider>
              </ConfigContext.Provider>
            </ModalsProvider>
          </MantineProvider>
        </LocaleContext.Provider>
      </IntlProvider>
    </>
  );
}

export default App;
