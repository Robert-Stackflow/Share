import { Info } from "lucide-react";
import {
  Alert,
  AppShell,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { GetStaticPaths, GetStaticProps } from "next";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import FormattedMessage from "../../../components/core/FormattedMessage";
import Meta from "../../../components/Meta";
import AdminConfigInput from "../../../components/admin/configuration/AdminConfigInput";
import ConfigurationHeader from "../../../components/admin/configuration/ConfigurationHeader";
import ConfigurationNavBar from "../../../components/admin/configuration/ConfigurationNavBar";
import LogoConfigInput from "../../../components/admin/configuration/LogoConfigInput";
import TestEmailButton from "../../../components/admin/configuration/TestEmailButton";
import TestRedisButton from "../../../components/admin/configuration/TestRedisButton";
import CenterLoader from "../../../components/core/CenterLoader";
import useConfig from "../../../hooks/config.hook";
import useTranslate from "../../../hooks/useTranslate.hook";
import useStaticRouteParam from "../../../hooks/staticRouteParam.hook";
import configService from "../../../services/config.service";
import { AdminConfig, UpdateConfig } from "../../../types/config.type";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { category: "_" } }],
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({ props: {} });
import { camelToKebab } from "../../../utils/string.util";
import toast from "../../../utils/toast.util";

const categories = [
  "general",
  "appearance",
  "email",
  "share",
  "smtp",
  "oauth",
  "ldap",
  "s3",
  "legal",
  "cache",
];

const OAUTH_PROVIDERS = ["github", "google", "microsoft", "discord", "oidc"];

// Returns the OAuth provider a config key belongs to (e.g. "oauth.github-clientId" -> "github"),
// or null for non-provider keys. Used to draw a divider between provider groups.
const getOAuthProvider = (key: string): string | null => {
  if (!key.startsWith("oauth.")) return null;
  const provider = key.slice("oauth.".length).split("-")[0];
  return OAUTH_PROVIDERS.includes(provider) ? provider : null;
};

