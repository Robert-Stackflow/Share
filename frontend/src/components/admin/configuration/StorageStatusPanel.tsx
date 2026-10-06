import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  CheckCircle2,
  CircleAlert,
  Database,
  FolderSync,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useTranslate from "../../../hooks/useTranslate.hook";
import systemService, {
  StorageConnectionTest,
  StorageStatus,
} from "../../../services/system.service";
import toast from "../../../utils/toast.util";
import classes from "./StorageStatusPanel.module.css";

type StorageStatusPanelProps = {
  category: "s3" | "webdav";
  hasUnsavedChanges: boolean;
};

const StorageStatusPanel = ({
  category,
  hasUnsavedChanges,
}: StorageStatusPanelProps) => {
  const t = useTranslate();
  const [status, setStatus] = useState<StorageStatus>();
  const [result, setResult] = useState<StorageConnectionTest>();
  const [testing, setTesting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await systemService.getStorageStatus());
    } catch (error) {
      toast.axiosError(error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, hasUnsavedChanges]);

  const testConnection = async () => {
    setTesting(true);
    setResult(undefined);
    try {
      const nextResult = await systemService.testStorageConnection(
        category === "s3" ? "S3" : undefined,
      );
      setResult(nextResult);
      if (nextResult.ok) {
        toast.success(t("admin.storage.test.success"));
      }
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setTesting(false);
    }
  };

  if (!status) {
    return (
      <section className={classes.panel}>
        <Group justify="center" p="xl">
          <Loader size="sm" />
        </Group>
      </section>
    );
  }

  const namespace = (id: "assets" | "webdav") =>
    status.namespaces.find((item) => item.id === id)?.path ?? "-";
  const webDavUrl =
    typeof window === "undefined"
      ? status.webdav.path
      : new URL(status.webdav.path, window.location.origin).toString();
  const webDavState = !status.webdav.enabled
    ? t("admin.storage.webdav.disabled")
    : !status.webdav.available
      ? t("admin.storage.webdav.unavailable")
      : status.webdav.allowWrite
        ? t("admin.storage.webdav.readWrite")
        : t("admin.storage.webdav.readOnly");
  const badge = result
    ? {
        color: result.ok ? "green" : "red",
        label: result.ok
          ? t("admin.storage.status.reachable")
          : t("admin.storage.status.failed"),
      }
    : category === "webdav" && !status.webdav.available
      ? {
          color: "orange",
          label: t("admin.storage.status.unavailable"),
        }
      : {
          color: "gray",
          label: t("admin.storage.status.notTested"),
        };

  return (
    <section className={classes.panel}>
      <header className={classes.header}>
        <div className={classes.titleGroup}>
          <ThemeIcon className={classes.icon} size={42} radius="md">
            {category === "s3" ? (
              <Database size={21} />
            ) : (
              <FolderSync size={21} />
            )}
          </ThemeIcon>
          <div>
            <Group gap="xs" wrap="wrap">
              <Title order={4}>{t(`admin.storage.${category}.title`)}</Title>
              <Badge color={badge.color} variant="light">
                {badge.label}
              </Badge>
            </Group>
            <Text c="dimmed" size="sm">
              {t(`admin.storage.${category}.description`)}
            </Text>
          </div>
        </div>
        <Button
          variant="light"
          leftSection={<RefreshCw size={15} />}
          loading={testing}
          disabled={hasUnsavedChanges}
          onClick={() => void testConnection()}
        >
          {hasUnsavedChanges
            ? t("admin.storage.test.saveFirst")
            : t("admin.storage.test.button")}
        </Button>
      </header>

      <div className={classes.summary}>
        <div className={classes.summaryItem}>
          <Text c="dimmed" size="xs">
            {t("admin.storage.field.provider")}
          </Text>
          <span className={classes.value}>
            {t(`admin.storage.provider.${status.provider.toLowerCase()}`)}
          </span>
        </div>
        <div className={classes.summaryItem}>
          <Text c="dimmed" size="xs">
            {category === "s3"
              ? t("admin.storage.field.bucket")
              : t("admin.storage.field.webdavMode")}
          </Text>
          <span className={classes.value}>
            {category === "s3" ? status.s3.bucket || "-" : webDavState}
          </span>
        </div>
        <div className={classes.summaryItem}>
          <Text c="dimmed" size="xs">
            {category === "s3"
              ? t("admin.storage.field.endpoint")
              : t("admin.storage.field.address")}
          </Text>
          <span className={classes.value}>
            {category === "s3" ? status.s3.endpoint || "AWS S3" : webDavUrl}
          </span>
        </div>
        <div className={classes.summaryItem}>
          <Text c="dimmed" size="xs">
            {t("admin.storage.field.rootPath")}
          </Text>
          <span className={classes.value}>{status.s3.rootPath || "/"}</span>
        </div>
      </div>

      <Stack className={classes.paths} gap="xs">
        <div className={classes.pathRow}>
          <Text c="dimmed" size="sm">
            {t("admin.storage.namespace.assets")}
          </Text>
          <code className={classes.pathValue}>{namespace("assets")}</code>
        </div>
        <div className={classes.pathRow}>
          <Text c="dimmed" size="sm">
            {t("admin.storage.namespace.webdav")}
          </Text>
          <code className={classes.pathValue}>{namespace("webdav")}</code>
        </div>
      </Stack>

      {status.webdav.reason === "requires_s3" && category === "webdav" ? (
        <Alert
          className={classes.result}
          color="orange"
          icon={<CircleAlert size={18} />}
          title={t("admin.storage.webdav.requiresS3.title")}
          variant="light"
        >
          {t("admin.storage.webdav.requiresS3.description")}
        </Alert>
      ) : null}

      {result ? (
        <div className={classes.result} aria-live="polite" role="status">
          <Group gap="xs" align="flex-start" wrap="nowrap">
            {result.ok ? (
              <CheckCircle2 color="var(--mantine-color-green-6)" size={18} />
            ) : (
              <CircleAlert color="var(--mantine-color-red-6)" size={18} />
            )}
            <div>
              <Text fw={620} size="sm">
                {result.ok
                  ? t("admin.storage.test.successWithLatency", {
                      latency: result.latencyMs.toString(),
                    })
                  : t("admin.storage.test.failed")}
              </Text>
              {result.error ? (
                <Text c="red" size="xs" mt={3}>
                  {result.error}
                </Text>
              ) : null}
            </div>
          </Group>
        </div>
      ) : null}
    </section>
  );
};

export default StorageStatusPanel;
