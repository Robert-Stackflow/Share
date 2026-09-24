import { Pencil, PencilLine } from "lucide-react";
import { ActionIcon, Box, Group, Text, Title } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { GetStaticPaths, GetStaticProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import FormattedMessage from "../../../components/core/FormattedMessage";
import Meta from "../../../components/Meta";
import DownloadAllButton from "../../../components/share/DownloadAllButton";
import ShareAssetList from "../../../components/share/ShareAssetList";
import showEnterPasswordModal from "../../../components/share/showEnterPasswordModal";
import showErrorModal from "../../../components/share/showErrorModal";
import showShareInformationsModal from "../../../components/share/showShareInformationsModal";
import useConfig from "../../../hooks/config.hook";
import useTranslate from "../../../hooks/useTranslate.hook";
import useUser from "../../../hooks/user.hook";
import useStaticRouteParam from "../../../hooks/staticRouteParam.hook";
import shareService from "../../../services/share.service";
import { MyShare, Share as ShareType } from "../../../types/share.type";
import toast from "../../../utils/toast.util";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import { getQueryString } from "../../../utils/router.util";
import { HoverTip } from "../../../components/core/HoverTip";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { shareId: "_" } }],
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({
  props: { shareId: "_" },
});

const Share = () => {
  const modals = useModals();
  const router = useRouter();
  const shareId = useStaticRouteParam("shareId", 1);
  const [share, setShare] = useState<ShareType>();
  const { user } = useUser();
  const config = useConfig();
  const t = useTranslate();

  const isOwner = !!user && !!share && share.creator?.id === user.id;

  const isOwnerOrAdmin =
    !!user && !!share && (share.creator?.id === user.id || user.isAdmin);
  const recipientId = getQueryString(router.query.recipient);
  const assetCount = share?.assets?.length || share?.files?.length || 0;
  const fileCount = share?.files?.length || 0;
  const fileSize =
    share?.files?.reduce(
      (total: number, file: { size: string }) => total + parseInt(file.size),
      0,
    ) || 0;

  const handleEditClick = async () => {
    try {
      const myShares = await shareService.getMyShares();
      const myShare = myShares.find((s) => s.id === shareId);
      if (!myShare) return;
      showShareInformationsModal(
        modals,
        myShare,
        parseInt(config.get("share.maxSize")),
        config.get("general.appUrl"),
        config.get("general.appUrl", true),
        config.get("share.maxExpiration"),
        (updatedShare: MyShare) => {
          setShare((prev) =>
            prev
              ? {
                  ...prev,
                  name: updatedShare.name,
                  description: updatedShare.description,
                  expiration: updatedShare.expiration,
                  hasPassword:
                    updatedShare.security?.passwordProtected ??
                    prev.hasPassword,
                }
              : prev,
          );
        },
        true,
      );
    } catch (e) {
      toast.axiosError(e);
    }
  };

  const getShareToken = async (password?: string) => {
    if (!shareId) return;
    await shareService
      .getShareToken(shareId, password)
      .then(() => {
        modals.closeAll();
        getFiles();
      })
      .catch((e) => {
        const { error } = e.response.data;
        if (error == "share_max_views_exceeded") {
          showErrorModal(
            modals,
            t("share.error.visitor-limit-exceeded.title"),
            t("share.error.visitor-limit-exceeded.description"),
            "go-home",
          );
        } else if (error == "share_password_required") {
          showEnterPasswordModal(modals, getShareToken);
        } else {
          toast.axiosError(e);
        }
      });
  };

  const getFiles = async () => {
    if (!shareId) return;
    shareService
      .get(shareId)
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
              "go-home",
            );
          } else {
            showErrorModal(
              modals,
              t("share.error.not-found.title"),
              t("share.error.not-found.description"),
              "go-home",
            );
          }
        } else if (e.response.status == 403 && error == "private_share") {
          showErrorModal(
            modals,
            t("share.error.access-denied.title"),
            t("share.error.access-denied.description"),
          );
        } else if (error == "share_password_required") {
          showEnterPasswordModal(modals, getShareToken);
        } else if (error == "share_token_required") {
          getShareToken();
        } else {
          showErrorModal(
            modals,
            t("common.error"),
            t("common.error.unknown"),
            "go-home",
          );
        }
      });
  };

  useEffect(() => {
    if (!shareId) return;
    getFiles();
  }, [shareId]);

  return (
    <>
      <Meta
        title={t("share.title", { shareId: share?.name || shareId })}
        description={t("share.description")}
      />

      <Group justify="space-between" mb="lg">
        <Box style={{ maxWidth: "70%" }}>
          <Title order={3}>{share?.name || share?.id}</Title>
          <Text size="sm">{share?.description}</Text>
          {assetCount > 0 && (
            <Text size="sm" c="dimmed" mt={5}>
              <FormattedMessage
                id="share.assetCount"
                values={{
                  count: assetCount,
                  fileCount,
                  size: byteToHumanSizeString(fileSize),
                }}
              />
            </Text>
          )}
        </Box>

        <Group gap="xs">
          {isOwner && (
            <HoverTip label={t("account.shares.button.edit")}>
              <Link href={`/share/${shareId}/edit`}>
                <ActionIcon variant="light" color="orange" size="lg">
                  <PencilLine />
                </ActionIcon>
              </Link>
            </HoverTip>
          )}
          {isOwnerOrAdmin && (
            <HoverTip label={t("common.button.edit")}>
              <ActionIcon
                variant="light"
                color="blue"
                size="lg"
                onClick={handleEditClick}
              >
                <Pencil />
              </ActionIcon>
            </HoverTip>
          )}
          {(share?.files?.length || 0) > 1 && (
            <DownloadAllButton shareId={shareId} recipientId={recipientId} />
          )}
        </Group>
      </Group>

      <ShareAssetList
        share={share!}
        isLoading={!share}
        recipientId={recipientId}
      />
    </>
  );
};

export default Share;
