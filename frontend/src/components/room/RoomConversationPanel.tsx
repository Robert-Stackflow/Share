import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileArchive,
  FileCode2,
  FileIcon,
  FileSpreadsheet,
  FileText,
  FileType2,
  Film,
  Image as ImageIcon,
  Link2,
  Music2,
  Presentation,
} from "lucide-react";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import FormattedMessage from "../core/FormattedMessage";
import useTranslate from "../../hooks/useTranslate.hook";
import { Asset, AssetType } from "../../types/asset.type";
import {
  getAssetLabel,
  getAssetSizeLabel,
  sortAssetsByCreatedAtDesc,
} from "../asset/AssetTable";
import AssetActionMenu from "../asset/AssetActionMenu";
import classes from "./RoomConversationPanel.module.css";

type FileKind =
  | "image"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "text"
  | "code"
  | "archive"
  | "audio"
  | "video"
  | "other";

const inlineImageTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const getFileKind = (asset: Asset): FileKind => {
  const mime = (asset.mimeType ?? "").toLowerCase();
  const extension = asset.name?.split(".").pop()?.toLowerCase() ?? "";
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"].includes(extension)
  )
    return "image";
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf"].includes(extension)) return "document";
  if (["xls", "xlsx", "ods", "csv", "tsv"].includes(extension))
    return "spreadsheet";
  if (["ppt", "pptx", "odp"].includes(extension)) return "presentation";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(extension))
    return "archive";
  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "flac"].includes(extension)
  )
    return "audio";
  if (
    mime.startsWith("video/") ||
    ["mp4", "webm", "mov", "mkv", "avi"].includes(extension)
  )
    return "video";
  if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "go",
      "rs",
      "html",
      "css",
      "json",
      "xml",
      "yaml",
      "yml",
      "sh",
    ].includes(extension)
  )
    return "code";
  if (mime.startsWith("text/") || ["txt", "md", "log"].includes(extension))
    return "text";
  return "other";
};

const fileKindIcons = {
  image: ImageIcon,
  pdf: FileText,
  document: FileType2,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  text: FileText,
  code: FileCode2,
  archive: FileArchive,
  audio: Music2,
  video: Film,
  other: FileIcon,
};

const typeIcon: Record<AssetType, ReactNode> = {
  FILE: <FileIcon />,
  TEXT: <FileText />,
  LINK: <Link2 />,
};

const renderTypeIcon = (asset: Asset) => {
  if (asset.type !== "FILE") return typeIcon[asset.type];
  const Icon = fileKindIcons[getFileKind(asset)];
  return <Icon />;
};

const RoomTextContent = ({ value }: { value: string }) => {
  const t = useTranslate();
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (expanded || !textRef.current) return;
    const element = textRef.current;
    const measure = () =>
      setCanExpand(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value, expanded]);

  return (
    <div>
      <Text
        ref={textRef}
        className={`${classes.messageText} ${!expanded ? classes.messageTextClamped : ""}`}
      >
        {value}
      </Text>
      {canExpand && (
        <div className={classes.expandAction}>
          <Button
            className={classes.expandButton}
            rightSection={
              expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            }
            size="xs"
            variant="subtle"
            onClick={() => setExpanded((current) => !current)}
          >
            {t(expanded ? "room.assets.collapse" : "room.assets.expand")}
          </Button>
        </div>
      )}
    </div>
  );
};

