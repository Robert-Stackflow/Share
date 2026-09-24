import { Check, Info, Link2, Plus, Share2, Trash2, X } from "lucide-react";
import {
  Accordion,
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import showReverseShareLinkModal from "../../components/account/showReverseShareLinkModal";
import showShareLinkModal from "../../components/account/showShareLinkModal";
import AssetActionMenu from "../../components/asset/AssetActionMenu";
import Meta from "../../components/Meta";
import CenterLoader from "../../components/core/CenterLoader";
import { HoverTip } from "../../components/core/HoverTip";
import tableClasses from "../../components/core/DataTable.module.css";
import showCreateReverseShareModal from "../../components/share/modals/showCreateReverseShareModal";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import inboxService from "../../services/inbox.service";
import { Asset } from "../../types/asset.type";
import { InboxSubmission } from "../../types/inbox.type";
import { MyReverseShare } from "../../types/share.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";

type PendingSubmissionRow = {
  inbox: MyReverseShare;
  submission: InboxSubmission;
};

const getSubmissionAssetLabel = (asset: Asset) => {
  if (asset.type === "FILE") return asset.name || asset.id;
  if (asset.type === "LINK") return asset.url || asset.id;
  return asset.content || asset.id;
};

const MyShares = () => {
  const modals = useModals();
  const clipboard = useClipboard();
  const t = useTranslate();

  const config = useConfig();
  const appUrl = config.get("general.appUrl");
  const defaultAppUrl = config.get("general.appUrl", true);

  const [reverseShares, setReverseShares] = useState<MyReverseShare[]>();
  const [submissionsByInbox, setSubmissionsByInbox] = useState<
    Record<string, InboxSubmission[]>
  >({});
  const [submissionAction, setSubmissionAction] = useState<string>();

  const publicBaseUrl =
    appUrl !== defaultAppUrl
      ? appUrl
      : typeof window !== "undefined"
        ? window.location.origin
        : defaultAppUrl;

  const getInboxLink = (token: string) => `${publicBaseUrl}/inbox/${token}`;

  const loadSubmissions = async (shares: MyReverseShare[]) => {
    const entries = await Promise.all(
      shares.map(async (share) => {
        const submissions = await inboxService.listSubmissions(share.id);
        return [share.id, submissions] as const;
      }),
    );

    setSubmissionsByInbox(Object.fromEntries(entries));
  };

  const getReverseShares = async () => {
    try {
      const shares = await inboxService.list();
      setReverseShares(shares);
      await loadSubmissions(shares);
    } catch (error) {
      toast.axiosError(error);
    }
  };

  useEffect(() => {
    void getReverseShares();
  }, []);

  const pendingSubmissions = useMemo<PendingSubmissionRow[]>(
    () =>
      (reverseShares ?? []).flatMap((inbox) =>
        (submissionsByInbox[inbox.id] ?? [])
          .filter((submission) => submission.status === "PENDING")
          .map((submission) => ({ inbox, submission })),
      ),
    [reverseShares, submissionsByInbox],
  );

  const acceptSubmission = async (
    submission: InboxSubmission,
    createShare: boolean,
  ) => {
    setSubmissionAction(
      `${submission.id}:${createShare ? "accept-share" : "accept-assets"}`,
    );

    try {
      if (createShare) {
        await inboxService.acceptSubmission(submission.id, true);
        toast.success(
          t("account.reverseShares.submissions.notify.acceptedShare"),
        );
      } else {
        await inboxService.acceptSubmission(submission.id, false);
        toast.success(
          t("account.reverseShares.submissions.notify.acceptedAssets"),
        );
      }
      await getReverseShares();
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSubmissionAction(undefined);
    }
  };

  const rejectSubmission = (submission: InboxSubmission) => {
    modals.openConfirmModal({
      title: t("account.reverseShares.submissions.reject.title"),
      children: (
        <Text size="sm">
          <FormattedMessage id="account.reverseShares.submissions.reject.description" />
        </Text>
      ),
      confirmProps: {
        color: "red",
      },
      labels: {
        confirm: t("account.reverseShares.submissions.reject"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: async () => {
        setSubmissionAction(`${submission.id}:reject`);
        try {
          await inboxService.rejectSubmission(submission.id);
          toast.success(t("account.reverseShares.submissions.notify.rejected"));
          await getReverseShares();
        } catch (error) {
          toast.axiosError(error);
        } finally {
          setSubmissionAction(undefined);
        }
      },
    });
  };

  if (!reverseShares) return <CenterLoader />;
  return (
    <>
      <Meta title={t("account.reverseShares.title")} />
      <Group justify="space-between" align="baseline" mb={20}>
        <Group align="center" gap={3} mb={30}>
          <Title order={3}>
            <FormattedMessage id="account.reverseShares.title" />
          </Title>
          <HoverTip label={t("account.reverseShares.description")}>
            <ActionIcon color="gray" variant="subtle">
              <Info />
            </ActionIcon>
          </HoverTip>
        </Group>
        <Button
          onClick={() =>
            showCreateReverseShareModal(
              modals,
              config.get("smtp.enabled"),
              config.get("share.maxExpiration"),
              config.get("share.defaultExpiration"),
              appUrl,
              defaultAppUrl,
              getReverseShares,
            )
          }
          leftSection={<Plus size={20} />}
        >
          <FormattedMessage id="common.button.create" />
        </Button>
      </Group>
      {reverseShares.length == 0 ? (
        <Center style={{ height: "70vh" }}>
          <Stack align="center" gap={10}>
            <Title order={3}>
              <FormattedMessage id="account.reverseShares.title.empty" />
            </Title>
            <Text>
              <FormattedMessage id="account.reverseShares.description.empty" />
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="xl">
          <Box className={tableClasses.tablePanel}>
            <Stack gap="md" p="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <Title order={4}>
                    <FormattedMessage id="account.reverseShares.submissions.pending" />
                  </Title>
                  <Badge color="gray" variant="light">
                    {pendingSubmissions.length}
                  </Badge>
                </Group>
              </Group>
              {pendingSubmissions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  <FormattedMessage id="account.reverseShares.submissions.empty" />
                </Text>
              ) : (
                <Table className={tableClasses.table}>
                  <thead>
                    <tr>
                      <th>
                        <FormattedMessage id="account.reverseShares.title" />
                      </th>
                      <th>
                        <FormattedMessage id="account.reverseShares.submissions.message" />
                      </th>
                      <th>
                        <FormattedMessage id="account.reverseShares.submissions.assets" />
                      </th>
                      <th>
                        <FormattedMessage id="account.reverseShares.table.expires" />
                      </th>
                      <th className={tableClasses.actionCell}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSubmissions.map(({ inbox, submission }) => (
                      <tr className={tableClasses.tableRow} key={submission.id}>
                        <td className={tableClasses.valueCell}>
                          <Text size="sm" truncate>
                            {inbox.token}
                          </Text>
                        </td>
                        <td className={tableClasses.valueCell}>
                          {submission.message ? (
                            <Text size="sm" lineClamp={2}>
                              {submission.message}
                            </Text>
                          ) : (
                            <Text c="dimmed" size="sm">
                              <FormattedMessage id="account.reverseShares.submissions.noMessage" />
                            </Text>
                          )}
                        </td>
                        <td className={tableClasses.valueCell}>
                          <Stack gap={4}>
                            {submission.assets.map((asset) => (
                              <Group
                                key={asset.id}
                                gap="xs"
                                justify="space-between"
                                wrap="nowrap"
                              >
                                <Text maw={220} size="sm" truncate>
                                  {getSubmissionAssetLabel(asset)}
                                </Text>
                                <AssetActionMenu asset={asset} readOnly />
                              </Group>
                            ))}
                          </Stack>
                        </td>
                        <td>{moment(submission.createdAt).format("LLL")}</td>
                        <td className={tableClasses.actionCell}>
                          <Group justify="flex-end" gap={6} wrap="nowrap">
                            <Button
                              color="gray"
                              leftSection={<Check />}
                              loading={
                                submissionAction ===
                                `${submission.id}:accept-assets`
                              }
                              size="xs"
                              variant="default"
                              onClick={() =>
                                void acceptSubmission(submission, false)
                              }
                            >
                              <FormattedMessage id="account.reverseShares.submissions.acceptAssets" />
                            </Button>
                            <Button
                              color="gray"
                              leftSection={<Share2 />}
                              loading={
                                submissionAction ===
                                `${submission.id}:accept-share`
                              }
                              size="xs"
                              variant="default"
                              onClick={() =>
                                void acceptSubmission(submission, true)
                              }
                            >
                              <FormattedMessage id="account.reverseShares.submissions.acceptShare" />
                            </Button>
                            <Button
                              color="red"
                              leftSection={<X />}
                              loading={
                                submissionAction === `${submission.id}:reject`
                              }
                              size="xs"
                              variant="subtle"
                              onClick={() => rejectSubmission(submission)}
                            >
                              <FormattedMessage id="account.reverseShares.submissions.reject" />
                            </Button>
                          </Group>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Stack>
          </Box>

          <Box className={tableClasses.tablePanel}>
            <Table className={tableClasses.table}>
              <thead>
                <tr>
                  <th>
                    <FormattedMessage id="account.reverseShares.table.shares" />
                  </th>
                  <th>
                    <FormattedMessage id="account.reverseShares.table.remaining" />
                  </th>
                  <th>
                    <FormattedMessage id="account.reverseShares.table.max-size" />
                  </th>
                  <th>
                    <FormattedMessage id="account.reverseShares.table.expires" />
                  </th>
                  <th className={tableClasses.actionCell}></th>
                </tr>
              </thead>
              <tbody>
                {reverseShares.map((reverseShare) => (
                  <tr className={tableClasses.tableRow} key={reverseShare.id}>
                    <td className={tableClasses.valueCell}>
                      {reverseShare.shares.length == 0 ? (
                        <Text c="dimmed" size="sm">
                          <FormattedMessage id="account.reverseShares.table.no-shares" />
                        </Text>
                      ) : (
                        <Accordion>
                          <Accordion.Item
                            value="customization"
                            style={{ borderBottom: "none" }}
                          >
                            <Accordion.Control p={0}>
                              <Text size="sm">
                                {reverseShare.shares.length == 1
                                  ? `1 ${t(
                                      "account.reverseShares.table.count.singular",
                                    )}`
                                  : `${reverseShare.shares.length} ${t(
                                      "account.reverseShares.table.count.plural",
                                    )}`}
                              </Text>
                            </Accordion.Control>
                            <Accordion.Panel>
                              {reverseShare.shares.map((share) => (
                                <Group key={share.id} mb={4}>
                                  <Anchor
                                    href={`${publicBaseUrl}/share/${share.id}`}
                                    target="_blank"
                                  >
                                    <Text maw={120} truncate>
                                      {share.id}
                                    </Text>
                                  </Anchor>
                                  <HoverTip
                                    label={t("common.button.copy-link")}
                                  >
                                    <ActionIcon
                                      color="gray"
                                      variant="subtle"
                                      size={25}
                                      onClick={() => {
                                        if (window.isSecureContext) {
                                          clipboard.copy(
                                            `${publicBaseUrl}/s/${share.id}`,
                                          );
                                          toast.success(
                                            t("common.notify.copied-link"),
                                          );
                                        } else {
                                          showShareLinkModal(
                                            modals,
                                            share.id,
                                            appUrl,
                                            defaultAppUrl,
                                          );
                                        }
                                      }}
                                    >
                                      <Link2 />
                                    </ActionIcon>
                                  </HoverTip>
                                </Group>
                              ))}
                            </Accordion.Panel>
                          </Accordion.Item>
                        </Accordion>
                      )}
                    </td>
                    <td>{reverseShare.remainingUses}</td>
                    <td>
                      {byteToHumanSizeString(
                        parseInt(reverseShare.maxShareSize),
                      )}
                    </td>
                    <td>
                      {moment(reverseShare.shareExpiration).unix() === 0
                        ? "Never"
                        : moment(reverseShare.shareExpiration).format("LLL")}
                    </td>
                    <td className={tableClasses.actionCell}>
                      <Group
                        className={tableClasses.actions}
                        justify="flex-end"
                        wrap="nowrap"
                      >
                        <HoverTip label={t("common.button.copy-link")}>
                          <ActionIcon
                            color="gray"
                            variant="subtle"
                            size={25}
                            onClick={() => {
                              if (window.isSecureContext) {
                                clipboard.copy(
                                  getInboxLink(reverseShare.token),
                                );
                                toast.success(t("common.notify.copied-link"));
                              } else {
                                showReverseShareLinkModal(
                                  modals,
                                  reverseShare.token,
                                  appUrl,
                                  defaultAppUrl,
                                );
                              }
                            }}
                          >
                            <Link2 />
                          </ActionIcon>
                        </HoverTip>
                        <HoverTip label={t("common.button.delete")}>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            size={25}
                            onClick={() => {
                              modals.openConfirmModal({
                                title: t(
                                  "account.reverseShares.modal.delete.title",
                                ),
                                children: (
                                  <Text size="sm">
                                    <FormattedMessage id="account.reverseShares.modal.delete.description" />
                                  </Text>
                                ),
                                confirmProps: {
                                  color: "red",
                                },
                                labels: {
                                  confirm: t("common.button.delete"),
                                  cancel: t("common.button.cancel"),
                                },
                                onConfirm: async () => {
                                  await inboxService.remove(reverseShare.id);
                                  setReverseShares(
                                    reverseShares.filter(
                                      (item) => item.id !== reverseShare.id,
                                    ),
                                  );
                                  setSubmissionsByInbox((current) => {
                                    const next = { ...current };
                                    delete next[reverseShare.id];
                                    return next;
                                  });
                                },
                              });
                            }}
                          >
                            <Trash2 />
                          </ActionIcon>
                        </HoverTip>
                      </Group>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Box>
        </Stack>
      )}
    </>
  );
};

export default MyShares;
