import {
  ExternalLink,
  Globe,
  House,
  KeyRound,
  Link2,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Checkbox,
  Group,
  Menu,
  Modal,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import { AxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import FormattedMessage from "../../components/core/FormattedMessage";
import AccessControlForm from "../../components/access/AccessControlForm";
import AssetContentComposer from "../../components/content/AssetContentComposer";
import RoomConversationPanel from "../../components/room/RoomConversationPanel";
import CenterLoader from "../../components/core/CenterLoader";
import EmptyState from "../../components/core/EmptyState";
import Meta from "../../components/Meta";
import useLiveSync from "../../hooks/useLiveSync.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import roomService from "../../services/room.service";
import {
  AccessControl,
  toAccessControlPayload,
} from "../../types/accessControl.type";
import { Asset } from "../../types/asset.type";
import { CreateRoomAsset, Room } from "../../types/room.type";
import {
  readVisitedRooms,
  rememberVisitedRoom,
  VisitedRoom,
} from "../../utils/visitedRooms.util";
import toast from "../../utils/toast.util";
import classes from "./RoomsPage.module.css";

type Selection = { kind: "owned" | "visited"; roomId: string } | null;
type Filter = "all" | "mine" | "visited";
const policyFields: Array<keyof AccessControl> = [
  "expiresAt",
  "maxViews",
  "allowDownload",
  "allowAnonymous",
  "oneTime",
];

export default function RoomsPage() {
  const t = useTranslate();
  const router = useRouter();
  const { user } = useUser();
  const clipboard = useClipboard();
  const modals = useModals();
  const [owned, setOwned] = useState<Room[]>();
  const [visited, setVisited] = useState<VisitedRoom[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const initialSelectionDone = useRef(false);
  const [activeVisited, setActiveVisited] = useState<Room>();
  const [locked, setLocked] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Room>();
  const [policy, setPolicy] = useState<AccessControl>({});
  const [scrollSignal, setScrollSignal] = useState(0);
  const createForm = useForm({ initialValues: { name: "", passcode: "" } });
  const editForm = useForm({
    initialValues: { name: "", passcode: "", removePasscode: false },
  });
  const passcodeForm = useForm({ initialValues: { passcode: "" } });

  const selectedOwned =
    selection?.kind === "owned"
      ? owned?.find((room) => room.roomId === selection.roomId)
      : undefined;
  const selectedVisited =
    selection?.kind === "visited" && activeVisited?.roomId === selection.roomId
      ? activeVisited
      : undefined;
  const active = selectedOwned ?? selectedVisited;
  const visibleOwned = filter === "visited" ? [] : (owned ?? []);
  const ownedIds = new Set((owned ?? []).map((room) => room.roomId));
  const visibleVisited =
    filter === "mine"
      ? []
      : visited.filter((room) => !ownedIds.has(room.roomId));

  const refreshList = async () => setOwned(await roomService.list());
  useLiveSync(user ? roomService.listEventsUrl : null, refreshList);
  useEffect(() => {
    if (!user) return;
    setVisited(readVisitedRooms());
    void refreshList().catch(toast.axiosError);
  }, [user]);

  const refreshActive = async () => {
    const current = selectionRef.current;
    if (!current) return;
    if (current.kind === "owned") {
      const room = await roomService.getOwned(current.roomId);
      if (selectionRef.current?.roomId === current.roomId) {
        setOwned((previous) =>
          previous?.map((item) => (item.id === room.id ? room : item)),
        );
      }
      return;
    }
    try {
      const room = await roomService.get(current.roomId);
      if (
        selectionRef.current?.kind === "visited" &&
        selectionRef.current.roomId === current.roomId
      ) {
        setActiveVisited(room);
        setLocked(false);
        rememberVisitedRoom(room);
        setVisited(readVisitedRooms());
      }
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 403) {
        setActiveVisited(undefined);
        setLocked(true);
        return;
      }
      throw error;
    }
  };

  const eventsUrl =
    selection?.kind === "owned"
      ? roomService.ownedEventsUrl(selection.roomId)
      : selection?.kind === "visited" && !locked && activeVisited
        ? roomService.eventsUrl(selection.roomId)
        : null;
  const syncStatus = useLiveSync(eventsUrl, refreshActive);

  const selectVisited = useCallback((room: VisitedRoom) => {
    initialSelectionDone.current = true;
    setActiveVisited(undefined);
    setLocked(false);
    setSelection({ kind: "visited", roomId: room.roomId });
    void roomService
      .get(room.roomId)
      .then((loaded) => {
        if (
          selectionRef.current?.kind !== "visited" ||
          selectionRef.current.roomId !== room.roomId
        )
          return;
        setActiveVisited(loaded);
        rememberVisitedRoom(loaded);
        setVisited(readVisitedRooms());
      })
      .catch((error) => {
        if (error instanceof AxiosError && error.response?.status === 403)
          setLocked(true);
        else toast.axiosError(error);
      });
  }, []);

  useEffect(() => {
    if (!user || !owned || !router.isReady) return;
    if (initialSelectionDone.current || selectionRef.current) return;
    const requestedRoomId =
      typeof router.query.roomId === "string" ? router.query.roomId : undefined;
    const requestedRoom = owned.find((room) => room.roomId === requestedRoomId);
    if (requestedRoom) {
      initialSelectionDone.current = true;
      setSelection({ kind: "owned", roomId: requestedRoom.roomId });
      return;
    }
    const firstOwned =
      owned.find((room) => room.visibility === "PRIVATE") ?? owned[0];
    if (firstOwned) {
      initialSelectionDone.current = true;
      setSelection({ kind: "owned", roomId: firstOwned.roomId });
      return;
    }
    const firstVisited = visited[0];
    if (firstVisited) selectVisited(firstVisited);
  }, [
    owned,
    visited,
    user,
    selectVisited,
    router.isReady,
    router.query.roomId,
  ]);

  const create = createForm.onSubmit((values) => {
    void roomService
      .create({
        name: values.name.trim() || undefined,
        passcode: values.passcode.trim() || undefined,
        accessControl: toAccessControlPayload(policy),
      })
      .then((room) => {
        setOwned((current) =>
          current?.some((item) => item.id === room.id)
            ? current.map((item) => (item.id === room.id ? room : item))
            : [room, ...(current ?? [])],
        );
        setFilter("all");
        initialSelectionDone.current = true;
        setSelection({ kind: "owned", roomId: room.roomId });
        setCreateOpen(false);
        createForm.reset();
        setPolicy({});
        toast.success(t("room.notify.room-created"));
      })
      .catch(toast.axiosError);
  });

  const openEdit = (room: Room) => {
    if (room.visibility === "PRIVATE") return;
    setEditing(room);
    editForm.setValues({
      name: room.name ?? "",
      passcode: "",
      removePasscode: false,
    });
    setPolicy({
      ...room.accessControl,
      expiresAt: room.accessControl?.expiresAt?.slice(0, 16),
    });
  };
  const update = editForm.onSubmit((values) => {
    if (!editing) return;
    void roomService
      .update(editing.roomId, {
        name: values.name.trim() || null,
        passcode: values.removePasscode
          ? null
          : values.passcode.trim() || undefined,
        accessControl: toAccessControlPayload(policy),
      })
      .then((room) => {
        setOwned((current) =>
          current?.map((item) => (item.id === room.id ? room : item)),
        );
        setEditing(undefined);
        setPolicy({});
        toast.success(t("room.notify.room-updated"));
      })
      .catch(toast.axiosError);
  });

  const confirmDelete = (room: Room) =>
    modals.openConfirmModal({
      title: t("room.rooms.delete.title"),
      children: (
        <Text size="sm">
          {t("room.rooms.delete.description", {
            room: room.name || room.roomId,
          })}
        </Text>
      ),
      confirmProps: { color: "red" },
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: () =>
        void roomService
          .remove(room.roomId)
          .then(() => {
            setOwned((current) =>
              current?.filter((item) => item.id !== room.id),
            );
            if (selectionRef.current?.roomId === room.roomId)
              setSelection(null);
            toast.success(t("room.notify.room-deleted"));
          })
          .catch(toast.axiosError),
    });

  const copyLink = (roomId: string) => {
    clipboard.copy(`${window.location.origin}/rooms/${roomId}`);
    toast.success(t("common.notify.copied-link"));
  };
  const verify = passcodeForm.onSubmit((values) => {
    if (selection?.kind !== "visited") return;
    void roomService
      .verify(selection.roomId, values.passcode)
      .then(() => {
        passcodeForm.reset();
        setLocked(false);
        return refreshActive();
      })
      .catch(toast.axiosError);
  });

  const addAsset = async (input: CreateRoomAsset) => {
    if (!selection) return;
    const created = await roomService.addAsset(selection.roomId, input);
    updateActiveAssets((assets) => [created, ...assets]);
    setScrollSignal((value) => value + 1);
  };
  const addFiles = (assets: Asset[]) => {
    updateActiveAssets((current) => [...assets, ...current]);
    setScrollSignal((value) => value + 1);
  };
  const updateActiveAssets = (transform: (assets: Asset[]) => Asset[]) => {
    if (selection?.kind === "owned")
      setOwned((current) =>
        current?.map((item) =>
          item.roomId === selection.roomId
            ? { ...item, assets: transform(item.assets) }
            : item,
        ),
      );
    if (selection?.kind === "visited")
      setActiveVisited(
        (current) =>
          current && { ...current, assets: transform(current.assets) },
      );
  };
  const removeAsset = async (asset: Asset) => {
    if (selection?.kind !== "owned") return;
    await roomService.removeAsset(selection.roomId, asset.id);
    updateActiveAssets((assets) =>
      assets.filter((item) => item.id !== asset.id),
    );
  };
  const removeAssets = async (items: Asset[]) => {
    if (selection?.kind !== "owned") return;
    const ids = await roomService.removeAssets(
      selection.roomId,
      items.map((item) => item.id),
    );
    updateActiveAssets((current) =>
      current.filter((item) => !ids.includes(item.id)),
    );
  };
  const clearAssets = async () => {
    if (selection?.kind !== "owned") return;
    await roomService.removeAssets(selection.roomId);
    updateActiveAssets(() => []);
  };

  if (!user)
    return (
      <>
        <Meta title={t("room.rooms.title")} />
        <Center h="50vh">
          <Stack align="center">
            <Title order={3}>
              <FormattedMessage id="room.auth.title" />
            </Title>
            <Button component={Link} href="/auth/signIn">
              <FormattedMessage id="navbar.signin" />
            </Button>
          </Stack>
        </Center>
      </>
    );
  if (!owned) return <CenterLoader />;

  return (
    <>
      <Meta title={t("room.rooms.title")} />
      <Group className={classes.pageHeader} justify="space-between" mb="md">
        <Title order={3}>
          <FormattedMessage id="room.rooms.title" />
        </Title>
        <Button
          leftSection={<Plus />}
          onClick={() => {
            setPolicy({});
            setCreateOpen(true);
          }}
        >
          <FormattedMessage id="room.rooms.create" />
        </Button>
      </Group>
      <div className={classes.shell}>
        <aside className={classes.sidebar}>
          <ActionIcon
            aria-label={t("room.rooms.create")}
            className={`${classes.mobileCreate} roomRailAction`}
            onClick={() => {
              setPolicy({});
              setCreateOpen(true);
            }}
            size={36}
            variant="subtle"
          >
            <Plus size={19} />
          </ActionIcon>
          <SegmentedControl
            fullWidth
            value={filter}
            onChange={(value) => setFilter(value as Filter)}
            data={[
              { value: "all", label: t("room.filter.all") },
              { value: "mine", label: t("room.rooms.title") },
              { value: "visited", label: t("room.rooms.visited") },
            ]}
          />
          <div className={classes.roomList}>
            {visibleOwned.length > 0 && (
              <Text
                className={classes.listHeading}
                c="dimmed"
                fw={600}
                size="xs"
                mt="sm"
              >
                <FormattedMessage id="room.rooms.title" />
              </Text>
            )}
            {visibleOwned.map((room) => (
              <button
                className={`${classes.roomEntry} ${selection?.kind === "owned" && selection.roomId === room.roomId ? classes.selected : ""}`}
                key={room.id}
                onClick={() => {
                  initialSelectionDone.current = true;
                  setSelection({ kind: "owned", roomId: room.roomId });
                  setLocked(false);
                }}
                type="button"
              >
                <span className={classes.entryText}>
                  <strong>
                    {room.visibility === "PRIVATE"
                      ? t("room.private.title")
                      : room.name || room.roomId}
                  </strong>
                  <small>
                    {room.visibility === "PRIVATE"
                      ? t("room.private.subtitle")
                      : room.roomId}
                  </small>
                </span>
                {room.visibility === "PRIVATE" ? (
                  <LockKeyhole />
                ) : room.hasPasscode ? (
                  <LockKeyhole />
                ) : (
                  <Globe />
                )}
              </button>
            ))}
            {visibleVisited.length > 0 && (
              <Text
                className={classes.listHeading}
                c="dimmed"
                fw={600}
                size="xs"
                mt="sm"
              >
                <FormattedMessage id="room.rooms.visited" />
              </Text>
            )}
            {visibleVisited.map((room) => (
              <button
                className={`${classes.roomEntry} ${selection?.kind === "visited" && selection.roomId === room.roomId ? classes.selected : ""}`}
                key={room.roomId}
                onClick={() => selectVisited(room)}
                type="button"
              >
                <span className={classes.entryText}>
                  <strong>{room.name || room.roomId}</strong>
                  <small>{room.roomId}</small>
                </span>
                {room.hasPasscode ? <LockKeyhole /> : <Globe />}
              </button>
            ))}
            {visibleOwned.length + visibleVisited.length === 0 && (
              <div className={classes.listEmpty} role="status">
                <span className={classes.listEmptyIcon}>
                  <House size={20} />
                </span>
                <strong className={classes.listEmptyTitle}>
                  <FormattedMessage
                    id={
                      filter === "visited"
                        ? "room.rooms.visited.empty"
                        : "room.rooms.empty"
                    }
                  />
                </strong>
                <span className={classes.listEmptyHint}>
                  <FormattedMessage
                    id={
                      filter === "visited"
                        ? "room.rooms.visited.emptyHint"
                        : "room.rooms.emptyHint"
                    }
                  />
                </span>
              </div>
            )}
          </div>
        </aside>
        <main className={classes.content}>
          {locked && selection?.kind === "visited" ? (
            <Center className={classes.empty}>
              <Paper withBorder p="lg" maw={360} w="100%">
                <form onSubmit={verify}>
                  <Stack>
                    <Title order={4}>
                      <FormattedMessage id="room.room.locked.title" />
                    </Title>
                    <PasswordInput
                      label={t("room.room.passcode")}
                      leftSection={<KeyRound />}
                      {...passcodeForm.getInputProps("passcode")}
                    />
                    <Button
                      disabled={!passcodeForm.values.passcode.trim()}
                      type="submit"
                    >
                      <FormattedMessage id="room.room.unlock" />
                    </Button>
                  </Stack>
                </form>
              </Paper>
            </Center>
          ) : active ? (
            <RoomConversationPanel
              key={`${selection?.kind}:${active.id}`}
              assets={active.assets}
              badge={
                <Group gap={5} wrap="nowrap">
                  <Badge
                    color={selection?.kind === "owned" ? "blue" : "gray"}
                    variant="light"
                  >
                    {t(
                      selection?.kind === "owned"
                        ? "room.role.owner"
                        : "room.role.visitor",
                    )}
                  </Badge>
                  <Badge
                    color={
                      active.visibility === "PRIVATE"
                        ? "gray"
                        : active.hasPasscode
                          ? "yellow"
                          : "green"
                    }
                    variant="light"
                  >
                    {t(
                      active.visibility === "PRIVATE"
                        ? "room.private.title"
                        : active.hasPasscode
                          ? "room.rooms.protected"
                          : "room.rooms.open",
                    )}
                  </Badge>
                </Group>
              }
              headerActions={
                active.visibility !== "PRIVATE" ? (
                  <>
                    <Menu.Item
                      leftSection={<Link2 size={16} />}
                      onClick={() => copyLink(active.roomId)}
                    >
                      {t("common.button.copy-link")}
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<ExternalLink size={16} />}
                      component={Link}
                      href={`/rooms/${active.roomId}`}
                      target="_blank"
                    >
                      {t("common.text.navigate-to-link")}
                    </Menu.Item>
                    {selectedOwned?.visibility === "SHARED" && (
                      <>
                        <Menu.Item
                          leftSection={<Pencil size={16} />}
                          onClick={() => openEdit(selectedOwned)}
                        >
                          {t("common.button.edit")}
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<Trash2 size={16} />}
                          onClick={() => confirmDelete(selectedOwned)}
                        >
                          {t("common.button.delete")}
                        </Menu.Item>
                      </>
                    )}
                  </>
                ) : undefined
              }
              composer={
                <AssetContentComposer
                  target={
                    active.visibility === "PRIVATE"
                      ? t("room.private.title")
                      : active.name || active.roomId
                  }
                  buttonLabel={t("room.asset.send")}
                  sendAction
                  onCreate={addAsset}
                  onFilesUploaded={addFiles}
                  uploadFile={(chunk, file, index, total) =>
                    roomService.uploadFile(
                      active.roomId,
                      chunk,
                      file,
                      index,
                      total,
                    )
                  }
                />
              }
              getFileDownloadUrl={(asset) =>
                roomService.downloadFileUrl(active.roomId, asset.id)
              }
              getAssetLinkUrl={(asset) =>
                asset.type === "FILE"
                  ? roomService.downloadFileUrl(active.roomId, asset.id)
                  : roomService.assetLinkUrl(
                      active.roomId,
                      asset.id,
                      active.visibility,
                    )
              }
              onDelete={selection?.kind === "owned" ? removeAsset : undefined}
              onDeleteMany={
                selection?.kind === "owned" ? removeAssets : undefined
              }
              onClear={selection?.kind === "owned" ? clearAssets : undefined}
              canSaveToLibrary={selection?.kind === "owned"}
              scrollToLatestSignal={scrollSignal}
              subtitle={
                active.visibility === "PRIVATE" ? undefined : active.roomId
              }
              title={
                active.visibility === "PRIVATE"
                  ? t("room.private.title")
                  : active.name || active.roomId
              }
            />
          ) : (
            <Center className={classes.empty}>
              <EmptyState
                className={classes.contentEmptyState}
                title={<FormattedMessage id="room.rooms.editor.empty" />}
              />
            </Center>
          )}
        </main>
      </div>

      <Modal
        centered
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("room.rooms.create.title")}
      >
        <form className={classes.roomForm} onSubmit={create}>
          <Stack>
            <TextInput
              label={t("room.rooms.name")}
              {...createForm.getInputProps("name")}
            />
            <PasswordInput
              label={t("room.rooms.passcode")}
              {...createForm.getInputProps("passcode")}
            />
            <AccessControlForm
              fields={policyFields}
              value={policy}
              onChange={setPolicy}
            />
            <Group justify="flex-end">
              <Button type="submit">
                <FormattedMessage id="room.rooms.create" />
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal
        centered
        opened={Boolean(editing)}
        onClose={() => setEditing(undefined)}
        title={t("room.rooms.edit.title")}
      >
        <form className={classes.roomForm} onSubmit={update}>
          <Stack>
            <TextInput
              label={t("room.rooms.name")}
              {...editForm.getInputProps("name")}
            />
            <PasswordInput
              disabled={editForm.values.removePasscode}
              description={t("room.rooms.passcode.keep")}
              label={t("room.rooms.passcode")}
              {...editForm.getInputProps("passcode")}
            />
            {editing?.hasPasscode && (
              <Checkbox
                label={t("room.rooms.passcode.remove")}
                {...editForm.getInputProps("removePasscode", {
                  type: "checkbox",
                })}
              />
            )}
            <AccessControlForm
              fields={policyFields}
              value={policy}
              onChange={setPolicy}
            />
            <Group justify="flex-end">
              <Button type="submit">
                <FormattedMessage id="common.button.save" />
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