export default function AppShellDemo() {
  const router = useRouter();
  const t = useTranslate();

  const [isMobileNavBarOpened, setIsMobileNavBarOpened] = useState(false);
  const isMobile = useMediaQuery("(max-width: 560px)");
  const config = useConfig();

  const routeCategory = useStaticRouteParam("category", 2);
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const activeCategory = selectedCategory ?? routeCategory;
  const categoryId = categories.includes(activeCategory)
    ? activeCategory
    : "general";

  const navigateCategory = (category: string) => {
    if (category === categoryId) return;
    window.history.pushState(null, "", `/admin/config/${category}/`);
    setSelectedCategory(category);
  };

  useEffect(() => {
    const onPopState = () => {
      const category = window.location.pathname.split("/").filter(Boolean)[2];
      setSelectedCategory(categories.includes(category) ? category : "general");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [configVariables, setConfigVariables] = useState<AdminConfig[]>();
  const [loadedCategory, setLoadedCategory] = useState<string>();
  const [updatedConfigVariables, setUpdatedConfigVariables] = useState<
    UpdateConfig[]
  >([]);
  const [optionalConfigVariables, setOptionalConfigVariables] =
    useState<AdminConfig[]>();

  const [logo, setLogo] = useState<File | null>(null);
  const [darkLogo, setDarkLogo] = useState<File | null>(null);

  const isEditingAllowed = (): boolean => {
    return !configVariables || configVariables[0].allowEdit;
  };

  const saveConfigVariables = async () => {
    if (logo) {
      await configService
        .changeLogo(logo)
        .then(() => {
          setLogo(null);
          toast.success(t("admin.config.notify.logo-success"));
        })
        .catch(toast.axiosError);
    }

    if (darkLogo) {
      await configService
        .changeDarkLogo(darkLogo)
        .then(() => {
          setDarkLogo(null);
          toast.success(t("admin.config.notify.logo-success"));
        })
        .catch(toast.axiosError);
    }

    if (updatedConfigVariables.length > 0) {
      await configService
        .updateMany(updatedConfigVariables)
        .then(() => {
          setConfigVariables((prev) =>
            prev?.map((cv) => {
              const updated = updatedConfigVariables.find(
                (u) => u.key === cv.key,
              );
              return updated ? { ...cv, value: String(updated.value) } : cv;
            }),
          );
          setUpdatedConfigVariables([]);
          toast.success(t("admin.config.notify.success"));
        })
        .catch(toast.axiosError);
      void config.refresh();
    } else {
      toast.success(t("admin.config.notify.no-changes"));
    }
  };

  const updateConfigVariable = (configVariable: UpdateConfig) => {
    if (configVariable.key === "general.appUrl") {
      configVariable.value = sanitizeUrl(configVariable.value);
    }

    const index = updatedConfigVariables.findIndex(
      (item) => item.key === configVariable.key,
    );

    if (index > -1) {
      updatedConfigVariables[index] = {
        ...updatedConfigVariables[index],
        ...configVariable,
      };
    } else {
      setUpdatedConfigVariables([...updatedConfigVariables, configVariable]);
    }
  };

  const sanitizeUrl = (url: string): string => {
    return url.endsWith("/") ? url.slice(0, -1) : url;
  };

  useEffect(() => {
    let active = true;
    setConfigVariables(undefined);
    setLoadedCategory(undefined);
    setUpdatedConfigVariables([]);
    setOptionalConfigVariables(undefined);
    setLogo(null);
    setDarkLogo(null);

    configService.getByCategory(categoryId).then((configVariables) => {
      if (!active) return;
      setConfigVariables(configVariables);
      setLoadedCategory(categoryId);
    });

    if (categoryId === "email") {
      configService.getByCategory("smtp").then((smtpConfigVariables) => {
        const optionalConfigVariables = smtpConfigVariables.filter(
          (configVariable) => {
            if (configVariable.key === "smtp.enabled") {
              return configVariable;
            }
          },
        );
        if (active) setOptionalConfigVariables(optionalConfigVariables);
      });
    }

    return () => {
      active = false;
    };
  }, [categoryId]);

  return (
    <>
      <Meta title={t("admin.config.title")} />
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: { sm: 200, lg: 300 },
          breakpoint: "sm",
          collapsed: { mobile: !isMobileNavBarOpened },
        }}
        padding="md"
        styles={{
          main: {
            background:
              "light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))",
          },
        }}
      >
        <AppShell.Header>
          <ConfigurationHeader
            isMobileNavBarOpened={isMobileNavBarOpened}
            setIsMobileNavBarOpened={setIsMobileNavBarOpened}
          />
        </AppShell.Header>
        <AppShell.Navbar>
          <ConfigurationNavBar
            categoryId={categoryId}
            onCategoryChange={navigateCategory}
            isMobileNavBarOpened={isMobileNavBarOpened}
            setIsMobileNavBarOpened={setIsMobileNavBarOpened}
          />
        </AppShell.Navbar>
        <AppShell.Main>
          <Container size="lg">
            {!configVariables || loadedCategory !== categoryId ? (
              <CenterLoader />
            ) : (
              <>
                {/*
                 * Keep custom CSS at the bottom in Appearance settings for better UX.
                 */}
                {(() => {
                  const customCssConfigVariable = configVariables.find(
                    (configVariable) =>
                      configVariable.key === "appearance.customCss",
                  );
                  const getEffectiveConfigValue = (key: string): string => {
                    const updatedValue = updatedConfigVariables.find(
                      (item) => item.key === key,
                    );
                    if (updatedValue) return updatedValue.value;

                    const configVariable = configVariables.find(
                      (item) => item.key === key,
                    );
                    return (
                      configVariable?.value ??
                      configVariable?.defaultValue ??
                      ""
                    );
                  };

                  const shouldShowPrimaryColorOverride =
                    getEffectiveConfigValue("appearance.themePrimaryColor") ===
                    "custom";
                  const visibleConfigVariables = configVariables.filter(
                    (configVariable) =>
                      configVariable.key !== "appearance.customCss",
                  );

                  return (
                    <>
                      <Stack>
                        {!isEditingAllowed() && (
                          <Alert
                            mb={"lg"}
                            variant="light"
                            color="primary"
                            title={t("admin.config.config-file-warning.title")}
                            icon={<Info />}
                          >
                            <FormattedMessage id="admin.config.config-file-warning.description" />
                          </Alert>
                        )}
                        <Title mb="md" order={3}>
                          {t("admin.config.category." + categoryId)}
                        </Title>
                        {visibleConfigVariables.map((configVariable, index) => {
                          if (
                            configVariable.key ===
                              "appearance.themePrimaryColorOverride" &&
                            !shouldShowPrimaryColorOverride
                          ) {
                            return null;
                          }

                          const provider = getOAuthProvider(configVariable.key);
                          const previousProvider =
                            index > 0
                              ? getOAuthProvider(
                                  visibleConfigVariables[index - 1].key,
                                )
                              : null;
                          const showProviderDivider =
                            provider !== null && provider !== previousProvider;

                          return (
                            <Box key={configVariable.key}>
                              {showProviderDivider && <Divider mb="lg" />}
                              <Group justify="space-between" align="flex-start">
                                <Stack
                                  style={{
                                    maxWidth: isMobile ? "100%" : "40%",
                                  }}
                                  gap={0}
                                >
                                  <Title order={6}>
                                    <FormattedMessage
                                      id={`admin.config.${camelToKebab(
                                        configVariable.key,
                                      )}`}
                                    />
                                  </Title>

                                  <Text
                                    style={{
                                      whiteSpace: "pre-line",
                                    }}
                                    c="dimmed"
                                    size="sm"
                                    mb="xs"
                                  >
                                    <FormattedMessage
                                      id={`admin.config.${camelToKebab(
                                        configVariable.key,
                                      )}.description`}
                                      values={{ br: <br /> }}
                                    />
                                  </Text>
                                </Stack>
                                <Stack></Stack>
                                <Box
                                  style={{
                                    width: isMobile ? "100%" : "50%",
                                    alignSelf: "center",
                                  }}
                                >
                                  <AdminConfigInput
                                    key={configVariable.key}
                                    configVariable={configVariable}
                                    updateConfigVariable={updateConfigVariable}
                                    allConfigVariables={configVariables}
                                    updatedConfigVariables={
                                      updatedConfigVariables
                                    }
                                    optionalConfigVariables={
                                      optionalConfigVariables
                                    }
                                  />
                                </Box>
                              </Group>
                            </Box>
                          );
                        })}
                        {categoryId == "general" && (
                          <LogoConfigInput
                            logo={logo}
                            setLogo={setLogo}
                            darkLogo={darkLogo}
                            setDarkLogo={setDarkLogo}
                          />
                        )}
                        {categoryId == "appearance" &&
                          customCssConfigVariable && (
                            <Group
                              key={customCssConfigVariable.key}
                              justify="space-between"
                              align="flex-start"
                            >
                              <Stack
                                style={{ maxWidth: isMobile ? "100%" : "40%" }}
                                gap={0}
                              >
                                <Title order={6}>
                                  <FormattedMessage
                                    id={`admin.config.${camelToKebab(
                                      customCssConfigVariable.key,
                                    )}`}
                                  />
                                </Title>

                                <Text
                                  style={{
                                    whiteSpace: "pre-line",
                                  }}
                                  c="dimmed"
                                  size="sm"
                                  mb="xs"
                                >
                                  <FormattedMessage
                                    id={`admin.config.${camelToKebab(
                                      customCssConfigVariable.key,
                                    )}.description`}
                                    values={{ br: <br /> }}
                                  />
                                </Text>
                              </Stack>
                              <Stack></Stack>
                              <Box style={{ width: isMobile ? "100%" : "50%" }}>
                                <AdminConfigInput
                                  key={customCssConfigVariable.key}
                                  configVariable={customCssConfigVariable}
                                  updateConfigVariable={updateConfigVariable}
                                  allConfigVariables={configVariables}
                                  updatedConfigVariables={
                                    updatedConfigVariables
                                  }
                                  optionalConfigVariables={
                                    optionalConfigVariables
                                  }
                                />
                              </Box>
                            </Group>
                          )}
                      </Stack>
                    </>
                  );
                })()}
                <Group mt="lg" justify="flex-end">
                  {categoryId == "smtp" && (
                    <TestEmailButton
                      configVariablesChanged={
                        updatedConfigVariables.length != 0
                      }
                      saveConfigVariables={saveConfigVariables}
                    />
                  )}
                  {categoryId == "cache" && (
                    <TestRedisButton
                      configVariablesChanged={
                        updatedConfigVariables.length != 0
                      }
                      saveConfigVariables={saveConfigVariables}
                    />
                  )}
                  <Button onClick={saveConfigVariables}>
                    <FormattedMessage id="common.button.save" />
                  </Button>
                </Group>
              </>
            )}
          </Container>
        </AppShell.Main>
      </AppShell>
    </>
  );
}
