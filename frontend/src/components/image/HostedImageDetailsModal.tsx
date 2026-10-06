import {
  Badge,
  Button,
  CopyButton,
  Group,
  Image,
  Modal,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import {
  Code2,
  Copy,
  Download,
  Globe2,
  Lock,
  Star,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import { HostedImage, ImageAlbum } from "../../types/image.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import classes from "../../pages/account/images.module.css";

type HostedImageDetailsModalProps = {
  image: HostedImage | null;
  draftName: string;
  savingName: boolean;
  allowPublic: boolean;
  albums: ImageAlbum[];
  onClose: () => void;
  onDraftNameChange: (name: string) => void;
  onSaveName: () => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
  onUpdateDetails: (input: {
    albumId?: string | null;
    favorite?: boolean;
    tags?: string[];
  }) => Promise<void>;
};

const HostedImageDetailsModal = ({
  image,
  draftName,
  savingName,
  allowPublic,
  albums,
  onClose,
  onDraftNameChange,
  onSaveName,
  onToggleVisibility,
  onRemove,
  onUpdateDetails,
}: HostedImageDetailsModalProps) => {
  const t = useTranslate();
  const intl = useIntl();
  const [tags, setTags] = useState<string[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    setTags(image?.tags ?? []);
  }, [image]);

  const updateDetails = async (
    input: Parameters<typeof onUpdateDetails>[0],
  ) => {
    setSavingDetails(true);
    try {
      await onUpdateDetails(input);
    } finally {
      setSavingDetails(false);
    }
  };

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
          <Group grow align="flex-end">
            <Select
              clearable
              searchable
              label={t("images.details.album")}
              placeholder={t("images.album.none")}
              data={albums.map((album) => ({
                value: album.id,
                label: album.name,
              }))}
              value={image.album?.id ?? null}
              disabled={savingDetails}
              onChange={(albumId) => void updateDetails({ albumId })}
            />
            <TagsInput
              label={t("images.details.tags")}
              value={tags}
              maxTags={12}
              disabled={savingDetails}
              onChange={setTags}
              onBlur={() => {
                if (tags.join("\0") !== image.tags.join("\0")) {
                  void updateDetails({ tags });
                }
              }}
            />
          </Group>
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <Button
                component="a"
                href={image.originalUrl}
                size="xs"
                variant="subtle"
                leftSection={<Download size={14} />}
              >
                {t("images.details.downloadOriginal")}
              </Button>
              <Button
                size="xs"
                variant={image.favorite ? "filled" : "light"}
                color="yellow"
                loading={savingDetails}
                leftSection={<Star size={14} />}
                onClick={() =>
                  void updateDetails({ favorite: !image.favorite })
                }
              >
                {t(
                  image.favorite
                    ? "images.details.unfavorite"
                    : "images.details.favorite",
                )}
              </Button>
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
