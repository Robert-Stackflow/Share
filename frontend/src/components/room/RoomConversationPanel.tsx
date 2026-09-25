import {
  ChevronDown,
  ChevronUp,
  Check,
  CheckCheck,
  Copy,
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
  MoreHorizontal,
  Presentation,
  Trash2,
  Library,
  X,
} from "lucide-react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import dynamic from "next/dynamic";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import FormattedMessage from "../core/FormattedMessage";
import useTranslate from "../../hooks/useTranslate.hook";
import { Asset, AssetType } from "../../types/asset.type";
import {
  exceedsPreviewLimit,
  IMAGE_PREVIEW_LIMIT,
  isTextPreviewableFile,
  PDF_PREVIEW_LIMIT,
  TEXT_PREVIEW_LIMIT,
} from "../../utils/filePreview.util";
import {
  getAssetLabel,
  getAssetSizeLabel,
  sortAssetsByCreatedAtDesc,
} from "../asset/AssetTable";
import AssetActionMenu from "../asset/AssetActionMenu";
import assetService from "../../services/asset.service";
import toast from "../../utils/toast.util";
import classes from "./RoomConversationPanel.module.css";

const RoomCodePreview = dynamic(() => import("./RoomCodePreview"));

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
      "htm",
      "css",
      "json",
      "xml",
      "yaml",
      "yml",
      "sh",
      "bash",
      "sql",
      "jsonl",
      "toml",
      "ini",
      "env",
      "diff",
      "patch",
      "scss",
      "mjs",
      "cjs",
    ].includes(extension)
  )
    return "code";
  if (mime.startsWith("text/") || ["txt", "md", "log"].includes(extension))
    return "text";
  if (isTextPreviewableFile(asset.name, asset.mimeType)) return "code";
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
    !exceedsPreviewLimit(asset.size, IMAGE_PREVIEW_LIMIT) &&
    Boolean(url);
  const previewUrl = url
    ? `${url}${url.includes("?") ? "&" : "?"}preview=1`
    : undefined;
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [dimensions, setDimensions] = useState<string>();
  const canPreviewText =
    Boolean(url) &&
    isTextPreviewableFile(asset.name, asset.mimeType) &&
    !exceedsPreviewLimit(asset.size, TEXT_PREVIEW_LIMIT);

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
            {imageLoading && (
              <span className={classes.imageLoader}>
                <Loader size="sm" />
              </span>
            )}
            <img
              alt={asset.name || ""}
              loading="lazy"
              src={`${previewUrl}&attempt=${previewAttempt}`}
              onLoad={(event) => {
                const image = event.currentTarget;
                setDimensions(`${image.naturalWidth} × ${image.naturalHeight}`);
                setImageLoading(false);
              }}
              onError={() => {
                setImageLoading(false);
                setPreviewFailed(true);
              }}
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
      {canPreviewImage && previewFailed && (
        <Button
          className={classes.pdfPreviewButton}
          size="xs"
          variant="subtle"
          onClick={() => {
            setPreviewAttempt((current) => current + 1);
            setPreviewFailed(false);
            setImageLoading(true);
          }}
        >
          {t("room.file.retryPreview")}
        </Button>
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
      {canPreviewText && url && (
        <RoomCodePreview name={asset.name || asset.id} url={url} />
      )}
      {kind === "pdf" &&
        url &&
        !exceedsPreviewLimit(asset.size, PDF_PREVIEW_LIMIT) && (
          <>
            <Button
              className={classes.pdfPreviewButton}
              size="xs"
              variant="light"
              onClick={() => setPreviewOpen(true)}
            >
              {t("room.file.previewPdf")}
            </Button>
            <Modal
              opened={previewOpen}
              onClose={() => setPreviewOpen(false)}
              title={asset.name}
              size="90%"
              centered
            >
              <Group justify="flex-end" mb="sm">
                <Button
                  component="a"
                  href={`${url}?preview=pdf`}
                  target="_blank"
                  rel="noreferrer"
                  variant="subtle"
                  size="xs"
                  leftSection={<ExternalLink size={15} />}
                >
                  {t("room.file.openPdf")}
                </Button>
              </Group>
              <Box pos="relative">
                {pdfLoading && (
                  <div className={classes.pdfLoader}>
                    <Loader size="sm" />
                    <Text size="sm" c="dimmed">
                      {t("room.file.loadingPreview")}
                    </Text>
                  </div>
                )}
                <iframe
                  className={classes.pdfFrame}
                  title={asset.name || "PDF"}
                  src={`${url}?preview=pdf`}
                  onLoad={() => setPdfLoading(false)}
                  onError={() => setPdfLoading(false)}
                />
              </Box>
            </Modal>
          </>
        )}
    </div>
  );
};

