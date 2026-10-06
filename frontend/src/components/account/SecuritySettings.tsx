import { Button, Group, PasswordInput, Stack, TextInput } from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { useModals } from "@mantine/modals";
import * as yup from "yup";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import authService from "../../services/auth.service";
import toast from "../../utils/toast.util";
import FormattedMessage from "../core/FormattedMessage";
import { AccountPanel } from "./AccountSettingsLayout";
import PasskeyManager from "./PasskeyManager";
import showEnableTotpModal from "./showEnableTotpModal";

const SecuritySettings = () => {
  const { user, refreshUser } = useUser();
  const modals = useModals();
  const t = useTranslate();

  const enableTotpForm = useForm({
    initialValues: { password: "" },
    validate: yupResolver(
      yup.object().shape({
        password: yup
          .string()
          .min(8, t("common.error.too-short", { length: 8 }))
          .required(t("common.error.field-required")),
      }),
    ),
  });

  const disableTotpForm = useForm({
    initialValues: { password: "", code: "" },
    validate: yupResolver(
      yup.object().shape({
        password: yup.string().min(8),
        code: yup
          .string()
          .min(6, t("common.error.exact-length", { length: 6 }))
          .max(6, t("common.error.exact-length", { length: 6 }))
          .matches(/^[0-9]+$/, { message: t("common.error.invalid-number") }),
      }),
    ),
  });

  return (
    <>
      <AccountPanel
        title="account.security.totp.title"
        description="account.security.totp.description"
      >
        {user?.totpVerified ? (
          <form
            onSubmit={disableTotpForm.onSubmit(async (values) => {
              try {
                await authService.disableTOTP(values.code, values.password);
                disableTotpForm.reset();
                await refreshUser();
                toast.success(t("account.notify.totp.disable"));
              } catch (error) {
                toast.axiosError(error);
              }
            })}
          >
            <Stack>
              <PasswordInput
                description={t(
                  "account.card.security.totp.disable.description",
                )}
                label={t("account.card.password.title")}
                {...disableTotpForm.getInputProps("password")}
              />
              <TextInput
                label={t("account.modal.totp.code")}
                placeholder="******"
                {...disableTotpForm.getInputProps("code")}
              />
              <Group justify="flex-end">
                <Button color="red" type="submit">
                  <FormattedMessage id="common.button.disable" />
                </Button>
              </Group>
            </Stack>
          </form>
        ) : (
          <form
            onSubmit={enableTotpForm.onSubmit(async (values) => {
              try {
                const result = await authService.enableTOTP(values.password);
                showEnableTotpModal(modals, refreshUser, {
                  qrCode: result.qrCode,
                  secret: result.totpSecret,
                  password: values.password,
                });
                enableTotpForm.reset();
              } catch (error) {
                toast.axiosError(error);
              }
            })}
          >
            <Stack>
              <PasswordInput
                label={t("account.card.password.title")}
                description={t("account.card.security.totp.enable.description")}
                {...enableTotpForm.getInputProps("password")}
              />
              <Group justify="flex-end">
                <Button type="submit">
                  <FormattedMessage id="account.card.security.totp.button.start" />
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </AccountPanel>

      <PasskeyManager />
    </>
  );
};

export default SecuritySettings;
