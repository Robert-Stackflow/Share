import { Globe, KeyRound, LockKeyhole } from "lucide-react";
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
import FormattedMessage from "../../components/core/FormattedMessage";
import AssetContentComposer from "../../components/content/AssetContentComposer";
import RoomConversationPanel from "../../components/room/RoomConversationPanel";
import CenterLoader from "../../components/core/CenterLoader";
import Meta from "../../components/Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import useLiveSync from "../../hooks/useLiveSync.hook";
import useUser from "../../hooks/user.hook";
import useStaticRouteParam from "../../hooks/staticRouteParam.hook";
import roomService from "../../services/room.service";
import { Asset } from "../../types/asset.type";
import { Room, CreateRoomAsset } from "../../types/room.type";
import { rememberVisitedRoom } from "../../utils/visitedRooms.util";
import toast from "../../utils/toast.util";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { roomId: "_" } }],
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({ props: {} });

const RoomPage = () => {
  const t = useTranslate();
  const router = useRouter();
  const { user } = useUser();
  const roomId = useStaticRouteParam("roomId", 1);
  const [room, setRoom] = useState<Room>();
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollToLatestSignal, setScrollToLatestSignal] = useState(0);
  const form = useForm({
    initialValues: {
      passcode: "",
    },
  });

  const refreshRoom = async () => {
    if (!roomId) return;
    try {
      const loadedRoom = await roomService.get(roomId);
      setRoom(loadedRoom);
      rememberVisitedRoom(loadedRoom);
      setNeedsPasscode(false);
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 403) {
        setNeedsPasscode(true);
        setRoom(undefined);
        return;
      }
      throw error;
    }
  };

  const loadRoom = () => {
    setIsLoading(true);
    refreshRoom()
      .catch(toast.axiosError)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    setRoom(undefined);
    loadRoom();
  }, [roomId]);

  const syncStatus = useLiveSync(
    roomId && room ? roomService.eventsUrl(roomId) : null,
    refreshRoom,
  );

  const verify = form.onSubmit((values) => {
    if (!roomId) return;
    roomService
      .verify(roomId, values.passcode)
      .then(() => {
        form.reset();
        toast.success(t("room.room.notify.verified"));
        loadRoom();
      })
      .catch(toast.axiosError);
  });

  if (!roomId || isLoading) return <CenterLoader />;

  if (needsPasscode) {
    return (
      <>
        <Meta title={t("room.room.title")} />
        <Center style={{ height: "55vh" }}>
          <Paper withBorder p="xl" maw={420} w="100%">
            <form onSubmit={verify}>
              <Stack gap="md">
                <Group>
                  <LockKeyhole />
                  <Title order={3}>
                    <FormattedMessage id="room.room.locked.title" />
                  </Title>
                </Group>
                <PasswordInput
                  label={t("room.room.passcode")}
                  leftSection={<KeyRound />}
                  {...form.getInputProps("passcode")}
                />
                <Button
                  type="submit"
                  leftSection={<KeyRound />}
                  disabled={form.values.passcode.trim().length === 0}
                >
                  <FormattedMessage id="room.room.unlock" />
                </Button>
              </Stack>
            </form>
          </Paper>
        </Center>
      </>
    );
  }

  if (!room) return null;

  const roomKey = room.roomId;
  const isLoggedIn = Boolean(user);
  const isOwner = Boolean(user && room.ownerId && user.id === room.ownerId);

  const prependAssets = (assets: Asset[]) => {
    setRoom((current) =>
      current
        ? { ...current, assets: [...assets, ...current.assets] }
        : current,
    );
    setScrollToLatestSignal((value) => value + 1);
  };

  const addAsset = async (asset: CreateRoomAsset) => {
    const created = await roomService.addAsset(roomKey, asset);
    prependAssets([created]);
    toast.success(t("room.notify.asset-created"));
  };

  const addFiles = (assets: Asset[]) => {
    prependAssets(assets);
    toast.success(t("room.notify.asset-created"));
  };

  const uploadFile = (
    chunk: Blob,
    file: { id?: string; name: string },
    chunkIndex: number,
    totalChunks: number,
  ) => roomService.uploadFile(roomKey, chunk, file, chunkIndex, totalChunks);

  const deleteAsset = async (asset: Asset) => {
    await roomService.removeAsset(roomKey, asset.id);
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
      <Meta title={room.name || room.roomId || t("room.room.title")} />
      <div style={{ height: "min(760px, calc(100vh - 130px))" }}>
        <RoomConversationPanel
          assets={room.assets}
          scrollToLatestSignal={scrollToLatestSignal}
          badge={
            <Badge
              color={room.hasPasscode ? "yellow" : "green"}
              leftSection={room.hasPasscode ? <LockKeyhole /> : <Globe />}
              variant="light"
            >
              {room.hasPasscode
                ? t("room.rooms.protected")
                : t("room.rooms.open")}
            </Badge>
          }
          composer={
            isLoggedIn ? (
              <AssetContentComposer
                target={room.name || room.roomId}
                buttonLabel={t("room.asset.send")}
                sendAction
                onCreate={addAsset}
                onFilesUploaded={addFiles}
                uploadFile={uploadFile}
              />
            ) : undefined
          }
          getFileDownloadUrl={(asset) =>
            roomService.downloadFileUrl(roomKey, asset.id)
          }
          onDelete={isOwner ? deleteAsset : undefined}
          canSaveToLibrary={isOwner}
          subtitle={room.roomId}
          title={room.name || room.roomId}
          empty={
            room.assets.length === 0 ? (
              <Stack align="center" gap="xs" py="xl">
                <Text c="dimmed">
                  <FormattedMessage id="room.assets.empty" />
                </Text>
                {syncStatus !== "connected" && (
                  <Text c="dimmed" size="xs">
                    <FormattedMessage id="room.sync.reconnecting" />
                  </Text>
                )}
              </Stack>
            ) : undefined
          }
        />
      </div>
    </>
  );
};

export default RoomPage;
