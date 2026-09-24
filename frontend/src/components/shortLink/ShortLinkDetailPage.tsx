import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Center,
  Group,
  Modal,
  Radio,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useClipboard, useDisclosure } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  TbArrowLeft,
  TbCalendarStats,
  TbChartBar,
  TbClock,
  TbCopy,
  TbDeviceFloppy,
  TbEdit,
  TbExternalLink,
  TbLink,
  TbUser,
  TbWorld,
  TbTrash,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import CenterLoader from "../../components/core/CenterLoader";
import tableClasses from "../../components/core/DataTable.module.css";
import { HoverTip } from "../../components/core/HoverTip";
import modalClasses from "../../components/core/ModalForm.module.css";
import AccessControlForm from "../access/AccessControlForm";
import useTranslate from "../../hooks/useTranslate.hook";
import useStaticRouteParam from "../../hooks/staticRouteParam.hook";
import shortLinkService from "../../services/shortLink.service";
import {
  ShortLink,
  ShortLinkStats,
  ShortLinkStatsBucket,
  ShortLinkTargetType,
} from "../../types/shortLink.type";
import toast from "../../utils/toast.util";
import { AccessControl, toAccessControlPayload } from "../../types/accessControl.type";
import classes from "./ShortLinksWorkspace.module.css";

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "-" : date.toLocaleString();
};

const KpiCard = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) => (
  <div className={classes.kpiCard}>
    <div className={classes.kpiIcon}>{icon}</div>
    <div className={classes.kpiText}>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text className={classes.kpiValue} fw={700}>
        {value}
      </Text>
    </div>
  </div>
);

const PanelHeader = ({
  title,
  subtitle,
}: {
  subtitle?: ReactNode;
  title: ReactNode;
}) => (
  <div className={classes.panelHeader}>
    <Text fw={700}>{title}</Text>
    {subtitle && (
      <Text c="dimmed" size="sm">
        {subtitle}
      </Text>
    )}
  </div>
);

