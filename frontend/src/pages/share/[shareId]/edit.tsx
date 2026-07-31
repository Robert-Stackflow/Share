import { LoadingOverlay, Paper, Stack, Text, Title } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { GetStaticPaths, GetStaticProps } from "next";
import { FormattedMessage } from "react-intl";
import { useEffect, useMemo, useState } from "react";
import Meta from "../../../components/Meta";
import AssetTable, {
  sortAssetsByCreatedAtDesc,
} from "../../../components/asset/AssetTable";
import AssetActionMenu from "../../../components/asset/AssetActionMenu";
import AssetComposer from "../../../components/asset/AssetComposer";
import showErrorModal from "../../../components/share/showErrorModal";
import useConfirmLeave from "../../../hooks/confirm-leave.hook";
import useTranslate from "../../../hooks/useTranslate.hook";
import useStaticRouteParam from "../../../hooks/staticRouteParam.hook";
import shareService from "../../../services/share.service";
import { Asset, CreateAsset } from "../../../types/asset.type";
import { Share as ShareType } from "../../../types/share.type";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { shareId: "_" } }],
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({ props: { shareId: "_" } });

const Share = () => {
  const shareId = useStaticRouteParam("shareId", 1);
  const t = useTranslate();
  const modals = useModals();

  const [isLoading, setIsLoading] = useState(true);
  const [share, setShare] = useState<ShareType>();
  const allAssets = useMemo(
    () => sortAssetsByCreatedAtDesc(share?.assets ?? []),
    [share?.assets],
  );

  const reloadShare = async () => {
    if (!shareId) return;
    const fresh = await shareService.getFromOwner(shareId);
    setShare(fresh);
  };

  useConfirmLeave({
    message: t("upload.notify.confirm-leave"),
    enabled: isLoading,
  });

  useEffect(() => {
    if (!shareId) return;
    shareService
      .getFromOwner(shareId)
      .then((share) => {
        setShare(share);
      })
      .catch((e) => {
        const { error } = e.response.data;
        if (e.response.status == 404) {
          if (error == "share_removed") {
            showErrorModal(
              modals,
              t("share.error.removed.title"),
              e.response.data.message,
            );
          } else {
            showErrorModal(
              modals,
              t("share.error.not-found.title"),
              t("share.error.not-found.description"),
            );
          }
        } else if (e.response.status == 403 && error == "share_removed") {
          showErrorModal(
            modals,
            t("share.error.access-denied.title"),
            t("share.error.access-denied.description"),
          );
        } else {
          showErrorModal(modals, t("common.error"), t("common.error.unknown"));
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [shareId]);

  const removeShareAsset = async (asset: Asset) => {
    await shareService.removeAsset(shareId, asset.id);
    if (asset.type === "FILE") {
      // FILE deletion also drops stored bytes and the files projection, so
      // refetch to keep the item list and the upload panel in sync.
      await reloadShare();
      return;
    }
    setShare((current) =>
      current
        ? {
            ...current,
            assets: current.assets?.filter((item) => item.id !== asset.id),
          }
        : current,
    );
  };

  if (isLoading) return <LoadingOverlay visible />;

  return (
    <>
      <Meta title={t("share.edit.title", { shareId })} />
      <Stack gap="lg">
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Title order={4}>
              <FormattedMessage id="share.asset.add.title" />
            </Title>
            <AssetComposer
              variant="chat"
              onCreate={async (asset) => {
                await shareService.addAsset(shareId, asset as CreateAsset);
                await reloadShare();
              }}
              uploadFile={(chunk, file, chunkIndex, totalChunks) =>
                shareService.uploadFile(
                  shareId,
                  chunk,
                  file,
                  chunkIndex,
                  totalChunks,
                )
              }
              beforeUpload={() => shareService.revertComplete(shareId)}
              afterUpload={async () => {
                await shareService.completeShare(shareId);
                await reloadShare();
              }}
            />
          </Stack>
        </Paper>
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Title order={4}>
              <FormattedMessage id="share.asset.manage.title" />
            </Title>
            <AssetTable
              assets={allAssets}
              columns={["type", "value", "size", "createdAt"]}
              headers={{
                type: <FormattedMessage id="share.table.type" />,
                value: <FormattedMessage id="share.table.name" />,
                size: <FormattedMessage id="account.assets.table.size" />,
                createdAt: (
                  <FormattedMessage id="clipboard.assets.table.createdAt" />
                ),
              }}
              empty={
                <Text c="dimmed" ta="center" py="xl">
                  <FormattedMessage id="share.asset.manage.empty" />
                </Text>
              }
              renderActions={(asset) => (
                <AssetActionMenu
                  asset={asset}
                  deleteModalTitle={t("share.asset.modal.delete.title")}
                  deleteModalDescription={
                    <Text size="sm">
                      <FormattedMessage id="share.asset.modal.delete.description" />
                    </Text>
                  }
                  deleteSuccessMessage={t("share.asset.notify.deleted")}
                  onDelete={(asset) => removeShareAsset(asset)}
                  showLibraryActions={false}
                />
              )}
            />
          </Stack>
        </Paper>
      </Stack>
    </>
  );
};

export default Share;
