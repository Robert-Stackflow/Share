import {
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import appCredentialService from "../../services/appCredential.service";
import {
  AppCredential,
  AppCredentialScope,
  AppCredentialType,
  CreatedAppCredential,
} from "../../types/appCredential.type";
import toast from "../../utils/toast.util";

type Expiry = "never" | "30" | "90" | "365";

const AppCredentialManager = () => {
  const t = useTranslate();
  const intl = useIntl();
  const [credentials, setCredentials] = useState<AppCredential[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AppCredentialType>("APP_PASSWORD");
  const [expiry, setExpiry] = useState<Expiry>("never");
  const [allowWrite, setAllowWrite] = useState(true);
  const [created, setCreated] = useState<CreatedAppCredential | null>(null);

  const reload = () =>
    appCredentialService.list().then(setCredentials).catch(toast.axiosError);

  useEffect(() => {
    void reload();
  }, []);

  const create = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const readScope: AppCredentialScope =
      type === "APP_PASSWORD" ? "webdav:read" : "image:read";
    const writeScope: AppCredentialScope =
      type === "APP_PASSWORD" ? "webdav:write" : "image:write";
    const expiresAt =
      expiry === "never"
        ? undefined
        : new Date(
            Date.now() + Number(expiry) * 24 * 60 * 60 * 1000,
          ).toISOString();

    setCreating(true);
    try {
      const result = await appCredentialService.create({
        name: trimmedName,
        type,
        scopes: allowWrite ? [readScope, writeScope] : [readScope],
        expiresAt,
      });
      setCreated(result);
      setName("");
      await reload();
      toast.success(t("credentials.created"));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (credential: AppCredential) => {
    if (!window.confirm(t("credentials.revokeConfirm"))) return;
    try {
      await appCredentialService.revoke(credential.id);
      await reload();
      toast.success(t("credentials.revoked"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const formatDate = (value: string) =>
    intl.formatDate(value, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <Stack mt="md" gap="md">
      <Text size="sm" c="dimmed">
        {t("credentials.description")}
      </Text>

      <Group align="flex-end" wrap="wrap">
        <TextInput
          label={t("credentials.name")}
          placeholder={t("credentials.namePlaceholder")}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          style={{ flex: "1 1 200px" }}
        />
        <Select
          label={t("credentials.type")}
          value={type}
          onChange={(value) =>
            setType((value as AppCredentialType) ?? "APP_PASSWORD")
          }
          data={[
            {
              value: "APP_PASSWORD",
              label: t("credentials.type.appPassword"),
            },
            {
              value: "API_TOKEN",
              label: t("credentials.type.apiToken"),
            },
          ]}
          w={190}
        />
        <Select
          label={t("credentials.expiry")}
          value={expiry}
          onChange={(value) => setExpiry((value as Expiry) ?? "never")}
          data={[
            { value: "never", label: t("credentials.expiry.never") },
            { value: "30", label: t("credentials.expiry.30") },
            { value: "90", label: t("credentials.expiry.90") },
            { value: "365", label: t("credentials.expiry.365") },
          ]}
          w={150}
        />
        <Switch
          label={t("credentials.allowWrite")}
          checked={allowWrite}
          onChange={(event) => setAllowWrite(event.currentTarget.checked)}
          mb={8}
        />
        <Button
          leftSection={<Plus size={16} />}
          loading={creating}
          disabled={!name.trim()}
          onClick={() => void create()}
        >
          {t("credentials.create")}
        </Button>
      </Group>

      {credentials.length === 0 && (
        <Text size="sm">{t("credentials.empty")}</Text>
      )}
      {credentials.map((credential) => (
        <Group key={credential.id} justify="space-between" wrap="wrap">
          <div>
            <Group gap="xs">
              <Text size="sm" fw={600}>
                {credential.name}
              </Text>
              <Badge size="sm" variant="light">
                {t(
                  credential.type === "APP_PASSWORD"
                    ? "credentials.type.appPassword"
                    : "credentials.type.apiToken",
                )}
              </Badge>
              {!credential.active && (
                <Badge size="sm" color="gray">
                  {t("credentials.inactive")}
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {credential.tokenHint} · {t("credentials.createdAt")}{" "}
              {formatDate(credential.createdAt)}
              {credential.lastUsedAt &&
                ` · ${t("credentials.lastUsedAt")} ${formatDate(
                  credential.lastUsedAt,
                )}`}
              {credential.expiresAt &&
                ` · ${t("credentials.expiresAt")} ${formatDate(
                  credential.expiresAt,
                )}`}
            </Text>
            <Text size="xs" c="dimmed">
              {credential.scopes.join(" · ")}
            </Text>
          </div>
          {credential.active && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={() => void revoke(credential)}
            >
              {t("credentials.revoke")}
            </Button>
          )}
        </Group>
      ))}

      <Modal
        opened={created !== null}
        onClose={() => setCreated(null)}
        title={t("credentials.createdTitle")}
        centered
      >
        {created && (
          <Stack>
            <Alert icon={<KeyRound size={18} />} color="yellow">
              {t("credentials.copyWarning")}
            </Alert>
            {created.credential.type === "APP_PASSWORD" && (
              <Stack gap={4}>
                <Text size="sm">
                  {t("credentials.webdavUrl")}:{" "}
                  <Code>{`${typeof window === "undefined" ? "" : window.location.origin}/dav/`}</Code>
                </Text>
                <Text size="sm">
                  {t("credentials.username")}: <Code>{created.username}</Code>
                </Text>
              </Stack>
            )}
            {created.credential.type === "API_TOKEN" && (
              <Text size="sm">
                {t("credentials.imageApiUrl")}:{" "}
                <Code>{`${typeof window === "undefined" ? "" : window.location.origin}/api/image-api/images`}</Code>
              </Text>
            )}
            <Code block style={{ overflowWrap: "anywhere" }}>
              {created.token}
            </Code>
            <CopyButton value={created.token}>
              {({ copied, copy }) => (
                <Button onClick={copy} color={copied ? "teal" : undefined}>
                  {copied ? t("credentials.copied") : t("credentials.copy")}
                </Button>
              )}
            </CopyButton>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};

export default AppCredentialManager;
