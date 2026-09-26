import {
  Check,
  ChevronDown,
  Info,
  Link2,
  Plus,
  Send,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import {
  Accordion,
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import FormattedMessage from "../../components/core/FormattedMessage";
import showReverseShareLinkModal from "../../components/account/showReverseShareLinkModal";
import showShareLinkModal from "../../components/account/showShareLinkModal";
import AssetActionMenu from "../../components/asset/AssetActionMenu";
import Meta from "../../components/Meta";
import CenterLoader from "../../components/core/CenterLoader";
import EmptyState from "../../components/core/EmptyState";
import { HoverTip } from "../../components/core/HoverTip";
import tableClasses from "../../components/core/DataTable.module.css";
import showCreateReverseShareModal from "../../components/share/modals/showCreateReverseShareModal";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import inboxService from "../../services/inbox.service";
import roomService from "../../services/room.service";
import { Asset } from "../../types/asset.type";
import { InboxSubmission } from "../../types/inbox.type";
import { Room } from "../../types/room.type";
import { MyReverseShare } from "../../types/share.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import classes from "./reverseShares.module.css";

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
  const [roomSubmission, setRoomSubmission] = useState<InboxSubmission | null>(
    null,
  );
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  const publicBaseUrl =
    appUrl !== defaultAppUrl
      ? appUrl
      : typeof window !== "undefined"
        ? window.location.origin
        : defaultAppUrl;

  const getInboxLink = (token: string) => `${publicBaseUrl}/inbox/${token}`;

  const getInboxStatus = (inbox: MyReverseShare) => {
    if (moment(inbox.shareExpiration).isSameOrBefore()) return "expired";
    if (inbox.remainingUses <= 0) return "exhausted";
    return "active";
  };

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

  const openRoomApproval = async (submission: InboxSubmission) => {
    setRoomSubmission(submission);
    setRooms([]);
    setSelectedRoomId(null);
    setIsLoadingRooms(true);
    try {
      setRooms(await roomService.list());
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const acceptIntoRoom = async () => {
    if (!roomSubmission || !selectedRoomId) return;
    setSubmissionAction(`${roomSubmission.id}:accept-room`);
    try {
      await inboxService.acceptSubmission(
        roomSubmission.id,
        false,
        selectedRoomId,
      );
      toast.success(t("account.reverseShares.submissions.notify.acceptedRoom"));
      setRoomSubmission(null);
      await getReverseShares();
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSubmissionAction(undefined);
    }
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
            <ActionIcon
              aria-label={t("account.reverseShares.description")}
              color="gray"
              variant="subtle"
            >
              <Info />
            </ActionIcon>
          </HoverTip>
        </Group>
        <Button
          onClick={() =>
            showCreateReverseShareModal(
              modals,
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
        <EmptyState
          icon={<Send size={22} />}
          title={<FormattedMessage id="account.reverseShares.title.empty" />}
          description={
            <FormattedMessage id="account.reverseShares.description.empty" />
          }
        />
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
                <EmptyState
                  compact
                  embedded
                  icon={<Send size={20} />}
                  title={
                    <FormattedMessage id="account.reverseShares.submissions.empty" />
                  }
                />
              ) : (
                <Table
                  className={`${tableClasses.table} ${classes.responsiveTable}`}
                >
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
                        <FormattedMessage id="account.reverseShares.submissions.submittedAt" />
                      </th>
                      <th className={tableClasses.actionCell}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSubmissions.map(({ inbox, submission }) => (
                      <tr className={tableClasses.tableRow} key={submission.id}>
                        <td className={tableClasses.valueCell}>
                          <Text size="sm" truncate>
                            {inbox.name ||
                              t("account.reverseShares.table.unnamed")}
                          </Text>
                        </td>
                        <td
                          className={tableClasses.valueCell}
                          data-label={t(
                            "account.reverseShares.submissions.message",
                          )}
                        >
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
                        <td
                          className={tableClasses.valueCell}
                          data-label={t(
                            "account.reverseShares.submissions.assets",
                          )}
                        >
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
                        <td
                          data-label={t(
                            "account.reverseShares.submissions.submittedAt",
                          )}
                        >
                          {moment(submission.createdAt).format("LLL")}
                        </td>
                        <td className={tableClasses.actionCell}>
                          <Group justify="flex-end" gap={6} wrap="nowrap">
                            <Menu withinPortal position="bottom-end">
                              <Menu.Target>
                                <Button
                                  color="gray"
                                  rightSection={<ChevronDown size={14} />}
                                  loading={submissionAction?.startsWith(
                                    `${submission.id}:accept`,
                                  )}
                                  size="xs"
                                  variant="default"
                                >
                                  {t(
                                    "account.reverseShares.submissions.approve",
                                  )}
                                </Button>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<Check />}
                                  onClick={() =>
                                    void acceptSubmission(submission, false)
                                  }
                                >
                                  {t(
                                    "account.reverseShares.submissions.acceptAssets",
                                  )}
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<Send />}
                                  onClick={() =>
                                    void openRoomApproval(submission)
                                  }
                                >
                                  {t(
                                    "account.reverseShares.submissions.acceptRoom",
                                  )}
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<Share2 />}
                                  onClick={() =>
                                    void acceptSubmission(submission, true)
                                  }
                                >
                                  {t(
                                    "account.reverseShares.submissions.acceptShare",
                                  )}
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
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
            <Table
              className={`${tableClasses.table} ${classes.responsiveTable}`}
            >
              <thead>
                <tr>
                  <th>
                    <FormattedMessage id="account.reverseShares.title" />
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
                      <Text fw={600} size="sm">
                        {reverseShare.name ||
                          t("account.reverseShares.table.unnamed")}
                      </Text>
                      <Badge
                        color={
                          getInboxStatus(reverseShare) === "active"
                            ? "green"
                            : "gray"
                        }
                        size="sm"
                        variant="light"
                      >
                        {t(
                          `account.reverseShares.status.${getInboxStatus(reverseShare)}`,
                        )}
                      </Badge>
                      {reverseShare.description && (
                        <Text c="dimmed" lineClamp={2} size="xs">
                          {reverseShare.description}
                        </Text>
                      )}
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
                    <td data-label={t("account.reverseShares.table.remaining")}>
                      {reverseShare.remainingUses}
                    </td>
                    <td data-label={t("account.reverseShares.table.max-size")}>
                      {byteToHumanSizeString(
                        parseInt(reverseShare.maxShareSize),
                      )}
                    </td>
                    <td data-label={t("account.reverseShares.table.expires")}>
                      {moment(reverseShare.shareExpiration).format("LLL")}
                    </td>
                    <td className={tableClasses.actionCell}>
                      <Group
                        className={tableClasses.actions}
                        justify="flex-end"
                        wrap="nowrap"
                      >
                        <HoverTip label={t("common.button.copy-link")}>
                          <ActionIcon
                            aria-label={t("common.button.copy-link")}
                            color="gray"
                            disabled={getInboxStatus(reverseShare) !== "active"}
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
                            aria-label={t("common.button.delete")}
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
      <Modal
        opened={Boolean(roomSubmission)}
        onClose={() => setRoomSubmission(null)}
        title={t("account.reverseShares.submissions.acceptRoom")}
      >
        <Stack>
          <Select
            data={rooms.map((room) => ({
              value: room.roomId,
              label:
                room.name ||
                (room.visibility === "PRIVATE"
                  ? t("room.private.title")
                  : room.roomId),
            }))}
            disabled={isLoadingRooms}
            label={t("account.assets.sendToRoom.select")}
            onChange={setSelectedRoomId}
            value={selectedRoomId}
          />
          {rooms.length === 0 && !isLoadingRooms && (
            <Text c="dimmed" size="sm">
              {t("account.assets.sendToRoom.empty")}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setRoomSubmission(null)}>
              {t("common.button.cancel")}
            </Button>
            <Button
              disabled={!selectedRoomId}
              loading={submissionAction === `${roomSubmission?.id}:accept-room`}
              onClick={() => void acceptIntoRoom()}
            >
              {t("account.reverseShares.submissions.acceptRoom")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default MyShares;
