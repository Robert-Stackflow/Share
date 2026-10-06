import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  Select,
} from "@mantine/core";
import { Globe2, Lock, Trash2, X } from "lucide-react";
import useTranslate from "../../hooks/useTranslate.hook";
import { ImageAlbum, ImageVisibility } from "../../types/image.type";
import classes from "../../pages/account/images.module.css";

type ImageBulkBarProps = {
  visibleIds: string[];
  selectedIds: Set<string>;
  allowPublic: boolean;
  busy: boolean;
  albums: ImageAlbum[];
  onToggleVisible: (checked: boolean) => void;
  onUpdateVisibility: (visibility: ImageVisibility) => void;
  onMove: (albumId: string | null) => void;
  onRemove: () => void;
  onClear: () => void;
};

const ImageBulkBar = ({
  visibleIds,
  selectedIds,
  allowPublic,
  busy,
  albums,
  onToggleVisible,
  onUpdateVisibility,
  onMove,
  onRemove,
  onClear,
}: ImageBulkBarProps) => {
  const t = useTranslate();
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const hasSelection = selectedIds.size > 0;

  return (
    <Paper withBorder className={classes.bulkBar}>
      <Checkbox
        className={classes.bulkSelectAll}
        checked={allVisibleSelected}
        indeterminate={!allVisibleSelected && someVisibleSelected}
        label={t("images.batch.selectVisible", {
          count: visibleIds.length.toString(),
        })}
        onChange={(event) => onToggleVisible(event.currentTarget.checked)}
      />
      <Group
        gap="xs"
        className={`${classes.bulkActions} ${
          hasSelection ? "" : classes.bulkActionsHidden
        }`}
        aria-hidden={!hasSelection}
      >
        <Badge variant="light">
          {t("images.batch.selected", {
            count: selectedIds.size.toString(),
          })}
        </Badge>
        {allowPublic ? (
          <Button
            size="xs"
            variant="light"
            loading={busy}
            disabled={!hasSelection}
            leftSection={<Globe2 size={14} />}
            onClick={() => onUpdateVisibility("PUBLIC")}
          >
            {t("images.makePublic")}
          </Button>
        ) : null}
        <Button
          size="xs"
          variant="light"
          loading={busy}
          disabled={!hasSelection}
          leftSection={<Lock size={14} />}
          onClick={() => onUpdateVisibility("PRIVATE")}
        >
          {t("images.makePrivate")}
        </Button>
        <Select
          size="xs"
          clearable
          searchable
          disabled={!hasSelection || busy}
          className={classes.bulkAlbumSelect}
          placeholder={t("images.batch.move")}
          data={albums.map((album) => ({
            value: album.id,
            label: album.name,
          }))}
          onChange={onMove}
        />
        <Button
          size="xs"
          variant="subtle"
          color="red"
          loading={busy}
          disabled={!hasSelection}
          leftSection={<Trash2 size={14} />}
          onClick={onRemove}
        >
          {t("common.button.delete")}
        </Button>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("images.batch.clear")}
          disabled={!hasSelection}
          onClick={onClear}
        >
          <X size={16} />
        </ActionIcon>
      </Group>
    </Paper>
  );
};

export default ImageBulkBar;
