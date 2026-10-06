import {
  Alert,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import {
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  ScanSearch,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useIntl } from "react-intl";
import useTranslate from "../../../hooks/useTranslate.hook";
import systemService, { StorageAudit } from "../../../services/system.service";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import toast from "../../../utils/toast.util";
import showConfirmDialog from "../../core/showConfirmDialog";
import classes from "./StorageAuditPanel.module.css";

type StorageAuditPanelProps = {
  hasUnsavedChanges: boolean;
};

const StorageAuditPanel = ({ hasUnsavedChanges }: StorageAuditPanelProps) => {
  const t = useTranslate();
  const intl = useIntl();
  const modals = useModals();
  const [audit, setAudit] = useState<StorageAudit>();
  const [auditing, setAuditing] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const runAudit = async () => {
    setAuditing(true);
    try {
      const result = await systemService.auditStorage();
      setAudit(result);
      toast.success(t("admin.storage.audit.completed"));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setAuditing(false);
    }
  };

  const cleanStorage = () => {
    if (!audit) return;
    showConfirmDialog(modals, {
      title: t("admin.storage.cleanup.confirmTitle"),
      message: t("admin.storage.cleanup.confirmDescription", {
        objects: audit.orphaned.count.toString(),
        uploads: audit.staleMultipartUploads.toString(),
      }),
      confirmLabel: t("admin.storage.cleanup.button"),
      cancelLabel: t("common.button.cancel"),
      onConfirm: async () => {
        setCleaning(true);
        try {
          const result = await systemService.cleanupStorage();
          setAudit(result.audit);
          toast.success(
            t("admin.storage.cleanup.completed", {
              objects: result.deletedOrphanedObjects.toString(),
              uploads: result.abortedMultipartUploads.toString(),
            }),
          );
        } catch (error) {
          toast.axiosError(error);
        } finally {
          setCleaning(false);
        }
      },
    });
  };

  const hasCleanupCandidates = Boolean(
    audit && (audit.orphaned.count > 0 || audit.staleMultipartUploads > 0),
  );
  const hasProblems = Boolean(
    audit &&
    (audit.orphaned.count > 0 ||
      audit.missing.count > 0 ||
      audit.staleMultipartUploads > 0),
  );

  return (
    <section className={classes.panel}>
      <header className={classes.header}>
        <div className={classes.titleGroup}>
          <ThemeIcon className={classes.icon} size={42} radius="md">
            <DatabaseZap size={21} />
          </ThemeIcon>
          <div>
            <Group gap="xs" wrap="wrap">
              <Title order={4}>{t("admin.storage.audit.title")}</Title>
              <Badge variant="light" color="blue">
                {t("admin.storage.audit.readOnly")}
              </Badge>
            </Group>
            <Text c="dimmed" size="sm">
              {t("admin.storage.audit.description")}
            </Text>
          </div>
        </div>
        <Button
          variant="light"
          leftSection={<ScanSearch size={16} />}
          loading={auditing}
          disabled={hasUnsavedChanges || cleaning}
          onClick={() => void runAudit()}
        >
          {hasUnsavedChanges
            ? t("admin.storage.test.saveFirst")
            : t("admin.storage.audit.button")}
        </Button>
      </header>

      {!audit ? (
        <div className={classes.intro}>
          <ShieldCheck size={18} />
          <Text size="sm" c="dimmed">
            {t("admin.storage.audit.protection")}
          </Text>
        </div>
      ) : !audit.available ? (
        <Alert
          className={classes.alert}
          color="orange"
          icon={<CircleAlert size={18} />}
          title={t("admin.storage.audit.unavailable")}
        >
          {t("admin.storage.webdav.requiresS3.description")}
        </Alert>
      ) : (
        <>
          <div className={classes.metrics} aria-live="polite">
            <div className={classes.metric}>
              <Text size="xs" c="dimmed">
                {t("admin.storage.audit.objects")}
              </Text>
              <Text fw={650}>{audit.objects.count}</Text>
              <Text size="xs" c="dimmed">
                {byteToHumanSizeString(audit.objects.totalBytes)}
              </Text>
            </div>
            <div className={classes.metric}>
              <Text size="xs" c="dimmed">
                {t("admin.storage.audit.references")}
              </Text>
              <Text fw={650}>{audit.database.referencedObjects}</Text>
            </div>
            <div className={classes.metric}>
              <Text size="xs" c="dimmed">
                {t("admin.storage.audit.orphaned")}
              </Text>
              <Text
                fw={650}
                c={audit.orphaned.count > 0 ? "orange" : undefined}
              >
                {audit.orphaned.count}
              </Text>
              <Text size="xs" c="dimmed">
                {byteToHumanSizeString(audit.orphaned.totalBytes)}
              </Text>
            </div>
            <div className={classes.metric}>
              <Text size="xs" c="dimmed">
                {t("admin.storage.audit.missing")}
              </Text>
              <Text fw={650} c={audit.missing.count > 0 ? "red" : undefined}>
                {audit.missing.count}
              </Text>
            </div>
            <div className={classes.metric}>
              <Text size="xs" c="dimmed">
                {t("admin.storage.audit.multipart")}
              </Text>
              <Text
                fw={650}
                c={audit.staleMultipartUploads > 0 ? "orange" : undefined}
              >
                {audit.staleMultipartUploads}
              </Text>
            </div>
          </div>

          <div className={classes.details}>
            {!hasProblems ? (
              <Group gap="sm" wrap="nowrap">
                <CheckCircle2 color="var(--mantine-color-green-6)" size={19} />
                <div>
                  <Text fw={650} size="sm">
                    {t("admin.storage.audit.healthy")}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {t("admin.storage.audit.healthyDescription")}
                  </Text>
                </div>
              </Group>
            ) : (
              <Stack gap="sm">
                {audit.orphaned.count > 0 ? (
                  <Finding
                    title={t("admin.storage.audit.orphanedFinding", {
                      count: audit.orphaned.count.toString(),
                    })}
                    samples={audit.orphaned.samples}
                  />
                ) : null}
                {audit.missing.count > 0 ? (
                  <Finding
                    title={t("admin.storage.audit.missingFinding", {
                      count: audit.missing.count.toString(),
                    })}
                    samples={audit.missing.samples}
                    color="red"
                  />
                ) : null}
                {audit.staleMultipartUploads > 0 ? (
                  <Finding
                    title={t("admin.storage.audit.multipartFinding", {
                      count: audit.staleMultipartUploads.toString(),
                    })}
                  />
                ) : null}
              </Stack>
            )}
            {audit.protectedUnreferenced.count > 0 ? (
              <Text size="xs" c="dimmed" mt="md">
                {t("admin.storage.audit.protectedObjects", {
                  count: audit.protectedUnreferenced.count.toString(),
                  size: byteToHumanSizeString(
                    audit.protectedUnreferenced.totalBytes,
                  ),
                })}
              </Text>
            ) : null}
          </div>

          <footer className={classes.footer}>
            <Text size="xs" c="dimmed">
              {t("admin.storage.audit.checkedAt", {
                date: intl.formatDate(audit.checkedAt, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </Text>
            <Button
              color="red"
              variant="light"
              leftSection={<Trash2 size={15} />}
              disabled={!hasCleanupCandidates || hasUnsavedChanges}
              loading={cleaning}
              onClick={cleanStorage}
            >
              {t("admin.storage.cleanup.button")}
            </Button>
          </footer>
        </>
      )}
    </section>
  );
};

type FindingProps = {
  title: string;
  samples?: string[];
  color?: "orange" | "red";
};

const Finding = ({ title, samples = [], color = "orange" }: FindingProps) => (
  <div className={classes.finding} data-color={color}>
    <Group gap="xs" wrap="nowrap">
      <CircleAlert size={16} />
      <Text fw={620} size="sm">
        {title}
      </Text>
    </Group>
    {samples.length > 0 ? (
      <div className={classes.samples}>
        {samples.map((sample) => (
          <code key={sample}>{sample}</code>
        ))}
      </div>
    ) : null}
  </div>
);

export default StorageAuditPanel;
