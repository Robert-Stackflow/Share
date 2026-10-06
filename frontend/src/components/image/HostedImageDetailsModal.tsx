import {
  Badge,
  Button,
  CopyButton,
  Group,
  Image,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { Code2, Copy, Globe2, Lock, Trash2 } from "lucide-react";
import { FormEvent } from "react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import { HostedImage } from "../../types/image.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import classes from "../../pages/account/images.module.css";

type HostedImageDetailsModalProps = {
  image: HostedImage | null;
  draftName: string;
  savingName: boolean;
  allowPublic: boolean;
  onClose: () => void;
  onDraftNameChange: (name: string) => void;
  onSaveName: () => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
};

const HostedImageDetailsModal = ({
  image,
  draftName,
  savingName,
  allowPublic,
  onClose,
  onDraftNameChange,
  onSaveName,
  onToggleVisibility,
  onRemove,
}: HostedImageDetailsModalProps) => {
  const t = useTranslate();
  const intl = useIntl();

  const submitName = (event: FormEvent) => {
    event.preventDefault();
    onSaveName();
  };

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
          <Image
            src={image.url ?? image.contentUrl}
            alt={image.name}
            className={classes.modalImage}
            fit="contain"
          />
          <form onSubmit={submitName}>
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                className={classes.nameInput}
                label={t("images.details.name")}
                value={draftName}
                maxLength={255}
                onChange={(event) =>
                  onDraftNameChange(event.currentTarget.value)
                }
              />
              <Button
                type="submit"
                loading={savingName}
                disabled={!draftName.trim() || draftName === image.name}
              >
                {t("common.button.save")}
              </Button>
            </Group>
          </form>
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

export default HostedImageDetailsModal;
