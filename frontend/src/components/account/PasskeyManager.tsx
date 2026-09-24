import { startRegistration } from "@simplewebauthn/browser";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [name, setName] = useState("");
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
      const response = await startRegistration({ optionsJSON: data.options });
      await authService.registerPasskey(
        data.challengeId,
        response,
        name.trim() || t("passkey.defaultName"),
      );
      setName("");
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
      <Text size="sm" c="dimmed">
        {t("passkey.description")}
      </Text>
      <Text size="xs" c="dimmed">
        {t("passkey.recovery")}
      </Text>
      <Text size="xs" c="dimmed">
        {t("passkey.totpRelation")}
      </Text>
      {keys.length === 0 && <Text size="sm">{t("passkey.empty")}</Text>}
      {keys.map((key) => (
        <Group key={key.id} justify="space-between" wrap="wrap">
          <div>
            <Text size="sm" fw={600}>
              {key.name}
            </Text>
            <Text size="xs" c="dimmed">
              {t("passkey.created")}:{" "}
              {new Date(key.createdAt).toLocaleDateString()}
              {key.lastUsedAt &&
                ` · ${t("passkey.lastUsed")}: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
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
      <Group align="end" wrap="wrap">
        <TextInput
          label={t("passkey.name")}
          placeholder={t("passkey.defaultName")}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          maxLength={80}
        />
        <Button
          leftSection={<KeyRound size={16} />}
          loading={busy}
          onClick={() => void add()}
        >
          {t("passkey.add")}
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        {t("passkey.recentLogin")}
      </Text>
    </Stack>
  );
};

export default PasskeyManager;
