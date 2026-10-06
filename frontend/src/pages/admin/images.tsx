import {
  Button,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import { Images as ImagesIcon, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import CenterLoader from "../../components/core/CenterLoader";
import EmptyState from "../../components/core/EmptyState";
import showConfirmDialog from "../../components/core/showConfirmDialog";
import AdminHostedImageDetailsModal from "../../components/image/AdminHostedImageDetailsModal";
import HostedImageCard from "../../components/image/HostedImageCard";
import ImageBulkBar from "../../components/image/ImageBulkBar";
import ImageStats from "../../components/image/ImageStats";
import Meta from "../../components/Meta";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import imageService from "../../services/image.service";
import {
  HostedImage,
  HostedImageStats,
  ImageVisibility,
} from "../../types/image.type";
import toast from "../../utils/toast.util";
import classes from "./images.module.css";

type VisibilityFilter = "ALL" | ImageVisibility;
type ImageSort = "createdAt_desc" | "createdAt_asc" | "name_asc" | "name_desc";

const pageSize = 36;

const AdminImages = () => {
  const t = useTranslate();
  const config = useConfig();
  const modals = useModals();
  const allowPublic = config.get("images.allowPublic") === true;
  const [images, setImages] = useState<HostedImage[]>();
  const [stats, setStats] = useState<HostedImageStats & { users: number }>();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [filter, setFilter] = useState<VisibilityFilter>("ALL");
  const [sort, setSort] = useState<ImageSort>("createdAt_desc");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<HostedImage | null>(null);

  const listParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      visibility: filter === "ALL" ? undefined : filter,
      sort,
      limit: pageSize,
    }),
    [debouncedSearch, filter, sort],
  );

  const refresh = useCallback(async () => {
    try {
      const [page, nextStats] = await Promise.all([
        imageService.adminList(listParams),
        imageService.adminStats(),
      ]);
      setImages(page.items);
      setNextCursor(page.nextCursor);
      setStats(nextStats);
      setSelectedIds(new Set());
    } catch (error) {
      toast.axiosError(error);
    }
  }, [listParams]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await imageService.adminList({
        ...listParams,
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

  const visibleIds = useMemo(
    () => (images ?? []).map((image) => image.id),
    [images],
  );
  const selectedIndex = selected
    ? (images ?? []).findIndex((image) => image.id === selected.id)
    : -1;

  const toggleImageSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const updateBatch = async (ids: string[], visibility: ImageVisibility) => {
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const updated = await imageService.adminUpdateBatch(ids, visibility);
      const updatedIds = new Set(ids);
      setImages((current) =>
        filter !== "ALL" && filter !== visibility
          ? current?.filter((image) => !updatedIds.has(image.id))
          : current?.map((image) =>
              updatedIds.has(image.id) ? { ...image, visibility } : image,
            ),
      );
      setSelected((current) =>
        current && updatedIds.has(current.id)
          ? filter !== "ALL" && filter !== visibility
            ? null
            : { ...current, visibility }
          : current,
      );
      setSelectedIds(new Set());
      setStats(await imageService.adminStats());
      toast.success(t("images.batch.updated", { count: updated.toString() }));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setBulkBusy(false);
    }
  };

  const updateVisibility = async (image: HostedImage) => {
    const visibility: ImageVisibility =
      image.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    setBulkBusy(true);
    try {
      await imageService.adminUpdateBatch([image.id], visibility);
      const updated = { ...image, visibility };
      setImages((current) =>
        filter !== "ALL" && filter !== visibility
          ? current?.filter((item) => item.id !== image.id)
          : current?.map((item) => (item.id === image.id ? updated : item)),
      );
      setSelected((current) =>
        current?.id === image.id
          ? filter !== "ALL" && filter !== visibility
            ? null
            : updated
          : current,
      );
      setStats(await imageService.adminStats());
      toast.success(t("images.visibility.updated"));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setBulkBusy(false);
    }
  };

  const remove = (image: HostedImage) =>
    showConfirmDialog(modals, {
      title: t("common.button.delete"),
      message: t("admin.images.deleteConfirm"),
      confirmLabel: t("common.button.delete"),
      cancelLabel: t("common.button.cancel"),
      onConfirm: async () => {
        try {
          await imageService.adminRemove(image.id);
          setSelected((current) => (current?.id === image.id ? null : current));
          await refresh();
          toast.success(t("admin.images.deleted"));
        } catch (error) {
          toast.axiosError(error);
        }
      },
    });

  const removeSelected = () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    showConfirmDialog(modals, {
      title: t("common.button.delete"),
      message: t("admin.images.batchDeleteConfirm", {
        count: ids.length.toString(),
      }),
      confirmLabel: t("common.button.delete"),
      cancelLabel: t("common.button.cancel"),
      onConfirm: async () => {
        setBulkBusy(true);
        try {
          const deleted = await imageService.adminRemoveBatch(ids);
          await refresh();
          toast.success(
            t("admin.images.batchDeleted", { count: deleted.toString() }),
          );
        } catch (error) {
          toast.axiosError(error);
        } finally {
          setBulkBusy(false);
        }
      },
    });
  };

  if (!images || !stats) {
    return (
      <>
        <Meta title={t("admin.images.title")} />
        <CenterLoader />
      </>
    );
  }

  return (
    <>
      <Meta title={t("admin.images.title")} />
      <Stack gap="lg" className={classes.page}>
        <header className={classes.header}>
          <Title order={3}>{t("admin.images.title")}</Title>
          <Text c="dimmed" size="sm">
            {t("admin.images.description", { users: stats.users.toString() })}
          </Text>
        </header>

        <ImageStats stats={stats} />

        <Paper withBorder className={classes.panel}>
          <div className={classes.toolbar}>
            <TextInput
              className={classes.search}
              leftSection={<Search size={17} />}
              placeholder={t("admin.images.search")}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Select
              value={sort}
              allowDeselect={false}
              data={[
                { value: "createdAt_desc", label: t("images.sort.newest") },
                { value: "createdAt_asc", label: t("images.sort.oldest") },
                { value: "name_asc", label: t("images.sort.nameAsc") },
                { value: "name_desc", label: t("images.sort.nameDesc") },
              ]}
              onChange={(value) =>
                setSort((value as ImageSort) ?? "createdAt_desc")
              }
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

          {images.length > 0 ? (
            <ImageBulkBar
              visibleIds={visibleIds}
              selectedIds={selectedIds}
              allowPublic={allowPublic}
              busy={bulkBusy}
              onToggleVisible={toggleVisibleSelection}
              onUpdateVisibility={(visibility) =>
                void updateBatch([...selectedIds], visibility)
              }
              onRemove={removeSelected}
              onClear={() => setSelectedIds(new Set())}
            />
          ) : null}

          {images.length === 0 ? (
            <EmptyState
              icon={<ImagesIcon size={22} />}
              title={t("admin.images.empty")}
              description={t("admin.images.emptyDescription")}
            />
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                {images.map((image) => (
                  <HostedImageCard
                    key={image.id}
                    image={image}
                    selected={selectedIds.has(image.id)}
                    allowPublic={allowPublic}
                    ownerLabel={
                      image.owner
                        ? `${image.owner.username} · ${image.owner.email}`
                        : undefined
                    }
                    onSelect={(checked) =>
                      toggleImageSelection(image.id, checked)
                    }
                    onOpen={() => {
                      setSelected(image);
                    }}
                    onToggleVisibility={() => void updateVisibility(image)}
                    onRemove={() => remove(image)}
                  />
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
        </Paper>
      </Stack>
      <AdminHostedImageDetailsModal
        image={selected}
        allowPublic={allowPublic}
        busy={bulkBusy}
        positionLabel={
          selectedIndex >= 0
            ? t("images.details.position", {
                current: (selectedIndex + 1).toString(),
                total: images.length.toString(),
              })
            : undefined
        }
        hasPrevious={selectedIndex > 0}
        hasNext={selectedIndex >= 0 && selectedIndex < images.length - 1}
        onClose={() => setSelected(null)}
        onPrevious={() => {
          if (selectedIndex > 0) setSelected(images[selectedIndex - 1]);
        }}
        onNext={() => {
          if (selectedIndex >= 0 && selectedIndex < images.length - 1) {
            setSelected(images[selectedIndex + 1]);
          }
        }}
        onToggleVisibility={() => {
          if (selected) void updateVisibility(selected);
        }}
        onRemove={() => {
          if (selected) void remove(selected);
        }}
      />
    </>
  );
};

export default AdminImages;
