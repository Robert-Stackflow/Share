import { Search } from "lucide-react";
import {
  Button,
  Center,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";
import FormattedMessage from "../../components/core/FormattedMessage";
import Meta from "../../components/Meta";
import AssetActionMenu from "../../components/asset/AssetActionMenu";
import AssetContentComposer from "../../components/content/AssetContentComposer";
import AssetTable from "../../components/asset/AssetTable";
import CenterLoader from "../../components/core/CenterLoader";
import useTranslate from "../../hooks/useTranslate.hook";
import assetService, { ListAssetParams } from "../../services/asset.service";
import {
  Asset,
  AssetSource,
  AssetTagSummary,
  AssetType,
  CreateAsset,
} from "../../types/asset.type";
import toast from "../../utils/toast.util";

type SortValue =
  | "createdAt_desc"
  | "createdAt_asc"
  | "lastAccessedAt_desc"
  | "name_asc";

const Assets = () => {
  const [assets, setAssets] = useState<Asset[]>();
  const [tags, setTags] = useState<AssetTagSummary[]>([]);
  const t = useTranslate();

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [typeFilter, setTypeFilter] = useState<AssetType | null>(null);
  const [sourceFilter, setSourceFilter] = useState<AssetSource | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortValue>("createdAt_desc");

  const filters: ListAssetParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      type: typeFilter ?? undefined,
      source: sourceFilter ?? undefined,
      favorite: favoriteOnly ? true : undefined,
      tag: tagFilter ?? undefined,
      sort,
    }),
    [debouncedSearch, typeFilter, sourceFilter, favoriteOnly, tagFilter, sort],
  );

  const refresh = () => {
    assetService.list(filters).then(setAssets).catch(toast.axiosError);
  };

  const refreshTags = () => {
    assetService.listTags().then(setTags).catch(toast.axiosError);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    refreshTags();
  }, []);

  if (!assets) return <CenterLoader />;
  const hasActiveFilter = Boolean(
    search || typeFilter || sourceFilter || favoriteOnly || tagFilter,
  );
  const showFilters = assets.length > 0 || hasActiveFilter;

  const clearFilters = () => {
    setSearch("");
    setTypeFilter(null);
    setSourceFilter(null);
    setFavoriteOnly(false);
    setTagFilter(null);
    setSort("createdAt_desc");
  };

  return (
    <>
      <Meta title={t("account.assets.title")} />
      <Title mb={30} order={3}>
        <FormattedMessage id="account.assets.title" />
      </Title>

      <Stack gap="sm" mb="xl">
        <AssetContentComposer
          target={t("account.assets.title")}
          buttonLabel={t("content.save-library")}
          onCreate={async (asset) => {
            const created = await assetService.create(asset as CreateAsset);
            setAssets((current) => [created, ...(current ?? [])]);
            toast.success(t("account.assets.notify.created"));
          }}
          uploadFile={(chunk, file, chunkIndex, totalChunks) =>
            assetService.uploadFile(chunk, file, chunkIndex, totalChunks)
          }
          onFilesUploaded={(uploaded) => {
            setAssets((current) => [...uploaded, ...(current ?? [])]);
            toast.success(t("account.assets.notify.created"));
          }}
        />
      </Stack>

      {showFilters && (
        <Group gap="sm" align="flex-end" wrap="wrap" mb="md">
          <TextInput
            leftSection={<Search />}
            placeholder={t("account.assets.filter.search")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: "1 1 220px" }}
          />
          <Select
            aria-label={t("account.assets.table.type")}
            clearable
            data={[
              { value: "FILE", label: t("account.assets.type.file") },
              { value: "TEXT", label: t("account.assets.type.text") },
              { value: "LINK", label: t("account.assets.type.link") },
            ]}
            placeholder={t("account.assets.filter.type.all")}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as AssetType | null)}
            w={130}
          />
          <Select
            aria-label={t("account.assets.filter.source.all")}
            clearable
            data={[
              { value: "UPLOAD", label: t("account.assets.source.upload") },
              { value: "SHARE", label: t("account.assets.source.share") },
              { value: "ROOM", label: t("account.assets.source.room") },
              { value: "INBOX", label: t("account.assets.source.inbox") },
            ]}
            placeholder={t("account.assets.filter.source.all")}
            value={sourceFilter}
            onChange={(value) => setSourceFilter(value as AssetSource | null)}
            w={140}
          />
          <Select
            aria-label={t("account.assets.filter.tag.all")}
            clearable
            data={tags.map((tag) => ({
              value: tag.name,
              label: `${tag.name} (${tag._count.assignments})`,
            }))}
            placeholder={t("account.assets.filter.tag.all")}
            value={tagFilter}
            onChange={setTagFilter}
            w={160}
          />
          <Select
            aria-label={t("account.assets.sort.createdAt_desc")}
            data={[
              {
                value: "createdAt_desc",
                label: t("account.assets.sort.createdAt_desc"),
              },
              {
                value: "createdAt_asc",
                label: t("account.assets.sort.createdAt_asc"),
              },
              {
                value: "lastAccessedAt_desc",
                label: t("account.assets.sort.lastAccessedAt_desc"),
              },
              {
                value: "name_asc",
                label: t("account.assets.sort.name_asc"),
              },
            ]}
            value={sort}
            onChange={(value) =>
              setSort((value as SortValue) ?? "createdAt_desc")
            }
            w={170}
          />
          <Switch
            label={t("account.assets.filter.favorite")}
            checked={favoriteOnly}
            onChange={(event) => setFavoriteOnly(event.currentTarget.checked)}
          />
        </Group>
      )}

      <AssetTable
        responsiveCards
        assets={assets}
        headers={{
          type: <FormattedMessage id="account.assets.table.type" />,
          value: <FormattedMessage id="account.assets.table.value" />,
          createdAt: <FormattedMessage id="account.assets.table.createdAt" />,
          size: <FormattedMessage id="account.assets.table.size" />,
        }}
        empty={
          <Center style={{ height: "45vh" }}>
            <Stack align="center" gap={10}>
              <Title order={3}>
                <FormattedMessage
                  id={
                    hasActiveFilter
                      ? "account.assets.title.noResults"
                      : "account.assets.title.empty"
                  }
                />
              </Title>
              <Text>
                <FormattedMessage
                  id={
                    hasActiveFilter
                      ? "account.assets.description.noResults"
                      : "account.assets.description.empty"
                  }
                />
              </Text>
              {hasActiveFilter && (
                <Button variant="light" onClick={clearFilters}>
                  {t("account.assets.filter.clear")}
                </Button>
              )}
            </Stack>
          </Center>
        }
        renderActions={(asset) => (
          <AssetActionMenu
            asset={asset}
            onAssetCreated={(createdAsset) => {
              setAssets((current) => [createdAsset, ...(current ?? [])]);
            }}
            onAssetDeleted={(assetId) => {
              setAssets((current) =>
                current?.filter((item) => item.id !== assetId),
              );
            }}
            onAssetUpdated={(updatedAsset) => {
              setAssets((current) =>
                current?.map((item) =>
                  item.id === updatedAsset.id ? updatedAsset : item,
                ),
              );
            }}
            onTagsUpdated={refreshTags}
          />
        )}
      />
    </>
  );
};

export default Assets;
