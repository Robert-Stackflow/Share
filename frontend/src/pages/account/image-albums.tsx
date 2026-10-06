import {
  ActionIcon,
  Button,
  Group,
  Image,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { Edit3, FolderOpen, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import CenterLoader from "../../components/core/CenterLoader";
import EmptyState from "../../components/core/EmptyState";
import ImageLibraryLayout, {
  ImagePanel,
} from "../../components/image/ImageLibraryLayout";
import useTranslate from "../../hooks/useTranslate.hook";
import imageService from "../../services/image.service";
import { ImageAlbum } from "../../types/image.type";
import toast from "../../utils/toast.util";
import classes from "./image-albums.module.css";

const ImageAlbums = () => {
  const t = useTranslate();
  const [albums, setAlbums] = useState<ImageAlbum[]>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setAlbums(await imageService.listAlbums());
    } catch (error) {
      toast.axiosError(error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await imageService.createAlbum({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      await refresh();
      toast.success(t("images.albums.created"));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setCreating(false);
    }
  };

  const rename = async (album: ImageAlbum) => {
    const nextName = window.prompt(t("images.albums.renamePrompt"), album.name);
    if (!nextName?.trim() || nextName.trim() === album.name) return;
    try {
      await imageService.updateAlbum(album.id, { name: nextName.trim() });
      await refresh();
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const remove = async (album: ImageAlbum) => {
    if (!window.confirm(t("images.albums.deleteConfirm"))) return;
    try {
      await imageService.removeAlbum(album.id);
      await refresh();
      toast.success(t("images.albums.deleted"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  if (!albums) {
    return (
      <ImageLibraryLayout
        active="albums"
        title="images.albums.title"
        description="images.albums.description"
      >
        <ImagePanel>
          <CenterLoader />
        </ImagePanel>
      </ImageLibraryLayout>
    );
  }

  return (
    <ImageLibraryLayout
      active="albums"
      title="images.albums.title"
      description="images.albums.description"
    >
      <ImagePanel
        title="images.albums.create"
        description="images.albums.createDescription"
      >
        <form onSubmit={(event) => void create(event)}>
          <Stack gap="md">
            <TextInput
              required
              maxLength={80}
              label={t("images.albums.name")}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <Textarea
              maxLength={240}
              label={t("images.albums.albumDescription")}
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button
                type="submit"
                loading={creating}
                leftSection={<Plus size={16} />}
              >
                {t("images.albums.createButton")}
              </Button>
            </Group>
          </Stack>
        </form>
      </ImagePanel>

      <ImagePanel>
        {albums.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={22} />}
            title={t("images.albums.empty")}
            description={t("images.albums.emptyDescription")}
          />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {albums.map((album) => (
              <Paper withBorder className={classes.album} key={album.id}>
                <Link
                  className={classes.cover}
                  href={`/account/images?album=${album.id}`}
                >
                  {album.coverUrl ? (
                    <Image src={album.coverUrl} alt="" />
                  ) : (
                    <FolderOpen size={36} />
                  )}
                </Link>
                <Group justify="space-between" wrap="nowrap" p="md">
                  <div className={classes.copy}>
                    <Title order={5}>{album.name}</Title>
                    <Text size="xs" c="dimmed">
                      {t("images.albums.count", {
                        count: album.imageCount.toString(),
                      })}
                    </Text>
                  </div>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={t("common.button.edit")}
                      onClick={() => void rename(album)}
                    >
                      <Edit3 size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={t("common.button.delete")}
                      onClick={() => void remove(album)}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        )}
      </ImagePanel>
    </ImageLibraryLayout>
  );
};

export default ImageAlbums;
