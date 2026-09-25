import { Copy, Download, ExternalLink } from "lucide-react";
import {
  Anchor,
  Box,
  Button,
  Group,
  Image,
  Modal,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import mime from "mime-types";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import assetService from "../../services/asset.service";
import { Asset } from "../../types/asset.type";
import { isTextPreviewableFile } from "../../utils/filePreview.util";
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

  const fileUrl = useMemo(() => {
    if (asset.type !== "FILE" || !allowFileDownload) return undefined;
    return providedFileUrl ?? assetService.downloadFileUrl(asset.id);
  }, [allowFileDownload, asset.id, asset.type, providedFileUrl]);

  const fileMimeType = useMemo(() => getFileMimeType(asset), [asset]);

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

    if (fileMimeType.startsWith("image/") && fileMimeType !== "image/svg+xml") {
      return (
        <Image
          alt={asset.name || asset.id}
          fit="contain"
          mah="60vh"
          src={previewUrl("1")}
        />
      );
    }

    if (fileMimeType.startsWith("audio/")) {
      return <audio controls src={fileUrl} style={{ width: "100%" }} />;
    }

    if (fileMimeType.startsWith("video/")) {
      return (
        <video
          controls
          src={fileUrl}
          style={{ maxHeight: "60vh", width: "100%" }}
        />
      );
    }

    if (fileMimeType === "application/pdf") {
      return (
        <Box
          component="iframe"
          src={previewUrl("pdf")}
          style={{ border: 0, height: "60vh", width: "100%" }}
          title={asset.name || asset.id}
        />
      );
    }

    if (
      isTextPreviewableFile(asset.name, fileMimeType) &&
      Number(asset.size ?? 0) <= 1024 * 1024
    ) {
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
