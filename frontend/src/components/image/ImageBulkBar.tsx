import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
} from "@mantine/core";
import { Globe2, Lock, Trash2, X } from "lucide-react";
import useTranslate from "../../hooks/useTranslate.hook";
import { ImageVisibility } from "../../types/image.type";
import classes from "../../pages/account/images.module.css";

type ImageBulkBarProps = {
  visibleIds: string[];
  selectedIds: Set<string>;
  allowPublic: boolean;
  busy: boolean;
  onToggleVisible: (checked: boolean) => void;
  onUpdateVisibility: (visibility: ImageVisibility) => void;
  onRemove: () => void;
  onClear: () => void;
};

const ImageBulkBar = ({
  visibleIds,
  selectedIds,
  allowPublic,
  busy,
  onToggleVisible,
  onUpdateVisibility,
  onRemove,
  onClear,
}: ImageBulkBarProps) => {
  const t = useTranslate();
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  return (
    <Paper withBorder className={classes.bulkBar}>
      <Checkbox
        checked={allVisibleSelected}
        indeterminate={!allVisibleSelected && someVisibleSelected}
        label={t("images.batch.selectVisible", {
          count: visibleIds.length.toString(),
        })}
        onChange={(event) => onToggleVisible(event.currentTarget.checked)}
      />
      {selectedIds.size > 0 ? (
        <Group gap="xs">
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
            leftSection={<Lock size={14} />}
            onClick={() => onUpdateVisibility("PRIVATE")}
          >
            {t("images.makePrivate")}
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            loading={busy}
            leftSection={<Trash2 size={14} />}
            onClick={onRemove}
          >
            {t("common.button.delete")}
          </Button>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t("images.batch.clear")}
            onClick={onClear}
          >
            <X size={16} />
          </ActionIcon>
        </Group>
      ) : null}
    </Paper>
  );
};

export default ImageBulkBar;
