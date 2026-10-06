import {
  Alert,
  Button,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Switch,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Images as ImagesIcon, Search } from "lucide-react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import CenterLoader from "../../components/core/CenterLoader";
import EmptyState from "../../components/core/EmptyState";
import FormattedMessage from "../../components/core/FormattedMessage";
import HostedImageCard from "../../components/image/HostedImageCard";
import HostedImageDetailsModal from "../../components/image/HostedImageDetailsModal";
import ImageBulkBar from "../../components/image/ImageBulkBar";
import ImageLibraryLayout, {
  ImagePanel,
} from "../../components/image/ImageLibraryLayout";
import ImageStats from "../../components/image/ImageStats";
import ImageUploadPanel from "../../components/image/ImageUploadPanel";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import assetService from "../../services/asset.service";
import imageService from "../../services/image.service";
import {
  HostedImage,
  HostedImageStats,
  ImageAlbum,
  ImageVisibility,
} from "../../types/image.type";
import { AssetTagSummary } from "../../types/asset.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import classes from "./images.module.css";

type VisibilityFilter = "ALL" | ImageVisibility;
type ImageSort = "createdAt_desc" | "createdAt_asc" | "name_asc" | "name_desc";

const acceptedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
const defaultMaxImageBytes = 25 * 1024 * 1024;
const uploadConcurrency = 3;
const pageSize = 36;

