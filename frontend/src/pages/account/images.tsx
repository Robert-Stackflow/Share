import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  FileButton,
  Group,
  Image,
  Menu,
  Modal,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  Clipboard,
  Code2,
  Copy,
  Globe2,
  Images as ImagesIcon,
  Lock,
  MoreVertical,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import EmptyState from "../../components/core/EmptyState";
import FormattedMessage from "../../components/core/FormattedMessage";
import CenterLoader from "../../components/core/CenterLoader";
import Meta from "../../components/Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import imageService from "../../services/image.service";
import { HostedImage, ImageVisibility } from "../../types/image.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import classes from "./images.module.css";

type VisibilityFilter = "ALL" | ImageVisibility;

const acceptedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const maxImageBytes = 25 * 1024 * 1024;

const Images = () => {
  const t = useTranslate();
  const intl = useIntl();
  const [images, setImages] = useState<HostedImage[]>();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [filter, setFilter] = useState<VisibilityFilter>("ALL");
  const [uploadVisibility, setUploadVisibility] =
    useState<ImageVisibility>("PUBLIC");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<HostedImage | null>(null);

  const refresh = useCallback(() => {
    imageService
      .list({
        q: debouncedSearch || undefined,
        visibility: filter === "ALL" ? undefined : filter,
      })
      .then(setImages)
      .catch(toast.axiosError);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const supported = files.filter(
        (file) =>
          acceptedTypes.includes(file.type) && file.size <= maxImageBytes,
      );
      if (!supported.length) {
        toast.error(t("images.upload.invalid"));
        return;
      }

      setUploading(true);
      const results = await Promise.allSettled(
        supported.map((file) => imageService.upload(file, uploadVisibility)),
      );
      const uploaded = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const failed = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      if (uploaded.length) {
        setImages((current) => [...uploaded, ...(current ?? [])]);
        toast.success(
          t("images.upload.success", { count: uploaded.length.toString() }),
        );
      }
      if (failed) toast.axiosError(failed.reason);
      setUploading(false);
    },
    [t, uploadVisibility],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter(
        (file) => file.type.startsWith("image/"),
      );
      if (files.length) void uploadFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploadFiles]);

  const totalSize = useMemo(
    () => (images ?? []).reduce((sum, image) => sum + Number(image.size), 0),
    [images],
  );

  const updateVisibility = async (image: HostedImage) => {
    try {
      const updated = await imageService.update(image.id, {
        visibility: image.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
      });
      setImages((current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelected((current) =>
        current?.id === updated.id ? updated : current,
      );
      toast.success(t("images.visibility.updated"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const remove = async (image: HostedImage) => {
    if (!window.confirm(t("images.delete.confirm"))) return;
    try {
      await imageService.remove(image.id);
      setImages((current) => current?.filter((item) => item.id !== image.id));
      setSelected((current) => (current?.id === image.id ? null : current));
      toast.success(t("images.delete.success"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  };

  if (!images) return <CenterLoader />;

  return (
    <>
      <Meta title={t("images.title")} />
      <div className={classes.hero}>
        <div className={classes.heroCopy}>
          <Title order={2} mb={6}>
            <FormattedMessage id="images.title" />
          </Title>
          <Text c="dimmed">
            <FormattedMessage id="images.description" />
          </Text>
        </div>
        <Group gap="xs">
          <Badge variant="light" size="lg">
            {t("images.stats.count", { count: images.length.toString() })}
          </Badge>
          <Badge variant="light" color="gray" size="lg">
            {byteToHumanSizeString(totalSize)}
          </Badge>
        </Group>
      </div>

      <Paper
        withBorder
        className={`${classes.dropzone} ${dragging ? classes.dropzoneActive : ""}`}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <Group wrap="nowrap">
          <div className={classes.dropIcon}>
            <UploadCloud size={25} />
          </div>
          <div>
            <Text fw={650}>{t("images.upload.title")}</Text>
            <Text size="sm" c="dimmed">
              {t("images.upload.description")}
            </Text>
            <Group gap={6} mt={6}>
              <Clipboard size={14} />
              <Text size="xs" c="dimmed">
                {t("images.upload.paste")}
              </Text>
            </Group>
          </div>
        </Group>
        <Group>
          <SegmentedControl
            size="xs"
            value={uploadVisibility}
            onChange={(value) => setUploadVisibility(value as ImageVisibility)}
            data={[
              { value: "PUBLIC", label: t("images.visibility.public") },
              { value: "PRIVATE", label: t("images.visibility.private") },
            ]}
          />
          <FileButton
            onChange={(files) => void uploadFiles(files ?? [])}
            accept={acceptedTypes.join(",")}
            multiple
          >
            {(props) => (
              <Button
                {...props}
                loading={uploading}
                leftSection={<UploadCloud size={17} />}
              >
                {t("images.upload.button")}
              </Button>
            )}
          </FileButton>
        </Group>
      </Paper>

      <div className={classes.toolbar}>
        <TextInput
          className={classes.search}
          leftSection={<Search size={17} />}
          placeholder={t("images.search")}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as VisibilityFilter)}
          data={[
            { value: "ALL", label: t("images.filter.all") },
            { value: "PUBLIC", label: t("images.visibility.public") },
            { value: "PRIVATE", label: t("images.visibility.private") },
          ]}
        />
      </div>

      {images.length === 0 ? (
        <EmptyState
          icon={<ImagesIcon size={22} />}
          title={<FormattedMessage id="images.empty.title" />}
          description={<FormattedMessage id="images.empty.description" />}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {images.map((image) => (
            <Paper withBorder className={classes.card} key={image.id}>
              <button
                type="button"
                className={classes.preview}
                onClick={() => setSelected(image)}
                aria-label={t("images.preview", { name: image.name })}
              >
                <Image
                  src={image.url ?? image.contentUrl}
                  alt={image.name}
                  loading="lazy"
                />
              </button>
              <div className={classes.cardBody}>
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
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
                      {image.links && (
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
                      )}
                      <Menu.Item
                        leftSection={
                          image.visibility === "PUBLIC" ? (
                            <Lock size={15} />
                          ) : (
                            <Globe2 size={15} />
                          )
                        }
                        onClick={() => void updateVisibility(image)}
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
                        onClick={() => void remove(image)}
                      >
                        {t("common.button.delete")}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
                <Group justify="space-between" mt="md">
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
                  <Text size="xs" c="dimmed">
                    {intl.formatDate(image.createdAt, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </Group>
              </div>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      <Modal
        opened={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name}
        size="xl"
        centered
      >
        {selected && (
          <Stack>
            <Image
              src={selected.url ?? selected.contentUrl}
              alt={selected.name}
              className={classes.modalImage}
              fit="contain"
            />
            <Group justify="space-between" wrap="wrap">
              <Text size="sm" c="dimmed">
                {selected.width} × {selected.height} ·{" "}
                {byteToHumanSizeString(Number(selected.size))}
              </Text>
              {selected.links && (
                <Group gap="xs">
                  <CopyButton value={selected.links.direct}>
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
                  <CopyButton value={selected.links.markdown}>
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
                </Group>
              )}
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
};

export default Images;
