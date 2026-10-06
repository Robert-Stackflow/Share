import { Button, Group, Stack, Text } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import PromptDialog from "../core/PromptDialog";
import showConfirmDialog from "../core/showConfirmDialog";
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
  const modals = useModals();
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState(false);
  const [renamingKey, setRenamingKey] = useState<Passkey | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

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

  const openRename = (key: Passkey) => {
    setRenamingKey(key);
    setRenameValue(key.name);
  };

  const rename = async () => {
    const next = renameValue.trim();
    if (!renamingKey || !next || next === renamingKey.name) return;
    setSavingRename(true);
    try {
      await authService.renamePasskey(renamingKey.id, next);
      await reload();
      setRenamingKey(null);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSavingRename(false);
    }
  };

  const remove = (key: Passkey) =>
    showConfirmDialog(modals, {
      title: t("passkey.remove"),
      message: t("passkey.removeConfirm"),
      confirmLabel: t("passkey.remove"),
      cancelLabel: t("common.button.cancel"),
      onConfirm: async () => {
        try {
          await authService.removePasskey(key.id);
          await reload();
          toast.success(t("passkey.removed"));
        } catch (error) {
          toast.axiosError(error);
        }
      },
    });

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
      {keys.length === 0 ? <Text size="sm">{t("passkey.empty")}</Text> : null}
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
                ` · ${t("passkey.lastUsed")}: ${intl.formatDate(
                  key.lastUsedAt,
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  },
                )}`}
            </Text>
          </div>
          <Group gap="xs">
            <Button size="xs" variant="subtle" onClick={() => openRename(key)}>
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
      <PromptDialog
        opened={renamingKey !== null}
        title={t("passkey.rename")}
        label={t("passkey.name")}
        value={renameValue}
        maxLength={80}
        confirmLabel={t("common.button.save")}
        cancelLabel={t("common.button.cancel")}
        loading={savingRename}
        onChange={setRenameValue}
        onCancel={() => setRenamingKey(null)}
        onConfirm={() => void rename()}
      />
    </Stack>
  );
};

export default PasskeyManager;