const Images = () => {
  const t = useTranslate();
  const router = useRouter();
  const config = useConfig();
  const uploadEnabled = config.get("images.uploadEnabled") === true;
  const allowPublic = config.get("images.allowPublic") === true;
  const defaultPublic = config.get("images.defaultPublic") === true;
  const configuredMaxSize = Number(config.get("images.maxSize"));
  const maxImageBytes =
    Number.isFinite(configuredMaxSize) && configuredMaxSize > 0
      ? configuredMaxSize
      : defaultMaxImageBytes;

  const [images, setImages] = useState<HostedImage[]>();
  const [albums, setAlbums] = useState<ImageAlbum[]>([]);
  const [tags, setTags] = useState<AssetTagSummary[]>([]);
  const [stats, setStats] = useState<HostedImageStats>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [filter, setFilter] = useState<VisibilityFilter>("ALL");
  const [sort, setSort] = useState<ImageSort>("createdAt_desc");
  const [albumFilter, setAlbumFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [uploadAlbumId, setUploadAlbumId] = useState<string | null>(null);
  const [uploadVisibility, setUploadVisibility] =
    useState<ImageVisibility>(
      allowPublic && defaultPublic ? "PUBLIC" : "PRIVATE",
    );
  const [uploading, setUploading] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<HostedImage | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const listParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      visibility: filter === "ALL" ? undefined : filter,
      albumId: albumFilter ?? undefined,
      tag: tagFilter ?? undefined,
      favorite: favoriteOnly ? true : undefined,
      sort,
      limit: pageSize,
    }),
    [albumFilter, debouncedSearch, favoriteOnly, filter, sort, tagFilter],
  );

  const refreshImages = useCallback(async () => {
    try {
      const page = await imageService.list(listParams);
      setImages(page.items);
      setNextCursor(page.nextCursor);
      setSelectedIds(new Set());
    } catch (error) {
      toast.axiosError(error);
    }
  }, [listParams]);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await imageService.stats());
    } catch (error) {
      toast.axiosError(error);
    }
  }, []);

  const refreshAlbums = useCallback(async () => {
    try {
      setAlbums(await imageService.listAlbums());
    } catch (error) {
      toast.axiosError(error);
    }
  }, []);

  const refreshTags = useCallback(async () => {
    try {
      setTags(await assetService.listTags());
    } catch (error) {
      toast.axiosError(error);
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const albumId =
      typeof router.query.album === "string" ? router.query.album : null;
    setAlbumFilter(albumId);
    setUploadAlbumId(albumId);
  }, [router.isReady, router.query.album]);

  useEffect(() => {
    void refreshImages();
  }, [refreshImages]);

  useEffect(() => {
    void Promise.all([refreshStats(), refreshAlbums(), refreshTags()]);
  }, [refreshAlbums, refreshStats, refreshTags]);

  useEffect(() => {
    if (!allowPublic) {
      setUploadVisibility("PRIVATE");
      return;
    }
    imageService
      .getPreferences()
      .then((preference) => setUploadVisibility(preference.defaultVisibility))
      .catch(toast.axiosError);
  }, [allowPublic]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await imageService.list({
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

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!uploadEnabled) {
        toast.error(t("images.upload.disabled"));
        return;
      }
      const supported = files.filter(
        (file) =>
          acceptedTypes.includes(file.type) && file.size <= maxImageBytes,
      );
      if (!supported.length) {
        toast.error(
          t("images.upload.invalid", {
            size: byteToHumanSizeString(maxImageBytes),
          }),
        );
        return;
      }

      setUploading(true);
      let uploadedCount = 0;
      let failedCount = files.length - supported.length;
      try {
        for (
          let index = 0;
          index < supported.length;
          index += uploadConcurrency
        ) {
          const batch = supported.slice(index, index + uploadConcurrency);
          const results = await Promise.allSettled(
            batch.map((file) =>
              imageService.upload(
                file,
                uploadVisibility,
                uploadAlbumId ?? undefined,
              ),
            ),
          );
          for (const result of results) {
            if (result.status === "fulfilled") uploadedCount += 1;
            else failedCount += 1;
          }
        }
        if (uploadedCount) {
          toast.success(
            t("images.upload.success", { count: uploadedCount.toString() }),
          );
          await Promise.all([refreshImages(), refreshStats(), refreshAlbums()]);
        }
        if (failedCount) {
          toast.error(
            t("images.upload.partial", { count: failedCount.toString() }),
          );
        }
      } finally {
        setUploading(false);
      }
    },
    [
      maxImageBytes,
      refreshAlbums,
      refreshImages,
      refreshStats,
      t,
      uploadAlbumId,
      uploadEnabled,
      uploadVisibility,
    ],
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

  const visibleIds = useMemo(
    () => (images ?? []).map((image) => image.id),
    [images],
  );

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

  const updateImage = (updated: HostedImage) => {
    setImages((current) =>
      current?.map((item) => (item.id === updated.id ? updated : item)),
    );
    setSelected((current) => (current?.id === updated.id ? updated : current));
  };

  const updateVisibility = async (image: HostedImage) => {
    try {
      updateImage(
        await imageService.update(image.id, {
          visibility: image.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
        }),
      );
      await refreshStats();
      toast.success(t("images.visibility.updated"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const updateBatch = async (input: {
    visibility?: ImageVisibility;
    albumId?: string | null;
  }) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const updated = await imageService.updateBatch(ids, input);
      const updates = new Map(updated.map((image) => [image.id, image]));
      setImages((current) =>
        current?.map((image) => updates.get(image.id) ?? image),
      );
      setSelectedIds(new Set());
      await Promise.all([refreshStats(), refreshAlbums()]);
      toast.success(
        t("images.batch.updated", { count: updated.length.toString() }),
      );
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setBulkBusy(false);
    }
  };

  const remove = async (image: HostedImage) => {
    if (!window.confirm(t("images.delete.confirm"))) return;
    try {
      await imageService.remove(image.id);
      setImages((current) => current?.filter((item) => item.id !== image.id));
      setSelected((current) => (current?.id === image.id ? null : current));
      await Promise.all([refreshStats(), refreshAlbums()]);
      toast.success(t("images.delete.success"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const removeSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length || !window.confirm(t("images.batch.deleteConfirm"))) return;
    setBulkBusy(true);
    try {
      const deleted = await imageService.removeBatch(ids);
      const deletedIds = new Set(ids);
      setImages((current) =>
        current?.filter((image) => !deletedIds.has(image.id)),
      );
      setSelectedIds(new Set());
      await Promise.all([refreshStats(), refreshAlbums()]);
      toast.success(t("images.batch.deleted", { count: deleted.toString() }));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setBulkBusy(false);
    }
  };

  const saveName = async () => {
    const name = draftName.trim();
    if (!selected || !name || name === selected.name) return;
    setSavingName(true);
    try {
      const updated = await imageService.update(selected.id, { name });
      updateImage(updated);
      setDraftName(updated.name);
      toast.success(t("images.rename.success"));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSavingName(false);
    }
  };

  if (!images) {
    return (
      <ImageLibraryLayout
        active="library"
        title="images.title"
        description="images.description"
      >
        <ImagePanel>
          <CenterLoader />
        </ImagePanel>
      </ImageLibraryLayout>
    );
  }

  const effectiveStats =
    stats ??
    ({
      count: images.length,
      publicCount: images.filter((image) => image.visibility === "PUBLIC")
        .length,
      privateCount: images.filter((image) => image.visibility === "PRIVATE")
        .length,
      totalSize: images.reduce((sum, image) => sum + Number(image.size), 0),
      views: images.reduce((sum, image) => sum + image.views, 0),
    } satisfies HostedImageStats);

  return (
    <ImageLibraryLayout
      active="library"
      title="images.title"
      description="images.description"
    >
      <ImageStats stats={effectiveStats} />

      {!uploadEnabled ? (
        <Alert color="red" title={t("images.policy.uploadDisabled.title")}>
          {t("images.policy.uploadDisabled.description")}
        </Alert>
      ) : !allowPublic ? (
        <Alert color="blue" title={t("images.policy.privateOnly.title")}>
          {t("images.policy.privateOnly.description")}
        </Alert>
      ) : null}

      <ImagePanel>
        <ImageUploadPanel
          uploadEnabled={uploadEnabled}
          allowPublic={allowPublic}
          uploading={uploading}
          uploadVisibility={uploadVisibility}
          maxImageBytes={maxImageBytes}
          acceptedTypes={acceptedTypes}
          albums={albums}
          albumId={uploadAlbumId}
          onAlbumChange={setUploadAlbumId}
          onVisibilityChange={setUploadVisibility}
          onFiles={(files) => void uploadFiles(files)}
        />
      </ImagePanel>

      <ImagePanel>
        <div className={classes.toolbar}>
          <TextInput
            className={classes.search}
            leftSection={<Search size={17} />}
            placeholder={t("images.search")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            clearable
            searchable
            placeholder={t("images.album.all")}
            data={albums.map((album) => ({
              value: album.id,
              label: album.name,
            }))}
            value={albumFilter}
            onChange={setAlbumFilter}
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
          <Select
            clearable
            searchable
            placeholder={t("images.tags.all")}
            data={tags.map((tag) => ({
              value: tag.name,
              label: `${tag.name} (${tag._count.assignments})`,
            }))}
            value={tagFilter}
            onChange={setTagFilter}
          />
          <Switch
            label={t("images.favoriteOnly")}
            checked={favoriteOnly}
            onChange={(event) => setFavoriteOnly(event.currentTarget.checked)}
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
            albums={albums}
            onToggleVisible={toggleVisibleSelection}
            onUpdateVisibility={(visibility) =>
              void updateBatch({ visibility })
            }
            onMove={(albumId) => void updateBatch({ albumId })}
            onRemove={() => void removeSelected()}
            onClear={() => setSelectedIds(new Set())}
          />
        ) : null}

        {images.length === 0 ? (
          <EmptyState
            icon={<ImagesIcon size={22} />}
            title={<FormattedMessage id="images.empty.title" />}
            description={<FormattedMessage id="images.empty.description" />}
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
                  onSelect={(checked) =>
                    toggleImageSelection(image.id, checked)
                  }
                  onOpen={() => {
                    setSelected(image);
                    setDraftName(image.name);
                  }}
                  onToggleVisibility={() => void updateVisibility(image)}
                  onRemove={() => void remove(image)}
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
      </ImagePanel>

      <HostedImageDetailsModal
        image={selected}
        draftName={draftName}
        savingName={savingName}
        allowPublic={allowPublic}
        albums={albums}
        onClose={() => setSelected(null)}
        onDraftNameChange={setDraftName}
        onSaveName={() => void saveName()}
        onToggleVisibility={() => {
          if (selected) void updateVisibility(selected);
        }}
        onRemove={() => {
          if (selected) void remove(selected);
        }}
        onUpdateDetails={async (input) => {
          if (!selected) return;
          try {
            updateImage(await imageService.update(selected.id, input));
            await Promise.all([refreshAlbums(), refreshTags()]);
            toast.success(t("images.details.updated"));
          } catch (error) {
            toast.axiosError(error);
          }
        }}
      />
    </ImageLibraryLayout>
  );
};

export default Images;
