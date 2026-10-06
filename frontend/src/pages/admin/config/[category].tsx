import { Info } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { GetStaticPaths, GetStaticProps } from "next";

import { useEffect, useState } from "react";
import FormattedMessage from "../../../components/core/FormattedMessage";
import Meta from "../../../components/Meta";
import AdminConfigInput from "../../../components/admin/configuration/AdminConfigInput";
import ConfigurationNavBar, {
  categories,
} from "../../../components/admin/configuration/ConfigurationNavBar";
import LogoConfigInput from "../../../components/admin/configuration/LogoConfigInput";
import TestEmailButton from "../../../components/admin/configuration/TestEmailButton";
import TestRedisButton from "../../../components/admin/configuration/TestRedisButton";
import StorageStatusPanel from "../../../components/admin/configuration/StorageStatusPanel";
import StorageAuditPanel from "../../../components/admin/configuration/StorageAuditPanel";
import CenterLoader from "../../../components/core/CenterLoader";
import useConfig from "../../../hooks/config.hook";
import useTranslate from "../../../hooks/useTranslate.hook";
import useStaticRouteParam from "../../../hooks/staticRouteParam.hook";
import configService from "../../../services/config.service";
import { AdminConfig, UpdateConfig } from "../../../types/config.type";
import classes from "./ConfigPage.module.css";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [...categories, "_"].map((category) => ({ params: { category } })),
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({ props: {} });
import { camelToKebab } from "../../../utils/string.util";
import toast from "../../../utils/toast.util";

const OAUTH_PROVIDERS = ["github", "google", "microsoft", "discord", "oidc"];

// Returns the OAuth provider a config key belongs to (e.g. "oauth.github-clientId" -> "github"),
// or null for non-provider keys. Used to draw a divider between provider groups.
const getOAuthProvider = (key: string): string | null => {
  if (!key.startsWith("oauth.")) return null;
  const provider = key.slice("oauth.".length).split("-")[0];
  return OAUTH_PROVIDERS.includes(provider) ? provider : null;
};

export default function ConfigurationPage() {
  const t = useTranslate();

  const config = useConfig();

  const routeCategory = useStaticRouteParam("category", 2);
  const categoryId = categories.includes(routeCategory)
    ? routeCategory
    : "general";

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
    if (
      configVariable.key === "general.appUrl" ||
      configVariable.key === "images.publicBaseUrl"
    ) {
      configVariable.value = sanitizeUrl(configVariable.value);
    }

    setUpdatedConfigVariables((current) => {
      const index = current.findIndex(
        (item) => item.key === configVariable.key,
      );
      if (index < 0) return [...current, configVariable];
      return current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...configVariable } : item,
      );
    });
  };

  const sanitizeUrl = (url: string): string => {
    return url.trim().replace(/\/+$/, "");
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
      <div className={classes.layout}>
        <aside className={classes.sidebar}>
          <ConfigurationNavBar categoryId={categoryId} />
        </aside>
        <main className={classes.content}>
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
                    configVariable?.value ?? configVariable?.defaultValue ?? ""
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
                    <Stack gap="lg">
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
                      {(categoryId === "s3" || categoryId === "webdav") && (
                        <StorageStatusPanel
                          category={categoryId}
                          hasUnsavedChanges={updatedConfigVariables.length > 0}
                        />
                      )}
                      {categoryId === "s3" && (
                        <StorageAuditPanel
                          hasUnsavedChanges={updatedConfigVariables.length > 0}
                        />
                      )}
                      <div className={classes.settingsPanel}>
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
                            <Box
                              key={configVariable.key}
                              className={`${classes.configRow} ${configVariable.key === "s3.fileRenameRules" ? classes.wideConfigRow : ""} ${configVariable.type === "boolean" ? classes.booleanRow : ""}`}
                            >
                              {showProviderDivider && (
                                <Divider
                                  className={classes.providerDivider}
                                  label={provider?.toUpperCase()}
                                  labelPosition="left"
                                />
                              )}
                              <div className={classes.configGrid}>
                                <Stack gap={4}>
                                  <Title order={6}>
                                    <FormattedMessage
                                      id={`admin.config.${camelToKebab(
                                        configVariable.key,
                                      )}`}
                                    />
                                  </Title>

                                  <Text
                                    className={classes.description}
                                    c="dimmed"
                                    size="sm"
                                  >
                                    <FormattedMessage
                                      id={`admin.config.${camelToKebab(
                                        configVariable.key,
                                      )}.description`}
                                      values={{ br: <br /> }}
                                    />
                                  </Text>
                                </Stack>
                                <Box className={classes.configControl}>
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
                              </div>
                            </Box>
                          );
                        })}
                        {categoryId == "general" && (
                          <LogoConfigInput
                            logo={logo}
                            setLogo={setLogo}
                            darkLogo={darkLogo}
                            setDarkLogo={setDarkLogo}
                            rowClassName={classes.configRow}
                            gridClassName={classes.configGrid}
                            controlClassName={classes.configControl}
                            descriptionClassName={classes.description}
                          />
                        )}
                      </div>
                      {categoryId == "appearance" &&
                        customCssConfigVariable && (
                          <div
                            key={customCssConfigVariable.key}
                            className={classes.settingsPanel}
                          >
                            <div
                              className={`${classes.configRow} ${classes.configGrid}`}
                            >
                              <Stack gap={4}>
                                <Title order={6}>
                                  <FormattedMessage
                                    id={`admin.config.${camelToKebab(
                                      customCssConfigVariable.key,
                                    )}`}
                                  />
                                </Title>

                                <Text
                                  className={classes.description}
                                  c="dimmed"
                                  size="sm"
                                >
                                  <FormattedMessage
                                    id={`admin.config.${camelToKebab(
                                      customCssConfigVariable.key,
                                    )}.description`}
                                    values={{ br: <br /> }}
                                  />
                                </Text>
                              </Stack>
                              <Box className={classes.configControl}>
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
                            </div>
                          </div>
                        )}
                    </Stack>
                  </>
                );
              })()}
              <Group className={classes.saveBar} justify="flex-end">
                {categoryId == "smtp" && (
                  <TestEmailButton
                    configVariablesChanged={updatedConfigVariables.length != 0}
                    saveConfigVariables={saveConfigVariables}
                  />
                )}
                {categoryId == "cache" && (
                  <TestRedisButton
                    configVariablesChanged={updatedConfigVariables.length != 0}
                    saveConfigVariables={saveConfigVariables}
                  />
                )}
                <Button onClick={saveConfigVariables}>
                  <FormattedMessage id="common.button.save" />
                </Button>
              </Group>
            </>
          )}
        </main>
      </div>
    </>
  );
}
