import { Loader, Select, Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import roomService from "../../services/room.service";
import shareService from "../../services/share.service";

type TargetGroup = {
  group: string;
  items: { label: string; value: string }[];
};

type InternalTargetPickerProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

const InternalTargetPicker = ({
  value,
  onChange,
  error,
}: InternalTargetPickerProps) => {
  const t = useTranslate();
  const [groups, setGroups] = useState<TargetGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([roomService.list(), shareService.getMyShares()]).then(
      ([roomsResult, sharesResult]) => {
        if (cancelled) return;
        const rooms =
          roomsResult.status === "fulfilled"
            ? roomsResult.value.filter((room) => room.visibility === "SHARED")
            : [];
        const shares =
          sharesResult.status === "fulfilled" ? sharesResult.value : [];
        setLoadFailed(
          roomsResult.status === "rejected" ||
            sharesResult.status === "rejected",
        );
        setGroups([
          {
            group: t("account.shortLinks.targetPicker.rooms"),
            items: rooms.map((room) => ({
              value: `/rooms/${encodeURIComponent(room.roomId)}`,
              label: room.name ? `${room.name} · ${room.roomId}` : room.roomId,
            })),
          },
          {
            group: t("account.shortLinks.targetPicker.shares"),
            items: shares.map((share) => ({
              value: `/share/${encodeURIComponent(share.id)}`,
              label: share.name ? `${share.name} · ${share.id}` : share.id,
            })),
          },
        ]);
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [t]);

  const hasTargets = groups.some((group) => group.items.length > 0);
  const selectedValue = groups.some((group) =>
    group.items.some((item) => item.value === value),
  )
    ? value
    : null;

  return (
    <Stack gap="sm">
      <Select
        data={groups}
        disabled={!isLoading && !hasTargets}
        label={t("account.shortLinks.targetPicker.label")}
        nothingFoundMessage={t("account.shortLinks.targetPicker.empty")}
        onChange={(selected) => {
          if (selected) onChange(selected);
        }}
        placeholder={t(
          hasTargets
            ? "account.shortLinks.targetPicker.placeholder"
            : "account.shortLinks.targetPicker.empty",
        )}
        searchable
        rightSection={isLoading ? <Loader size="xs" /> : undefined}
        value={selectedValue}
      />
      {loadFailed && (
        <Text c="red" size="xs">
          {t("account.shortLinks.targetPicker.loadFailed")}
        </Text>
      )}
      <TextInput
        error={error}
        label={t("account.shortLinks.targetPicker.path")}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="/rooms/example"
        value={value}
      />
    </Stack>
  );
};

export default InternalTargetPicker;
