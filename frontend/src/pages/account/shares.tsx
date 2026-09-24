import { Info, Link2, LockKeyhole, PencilLine, Trash2 } from "lucide-react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Space,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import moment from "moment";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import showShareInformationsModal from "../../components/share/showShareInformationsModal";
import showShareLinkModal from "../../components/account/showShareLinkModal";
import { HoverTip } from "../../components/core/HoverTip";
import CenterLoader from "../../components/core/CenterLoader";
import tableClasses from "../../components/core/DataTable.module.css";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import { MyShare } from "../../types/share.type";
import toast from "../../utils/toast.util";

const MyShares = () => {
  const modals = useModals();
  const clipboard = useClipboard();
  const config = useConfig();
  const t = useTranslate();

  const [shares, setShares] = useState<MyShare[]>();

  useEffect(() => {
    shareService.getMyShares().then((shares) => setShares(shares));
  }, []);

  if (!shares) return <CenterLoader />;

  const getStatus = (share: MyShare) => {
    const expiration = share.effectiveExpiration ?? share.expiration;
    if (
      moment(expiration).unix() !== 0 &&
      moment(expiration).isSameOrBefore()
    ) {
      return "expired";
    }
    if (share.security?.maxViews && share.views >= share.security.maxViews) {
      return "exhausted";
    }
    return "active";
  };

  return (
    <>
      <Meta title={t("account.shares.title")} />
      <Title mb={30} order={3}>
        <FormattedMessage id="account.shares.title" />
      </Title>
      {shares.length == 0 ? (
        <Center style={{ height: "70vh" }}>
          <Stack align="center" gap={10}>
            <Title order={3}>
              <FormattedMessage id="account.shares.title.empty" />
            </Title>
            <Text>
              <FormattedMessage id="account.shares.description.empty" />
            </Text>
            <Space h={5} />
            <Button component={Link} href="/upload" variant="light">
              <FormattedMessage id="account.shares.button.create" />
            </Button>
          </Stack>
        </Center>
      ) : (
        <Box className={tableClasses.tablePanel}>
          <Table className={tableClasses.table}>
            <thead>
              <tr>
                <th>
                  <FormattedMessage id="account.shares.table.id" />
                </th>
                <th>
                  <FormattedMessage id="account.shares.table.name" />
                </th>
                <th>{t("account.shares.table.status")}</th>
                <th>
                  <FormattedMessage id="account.shares.table.visitors" />
                </th>
                <th>
                  <FormattedMessage id="account.shares.table.expiresAt" />
                </th>
                <th className={tableClasses.actionCell}></th>
              </tr>
            </thead>
            <tbody>
              {shares.map((share) => (
                <tr className={tableClasses.tableRow} key={share.id}>
                  <td>
                    <Group gap="xs">
                      {share.id}{" "}
                      {share.security?.passwordProtected && (
                        <LockKeyhole
                          color="orange"
                          aria-label={t(
                            "account.shares.table.password-protected",
                          )}
                        />
                      )}
                    </Group>
                  </td>
                  <td>{share.name || "—"}</td>
                  <td>
                    <Badge
                      color={getStatus(share) === "active" ? "green" : "gray"}
                      variant="light"
                    >
                      {t(`account.shares.status.${getStatus(share)}`)}
                    </Badge>
                  </td>
                  <td>
                    {share.security?.maxViews ? (
                      <FormattedMessage
                        id="account.shares.table.visitor-count"
                        values={{
                          count: share.views,
                          max: share.security.maxViews,
                        }}
                      />
                    ) : (
                      share.views
                    )}
                  </td>
                  <td>
                    {moment(
                      share.effectiveExpiration ?? share.expiration,
                    ).unix() === 0 ? (
                      <FormattedMessage id="account.shares.table.expiry-never" />
                    ) : (
                      moment(
                        share.effectiveExpiration ?? share.expiration,
                      ).format("LLL")
                    )}
                  </td>
                  <td className={tableClasses.actionCell}>
                    <Group
                      className={tableClasses.actions}
                      justify="flex-end"
                      wrap="nowrap"
                    >
                      <HoverTip label={t("account.shares.button.edit")}>
                        <ActionIcon
                          color="gray"
                          component={Link}
                          href={`/share/${share.id}/edit`}
                          variant="subtle"
                          size={25}
                        >
                          <PencilLine />
                        </ActionIcon>
                      </HoverTip>
                      <HoverTip label={t("common.button.info")}>
                        <ActionIcon
                          color="gray"
                          variant="subtle"
                          size={25}
                          onClick={() => {
                            showShareInformationsModal(
                              modals,
                              share,
                              parseInt(config.get("share.maxSize")),
                              config.get("general.appUrl"),
                              config.get("general.appUrl", true),
                              config.get("share.maxExpiration"),
                              (updatedShare) =>
                                setShares(
                                  shares.map((item) =>
                                    item.id === updatedShare.id
                                      ? updatedShare
                                      : item,
                                  ),
                                ),
                            );
                          }}
                        >
                          <Info />
                        </ActionIcon>
                      </HoverTip>
                      <HoverTip label={t("common.button.copy-link")}>
                        <ActionIcon
                          color="gray"
                          disabled={getStatus(share) !== "active"}
                          variant="subtle"
                          size={25}
                          onClick={() => {
                            if (window.isSecureContext) {
                              clipboard.copy(
                                `${config.get("general.appUrl") !== config.get("general.appUrl", true) ? config.get("general.appUrl") : window.location.origin}/s/${share.id}`,
                              );
                              toast.success(t("common.notify.copied-link"));
                            } else {
                              showShareLinkModal(
                                modals,
                                share.id,
                                config.get("general.appUrl"),
                                config.get("general.appUrl", true),
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
                              title: t("account.shares.modal.delete.title", {
                                share: share.id,
                              }),
                              children: (
                                <Text size="sm">
                                  <FormattedMessage id="account.shares.modal.delete.description" />
                                </Text>
                              ),
                              confirmProps: {
                                color: "red",
                              },
                              labels: {
                                confirm: t("common.button.delete"),
                                cancel: t("common.button.cancel"),
                              },
                              onConfirm: () => {
                                shareService.expire(share.id);
                                setShares(
                                  shares.filter((item) => item.id !== share.id),
                                );
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
      )}
    </>
  );
};

export default MyShares;