const VisitTrendChart = ({
  title,
  buckets,
  emptyLabel,
}: {
  title: string;
  buckets: { date: string; visits: number }[];
  emptyLabel: string;
}) => {
  const maxVisits = Math.max(...buckets.map((bucket) => bucket.visits), 1);

  return (
    <section className={`${classes.analyticsPanel} ${classes.trendPanel}`}>
      <PanelHeader
        subtitle={buckets.length > 0 ? `${buckets.length} days` : emptyLabel}
        title={title}
      />
      {buckets.length === 0 ? (
        <Center className={classes.emptyAnalyticsState}>{emptyLabel}</Center>
      ) : (
        <div className={classes.trendBars}>
          {buckets.map((bucket) => {
            const height = Math.max((bucket.visits / maxVisits) * 100, 8);
            return (
              <div className={classes.trendBarItem} key={bucket.date}>
                <Text c="dimmed" fw={600} size="xs">
                  {bucket.visits}
                </Text>
                <div className={classes.trendBarColumn}>
                  <div
                    className={classes.trendBar}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <Text className={classes.trendBarLabel} size="xs">
                  {bucket.date}
                </Text>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const DistributionPanel = ({
  title,
  buckets,
  emptyLabel,
  className,
}: {
  title: string;
  buckets: ShortLinkStatsBucket[];
  emptyLabel: string;
  className?: string;
}) => {
  const maxVisits = Math.max(...buckets.map((bucket) => bucket.visits), 1);

  return (
    <section className={`${classes.analyticsPanel} ${className ?? ""}`}>
      <PanelHeader
        subtitle={buckets.length > 0 ? `${buckets.length} groups` : emptyLabel}
        title={title}
      />
      {buckets.length === 0 ? (
        <Center className={classes.emptyAnalyticsState}>{emptyLabel}</Center>
      ) : (
        <div className={classes.distributionList}>
          {buckets.map((bucket) => (
            <div className={classes.distributionRow} key={bucket.label}>
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Text className={classes.distributionLabel} lineClamp={2}>
                  {bucket.label || "-"}
                </Text>
                <Text fw={700} size="sm">
                  {bucket.visits}
                </Text>
              </Group>
              <div className={classes.distributionTrack}>
                <div
                  className={classes.distributionFill}
                  style={{
                    width: `${Math.max((bucket.visits / maxVisits) * 100, 4)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const RecentVisitsTable = ({
  visits,
  emptyLabel,
}: {
  visits: ShortLinkStats["recentVisits"];
  emptyLabel: string;
}) => (
  <section className={classes.recentVisitsPanel}>
    <PanelHeader
      subtitle={`${visits.length} records`}
      title={<FormattedMessage id="account.shortLinks.stats.recent" />}
    />
    {visits.length === 0 ? (
      <Center className={classes.emptyAnalyticsState}>{emptyLabel}</Center>
    ) : (
      <div
        className={`${tableClasses.tablePanel} ${classes.recentVisitsTablePanel}`}
      >
        <Table className={`${tableClasses.table} ${classes.recentVisitsTable}`}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>
                <FormattedMessage id="account.shortLinks.stats.visitTime" />
              </Table.Th>
              <Table.Th>
                <FormattedMessage id="account.shortLinks.stats.referer" />
              </Table.Th>
              <Table.Th>
                <FormattedMessage id="account.shortLinks.stats.userAgent" />
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visits.map((visit) => (
              <Table.Tr className={tableClasses.tableRow} key={visit.id}>
                <Table.Td>
                  <Text size="sm">{formatDateTime(visit.createdAt)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text c="dimmed" lineClamp={2} size="sm">
                    {visit.referer || "-"}
                  </Text>
                </Table.Td>
                <Table.Td className={classes.userAgentCell}>
                  <Text lineClamp={2} size="sm">
                    {visit.userAgent || "-"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    )}
  </section>
);

const ShortLinkDetailPage = () => {
  const t = useTranslate();
  const router = useRouter();
  const clipboard = useClipboard();
  const modals = useModals();
  const [shortLink, setShortLink] = useState<ShortLink>();
  const [stats, setStats] = useState<ShortLinkStats>();
  const [isEditOpen, { open: openEdit, close: closeEdit }] =
    useDisclosure(false);
  const [isLoading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [accessControl, setAccessControl] = useState<AccessControl>({});
  const [removePassword, setRemovePassword] = useState(false);
  const editForm = useForm({
    initialValues: {
      targetType: "URL" as ShortLinkTargetType,
      targetUrl: "",
      title: "",
      isActive: true,
    },
  });

  const code = useStaticRouteParam("code", 1);

  const publicLink = (shortCode: string) => {
    if (typeof window === "undefined") return `/s/${shortCode}`;
    return `${window.location.origin}/s/${shortCode}`;
  };

  const applyLinkToForm = (
    link: ShortLink | undefined,
    linkStats: ShortLinkStats,
  ) => {
    setAccessControl({
      expiresAt: link?.accessControl?.expiresAt
        ? new Date(link.accessControl.expiresAt).toISOString().slice(0, 16)
        : undefined,
      maxViews: link?.accessControl?.maxViews,
      allowAnonymous: link?.accessControl?.allowAnonymous,
      oneTime: link?.accessControl?.oneTime,
    });
    setRemovePassword(false);
    editForm.setValues({
      targetType: link?.targetType ?? linkStats.targetType,
      targetUrl: link?.targetUrl ?? linkStats.targetUrl,
      title: link?.title ?? "",
      isActive: link?.isActive ?? true,
    });
  };

  const loadDetail = (shortCode: string) => {
    setLoading(true);
    Promise.all([shortLinkService.list(), shortLinkService.stats(shortCode)])
      .then(([links, nextStats]) => {
        const link = links.find((item) => item.code === shortCode);
        setShortLink(link);
        setStats(nextStats);
        applyLinkToForm(link, nextStats);
      })
      .catch(toast.axiosError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (code) loadDetail(code);
  }, [code]);

  const copyLink = () => {
    if (!code) return;
    clipboard.copy(publicLink(code));
    toast.success(t("common.notify.copied-link"));
  };

  const updateSelectedLink = editForm.onSubmit((values) => {
    if (!code) return;
    setIsUpdating(true);
    shortLinkService
      .update(code, {
        targetType: values.targetType,
        targetUrl: values.targetUrl,
        title: values.title.trim() || undefined,
        isActive: values.isActive,
        accessControl: {
          ...toAccessControlPayload(accessControl),
          ...(removePassword ? { password: "" } : {}),
        },
      })
      .then((updated) => {
        return Promise.all([shortLinkService.list(), shortLinkService.stats(updated.code)]).then(([links, nextStats]) => {
          const refreshed = links.find((link) => link.code === updated.code);
          setShortLink(refreshed);
          setStats(nextStats);
          applyLinkToForm(refreshed, nextStats);
        });
      })
      .then(() => {
        closeEdit();
        toast.success(t("account.shortLinks.notify.updated"));
      })
      .catch(toast.axiosError)
      .finally(() => setIsUpdating(false));
  });

  const confirmRemove = () => {
    if (!code) return;
    modals.openConfirmModal({
      title: t("account.shortLinks.modal.delete.title"),
      children: (
        <Text size="sm">
          <FormattedMessage
            id="account.shortLinks.modal.delete.description"
            values={{ code }}
          />
        </Text>
      ),
      confirmProps: { color: "red" },
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: () => {
        shortLinkService
          .remove(code)
          .then(() => {
            toast.success(t("account.shortLinks.notify.deleted"));
            void router.push("/short-links");
          })
          .catch(toast.axiosError);
      },
    });
  };

  if (!code || isLoading) return <CenterLoader />;

  if (!stats) {
    return (
      <>
        <Meta title={t("account.shortLinks.title")} />
        <Center py="xl">
          <Stack align="center">
            <Text c="dimmed">
              <FormattedMessage id="account.shortLinks.stats.empty" />
            </Text>
            <Button component={Link} href="/short-links" variant="light">
              <FormattedMessage id="account.shortLinks.title" />
            </Button>
          </Stack>
        </Center>
      </>
    );
  }

  const pageTitle = shortLink?.title || stats.targetUrl;

  return (
    <>
      <Meta title={`${pageTitle} - ${t("account.shortLinks.title")}`} />
      <Modal
        centered
        opened={isEditOpen}
        size="lg"
        title={<FormattedMessage id="account.shortLinks.edit.title" />}
        onClose={closeEdit}
      >
        <form onSubmit={updateSelectedLink}>
          <Stack className={modalClasses.modalStack}>
            <section className={modalClasses.section}>
              <div className={modalClasses.sectionHeader}>
                <Text className={modalClasses.sectionTitle}>
                  {t("account.shortLinks.form.target")}
                </Text>
              </div>
              <Stack gap="sm">
                <SegmentedControl
                  value={editForm.values.targetType}
                  onChange={(value) =>
                    editForm.setFieldValue(
                      "targetType",
                      value as ShortLinkTargetType,
                    )
                  }
                  data={[
                    {
                      value: "URL",
                      label: t("account.shortLinks.type.url"),
                    },
                    {
                      value: "INTERNAL_PATH",
                      label: t("account.shortLinks.type.internal"),
                    },
                  ]}
                />
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label={t("account.shortLinks.form.target")}
                    {...editForm.getInputProps("targetUrl")}
                  />
                  <TextInput
                    label={t("account.shortLinks.form.title")}
                    {...editForm.getInputProps("title")}
                  />
                </SimpleGrid>
              </Stack>
            </section>

            <section className={modalClasses.section}>
              <Radio.Group
                label={t("account.shortLinks.table.status")}
                name="short-link-status"
                value={editForm.values.isActive ? "active" : "disabled"}
                onChange={(value) =>
                  editForm.setFieldValue("isActive", value === "active")
                }
              >
                <Group className={modalClasses.radioOptions}>
                  <Radio
                    label={t("account.shortLinks.status.active")}
                    value="active"
                  />
                  <Radio
                    label={t("account.shortLinks.status.disabled")}
                    value="disabled"
                  />
                </Group>
              </Radio.Group>
            </section>

            <section className={modalClasses.section}>
              <AccessControlForm
                value={accessControl}
                onChange={setAccessControl}
                fields={["password", "expiresAt", "maxViews", "allowAnonymous", "oneTime"]}
              />
              {shortLink?.accessControl?.passwordProtected && (
                <Stack gap="xs" mt="sm">
                  <Text size="sm">{t("account.shortLinks.password-active")}</Text>
                  <Button type="button" variant="light" color={removePassword ? "gray" : "red"} onClick={() => setRemovePassword((current) => !current)}>
                    {t(removePassword ? "account.shortLinks.keep-password" : "account.shortLinks.remove-password")}
                  </Button>
                </Stack>
              )}
              <Text size="xs" c="dimmed" mt="sm">{t("account.shortLinks.access-scope")}</Text>
            </section>

            <Group className={modalClasses.footer}>
              <Button
                leftSection={<TbDeviceFloppy />}
                loading={isUpdating}
                type="submit"
              >
                <FormattedMessage id="common.button.save" />
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <section className={classes.statsHeaderPanel}>
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <div className={classes.statsHeaderContent}>
            <Button
              component={Link}
              href="/short-links"
              leftSection={<TbArrowLeft />}
              mb="sm"
              variant="subtle"
            >
              <FormattedMessage id="account.shortLinks.title" />
            </Button>
            <Title order={3}>{pageTitle}</Title>
            <Group className={classes.shortLinkMeta} gap="xs" wrap="nowrap">
              <Badge
                className={classes.metaBadge}
                color="gray"
                leftSection={<TbLink />}
                variant="light"
              >
                /s/{code}
              </Badge>
              <Badge
                className={classes.metaBadge}
                color={(shortLink?.isActive ?? true) ? "green" : "gray"}
                variant={(shortLink?.isActive ?? true) ? "light" : "outline"}
              >
                {(shortLink?.isActive ?? true)
                  ? t("account.shortLinks.status.active")
                  : t("account.shortLinks.status.disabled")}
              </Badge>
              <Anchor
                className={classes.targetUrl}
                href={stats.targetUrl}
                target={stats.targetType === "URL" ? "_blank" : undefined}
                rel="noreferrer"
              >
                {stats.targetUrl}
              </Anchor>
            </Group>
          </div>
          <Group className={classes.statsHeaderActions} gap={4} wrap="nowrap">
            <HoverTip label={t("account.shortLinks.edit.title")}>
              <ActionIcon
                aria-label={t("account.shortLinks.edit.title")}
                color="gray"
                variant="subtle"
                onClick={openEdit}
              >
                <TbEdit />
              </ActionIcon>
            </HoverTip>
            <HoverTip label={t("common.button.copy-link")}>
              <ActionIcon
                aria-label={t("common.button.copy-link")}
                color="gray"
                variant="subtle"
                onClick={copyLink}
              >
                <TbCopy />
              </ActionIcon>
            </HoverTip>
            <HoverTip label={t("common.text.navigate-to-link")}>
              <ActionIcon
                aria-label={t("common.text.navigate-to-link")}
                color="gray"
                component={Link}
                href={`/s/${code}`}
                target="_blank"
                rel="noreferrer"
                variant="subtle"
              >
                <TbExternalLink />
              </ActionIcon>
            </HoverTip>
            <HoverTip label={t("common.button.delete")}>
              <ActionIcon
                aria-label={t("common.button.delete")}
                color="red"
                variant="subtle"
                onClick={confirmRemove}
              >
                <TbTrash />
              </ActionIcon>
            </HoverTip>
          </Group>
        </Group>
      </section>

      <main className={classes.shortLinkDetails}>
        <div className={classes.statsOverview}>
          <KpiCard
            icon={<TbChartBar />}
            label={t("account.shortLinks.stats.totalVisits")}
            value={stats.totalVisits}
          />
          <KpiCard
            icon={<TbUser />}
            label={t("account.shortLinks.stats.uniqueVisitors")}
            value={stats.uniqueVisitors}
          />
          <KpiCard
            icon={<TbClock />}
            label={t("account.shortLinks.stats.lastVisit")}
            value={formatDateTime(stats.lastVisitedAt)}
          />
          <KpiCard
            icon={<TbWorld />}
            label={t("account.shortLinks.form.target")}
            value={
              stats.targetType === "URL"
                ? t("account.shortLinks.type.url")
                : t("account.shortLinks.type.internal")
            }
          />
        </div>

        <div className={classes.statsDashboardGrid}>
          <VisitTrendChart
            buckets={stats.visitsByDay}
            emptyLabel={t("account.shortLinks.stats.noVisits")}
            title={t("account.shortLinks.stats.byDay")}
          />
          <DistributionPanel
            buckets={stats.visitsByReferer}
            emptyLabel={t("account.shortLinks.stats.noVisits")}
            title={t("account.shortLinks.stats.byReferer")}
          />
          <DistributionPanel
            buckets={stats.visitsByUserAgent}
            className={classes.userAgentPanel}
            emptyLabel={t("account.shortLinks.stats.noVisits")}
            title={t("account.shortLinks.stats.byUserAgent")}
          />
        </div>

        <RecentVisitsTable
          emptyLabel={t("account.shortLinks.stats.noVisits")}
          visits={stats.recentVisits}
        />
      </main>
    </>
  );
};

export default ShortLinkDetailPage;
