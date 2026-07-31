import {
  Badge,
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { AxiosError } from "axios";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TbKey, TbLock, TbWorld } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import AssetComposer from "../../../components/asset/AssetComposer";
import ClipboardConversationPanel from "../../../components/clipboard/ClipboardConversationPanel";
import CenterLoader from "../../../components/core/CenterLoader";
import Meta from "../../../components/Meta";
import useTranslate from "../../../hooks/useTranslate.hook";
import useUser from "../../../hooks/user.hook";
import useStaticRouteParam from "../../../hooks/staticRouteParam.hook";
import clipboardService from "../../../services/clipboard.service";
import { Asset } from "../../../types/asset.type";
import { Clipboard, CreateClipboardAsset } from "../../../types/clipboard.type";
import { rememberVisitedClipboardRoom } from "../../../utils/visitedClipboardRooms.util";
import toast from "../../../utils/toast.util";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { roomId: "_" } }],
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({ props: {} });

const ClipboardRoomPage = () => {
  const t = useTranslate();
  const router = useRouter();
  const { user } = useUser();
  const roomId = useStaticRouteParam("roomId", 2);
  const [room, setRoom] = useState<Clipboard>();
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const form = useForm({
    initialValues: {
      passcode: "",
    },
  });

  const loadRoom = () => {
    if (!roomId) return;
    setIsLoading(true);
    clipboardService
      .getRoom(roomId)
      .then((loadedRoom) => {
        setRoom(loadedRoom);
        rememberVisitedClipboardRoom(loadedRoom);
        setNeedsPasscode(false);
      })
      .catch((error) => {
        if (error instanceof AxiosError && error.response?.status === 403) {
          setNeedsPasscode(true);
          setRoom(undefined);
          return;
        }
        toast.axiosError(error);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadRoom();
  }, [roomId]);

  const verify = form.onSubmit((values) => {
    if (!roomId) return;
    clipboardService
      .verifyRoom(roomId, values.passcode)
      .then(() => {
        form.reset();
        toast.success(t("clipboard.room.notify.verified"));
        loadRoom();
      })
      .catch(toast.axiosError);
  });

  if (!roomId || isLoading) return <CenterLoader />;

  if (needsPasscode) {
    return (
      <>
        <Meta title={t("clipboard.room.title")} />
        <Center style={{ height: "55vh" }}>
          <Paper withBorder p="xl" maw={420} w="100%">
            <form onSubmit={verify}>
              <Stack gap="md">
                <Group>
                  <TbLock />
                  <Title order={3}>
                    <FormattedMessage id="clipboard.room.locked.title" />
                  </Title>
                </Group>
                <PasswordInput
                  label={t("clipboard.room.passcode")}
                  leftSection={<TbKey />}
                  {...form.getInputProps("passcode")}
                />
                <Button
                  type="submit"
                  leftSection={<TbKey />}
                  disabled={form.values.passcode.trim().length === 0}
                >
                  <FormattedMessage id="clipboard.room.unlock" />
                </Button>
              </Stack>
            </form>
          </Paper>
        </Center>
      </>
    );
  }

  if (!room) return null;

  const roomKey = room.roomId as string;
  const isLoggedIn = Boolean(user);
  const isOwner = Boolean(user && room.ownerId && user.id === room.ownerId);

  const prependAssets = (assets: Asset[]) =>
    setRoom((current) =>
      current ? { ...current, assets: [...assets, ...current.assets] } : current,
    );

  const addAsset = async (asset: CreateClipboardAsset) => {
    const created = await clipboardService.addRoomAsset(roomKey, asset);
    prependAssets([created]);
    toast.success(t("clipboard.notify.asset-created"));
  };

  const addFiles = (assets: Asset[]) => {
    prependAssets(assets);
    toast.success(t("clipboard.notify.asset-created"));
  };

  const uploadFile = (
    chunk: Blob,
    file: { id?: string; name: string },
    chunkIndex: number,
    totalChunks: number,
  ) =>
    clipboardService.uploadRoomFile(
      roomKey,
      chunk,
      file,
      chunkIndex,
      totalChunks,
    );

  const deleteAsset = async (asset: Asset) => {
    await clipboardService.removeRoomAsset(roomKey, asset.id);
    setRoom((current) =>
      current
        ? {
            ...current,
            assets: current.assets.filter((item) => item.id !== asset.id),
          }
        : current,
    );
  };

  return (
    <>
      <Meta title={room.name || room.roomId || t("clipboard.room.title")} />
      <div style={{ height: "min(760px, calc(100vh - 130px))" }}>
        <ClipboardConversationPanel
          assets={room.assets}
          badge={
            <Badge
              color={room.hasPasscode ? "yellow" : "green"}
              leftSection={room.hasPasscode ? <TbLock /> : <TbWorld />}
              variant="light"
            >
              {room.hasPasscode
                ? t("clipboard.rooms.protected")
                : t("clipboard.rooms.open")}
            </Badge>
          }
          composer={
            isLoggedIn ? (
              <AssetComposer
                variant="chat"
                onCreate={addAsset}
                onFilesUploaded={addFiles}
                uploadFile={uploadFile}
              />
            ) : undefined
          }
          getFileDownloadUrl={(asset) =>
            clipboardService.downloadRoomFileUrl(roomKey, asset.id)
          }
          onDelete={isOwner ? deleteAsset : undefined}
          subtitle={room.roomId}
          title={room.name || room.roomId}
        />
      </div>
    </>
  );
};

export default ClipboardRoomPage;
