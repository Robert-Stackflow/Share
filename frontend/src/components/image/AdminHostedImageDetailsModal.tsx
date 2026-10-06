import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Group,
  Image,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Globe2,
  Lock,
  Trash2,
} from "lucide-react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "../../pages/account/images.module.css";
import { HostedImage } from "../../types/image.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import modalClasses from "./AdminHostedImageDetailsModal.module.css";

type AdminHostedImageDetailsModalProps = {
  image: HostedImage | null;
  allowPublic: boolean;
  busy: boolean;
  positionLabel?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
};

const AdminHostedImageDetailsModal = ({
  image,
  allowPublic,
  busy,
  positionLabel,
  hasPrevious,
  hasNext,
  onClose,
  onPrevious,
  onNext,
  onToggleVisibility,
  onRemove,
}: AdminHostedImageDetailsModalProps) => {
  const t = useTranslate();
  const intl = useIntl();

  useHotkeys([
    ["ArrowLeft", () => image && hasPrevious && onPrevious()],
    ["ArrowRight", () => image && hasNext && onNext()],
  ]);

  return (
    <Modal
      opened={image !== null}
      onClose={onClose}
      title={t("images.details.title")}
      size="xl"
      centered
    >
      {image ? (
        <Stack gap="lg">
          <div className={modalClasses.preview}>
            <Image
              src={image.contentUrl}
              alt={image.name}
              className={classes.modalImage}
              fit="contain"
            />
            <ActionIcon
              className={modalClasses.previous}
              size="lg"
              radius="xl"
              variant="filled"
              color="dark"
              disabled={!hasPrevious}
              aria-label={t("images.details.previous")}
              onClick={onPrevious}
            >
              <ChevronLeft size={20} />
            </ActionIcon>
            <ActionIcon
              className={modalClasses.next}
              size="lg"
              radius="xl"
              variant="filled"
              color="dark"
              disabled={!hasNext}
              aria-label={t("images.details.next")}
              onClick={onNext}
            >
              <ChevronRight size={20} />
            </ActionIcon>
          </div>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <div>
              <Text fw={650}>{image.name}</Text>
              {image.owner ? (
                <Text size="sm" c="dimmed">
                  {t("admin.images.owner")}: {image.owner.username} ·{" "}
                  {image.owner.email}
                </Text>
              ) : null}
            </div>
            {positionLabel ? (
              <Badge variant="light" color="gray">
                {positionLabel}
              </Badge>
            ) : null}
          </Group>
          <div className={classes.detailsGrid}>
            <div>
              <Text size="xs" c="dimmed">
                {t("images.details.dimensions")}
              </Text>
              <Text size="sm">
                {image.width} × {image.height}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                {t("images.details.size")}
              </Text>
              <Text size="sm">{byteToHumanSizeString(Number(image.size))}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                {t("images.details.type")}
              </Text>
              <Text size="sm">{image.mimeType}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                {t("images.details.created")}
              </Text>
              <Text size="sm">
                {intl.formatDate(image.createdAt, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </div>
          </div>
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <Button
                component="a"
                href={image.originalUrl}
                download={image.name}
                size="xs"
                variant="subtle"
                leftSection={<Download size={14} />}
              >
                {t("images.details.downloadOriginal")}
              </Button>
              <Badge variant="light">
                {t("admin.images.views", { count: image.views.toString() })}
              </Badge>
              {image.links ? (
                <>
                  <CopyButton value={image.links.direct}>
                    {({ copied, copy }) => (
                      <Button
                        size="xs"
                        variant="light"
                        onClick={copy}
                        leftSection={<Copy size={14} />}
                      >
                        {copied
                          ? t("images.copy.copied")
                          : t("images.copy.direct")}
                      </Button>
                    )}
                  </CopyButton>
                  <CopyButton value={image.links.markdown}>
                    {({ copied, copy }) => (
                      <Button
                        size="xs"
                        variant="light"
                        onClick={copy}
                        leftSection={<Code2 size={14} />}
                      >
                        {copied
                          ? t("images.copy.copied")
                          : t("images.copy.markdown")}
                      </Button>
                    )}
                  </CopyButton>
                </>
              ) : (
                <Badge
                  variant="light"
                  color="gray"
                  leftSection={<Lock size={11} />}
                >
                  {t("images.visibility.private")}
                </Badge>
              )}
            </Group>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                loading={busy}
                disabled={image.visibility === "PRIVATE" && !allowPublic}
                leftSection={
                  image.visibility === "PUBLIC" ? (
                    <Lock size={14} />
                  ) : (
                    <Globe2 size={14} />
                  )
                }
                onClick={onToggleVisibility}
              >
                {t(
                  image.visibility === "PUBLIC"
                    ? "images.makePrivate"
                    : "images.makePublic",
                )}
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<Trash2 size={14} />}
                onClick={onRemove}
              >
                {t("common.button.delete")}
              </Button>
            </Group>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
};

export default AdminHostedImageDetailsModal;
