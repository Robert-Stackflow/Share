import { FileIcon, FileText, Link2 } from "lucide-react";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
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

const typeIcon: Record<AssetType, ReactNode> = {
  FILE: <FileIcon />,
  TEXT: <FileText />,
  LINK: <Link2 />,
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
      return (
        <Anchor href={asset.url} target="_blank" rel="noreferrer">
          {asset.url}
        </Anchor>
      );
    }

    if (asset.type === "FILE") {
      return (
        <Stack gap={2}>
          <Text fw={500}>{getAssetLabel(asset)}</Text>
          {asset.size && (
            <Text c="dimmed" size="xs">
              {getAssetSizeLabel(asset)}
            </Text>
          )}
        </Stack>
      );
    }

    return <Text>{getAssetLabel(asset)}</Text>;
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
                  <Box className={classes.messageIcon}>
                    {typeIcon[asset.type]}
                  </Box>
                  <Box className={classes.roomMessageBubble}>
                    <div className={classes.bubbleHeader}>
                      <Group
                        className={classes.messageMeta}
                        gap="xs"
                        wrap="nowrap"
                      >
                        <Badge color="gray" variant="light">
                          {t(`room.asset.type.${asset.type.toLowerCase()}`)}
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
