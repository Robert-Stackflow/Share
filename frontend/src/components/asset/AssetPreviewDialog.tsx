import { Copy, Download, ExternalLink } from "lucide-react";
import {
  Anchor,
  Box,
  Button,
  Group,
  Image,
  LoadingOverlay,
  Modal,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import mime from "mime-types";
import dynamic from "next/dynamic";
import { ReactNode, useEffect, useMemo, useState } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import assetService from "../../services/asset.service";
import { Asset } from "../../types/asset.type";
import {
  exceedsPreviewLimit,
  isTextPreviewableFile,
  previewLimitForFile,
} from "../../utils/filePreview.util";
import toast from "../../utils/toast.util";
import { getAssetLabel } from "./AssetTable";

const RoomCodePreview = dynamic(() => import("../room/RoomCodePreview"));

type AssetPreviewDialogProps = {
  asset: Asset;
  fileUrl?: string;
  onDownloadFile?: () => void;
  opened: boolean;
  onClose: () => void;
  allowFileDownload?: boolean;
};

const getFileMimeType = (asset: Asset) => {
  return (
    asset.mimeType ||
    (asset.name ? (mime.contentType(asset.name) || "").split(";")[0] : "") ||
    "application/octet-stream"
  );
};

const AssetPreviewDialog = ({
  asset,
  fileUrl: providedFileUrl,
  onDownloadFile,
  opened,
  onClose,
  allowFileDownload = true,
}: AssetPreviewDialogProps) => {
  const t = useTranslate();
  const clipboard = useClipboard();
  const [mediaLoading, setMediaLoading] = useState(true);

  const fileUrl = useMemo(() => {
    if (asset.type !== "FILE" || !allowFileDownload) return undefined;
    return providedFileUrl ?? assetService.downloadFileUrl(asset.id);
  }, [allowFileDownload, asset.id, asset.type, providedFileUrl]);

  const fileMimeType = useMemo(() => getFileMimeType(asset), [asset]);

  useEffect(() => setMediaLoading(true), [asset.id, opened]);

  const copy = (value?: string) => {
    if (!value) return;
    clipboard.copy(value);
    toast.success(t("common.notify.copied"));
  };

  const renderFilePreview = () => {
    if (!fileUrl) return null;
    const previewUrl = (mode: string) =>
      fileUrl.includes("/rooms/")
        ? `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}preview=${mode}`
        : fileUrl;
    const limit = previewLimitForFile(asset.name, fileMimeType);
    if (limit && exceedsPreviewLimit(asset.size, limit)) {
      return (
        <Text c="dimmed" size="sm">
          {t("room.file.previewTooLarge", {
            limit: Math.round(limit / 1024 / 1024),
          })}
        </Text>
      );
    }

    const withLoading = (content: ReactNode) => (
      <Box pos="relative" mih={120}>
        <LoadingOverlay
          visible={mediaLoading}
          loaderProps={{ size: "sm" }}
          overlayProps={{ blur: 1 }}
          zIndex={1}
        />
        {content}
      </Box>
    );

    if (fileMimeType.startsWith("image/") && fileMimeType !== "image/svg+xml") {
      return withLoading(
        <Image
          alt={asset.name || asset.id}
          fit="contain"
          mah="60vh"
          src={previewUrl("1")}
          onLoad={() => setMediaLoading(false)}
          onError={() => setMediaLoading(false)}
        />,
      );
    }

    if (fileMimeType.startsWith("audio/")) {
      return withLoading(
        <audio
          controls
          src={fileUrl}
          style={{ width: "100%" }}
          onLoadedMetadata={() => setMediaLoading(false)}
          onError={() => setMediaLoading(false)}
        />,
      );
    }

    if (fileMimeType.startsWith("video/")) {
      return withLoading(
        <video
          controls
          src={fileUrl}
          style={{ maxHeight: "60vh", width: "100%" }}
          onLoadedMetadata={() => setMediaLoading(false)}
          onError={() => setMediaLoading(false)}
        />,
      );
    }

    if (fileMimeType === "application/pdf") {
      return withLoading(
        <Box
          component="iframe"
          src={previewUrl("pdf")}
          style={{ border: 0, height: "60vh", width: "100%" }}
          title={asset.name || asset.id}
          onLoad={() => setMediaLoading(false)}
          onError={() => setMediaLoading(false)}
        />,
      );
    }

    if (isTextPreviewableFile(asset.name, fileMimeType)) {
      return (
        <RoomCodePreview full name={asset.name || asset.id} url={fileUrl} />
      );
    }

    return (
      <Text c="dimmed" size="sm">
        {t("account.assets.preview.file.unsupported")}
      </Text>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title={t("account.assets.preview.title")}
    >
      {asset.type === "TEXT" && (
        <Stack>
          <Textarea autosize minRows={8} readOnly value={asset.content || ""} />
          <Group justify="flex-end">
            <Button
              leftSection={<Copy />}
              variant="light"
              onClick={() => copy(asset.content)}
            >
              {t("common.button.copy")}
            </Button>
          </Group>
        </Stack>
      )}

      {asset.type === "LINK" && (
        <Stack>
          <Anchor href={asset.url} target="_blank" rel="noreferrer">
            {asset.url}
          </Anchor>
          <Group justify="flex-end">
            <Button
              leftSection={<Copy />}
              variant="light"
              onClick={() => copy(asset.url)}
            >
              {t("common.button.copy")}
            </Button>
            <Button
              component="a"
              href={asset.url}
              leftSection={<ExternalLink />}
              target="_blank"
              rel="noreferrer"
            >
              {t("common.text.navigate-to-link")}
            </Button>
          </Group>
        </Stack>
      )}

      {asset.type === "FILE" && (
        <Stack>
          <Text fw={500}>{getAssetLabel(asset)}</Text>
          {renderFilePreview()}
          <Group justify="flex-end">
            {allowFileDownload && (
              <Button
                leftSection={<Download />}
                variant="light"
                onClick={
                  onDownloadFile ?? (() => assetService.downloadFile(asset.id))
                }
              >
                {t("common.button.download")}
              </Button>
            )}
          </Group>
        </Stack>
      )}
    </Modal>
  );
};

export default AssetPreviewDialog;
