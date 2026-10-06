import { Text } from "@mantine/core";
import { ModalsContextProps } from "@mantine/modals/lib/context";

type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  destructive?: boolean;
};

const showConfirmDialog = (
  modals: ModalsContextProps,
  {
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    destructive = true,
  }: ConfirmDialogOptions,
) =>
  modals.openConfirmModal({
    title,
    centered: true,
    children: (
      <Text size="sm" c="dimmed" lh={1.6}>
        {message}
      </Text>
    ),
    labels: {
      confirm: confirmLabel,
      cancel: cancelLabel,
    },
    confirmProps: destructive ? { color: "red" } : undefined,
    onConfirm,
    onCancel,
  });

export default showConfirmDialog;
