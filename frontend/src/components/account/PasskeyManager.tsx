import { Button, Group, Stack, Text } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import authService from "../../services/auth.service";
import { showPasskeyError } from "../../utils/passkey.util";
import toast from "../../utils/toast.util";
import PromptDialog from "../core/PromptDialog";
import showConfirmDialog from "../core/showConfirmDialog";
import { AccountPanel } from "./AccountSettingsLayout";
import classes from "./PasskeyManager.module.css";

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
    <AccountPanel
      title="passkey.title"
      description="account.security.passkey.description"
      action={
        <Button
          leftSection={<KeyRound size={16} />}
          loading={busy}
          onClick={() => void add()}
        >
          {t("passkey.add")}
        </Button>
      }
    >
      {keys.length === 0 ? (
        <div className={classes.emptyState}>
          <span className={classes.emptyIcon}>
            <KeyRound size={20} />
          </span>
          <Text size="sm" c="dimmed">
            {t("passkey.empty")}
          </Text>
        </div>
      ) : (
        <Stack gap="sm">
          {keys.map((key) => (
            <div className={classes.item} key={key.id}>
              <span className={classes.itemIcon}>
                <KeyRound size={19} />
              </span>
              <div className={classes.itemContent}>
                <Text className={classes.itemName} fw={650}>
                  {key.name}
                </Text>
                <div className={classes.metadata}>
                  <Text component="span" size="xs" c="dimmed">
                    {t("passkey.created")}:{" "}
                    {intl.formatDate(key.createdAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                  {key.lastUsedAt ? (
                    <Text component="span" size="xs" c="dimmed">
                      {t("passkey.lastUsed")}:{" "}
                      {intl.formatDate(key.lastUsedAt, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  ) : null}
                </div>
              </div>
              <Group className={classes.actions} gap={4} wrap="nowrap">
                <Button
                  size="compact-sm"
                  variant="subtle"
                  leftSection={<Pencil size={14} />}
                  onClick={() => openRename(key)}
                >
                  {t("passkey.rename")}
                </Button>
                <Button
                  size="compact-sm"
                  variant="subtle"
                  color="red"
                  leftSection={<Trash2 size={14} />}
                  onClick={() => void remove(key)}
                >
                  {t("passkey.remove")}
                </Button>
              </Group>
            </div>
          ))}
        </Stack>
      )}
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
    </AccountPanel>
  );
};

export default PasskeyManager;
