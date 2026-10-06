import { Alert, Group, Loader, Text, ThemeIcon } from "@mantine/core";
import { Clock3, Files, FolderSync, HardDrive } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import systemService, {
  StorageWebDavUsage,
} from "../../services/system.service";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import classes from "./WebDavUsagePanel.module.css";

const WebDavUsagePanel = () => {
  const t = useTranslate();
  const intl = useIntl();
  const [usage, setUsage] = useState<StorageWebDavUsage>();
  const [loading, setLoading] = useState(true);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    try {
      setUsage(await systemService.getWebDavUsage());
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  if (loading) {
    return (
      <Group
        justify="center"
        py="lg"
        aria-label={t("credentials.webdavUsage.loading")}
      >
        <Loader size="sm" />
      </Group>
    );
  }

  if (!usage?.available) {
    return (
      <Alert color="gray" variant="light">
        {t(
          usage?.reason === "requires_s3"
            ? "credentials.webdavUsage.requiresS3"
            : "credentials.webdavUsage.disabled",
        )}
      </Alert>
    );
  }

  const latest = usage.lastModified
    ? intl.formatDate(usage.lastModified, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : t("credentials.webdavUsage.never");

  return (
    <div>
      <div className={classes.metrics}>
        <div className={classes.metric}>
          <ThemeIcon variant="light" radius="md" size={38}>
            <Files size={18} />
          </ThemeIcon>
          <div>
            <Text size="xs" c="dimmed">
              {t("credentials.webdavUsage.objects")}
            </Text>
            <Text fw={650}>{usage.objectCount}</Text>
          </div>
        </div>
        <div className={classes.metric}>
          <ThemeIcon variant="light" radius="md" size={38}>
            <HardDrive size={18} />
          </ThemeIcon>
          <div>
            <Text size="xs" c="dimmed">
              {t("credentials.webdavUsage.storage")}
            </Text>
            <Text fw={650}>{byteToHumanSizeString(usage.totalBytes)}</Text>
          </div>
        </div>
        <div className={classes.metric}>
          <ThemeIcon variant="light" radius="md" size={38}>
            <Clock3 size={18} />
          </ThemeIcon>
          <div>
            <Text size="xs" c="dimmed">
              {t("credentials.webdavUsage.latest")}
            </Text>
            <Text fw={650}>{latest}</Text>
          </div>
        </div>
      </div>
      <div className={classes.namespace}>
        <Group gap="xs" wrap="nowrap">
          <FolderSync size={16} />
          <Text size="sm" c="dimmed">
            {t("credentials.webdavUsage.namespace")}
          </Text>
        </Group>
        <code>{usage.namespace}</code>
      </div>
    </div>
  );
};

export default WebDavUsagePanel;
