import { Info, Link2, Trash2 } from "lucide-react";
import { ActionIcon, Box, Group, Skeleton, Table, Text } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import moment from "moment";
import { FormattedMessage } from "react-intl";
import useConfig from "../../../hooks/config.hook";
import useTranslate from "../../../hooks/useTranslate.hook";
import { MyShare } from "../../../types/share.type";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import toast from "../../../utils/toast.util";
import showShareInformationsModal from "../../share/showShareInformationsModal";
import showShareLinkModal from "../../account/showShareLinkModal";
import tableClasses from "../../core/DataTable.module.css";
import { HoverTip } from "../../core/HoverTip";

const ManageShareTable = ({
  shares,
  updateShare,
  deleteShare,
  isLoading,
}: {
  shares: MyShare[];
  updateShare: (share: MyShare) => void;
  deleteShare: (share: MyShare) => void;
  isLoading: boolean;
}) => {
  const modals = useModals();
  const clipboard = useClipboard();
  const config = useConfig();
  const t = useTranslate();

  // Check if file retention is enabled
  const fileRetentionPeriod = config.get("share.fileRetentionPeriod");
  const fileRetentionEnabled = fileRetentionPeriod.value !== 0 ? true : false;

  return (
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
            <th>
              <FormattedMessage id="admin.shares.table.username" />
            </th>
            <th>
              <FormattedMessage id="account.shares.table.visitors" />
            </th>
            <th>
              <FormattedMessage id="account.shares.table.size" />
            </th>
            <th>
              <FormattedMessage id="account.shares.table.expiresAt" />
            </th>
            {fileRetentionEnabled ? (
              <th>
                <FormattedMessage id="admin.shares.table.deletes" />
              </th>
            ) : (
              <></>
            )}
            <th className={tableClasses.actionCell}></th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? skeletonRows
            : shares.map((share) => (
                <tr className={tableClasses.tableRow} key={share.id}>
                  <td>{share.id}</td>
                  <td>{share.name}</td>
                  <td>
                    {share.creator ? (
                      share.creator.username
                    ) : (
                      <Text c="dimmed">Anonymous</Text>
                    )}
                  </td>
                  <td>{share.views}</td>
                  <td>{byteToHumanSizeString(share.size)}</td>
                  <td>
                    {moment(share.expiration).unix() === 0
                      ? "Never"
                      : moment(share.expiration).format("LLL")}
                  </td>
                  {fileRetentionEnabled ? (
                    <td>
                      {moment(share.expiration).unix() === 0 ||
                      fileRetentionPeriod.value === -1
                        ? "Never"
                        : moment(share.expiration)
                            .add(
                              fileRetentionPeriod.value,
                              fileRetentionPeriod.unit,
                            )
                            .format("LLL")}
                    </td>
                  ) : (
                    <></>
                  )}
                  <td className={tableClasses.actionCell}>
                    <Group
                      className={tableClasses.actions}
                      justify="flex-end"
                      wrap="nowrap"
                    >
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
                              updateShare,
                            );
                          }}
                        >
                          <Info />
                        </ActionIcon>
                      </HoverTip>
                      <HoverTip label={t("common.button.copy-link")}>
                        <ActionIcon
                          color="gray"
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
                          variant="subtle"
                          color="red"
                          size={25}
                          onClick={() => deleteShare(share)}
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
  );
};

const skeletonRows = [...Array(10)].map((v, i) => (
  <tr key={i}>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <Box component="td" visibleFrom="md">
      <Skeleton key={i} height={20} />
    </Box>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
  </tr>
));

export default ManageShareTable;
