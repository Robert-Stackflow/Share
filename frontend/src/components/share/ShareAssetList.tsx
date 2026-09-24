import { Clipboard, Download, Eye, Link2 } from "lucide-react";
import { ActionIcon, Group } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import { useMemo, useState } from "react";
import { FormattedMessage } from "react-intl";
import AssetTable, { getAssetSortValue } from "../asset/AssetTable";
import api from "../../services/api.service";
import shareService from "../../services/share.service";
import { Asset } from "../../types/asset.type";
import { FileMetaData } from "../../types/File.type";
import { Share } from "../../types/share.type";
import toast from "../../utils/toast.util";
import { HoverTip } from "../core/HoverTip";
import TableSortIcon, { TableSort } from "../core/SortIcon";
import showFilePreviewModal from "./modals/showFilePreviewModal";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";

const fileToAsset = (file: FileMetaData, shareId: string): Asset => ({
  ...file,
  createdAt: new Date(0),
  type: "FILE",
  shareId,
});

const ShareAssetList = ({
  share,
  isLoading,
  recipientId,
}: {
  share?: Share;
  isLoading: boolean;
  recipientId?: string;
}) => {
  const clipboard = useClipboard();
  const config = useConfig();
  const modals = useModals();
  const t = useTranslate();
  const [sort, setSort] = useState<TableSort>({
    property: "name",
    direction: "desc",
  });

  const assets = useMemo(() => {
    if (!share) return [];
    const shareAssets =
      share.assets && share.assets.length > 0
        ? share.assets
        : share.files.map((file) => fileToAsset(file, share.id));

    return shareAssets.slice().sort((a, b) => {
      const property = sort.property || "name";
      const aValue = getAssetSortValue(a, property);
      const bValue = getAssetSortValue(b, property);
      if (sort.direction === "asc") {
        return bValue.localeCompare(aValue, undefined, { numeric: true });
      }
      return aValue.localeCompare(bValue, undefined, { numeric: true });
    });
  }, [share, sort]);

  const copyFileLink = (asset: Asset) => {
    if (!share) return;
    const recipientQuery = recipientId
      ? `?recipient=${encodeURIComponent(recipientId)}`
      : "";
    const link = `${config.get("general.appUrl") !== config.get("general.appUrl", true) ? config.get("general.appUrl") : window.location.origin}/api/shares/${
      share.id
    }/files/${asset.id}${recipientQuery}`;

    copyText(link, t("common.notify.copied-link"));
  };

  const copyTextAsset = (asset: Asset) => {
    copyText(asset.content || "", t("share.notify.copied-contents"));
  };

  const copyLinkAsset = (asset: Asset) => {
    copyText(asset.url || "", t("common.notify.copied-link"));
  };

  const copyText = (value: string, message: string) => {
    if (window.isSecureContext) {
      clipboard.copy(value);
      toast.success(message);
      return;
    }
    toast.error(t("share.notify.copy-not-supported-error"));
  };

  const readTextFile = (asset: Asset) => {
    if (!share) return;
    api
      .get(`/shares/${share.id}/files/${asset.id}?download=false`)
      .then((res) => copyText(res.data, t("share.notify.copied-contents")))
      .catch(toast.axiosError);
  };

  return (
    <AssetTable
      assets={assets}
      columns={["type", "value", "size"]}
      headers={{
        type: <FormattedMessage id="share.table.type" />,
        value: (
          <Group gap="xs">
            <FormattedMessage id="share.table.name" />
            <TableSortIcon sort={sort} setSort={setSort} property="name" />
          </Group>
        ),
        size: (
          <Group gap="xs">
            <FormattedMessage id="share.table.size" />
            <TableSortIcon sort={sort} setSort={setSort} property="size" />
          </Group>
        ),
      }}
      isLoading={isLoading}
      textLineClamp={2}
      renderActions={(asset) => (
        <Group justify="flex-end" wrap="nowrap">
          {asset.type === "TEXT" && (
            <HoverTip label={t("share.asset.copy-text")}>
              <ActionIcon
                aria-label={t("share.asset.copy-text")}
                color="blue"
                variant="light"
                size={25}
                onClick={() => copyTextAsset(asset)}
              >
                <Clipboard />
              </ActionIcon>
            </HoverTip>
          )}

          {asset.type === "LINK" && (
            <HoverTip label={t("common.button.copy-link")}>
              <ActionIcon
                aria-label={t("common.button.copy-link")}
                color="victoria"
                variant="light"
                size={25}
                onClick={() => copyLinkAsset(asset)}
              >
                <Clipboard />
              </ActionIcon>
            </HoverTip>
          )}

          {asset.type === "FILE" &&
            asset.name &&
            shareService.isShareTextFile(asset.name) && (
              <HoverTip label={t("share.copy-text-contents")}>
                <ActionIcon
                  aria-label={t("share.copy-text-contents")}
                  color="blue"
                  variant="light"
                  size={25}
                  onClick={() => readTextFile(asset)}
                >
                  <Clipboard />
                </ActionIcon>
              </HoverTip>
            )}

          {asset.type === "FILE" &&
            asset.name &&
            shareService.doesFileSupportPreview(asset.name) && (
              <HoverTip label={t("common.button.preview")}>
                <ActionIcon
                  aria-label={t("common.button.preview")}
                  color="green"
                  variant="light"
                  size={25}
                  onClick={() =>
                    showFilePreviewModal(
                      share!.id,
                      asset as FileMetaData,
                      modals,
                    )
                  }
                >
                  <Eye />
                </ActionIcon>
              </HoverTip>
            )}

          {asset.type === "FILE" && !share?.hasPassword && (
            <HoverTip label={t("common.button.copy-link")}>
              <ActionIcon
                aria-label={t("common.button.copy-link")}
                color="victoria"
                variant="light"
                size={25}
                onClick={() => copyFileLink(asset)}
              >
                <Link2 />
              </ActionIcon>
            </HoverTip>
          )}

          {asset.type === "FILE" && (
            <HoverTip label={t("common.button.download")}>
              <ActionIcon
                aria-label={t("common.button.download")}
                color="cyan"
                variant="light"
                size={25}
                onClick={async () => {
                  if (share) {
                    await shareService.downloadFile(
                      share.id,
                      asset.id,
                      recipientId,
                    );
                  }
                }}
              >
                <Download />
              </ActionIcon>
            </HoverTip>
          )}
        </Group>
      )}
    />
  );
};

export default ShareAssetList;
