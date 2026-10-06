import {
  Alert,
  SegmentedControl,
  SimpleGrid,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Images as ImagesIcon, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import HostedImageCard from "../../components/image/HostedImageCard";
import HostedImageDetailsModal from "../../components/image/HostedImageDetailsModal";
import ImageApiPanel from "../../components/image/ImageApiPanel";
import ImageBulkBar from "../../components/image/ImageBulkBar";
import ImageStats from "../../components/image/ImageStats";
import ImageUploadPanel from "../../components/image/ImageUploadPanel";
import CenterLoader from "../../components/core/CenterLoader";
import EmptyState from "../../components/core/EmptyState";
import FormattedMessage from "../../components/core/FormattedMessage";
import Meta from "../../components/Meta";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import imageService from "../../services/image.service";
import {
  HostedImage,
  HostedImageStats,
  ImageVisibility,
} from "../../types/image.type";
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

const defaultMaxImageBytes = 25 * 1024 * 1024;
const uploadConcurrency = 3;

const Images = () => {
  const t = useTranslate();
  const config = useConfig();
  const uploadEnabled = config.get("images.uploadEnabled") === true;
  const apiUploadEnabled = config.get("images.apiUploadEnabled") === true;
  const allowPublic = config.get("images.allowPublic") === true;
  const defaultPublic = config.get("images.defaultPublic") === true;
  const configuredMaxSize = Number(config.get("images.maxSize"));
  const maxImageBytes =
    Number.isFinite(configuredMaxSize) && configuredMaxSize > 0
      ? configuredMaxSize
      : defaultMaxImageBytes;

  const [images, setImages] = useState<HostedImage[]>();
  const [stats, setStats] = useState<HostedImageStats>();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [filter, setFilter] = useState<VisibilityFilter>("ALL");
  const [uploadVisibility, setUploadVisibility] =
    useState<ImageVisibility>("PUBLIC");
  const [uploading, setUploading] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<HostedImage | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const refreshImages = useCallback(async () => {
    try {
      setImages(
        await imageService.list({
          q: debouncedSearch || undefined,
          visibility: filter === "ALL" ? undefined : filter,
        }),
      );
    } catch (error) {
      toast.axiosError(error);
    }
  }, [debouncedSearch, filter]);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await imageService.stats());
    } catch (error) {
      toast.axiosError(error);
    }
  }, []);

  useEffect(() => {
    void refreshImages();
  }, [refreshImages]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    setUploadVisibility(allowPublic && defaultPublic ? "PUBLIC" : "PRIVATE");
  }, [allowPublic, defaultPublic]);

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
            batch.map((file) => imageService.upload(file, uploadVisibility)),
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
          await Promise.all([refreshImages(), refreshStats()]);
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
      refreshImages,
      refreshStats,
      t,
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
      await refreshStats();
      toast.success(t("images.visibility.updated"));
    } catch (error) {
      toast.axiosError(error);
    }
  };

  const updateBatchVisibility = async (visibility: ImageVisibility) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const updated = await imageService.updateBatch(ids, visibility);
      const updates = new Map(updated.map((image) => [image.id, image]));
      setImages((current) =>
        current?.map((image) => updates.get(image.id) ?? image),
      );
      setSelected((current) =>
        current ? (updates.get(current.id) ?? current) : current,
      );
      setSelectedIds(new Set());
      await refreshStats();
      toast.success(
        t("images.batch.visibility", { count: updated.length.toString() }),
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
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(image.id);
        return next;
      });
      setSelected((current) => (current?.id === image.id ? null : current));
      await refreshStats();
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
      setSelected((current) =>
        current && deletedIds.has(current.id) ? null : current,
      );
      await refreshStats();
      toast.success(t("images.batch.deleted", { count: deleted.toString() }));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setBulkBusy(false);
    }
  };

  const openDetails = (image: HostedImage) => {
    setSelected(image);
    setDraftName(image.name);
  };

  const saveName = async () => {
    const name = draftName.trim();
    if (!selected || !name || name === selected.name) return;
    setSavingName(true);
    try {
      const updated = await imageService.update(selected.id, { name });
      setImages((current) =>
        current?.map((image) => (image.id === updated.id ? updated : image)),
      );
      setSelected(updated);
      setDraftName(updated.name);
      toast.success(t("images.rename.success"));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSavingName(false);
    }
  };

  if (!images) return <CenterLoader />;

  const effectiveStats =
    stats ??
    ({
      count: images.length,
      publicCount: images.filter((image) => image.visibility === "PUBLIC")
        .length,
      privateCount: images.filter((image) => image.visibility === "PRIVATE")
        .length,
      totalSize: images.reduce((sum, image) => sum + Number(image.size), 0),
    } satisfies HostedImageStats);

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
      </div>

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

      <ImageUploadPanel
        uploadEnabled={uploadEnabled}
        allowPublic={allowPublic}
        uploading={uploading}
        uploadVisibility={uploadVisibility}
        maxImageBytes={maxImageBytes}
        acceptedTypes={acceptedTypes}
        onVisibilityChange={setUploadVisibility}
        onFiles={(files) => void uploadFiles(files)}
      />

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

      {images.length > 0 ? (
        <ImageBulkBar
          visibleIds={visibleIds}
          selectedIds={selectedIds}
          allowPublic={allowPublic}
          busy={bulkBusy}
          onToggleVisible={toggleVisibleSelection}
          onUpdateVisibility={(visibility) =>
            void updateBatchVisibility(visibility)
          }
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
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {images.map((image) => (
            <HostedImageCard
              key={image.id}
              image={image}
              selected={selectedIds.has(image.id)}
              allowPublic={allowPublic}
              onSelect={(checked) => toggleImageSelection(image.id, checked)}
              onOpen={() => openDetails(image)}
              onToggleVisibility={() => void updateVisibility(image)}
              onRemove={() => void remove(image)}
            />
          ))}
        </SimpleGrid>
      )}

      <ImageApiPanel enabled={apiUploadEnabled && uploadEnabled} />

      <HostedImageDetailsModal
        image={selected}
        draftName={draftName}
        savingName={savingName}
        allowPublic={allowPublic}
        onClose={() => setSelected(null)}
        onDraftNameChange={setDraftName}
        onSaveName={() => void saveName()}
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

export default Images;