type RoomConversationPanelProps = {
  assets: Asset[];
  badge?: ReactNode;
  headerActions?: ReactNode;
  composer?: ReactNode;
  empty?: ReactNode;
  flushHeader?: boolean;
  getFileDownloadUrl?: (asset: Asset) => string;
  hideHeader?: boolean;
  onDelete?: (asset: Asset) => Promise<void>;
  onDeleteMany?: (assets: Asset[]) => Promise<void>;
  onClear?: () => Promise<void>;
  canSaveToLibrary?: boolean;
  scrollToLatestSignal?: number;
  subtitle?: ReactNode;
  title: ReactNode;
};

const RoomConversationPanel = ({
  assets,
  badge,
  headerActions,
  composer,
  empty,
  flushHeader = false,
  getFileDownloadUrl,
  hideHeader = false,
  onDelete,
  onDeleteMany,
  onClear,
  canSaveToLibrary = false,
  scrollToLatestSignal,
  subtitle,
  title,
}: RoomConversationPanelProps) => {
  const t = useTranslate();
  const intl = useIntl();
  const modals = useModals();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const roomConversationMessages = sortAssetsByCreatedAtDesc(assets)
    .slice()
    .reverse();
  const messagesRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const nearBottomRef = useRef(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const selectedAssets = assets.filter((asset) => selectedIds.has(asset.id));

  useEffect(() => {
    setSelectedIds(
      (previous) =>
        new Set(
          [...previous].filter((id) => assets.some((asset) => asset.id === id)),
        ),
    );
  }, [assets]);

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };
  const toggleSelected = (id: string) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => {
    setSelectionMode(true);
    setSelectedIds(new Set(assets.map((asset) => asset.id)));
  };
  const copySelected = async () => {
    const values = selectedAssets.map((asset) =>
      asset.type === "TEXT"
        ? asset.content || ""
        : asset.type === "LINK"
          ? asset.url || ""
          : getFileDownloadUrl?.(asset) || asset.name || "",
    );
    const value = values
      .map((item) =>
        item.startsWith("/") ? `${window.location.origin}${item}` : item,
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("common.notify.copied"));
    } catch {
      modals.openModal({
        title: t("room.selection.copy"),
        children: (
          <Text component="pre" className={classes.copyFallback}>
            {value}
          </Text>
        ),
      });
    }
  };
  const saveSelected = async () => {
    setBusy(true);
    try {
      for (const asset of selectedAssets)
        await assetService.saveToLibrary(asset.id);
      toast.success(t("room.selection.saved"));
      exitSelection();
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setBusy(false);
    }
  };
  const confirmDeleteSelected = () =>
    modals.openConfirmModal({
      title: t("room.selection.delete"),
      children: (
        <Text size="sm">
          {t("room.selection.deleteConfirm", { count: selectedAssets.length })}
        </Text>
      ),
      confirmProps: { color: "red" },
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: () => {
        setBusy(true);
        void onDeleteMany?.(selectedAssets)
          .then(() => {
            exitSelection();
            toast.success(t("room.notify.asset-deleted"));
          })
          .catch(toast.axiosError)
          .finally(() => setBusy(false));
      },
    });
  const confirmClear = () =>
    modals.openConfirmModal({
      title: t("room.selection.clear"),
      children: <Text size="sm">{t("room.selection.clearConfirm")}</Text>,
      confirmProps: { color: "red" },
      labels: {
        confirm: t("room.selection.clear"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: () => {
        setBusy(true);
        void onClear?.()
          .then(() => {
            exitSelection();
            toast.success(t("room.selection.cleared"));
          })
          .catch(toast.axiosError)
          .finally(() => setBusy(false));
      },
    });

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
          <Group className={classes.headerIdentity} gap="xs" wrap="nowrap">
            <Title order={4} className={classes.headerTitle}>
              {title}
            </Title>
            {subtitle && (
              <Text c="dimmed" size="xs" className={classes.headerSubtitle}>
                {subtitle}
              </Text>
            )}
            {badge}
          </Group>
          <Group gap={6} wrap="nowrap" className={classes.headerControls}>
            {assets.length > 0 && (
              <Button
                size="xs"
                variant="subtle"
                leftSection={
                  selectionMode ? <CheckCheck size={16} /> : <Check size={16} />
                }
                onClick={
                  selectionMode ? selectAll : () => setSelectionMode(true)
                }
              >
                {t(
                  selectionMode
                    ? "room.selection.selectAll"
                    : "room.selection.select",
                )}
              </Button>
            )}
            {(headerActions || onClear) && (
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon
                    variant="subtle"
                    aria-label={t("room.selection.more")}
                  >
                    <MoreHorizontal size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {headerActions}
                  {onClear && assets.length > 0 && (
                    <>
                      {headerActions && <Menu.Divider />}
                      <Menu.Item
                        color="red"
                        leftSection={<Trash2 size={16} />}
                        onClick={confirmClear}
                      >
                        {t("room.selection.clear")}
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
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
                  className={`${classes.messageRow} ${classes.messageListItem} ${selectionMode ? classes.selectableRow : ""} ${selectedIds.has(asset.id) ? classes.selectedRow : ""}`}
                  wrap="nowrap"
                >
                  {selectionMode && (
                    <button
                      type="button"
                      className={classes.selectionHitArea}
                      aria-hidden="true"
                      tabIndex={-1}
                      onClick={() => toggleSelected(asset.id)}
                    />
                  )}
                  <Box
                    component="button"
                    type="button"
                    className={classes.messageIcon}
                    aria-label={t("room.selection.toggle", {
                      name: getAssetLabel(asset),
                    })}
                    aria-pressed={selectedIds.has(asset.id)}
                    onClick={() => {
                      if (!selectionMode) setSelectionMode(true);
                      toggleSelected(asset.id);
                    }}
                    data-type={asset.type.toLowerCase()}
                    data-kind={
                      asset.type === "FILE" ? getFileKind(asset) : undefined
                    }
                  >
                    {selectionMode && selectedIds.has(asset.id) ? (
                      <Check />
                    ) : (
                      renderTypeIcon(asset)
                    )}
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
                      {!selectionMode && renderActions(asset)}
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

      {(composer || selectionMode) && (
        <Box className={classes.composer}>
          {selectionMode ? (
            <Group
              className={classes.selectionToolbar}
              justify="space-between"
              wrap="nowrap"
            >
              <Group gap="xs" wrap="nowrap">
                <Text fw={650} size="sm">
                  {t("room.selection.count", { count: selectedAssets.length })}
                </Text>
                <Button size="xs" variant="subtle" onClick={selectAll}>
                  {t("room.selection.selectAll")}
                </Button>
              </Group>
              <Group
                gap="xs"
                wrap="nowrap"
                className={classes.selectionActions}
              >
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<Copy size={16} />}
                  disabled={!selectedAssets.length || busy}
                  onClick={() => void copySelected()}
                >
                  {t("room.selection.copy")}
                </Button>
                {canSaveToLibrary && (
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<Library size={16} />}
                    disabled={!selectedAssets.length || busy}
                    onClick={() => void saveSelected()}
                  >
                    {t("room.selection.save")}
                  </Button>
                )}
                {onDeleteMany && (
                  <Button
                    size="xs"
                    color="red"
                    variant="subtle"
                    leftSection={<Trash2 size={16} />}
                    disabled={!selectedAssets.length || busy}
                    onClick={confirmDeleteSelected}
                  >
                    {t("room.selection.delete")}
                  </Button>
                )}
                <ActionIcon
                  variant="subtle"
                  aria-label={t("common.button.cancel")}
                  onClick={exitSelection}
                >
                  <X size={18} />
                </ActionIcon>
              </Group>
            </Group>
          ) : (
            composer
          )}
        </Box>
      )}
    </Box>
  );
};

export default RoomConversationPanel;
