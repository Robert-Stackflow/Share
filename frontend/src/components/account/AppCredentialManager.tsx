import {
  ActionIcon,
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
import {
  Copy,
  FolderSync,
  ImageUp,
  KeyRound,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import appCredentialService from "../../services/appCredential.service";
import {
  AppCredential,
  AppCredentialScope,
  AppCredentialType,
  CreatedAppCredential,
} from "../../types/appCredential.type";
import toast from "../../utils/toast.util";
import classes from "./AppCredentialManager.module.css";

type Expiry = "never" | "30" | "90" | "365";

const AppCredentialManager = () => {
  const t = useTranslate();
  const intl = useIntl();
  const config = useConfig();
  const [credentials, setCredentials] = useState<AppCredential[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AppCredentialType>("APP_PASSWORD");
  const [expiry, setExpiry] = useState<Expiry>("never");
  const [allowWrite, setAllowWrite] = useState(true);
  const [created, setCreated] = useState<CreatedAppCredential | null>(null);
  const [origin, setOrigin] = useState("");

  const webDavEnabled = config.get("webdav.enabled") === true;
  const webDavAllowWrite = config.get("webdav.allowWrite") === true;
  const canAllowWrite = type !== "APP_PASSWORD" || webDavAllowWrite;
  const effectiveAllowWrite = allowWrite && canAllowWrite;
  const webDavUrl = `${origin}/dav/`;
  const imageApiUrl = `${origin}/api/image-api/images`;

  const reload = useCallback(
    () =>
      appCredentialService.list().then(setCredentials).catch(toast.axiosError),
    [],
  );

  useEffect(() => {
    setOrigin(window.location.origin);
    void reload();
  }, [reload]);

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
        scopes: effectiveAllowWrite ? [readScope, writeScope] : [readScope],
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

  const serviceStatus = !webDavEnabled
    ? { color: "gray", label: t("credentials.status.disabled") }
    : webDavAllowWrite
      ? { color: "teal", label: t("credentials.status.readWrite") }
      : { color: "yellow", label: t("credentials.status.readOnly") };

  return (
    <Stack gap="xl">
      <div className={classes.serviceGrid}>
        <div className={classes.serviceCard}>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <span className={classes.serviceIcon}>
                <FolderSync size={19} />
              </span>
              <div>
                <Text fw={650}>{t("credentials.service.webdav")}</Text>
                <Text size="xs" c="dimmed">
                  {t("credentials.type.appPassword")}
                </Text>
              </div>
            </Group>
            <Badge variant="light" color={serviceStatus.color}>
              {serviceStatus.label}
            </Badge>
          </Group>
          <Group className={classes.endpoint} gap="xs" wrap="nowrap">
            <Code>{webDavUrl}</Code>
            <CopyButton value={webDavUrl}>
              {({ copied, copy }) => (
                <ActionIcon
                  variant="subtle"
                  color={copied ? "teal" : "gray"}
                  onClick={copy}
                  aria-label={t("credentials.copyAddress")}
                >
                  <Copy size={16} />
                </ActionIcon>
              )}
            </CopyButton>
          </Group>
        </div>

        <div className={classes.serviceCard}>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <span className={classes.serviceIcon}>
                <ImageUp size={19} />
              </span>
              <div>
                <Text fw={650}>{t("credentials.service.imageApi")}</Text>
                <Text size="xs" c="dimmed">
                  {t("credentials.type.apiToken")}
                </Text>
              </div>
            </Group>
            <Badge variant="light" color="teal">
              {t("credentials.status.available")}
            </Badge>
          </Group>
          <Group className={classes.endpoint} gap="xs" wrap="nowrap">
            <Code>{imageApiUrl}</Code>
            <CopyButton value={imageApiUrl}>
              {({ copied, copy }) => (
                <ActionIcon
                  variant="subtle"
                  color={copied ? "teal" : "gray"}
                  onClick={copy}
                  aria-label={t("credentials.copyAddress")}
                >
                  <Copy size={16} />
                </ActionIcon>
              )}
            </CopyButton>
          </Group>
        </div>
      </div>

      {!webDavEnabled ? (
        <Alert color="gray" title={t("credentials.webdavDisabled.title")}>
          {t("credentials.webdavDisabled.description")}
        </Alert>
      ) : !webDavAllowWrite ? (
        <Alert color="yellow" title={t("credentials.webdavReadOnly.title")}>
          {t("credentials.webdavReadOnly.description")}
        </Alert>
      ) : null}

      <form
        className={classes.createPanel}
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <div>
          <Text fw={650}>{t("credentials.createTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("credentials.description")}
          </Text>
        </div>
        <div className={classes.formGrid}>
          <TextInput
            label={t("credentials.name")}
            placeholder={t("credentials.namePlaceholder")}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
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
          />
          <div className={classes.writeControl}>
            <Switch
              label={t("credentials.allowWrite")}
              description={
                !canAllowWrite ? t("credentials.allowWriteDisabled") : undefined
              }
              checked={effectiveAllowWrite}
              disabled={!canAllowWrite}
              onChange={(event) => setAllowWrite(event.currentTarget.checked)}
            />
          </div>
          <Button
            className={classes.createButton}
            leftSection={<Plus size={16} />}
            loading={creating}
            disabled={!name.trim()}
            type="submit"
          >
            {t("credentials.create")}
          </Button>
        </div>
      </form>

      <section>
        <Group justify="space-between" mb="sm">
          <div>
            <Text fw={650}>{t("credentials.listTitle")}</Text>
            <Text size="sm" c="dimmed">
              {t("credentials.listDescription")}
            </Text>
          </div>
          <Badge variant="light" color="gray">
            {credentials.length}
          </Badge>
        </Group>
        <div className={classes.credentialList}>
          {credentials.length === 0 ? (
            <Text size="sm" c="dimmed" className={classes.emptyState}>
              {t("credentials.empty")}
            </Text>
          ) : (
            credentials.map((credential) => (
              <div className={classes.credentialRow} key={credential.id}>
                <div className={classes.credentialInfo}>
                  <Group gap="xs">
                    <Text size="sm" fw={650}>
                      {credential.name}
                    </Text>
                    <Badge size="sm" variant="light">
                      {t(
                        credential.type === "APP_PASSWORD"
                          ? "credentials.type.appPassword"
                          : "credentials.type.apiToken",
                      )}
                    </Badge>
                    {!credential.active ? (
                      <Badge size="sm" color="gray">
                        {t("credentials.inactive")}
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {credential.tokenHint} · {t("credentials.createdAt")}{" "}
                    {formatDate(credential.createdAt)}
                    {credential.lastUsedAt
                      ? ` · ${t("credentials.lastUsedAt")} ${formatDate(
                          credential.lastUsedAt,
                        )}`
                      : ""}
                    {credential.expiresAt
                      ? ` · ${t("credentials.expiresAt")} ${formatDate(
                          credential.expiresAt,
                        )}`
                      : ""}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {credential.scopes.join(" · ")}
                  </Text>
                </div>
                {credential.active ? (
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    leftSection={<Trash2 size={14} />}
                    onClick={() => void revoke(credential)}
                  >
                    {t("credentials.revoke")}
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <Modal
        opened={created !== null}
        onClose={() => setCreated(null)}
        title={t("credentials.createdTitle")}
        centered
      >
        {created ? (
          <Stack>
            <Alert icon={<KeyRound size={18} />} color="yellow">
              {t("credentials.copyWarning")}
            </Alert>
            {created.credential.type === "APP_PASSWORD" ? (
              <Stack gap={4}>
                <Text size="sm">
                  {t("credentials.webdavUrl")}: <Code>{webDavUrl}</Code>
                </Text>
                <Text size="sm">
                  {t("credentials.username")}: <Code>{created.username}</Code>
                </Text>
              </Stack>
            ) : (
              <Text size="sm">
                {t("credentials.imageApiUrl")}: <Code>{imageApiUrl}</Code>
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
        ) : null}
      </Modal>
    </Stack>
  );
};

export default AppCredentialManager;