const RoomFileContent = ({ asset, url }: { asset: Asset; url?: string }) => {
  const t = useTranslate();
  const kind = getFileKind(asset);
  const extension = asset.name?.match(/\.([^.]+)$/)?.[1]?.toUpperCase();
  const canPreviewImage =
    kind === "image" &&
    inlineImageTypes.has((asset.mimeType ?? "").toLowerCase()) &&
    Boolean(url);
  const previewUrl = url
    ? `${url}${url.includes("?") ? "&" : "?"}preview=1`
    : undefined;
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dimensions, setDimensions] = useState<string>();

  return (
    <div className={classes.fileContent}>
      {canPreviewImage && !previewFailed && previewUrl && (
        <>
          <button
            aria-label={t("room.file.openImage", {
              name: asset.name || asset.id,
            })}
            className={classes.imagePreview}
            type="button"
            onClick={() => setPreviewOpen(true)}
          >
            <img
              alt={asset.name || ""}
              loading="lazy"
              src={previewUrl}
              onLoad={(event) => {
                const image = event.currentTarget;
                setDimensions(`${image.naturalWidth} × ${image.naturalHeight}`);
              }}
              onError={() => setPreviewFailed(true)}
            />
          </button>
          {previewOpen && (
            <Modal
              opened
              centered
              size="xl"
              title={asset.name || t("room.file.kind.image")}
              onClose={() => setPreviewOpen(false)}
            >
              <img
                className={classes.imageExpanded}
                alt={asset.name || ""}
                src={previewUrl}
              />
            </Modal>
          )}
        </>
      )}
      <div className={classes.fileDetails}>
        <div className={classes.fileDescription}>
          <Text className={classes.fileName} fw={650} lineClamp={2}>
            {getAssetLabel(asset)}
          </Text>
          <div className={classes.fileMetadata}>
            {extension && <span>{extension}</span>}
            {asset.size && <span>{getAssetSizeLabel(asset)}</span>}
            {dimensions && <span>{dimensions}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

type RoomConversationPanelProps = {
  assets: Asset[];
  badge?: ReactNode;
  composer?: ReactNode;
  empty?: ReactNode;
  flushHeader?: boolean;
  getFileDownloadUrl?: (asset: Asset) => string;
  hideHeader?: boolean;
  onDelete?: (asset: Asset) => Promise<void>;
  canSaveToLibrary?: boolean;
  scrollToLatestSignal?: number;
  subtitle?: ReactNode;
  title: ReactNode;
};

const RoomConversationPanel = ({
  assets,
  badge,
  composer,
  empty,
  flushHeader = false,
  getFileDownloadUrl,
  hideHeader = false,
  onDelete,
  canSaveToLibrary = false,
  scrollToLatestSignal,
  subtitle,
  title,
}: RoomConversationPanelProps) => {
  const t = useTranslate();
  const intl = useIntl();
  const roomConversationMessages = sortAssetsByCreatedAtDesc(assets)
    .slice()
    .reverse();
  const messagesRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const nearBottomRef = useRef(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollToLatest = () => {
    const element = messagesRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    nearBottomRef.current = true;
    setUnreadCount(0);
  };

  useEffect(() => {
    const nextIds = new Set(assets.map((asset) => asset.id));
    const previousIds = knownIdsRef.current;
    knownIdsRef.current = nextIds;
    if (previousIds === null || nearBottomRef.current) {
      scrollToLatest();
      return;
    }
    const added = assets.filter((asset) => !previousIds.has(asset.id)).length;
    if (added > 0) setUnreadCount((count) => count + added);
  }, [assets]);

  useEffect(() => {
    if (scrollToLatestSignal) scrollToLatest();
  }, [scrollToLatestSignal]);

  const onMessagesScroll = () => {
    const element = messagesRef.current;
    if (!element) return;
    nearBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    if (nearBottomRef.current) setUnreadCount(0);
  };

  const renderValue = (asset: Asset) => {
    if (asset.type === "LINK") {
      let hostname = asset.url || "";
      try {
        hostname = new URL(asset.url || "").hostname;
      } catch {
        // Keep the original link when a legacy item has no valid host.
      }
      return (
        <Anchor
          className={classes.linkCard}
          href={asset.url}
          target="_blank"
          rel="noreferrer"
        >
          <span className={classes.linkDetails}>
            <span className={classes.linkHostname}>{hostname}</span>
            <span className={classes.linkUrl}>{asset.url}</span>
          </span>
          <ExternalLink size={16} className={classes.linkExternal} />
        </Anchor>
      );
    }

    if (asset.type === "FILE") {
      return (
        <RoomFileContent asset={asset} url={getFileDownloadUrl?.(asset)} />
      );
    }

    return <RoomTextContent value={getAssetLabel(asset)} />;
  };

  const renderActions = (asset: Asset) => (
    <Group className={classes.bubbleActions} gap={4} wrap="nowrap">
      <AssetActionMenu
        asset={asset}
        deleteModalTitle={t("room.assets.modal.delete.title")}
        deleteModalDescription={
          <Text size="sm">
            <FormattedMessage id="room.assets.modal.delete.description" />
          </Text>
        }
        deleteSuccessMessage={t("room.notify.asset-deleted")}
        downloadUrl={getFileDownloadUrl?.(asset)}
        onDelete={onDelete}
        showLibraryActions={false}
        showSaveToLibrary={canSaveToLibrary}
      />
    </Group>
  );

  return (
    <Box className={classes.roomConversationPanel}>
      {!hideHeader && (
        <Group
          className={`${classes.header} ${flushHeader ? classes.headerFlush : ""}`}
          justify="space-between"
          wrap="nowrap"
        >
          <div>
            <Title order={4}>{title}</Title>
            {subtitle && (
              <Text c="dimmed" size="sm">
                {subtitle}
              </Text>
            )}
          </div>
          {badge}
        </Group>
      )}

      <div className={classes.messageViewport}>
        <Stack
          className={classes.roomConversationMessages}
          gap="md"
          ref={messagesRef}
          onScroll={onMessagesScroll}
        >
          {roomConversationMessages.length === 0
            ? (empty ?? (
                <Text c="dimmed" ta="center" py="xl">
                  <FormattedMessage id="room.assets.empty" />
                </Text>
              ))
            : roomConversationMessages.map((asset) => (
                <Group
                  key={asset.id}
                  align="flex-start"
                  className={`${classes.messageRow} ${classes.messageListItem}`}
                  wrap="nowrap"
                >
                  <Box
                    className={classes.messageIcon}
                    data-type={asset.type.toLowerCase()}
                    data-kind={
                      asset.type === "FILE" ? getFileKind(asset) : undefined
                    }
                  >
                    {renderTypeIcon(asset)}
                  </Box>
                  <Box
                    className={classes.roomMessageBubble}
                    data-type={asset.type.toLowerCase()}
                    data-kind={
                      asset.type === "FILE" ? getFileKind(asset) : undefined
                    }
                  >
                    <div className={classes.bubbleHeader}>
                      <Group
                        className={classes.messageMeta}
                        gap="xs"
                        wrap="nowrap"
                      >
                        <Badge color="gray" variant="light">
                          {asset.type === "FILE"
                            ? t(`room.file.kind.${getFileKind(asset)}`)
                            : t(`room.asset.type.${asset.type.toLowerCase()}`)}
                        </Badge>
                        <Text c="dimmed" size="xs">
                          {intl.formatDate(asset.createdAt, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </Text>
                      </Group>
                      {renderActions(asset)}
                    </div>
                    <Box className={classes.bubbleContent}>
                      {renderValue(asset)}
                    </Box>
                  </Box>
                </Group>
              ))}
        </Stack>

        {unreadCount > 0 && (
          <Button
            className={classes.newItemsButton}
            size="xs"
            onClick={scrollToLatest}
          >
            {t("room.assets.new", { count: unreadCount })}
          </Button>
        )}
      </div>

      {composer && <Box className={classes.composer}>{composer}</Box>}
    </Box>
  );
};

export default RoomConversationPanel;
