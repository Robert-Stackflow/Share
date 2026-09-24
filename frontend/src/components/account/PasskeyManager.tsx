import { Button, Group, Stack, Text } from "@mantine/core";
import { KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import authService from "../../services/auth.service";
import toast from "../../utils/toast.util";
import { showPasskeyError } from "../../utils/passkey.util";

type Passkey = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

const PasskeyManager = () => {
  const t = useTranslate();
  const intl = useIntl();
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = () =>
    authService
      .getPasskeys()
      .then(({ data }) => setKeys(data))
      .catch(toast.axiosError);

  useEffect(() => {
    void reload();
  }, []);

  const add = async () => {
    if (!window.PublicKeyCredential) {
      toast.error(t("passkey.unsupported"));
      return;
    }
    setBusy(true);
    try {
      const { data } = await authService.getPasskeyRegistrationOptions();
      const { startRegistration } = await import("@simplewebauthn/browser");
      const response = await startRegistration({ optionsJSON: data.options });
      const baseName = t("passkey.defaultName");
      let number = 1;
      while (keys.some((key) => key.name === `${baseName} ${number}`)) number++;
      await authService.registerPasskey(
        data.challengeId,
        response,
        `${baseName} ${number}`,
      );
      await reload();
      toast.success(t("passkey.added"));
    } catch (error) {
      showPasskeyError(error, t);
    } finally {
      setBusy(false);
    }
  };

  const rename = async (key: Passkey) => {
    const next = window.prompt(t("passkey.name"), key.name)?.trim();
    if (!next || next === key.name) return;
    try {
      await authService.renamePasskey(key.id, next);
      await reload();
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const remove = async (key: Passkey) => {
    if (!window.confirm(t("passkey.removeConfirm"))) return;
    try {
      await authService.removePasskey(key.id);
      await reload();
      toast.success(t("passkey.removed"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  return (
    <Stack mt="md" gap="sm">
      <Group>
        <Button
          leftSection={<KeyRound size={16} />}
          loading={busy}
          onClick={() => void add()}
        >
          {t("passkey.add")}
        </Button>
      </Group>
      {keys.length === 0 && <Text size="sm">{t("passkey.empty")}</Text>}
      {keys.map((key) => (
        <Group key={key.id} justify="space-between" wrap="wrap">
          <div>
            <Text size="sm" fw={600}>
              {key.name}
            </Text>
            <Text size="xs" c="dimmed">
              {t("passkey.created")}:{" "}
              {intl.formatDate(key.createdAt, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {key.lastUsedAt &&
                ` · ${t("passkey.lastUsed")}: ${intl.formatDate(key.lastUsedAt, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}`}
            </Text>
          </div>
          <Group gap="xs">
            <Button size="xs" variant="subtle" onClick={() => void rename(key)}>
              {t("passkey.rename")}
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={() => void remove(key)}
            >
              {t("passkey.remove")}
            </Button>
          </Group>
        </Group>
      ))}
    </Stack>
  );
};

export default PasskeyManager;
