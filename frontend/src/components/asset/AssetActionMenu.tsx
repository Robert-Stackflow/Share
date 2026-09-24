import {
  Copy,
  Download,
  EllipsisVertical,
  Eye,
  Files,
  Link2,
  Library,
  Pencil,
  Send,
  Share,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import { useRouter } from "next/router";
import { ReactNode, useMemo, useState } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import assetService from "../../services/asset.service";
import roomService from "../../services/room.service";
import { Asset } from "../../types/asset.type";
import { Room } from "../../types/room.type";
import toast from "../../utils/toast.util";
import AssetPreviewDialog from "./AssetPreviewDialog";

type AssetActionMenuProps = {
  asset: Asset;
  deleteModalDescription?: ReactNode;
  deleteModalTitle?: string;
  deleteSuccessMessage?: string;
  downloadUrl?: string;
  onAssetCreated?: (asset: Asset) => void;
  onAssetDeleted?: (assetId: string) => void;
  onAssetUpdated?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => Promise<void>;
  onTagsUpdated?: () => void;
  readOnly?: boolean;
  showLibraryActions?: boolean;
  showSaveToLibrary?: boolean;
};

const AssetActionMenu = ({
  asset,
  deleteModalDescription,
  deleteModalTitle,
  deleteSuccessMessage,
  downloadUrl,
  onAssetCreated,
  onAssetDeleted,
  onAssetUpdated,
  onDelete,
  onTagsUpdated,
  readOnly = false,
  showLibraryActions = !readOnly,
  showSaveToLibrary = false,
}: AssetActionMenuProps) => {
  const clipboard = useClipboard();
  const modals = useModals();
  const router = useRouter();
  const t = useTranslate();
  const [busyAction, setBusyAction] = useState<string>();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [tagValues, setTagValues] = useState<string[]>([]);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const roomOptions = useMemo(
    () =>
      rooms
        .filter((room) => Boolean(room.roomId))
        .map((room) => ({
          value: room.roomId as string,
          label: room.name ? `${room.name} (${room.roomId})` : room.roomId!,
        })),
    [rooms],
  );

  const fileUrl =
    asset.type === "FILE"
      ? (downloadUrl ??
        (!readOnly ? assetService.downloadFileUrl(asset.id) : undefined))
      : undefined;
  const canDownloadFile = asset.type === "FILE" && Boolean(fileUrl);
  const canDelete = Boolean(onDelete) || (!readOnly && showLibraryActions);
  const canUseLibraryActions = showLibraryActions && !readOnly;

  const runAction = async (name: string, action: () => Promise<void>) => {
    setBusyAction(name);
    try {
      await action();
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setBusyAction(undefined);
    }
  };

  const openCopyFallback = (title: string, value: string) => {
    modals.openModal({
      title,
      children: (
        <Stack align="stretch">
          <TextInput readOnly value={value} />
        </Stack>
      ),
    });
  };

  const copyValue = (
    value: string,
    title = t("account.assets.action.copy"),
  ) => {
    if (window.isSecureContext) {
      clipboard.copy(value);
      toast.success(t("common.notify.copied"));
      return;
    }

    openCopyFallback(title, value);
  };

  const getCopyValue = () => {
    if (asset.type === "TEXT") return asset.content || "";
    if (asset.type === "LINK") return asset.url || "";
    if (readOnly && asset.type === "FILE" && !fileUrl) {
      return asset.name || asset.id;
    }
    if (fileUrl) return toAbsoluteUrl(fileUrl);
    return asset.name || asset.id;
  };

  const toAbsoluteUrl = (url: string) => {
    if (/^https?:\/\//.test(url)) return url;
    return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
  };

  const downloadFile = () => {
    if (downloadUrl) {
      window.location.href = downloadUrl;
      return;
    }

    assetService.downloadFile(asset.id);
  };

  const openSendToRoom = () => {
    setIsSendModalOpen(true);
    setIsLoadingRooms(true);
    roomService
      .list()
      .then(setRooms)
      .catch(toast.axiosError)
      .finally(() => setIsLoadingRooms(false));
  };

  const toggleFavorite = () =>
    runAction("favorite", async () => {
      const updated = await assetService.update(asset.id, {
        favorite: !asset.favorite,
      });
      onAssetUpdated?.(updated);
      toast.success(t("account.assets.notify.favorited"));
    });

  const openManageTags = () => {
    setTagValues((asset.tags ?? []).map((tag) => tag.name));
    setIsTagsModalOpen(true);
  };

  const openRename = () => {
    setNameDraft(asset.name || "");
    setIsRenameModalOpen(true);
  };

  const saveName = () =>
    runAction("rename", async () => {
      const updated = await assetService.update(asset.id, {
        name: nameDraft.trim(),
      });
      onAssetUpdated?.(updated);
      setIsRenameModalOpen(false);
      toast.success(t("account.assets.notify.renamed"));
    });

  const canSaveName = asset.type !== "FILE" || Boolean(nameDraft.trim());

  const saveTags = () =>
    runAction("tags", async () => {
      const updated = await assetService.update(asset.id, { tags: tagValues });
      onAssetUpdated?.(updated);
      onTagsUpdated?.();
      setIsTagsModalOpen(false);
      toast.success(t("account.assets.notify.tagsUpdated"));
    });

  const deleteAsset = () => {
    const description =
      typeof deleteModalDescription === "string" ? (
        <Text size="sm">{deleteModalDescription}</Text>
      ) : (
        (deleteModalDescription ?? (
          <Text size="sm">{t("account.assets.modal.delete.description")}</Text>
        ))
      );

    modals.openConfirmModal({
      title: deleteModalTitle ?? t("account.assets.modal.delete.title"),
      children: description,
      confirmProps: {
        color: "red",
      },
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: () =>
        runAction("delete", async () => {
          if (onDelete) {
            await onDelete(asset);
          } else {
            await assetService.remove(asset.id);
          }
          onAssetDeleted?.(asset.id);
          toast.success(
            deleteSuccessMessage ?? t("account.assets.notify.deleted"),
          );
        }),
    });
  };

  const isBusy = Boolean(busyAction);

  return (
    <>
      <Menu withinPortal position="bottom-end" shadow="md" width={220}>
        <Menu.Target>
          <ActionIcon
            aria-label={t("account.assets.action.more")}
            color="gray"
            variant="subtle"
            size={36}
          >
            <EllipsisVertical />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<Eye />}
            onClick={() => setIsPreviewOpen(true)}
          >
            {t("account.assets.action.preview")}
          </Menu.Item>
          <Menu.Item
            leftSection={asset.type === "FILE" ? <Link2 /> : <Copy />}
            onClick={() => copyValue(getCopyValue())}
          >
            {t("account.assets.action.copy")}
          </Menu.Item>
          {canDownloadFile && (
            <Menu.Item leftSection={<Download />} onClick={downloadFile}>
              {t("common.button.download")}
            </Menu.Item>
          )}
          {showSaveToLibrary && (
            <Menu.Item
              disabled={isBusy}
              leftSection={<Library />}
              onClick={() =>
                runAction("save-to-library", async () => {
                  await assetService.saveToLibrary(asset.id);
                  toast.success(t("account.assets.notify.savedToLibrary"));
                })
              }
            >
              {t("account.assets.action.saveToLibrary")}
            </Menu.Item>
          )}
          {(canUseLibraryActions || canDelete) && <Menu.Divider />}
          {canUseLibraryActions && (
            <>
              <Menu.Item
                disabled={isBusy}
                leftSection={<Pencil />}
                onClick={openRename}
              >
                {t("account.assets.action.rename")}
              </Menu.Item>
              <Menu.Item
                disabled={isBusy}
                leftSection={
                  asset.favorite ? <Star fill="currentColor" /> : <Star />
                }
                onClick={toggleFavorite}
              >
                {t("account.assets.action.favorite")}
              </Menu.Item>
              <Menu.Item
                disabled={isBusy}
                leftSection={<Tag />}
                onClick={openManageTags}
              >
                {t("account.assets.action.manageTags")}
              </Menu.Item>
              <Menu.Item
                disabled={isBusy}
                leftSection={<Share />}
                onClick={() =>
                  runAction("share", async () => {
                    const result = await assetService.createShare(asset.id);
                    toast.success(t("account.assets.notify.shareCreated"));
                    void router.push(`/share/${result.share.id}/edit`);
                  })
                }
              >
                {t("account.assets.action.createShare")}
              </Menu.Item>
              <Menu.Item
                disabled={isBusy}
                leftSection={<Link2 />}
                onClick={() =>
                  runAction("short-link", async () => {
                    const shortLink = await assetService.createShortLink(
                      asset.id,
                    );
                    copyValue(
                      `${window.location.origin}/s/${shortLink.code}`,
                      t("account.assets.action.createShortLink"),
                    );
                    toast.success(t("account.assets.notify.shortLinkCreated"));
                  })
                }
              >
                {t("account.assets.action.createShortLink")}
              </Menu.Item>
              <Menu.Item
                disabled={isBusy}
                leftSection={<Send />}
                onClick={openSendToRoom}
              >
                {t("account.assets.action.sendToRoom")}
              </Menu.Item>
              <Menu.Item
                disabled={isBusy}
                leftSection={<Files />}
                onClick={() =>
                  runAction("clone", async () => {
                    const clonedAsset = await assetService.clone(asset.id);
                    onAssetCreated?.(clonedAsset);
                    toast.success(t("account.assets.notify.cloned"));
                  })
                }
              >
                {t("account.assets.action.clone")}
              </Menu.Item>
            </>
          )}
          {canDelete && (
            <Menu.Item
              color="red"
              leftSection={<Trash2 />}
              onClick={deleteAsset}
            >
              {t("common.button.delete")}
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      <AssetPreviewDialog
        asset={asset}
        fileUrl={fileUrl}
        opened={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onDownloadFile={downloadFile}
        allowFileDownload={canDownloadFile}
      />

      <Modal
        opened={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        title={t("account.assets.rename.title")}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSaveName) void saveName();
          }}
        >
          <Stack>
            <TextInput
              autoFocus
              label={t("account.assets.rename.name")}
              maxLength={120}
              onChange={(event) => setNameDraft(event.currentTarget.value)}
              value={nameDraft}
            />
            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => setIsRenameModalOpen(false)}
              >
                {t("common.button.cancel")}
              </Button>
              <Button
                disabled={!canSaveName}
                loading={busyAction === "rename"}
                type="submit"
              >
                {t("common.button.save")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        title={t("account.assets.sendToRoom.title")}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedRoomId) return;
            void runAction("send-to-room", async () => {
              await assetService.sendToRoom(asset.id, selectedRoomId);
              toast.success(t("account.assets.notify.sentToRoom"));
              setIsSendModalOpen(false);
              setSelectedRoomId(null);
            });
          }}
        >
          <Stack>
            <Select
              data={roomOptions}
              disabled={isLoadingRooms || roomOptions.length === 0}
              label={t("account.assets.sendToRoom.select")}
              onChange={setSelectedRoomId}
              placeholder={
                isLoadingRooms
                  ? t("common.text.loading")
                  : roomOptions.length === 0
                    ? t("account.assets.sendToRoom.empty")
                    : t("account.assets.sendToRoom.select")
              }
              value={selectedRoomId}
            />
            {roomOptions.length === 0 && !isLoadingRooms && (
              <Text c="dimmed" size="sm">
                {t("account.assets.sendToRoom.empty")}
              </Text>
            )}
            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => setIsSendModalOpen(false)}
              >
                {t("common.button.cancel")}
              </Button>
              <Button
                disabled={!selectedRoomId}
                loading={busyAction === "send-to-room"}
                type="submit"
              >
                {t("account.assets.action.sendToRoom")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={isTagsModalOpen}
        onClose={() => setIsTagsModalOpen(false)}
        title={t("account.assets.tags.modal.title")}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveTags();
          }}
        >
          <Stack>
            <TagsInput
              data={[]}
              label={t("account.assets.tags.modal.label")}
              placeholder={t("account.assets.tags.modal.placeholder")}
              onChange={setTagValues}
              value={tagValues}
            />
            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => setIsTagsModalOpen(false)}
              >
                {t("common.button.cancel")}
              </Button>
              <Button loading={busyAction === "tags"} type="submit">
                {t("common.button.save")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
};

export default AssetActionMenu;
