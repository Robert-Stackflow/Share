import {
  Badge,
  Button,
  Group,
  PasswordInput,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { useModals } from "@mantine/modals";
import { useCallback, useEffect, useState } from "react";
import * as yup from "yup";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import authService from "../../services/auth.service";
import userService from "../../services/user.service";
import { getOAuthIcon, getOAuthUrl, unlinkOAuth } from "../../utils/oauth.util";
import toast from "../../utils/toast.util";
import FormattedMessage from "../core/FormattedMessage";
import { AccountPanel } from "./AccountSettingsLayout";
import classes from "./AccountSettings.module.css";

type OAuthStatus = Record<
  string,
  { provider: string; providerUsername: string }
>;

const ProfileSettings = () => {
  const [oauth, setOAuth] = useState<string[]>([]);
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null);
  const { user, refreshUser } = useUser();
  const modals = useModals();
  const t = useTranslate();
  const config = useConfig();

  const accountForm = useForm({
    initialValues: { username: user?.username, email: user?.email },
    validate: yupResolver(
      yup.object().shape({
        email: yup.string().email(t("common.error.invalid-email")),
        username: yup
          .string()
          .min(3, t("common.error.too-short", { length: 3 })),
      }),
    ),
  });

  const passwordForm = useForm({
    initialValues: { oldPassword: "", password: "" },
    validate: yupResolver(
      yup.object().shape({
        oldPassword: yup.string().when([], {
          is: () => !!user?.hasPassword,
          then: (schema) =>
            schema
              .min(8, t("common.error.too-short", { length: 8 }))
              .required(t("common.error.field-required")),
          otherwise: (schema) => schema.notRequired(),
        }),
        password: yup
          .string()
          .min(8, t("common.error.too-short", { length: 8 }))
          .required(t("common.error.field-required")),
      }),
    ),
  });

  const refreshOAuthStatus = useCallback(() => {
    return authService
      .getOAuthStatus()
      .then((data) => setOAuthStatus(data.data))
      .catch(toast.axiosError);
  }, []);

  useEffect(() => {
    void Promise.all([
      authService
        .getAvailableOAuth()
        .then((data) => setOAuth(data.data))
        .catch(toast.axiosError),
      refreshOAuthStatus(),
    ]);
  }, [refreshOAuthStatus]);

  return (
    <>
      <AccountPanel
        title="account.card.info.title"
        description="account.section.profile.infoDescription"
      >
        <form
          onSubmit={accountForm.onSubmit(async (values) => {
            try {
              await userService.updateCurrentUser({
                username: values.username,
                email: values.email,
              });
              await refreshUser();
              toast.success(t("account.notify.info.success"));
            } catch (error) {
              toast.axiosError(error);
            }
          })}
        >
          <div className={classes.formGrid}>
            <TextInput
              label={t("account.card.info.username")}
              disabled={user?.isLdap}
              {...accountForm.getInputProps("username")}
            />
            <TextInput
              label={t("account.card.info.email")}
              disabled={user?.isLdap}
              {...accountForm.getInputProps("email")}
            />
          </div>
          {user?.isLdap ? (
            <Badge mt="md">LDAP</Badge>
          ) : (
            <div className={classes.formActions}>
              <Button type="submit">
                <FormattedMessage id="common.button.save" />
              </Button>
            </div>
          )}
        </form>
      </AccountPanel>

      {user?.isLdap ? null : (
        <AccountPanel
          title="account.card.password.title"
          description="account.section.profile.passwordDescription"
        >
          <form
            onSubmit={passwordForm.onSubmit(async (values) => {
              try {
                await authService.updatePassword(
                  values.oldPassword,
                  values.password,
                );
                await refreshUser();
                passwordForm.reset();
                toast.success(t("account.notify.password.success"));
              } catch (error) {
                toast.axiosError(error);
              }
            })}
          >
            <Stack>
              {user?.hasPassword ? (
                <PasswordInput
                  label={t("account.card.password.old")}
                  {...passwordForm.getInputProps("oldPassword")}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  <FormattedMessage id="account.card.password.noPasswordSet" />
                </Text>
              )}
              <PasswordInput
                label={t("account.card.password.new")}
                {...passwordForm.getInputProps("password")}
              />
            </Stack>
            <div className={classes.formActions}>
              <Button type="submit">
                <FormattedMessage id="common.button.save" />
              </Button>
            </div>
          </form>
        </AccountPanel>
      )}

      {oauth.length > 0 ? (
        <AccountPanel
          title="account.card.oauth.title"
          description="account.section.profile.oauthDescription"
        >
          <Tabs defaultValue={oauth[0] || ""}>
            <Tabs.List>
              {oauth.map((provider) => (
                <Tabs.Tab
                  value={provider}
                  leftSection={getOAuthIcon(provider)}
                  key={provider}
                >
                  {t(`account.card.oauth.${provider}`)}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {oauth.map((provider) => (
              <Tabs.Panel value={provider} pt="lg" key={provider}>
                <Group
                  className={classes.connectedAccount}
                  justify="space-between"
                >
                  <Text>
                    {oauthStatus?.[provider]
                      ? oauthStatus[provider].providerUsername
                      : t("account.card.oauth.unlinked")}
                  </Text>
                  {oauthStatus?.[provider] ? (
                    <Button
                      variant="light"
                      color="red"
                      onClick={() => {
                        modals.openConfirmModal({
                          title: t("account.modal.unlink.title"),
                          children: (
                            <Text>{t("account.modal.unlink.description")}</Text>
                          ),
                          labels: {
                            confirm: t("account.card.oauth.unlink"),
                            cancel: t("common.button.cancel"),
                          },
                          confirmProps: { color: "red" },
                          onConfirm: () => {
                            unlinkOAuth(provider)
                              .then(() => {
                                toast.success(
                                  t("account.notify.oauth.unlinked.success"),
                                );
                                void refreshOAuthStatus();
                              })
                              .catch(toast.axiosError);
                          },
                        });
                      }}
                    >
                      {t("account.card.oauth.unlink")}
                    </Button>
                  ) : (
                    <Button
                      component="a"
                      href={getOAuthUrl(
                        config.get("general.appUrl") !==
                          config.get("general.appUrl", true)
                          ? config.get("general.appUrl")
                          : window.location.origin,
                        provider,
                      )}
                    >
                      {t("account.card.oauth.link")}
                    </Button>
                  )}
                </Group>
              </Tabs.Panel>
            ))}
          </Tabs>
        </AccountPanel>
      ) : null}

      <AccountPanel
        title="account.danger.title"
        description="account.danger.description"
        danger
      >
        <div className={classes.dangerRow}>
          <Text size="sm" c="dimmed">
            {t("account.modal.delete.description")}
          </Text>
          <Button
            variant="light"
            color="red"
            onClick={() =>
              modals.openConfirmModal({
                title: t("account.modal.delete.title"),
                children: (
                  <Text size="sm">
                    <FormattedMessage id="account.modal.delete.description" />
                  </Text>
                ),
                labels: {
                  confirm: t("common.button.delete"),
                  cancel: t("common.button.cancel"),
                },
                confirmProps: { color: "red" },
                onConfirm: async () => {
                  await userService
                    .removeCurrentUser()
                    .then(() => window.location.reload())
                    .catch(toast.axiosError);
                },
              })
            }
          >
            <FormattedMessage id="account.button.delete" />
          </Button>
        </div>
      </AccountPanel>
    </>
  );
};

export default ProfileSettings;
