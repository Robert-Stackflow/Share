import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Image,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import CenterLoader from "../../components/core/CenterLoader";
import Meta from "../../components/Meta";
import ImageStats from "../../components/image/ImageStats";
import useTranslate from "../../hooks/useTranslate.hook";
import imageService from "../../services/image.service";
import { HostedImage, HostedImageStats } from "../../types/image.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import classes from "./images.module.css";

type Filter = "ALL" | "PUBLIC" | "PRIVATE";

const AdminImages = () => {
  const t = useTranslate();
  const [images, setImages] = useState<HostedImage[]>();
  const [stats, setStats] = useState<HostedImageStats & { users: number }>();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [page, nextStats] = await Promise.all([
        imageService.adminList({
          q: debouncedSearch || undefined,
          visibility: filter === "ALL" ? undefined : filter,
          limit: 100,
        }),
        imageService.adminStats(),
      ]);
      setImages(page.items);
      setNextCursor(page.nextCursor);
      setStats(nextStats);
    } catch (error) {
      toast.axiosError(error);
    }
  }, [debouncedSearch, filter]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await imageService.adminList({
        q: debouncedSearch || undefined,
        visibility: filter === "ALL" ? undefined : filter,
        cursor: nextCursor,
        limit: 100,
      });
      setImages((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (image: HostedImage) => {
    if (!window.confirm(t("admin.images.deleteConfirm"))) return;
    try {
      await imageService.adminRemove(image.id);
      await refresh();
      toast.success(t("admin.images.deleted"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  if (!images || !stats) return <CenterLoader />;

  return (
    <>
      <Meta title={t("admin.images.title")} />
      <Group justify="space-between" align="baseline" mb="lg">
        <div>
          <Title order={3}>{t("admin.images.title")}</Title>
          <Text c="dimmed" size="sm">
            {t("admin.images.description", { users: stats.users.toString() })}
          </Text>
        </div>
      </Group>
      <ImageStats stats={stats} />
      <Paper withBorder className={classes.panel}>
        <Group justify="space-between" mb="lg">
          <TextInput
            className={classes.search}
            leftSection={<Search size={17} />}
            placeholder={t("images.search")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <SegmentedControl
            value={filter}
            onChange={(value) => setFilter(value as Filter)}
            data={[
              { value: "ALL", label: t("images.filter.all") },
              { value: "PUBLIC", label: t("images.visibility.public") },
              { value: "PRIVATE", label: t("images.visibility.private") },
            ]}
          />
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {images.map((image) => (
            <Paper withBorder className={classes.card} key={image.id}>
              <Image
                src={image.thumbnailUrl}
                alt={image.name}
                className={classes.preview}
              />
              <div className={classes.body}>
                <Group justify="space-between" wrap="nowrap">
                  <div className={classes.copy}>
                    <Text fw={600} size="sm" truncate>
                      {image.name}
                    </Text>
                    <Text c="dimmed" size="xs" truncate>
                      {image.owner?.username} · {image.owner?.email}
                    </Text>
                  </div>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    aria-label={t("common.button.delete")}
                    onClick={() => void remove(image)}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Group>
                <Group justify="space-between" mt="md">
                  <Badge
                    variant="light"
                    color={image.visibility === "PUBLIC" ? "teal" : "gray"}
                  >
                    {t(
                      image.visibility === "PUBLIC"
                        ? "images.visibility.public"
                        : "images.visibility.private",
                    )}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {byteToHumanSizeString(Number(image.size))} ·{" "}
                    {t("admin.images.views", {
                      count: image.views.toString(),
                    })}
                  </Text>
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
      </Paper>
    </>
  );
};

export default AdminImages;
