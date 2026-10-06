import {
  ActionIcon,
  Badge,
  Checkbox,
  CopyButton,
  Group,
  Image,
  Menu,
  Paper,
  Text,
} from "@mantine/core";
import {
  Code2,
  Copy,
  Globe2,
  Lock,
  MoreVertical,
  Star,
  Trash2,
} from "lucide-react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import { HostedImage } from "../../types/image.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import classes from "../../pages/account/images.module.css";

type HostedImageCardProps = {
  image: HostedImage;
  selected: boolean;
  allowPublic: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
};

const HostedImageCard = ({
  image,
  selected,
  allowPublic,
  onSelect,
  onOpen,
  onToggleVisibility,
  onRemove,
}: HostedImageCardProps) => {
  const t = useTranslate();
  const intl = useIntl();

  return (
    <Paper
      withBorder
      className={`${classes.card} ${selected ? classes.cardSelected : ""}`}
    >
      <div className={classes.selectControl}>
        <Checkbox
          checked={selected}
          aria-label={t("images.batch.selectImage", { name: image.name })}
          onChange={(event) => onSelect(event.currentTarget.checked)}
        />
      </div>
      <button
        type="button"
        className={classes.preview}
        onClick={onOpen}
        aria-label={t("images.preview", { name: image.name })}
      >
        <Image src={image.thumbnailUrl} alt={image.name} loading="lazy" />
      </button>
      <div className={classes.cardBody}>
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div className={classes.cardMeta}>
            <Text
              fw={600}
              size="sm"
              className={classes.fileName}
              title={image.name}
            >
              {image.name}
            </Text>
            <Text size="xs" c="dimmed">
              {image.width} × {image.height} ·{" "}
              {byteToHumanSizeString(Number(image.size))}
            </Text>
          </div>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={t("images.actions")}
              >
                <MoreVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {image.links ? (
                <>
                  <CopyButton value={image.links.direct}>
                    {({ copy }) => (
                      <Menu.Item
                        leftSection={<Copy size={15} />}
                        onClick={copy}
                      >
                        {t("images.copy.direct")}
                      </Menu.Item>
                    )}
                  </CopyButton>
                  <CopyButton value={image.links.markdown}>
                    {({ copy }) => (
                      <Menu.Item
                        leftSection={<Code2 size={15} />}
                        onClick={copy}
                      >
                        {t("images.copy.markdown")}
                      </Menu.Item>
                    )}
                  </CopyButton>
                  <CopyButton value={image.links.html}>
                    {({ copy }) => (
                      <Menu.Item
                        leftSection={<Code2 size={15} />}
                        onClick={copy}
                      >
                        {t("images.copy.html")}
                      </Menu.Item>
                    )}
                  </CopyButton>
                  <CopyButton value={image.links.bbcode}>
                    {({ copy }) => (
                      <Menu.Item
                        leftSection={<Code2 size={15} />}
                        onClick={copy}
                      >
                        {t("images.copy.bbcode")}
                      </Menu.Item>
                    )}
                  </CopyButton>
                </>
              ) : null}
              <Menu.Item
                disabled={image.visibility === "PRIVATE" && !allowPublic}
                leftSection={
                  image.visibility === "PUBLIC" ? (
                    <Lock size={15} />
                  ) : (
                    <Globe2 size={15} />
                  )
                }
                onClick={onToggleVisibility}
              >
                {t(
                  image.visibility === "PUBLIC"
                    ? "images.makePrivate"
                    : "images.makePublic",
                )}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<Trash2 size={15} />}
                onClick={onRemove}
              >
                {t("common.button.delete")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
        <Group
          justify="space-between"
          mt="md"
          align="flex-end"
          wrap="nowrap"
          className={classes.cardFooter}
        >
          <Group gap={6} className={classes.cardBadges}>
            <Badge
              size="sm"
              variant="light"
              color={image.visibility === "PUBLIC" ? "teal" : "gray"}
              leftSection={
                image.visibility === "PUBLIC" ? (
                  <Globe2 size={11} />
                ) : (
                  <Lock size={11} />
                )
              }
            >
              {t(
                image.visibility === "PUBLIC"
                  ? "images.visibility.public"
                  : "images.visibility.private",
              )}
            </Badge>
            {image.album ? (
              <Badge
                size="sm"
                variant="outline"
                color="gray"
                title={image.album.name}
              >
                {image.album.name}
              </Badge>
            ) : null}
            {image.favorite ? (
              <Badge
                size="sm"
                variant="light"
                color="yellow"
                aria-label={t("images.details.favorite")}
              >
                <Star size={11} fill="currentColor" />
              </Badge>
            ) : null}
          </Group>
          <Text size="xs" c="dimmed">
            {intl.formatDate(image.createdAt, {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </Group>
      </div>
    </Paper>
  );
};

export default HostedImageCard;
