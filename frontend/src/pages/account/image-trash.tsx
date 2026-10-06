import { Button, Group, Image, Paper, SimpleGrid, Text } from "@mantine/core";
import { RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import CenterLoader from "../../components/core/CenterLoader";
import EmptyState from "../../components/core/EmptyState";
import ImageLibraryLayout, {
  ImagePanel,
} from "../../components/image/ImageLibraryLayout";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import imageService from "../../services/image.service";
import { HostedImage } from "../../types/image.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import classes from "./image-trash.module.css";

const ImageTrash = () => {
  const t = useTranslate();
  const config = useConfig();
  const retentionDays = Number(config.get("images.recycleRetentionDays")) || 30;
  const [images, setImages] = useState<HostedImage[]>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const page = await imageService.list({ trashed: true, limit: 36 });
      setImages(page.items);
      setNextCursor(page.nextCursor);
    } catch (error) {
      toast.axiosError(error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const restore = async (image: HostedImage) => {
    try {
      await imageService.restore(image.id);
      setImages((current) => current?.filter((item) => item.id !== image.id));
      toast.success(t("images.trash.restored"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const destroy = async (image: HostedImage) => {
    if (!window.confirm(t("images.trash.destroyConfirm"))) return;
    try {
      await imageService.destroy(image.id);
      setImages((current) => current?.filter((item) => item.id !== image.id));
      toast.success(t("images.trash.destroyed"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await imageService.list({
        trashed: true,
        limit: 36,
        cursor: nextCursor,
      });
      setImages((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!images) {
    return (
      <ImageLibraryLayout
        active="trash"
        title="images.trash.title"
        description="images.trash.description"
      >
        <ImagePanel>
          <CenterLoader />
        </ImagePanel>
      </ImageLibraryLayout>
    );
  }

  return (
    <ImageLibraryLayout
      active="trash"
      title="images.trash.title"
      description="images.trash.description"
    >
      <ImagePanel>
        <Text size="sm" c="dimmed" mb="lg">
          {t("images.trash.retention", { days: retentionDays.toString() })}
        </Text>
        {images.length === 0 ? (
          <EmptyState
            icon={<Trash2 size={22} />}
            title={t("images.trash.empty")}
            description={t("images.trash.emptyDescription")}
          />
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {images.map((image) => (
                <Paper withBorder className={classes.card} key={image.id}>
                  <Image
                    src={image.thumbnailUrl}
                    alt={image.name}
                    className={classes.preview}
                  />
                  <div className={classes.body}>
                    <Text fw={600} size="sm" truncate>
                      {image.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {byteToHumanSizeString(Number(image.size))}
                    </Text>
                    <Group gap="xs" mt="md">
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<RotateCcw size={14} />}
                        onClick={() => void restore(image)}
                      >
                        {t("images.trash.restore")}
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        leftSection={<Trash2 size={14} />}
                        onClick={() => void destroy(image)}
                      >
                        {t("images.trash.destroy")}
                      </Button>
                    </Group>
                  </div>
                </Paper>
              ))}
            </SimpleGrid>
            {nextCursor ? (
              <Group justify="center" mt="xl">
                <Button
                  variant="light"
                  loading={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {t("images.loadMore")}
                </Button>
              </Group>
            ) : null}
          </>
        )}
      </ImagePanel>
    </ImageLibraryLayout>
  );
};

export default ImageTrash;
