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

let confirmDialogSequence = 0;

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
) => {
  const modalId = `share-confirm-${++confirmDialogSequence}`;
  let confirming = false;

  return modals.openConfirmModal({
    modalId,
    title,
    centered: true,
    closeOnConfirm: false,
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
    onConfirm: async () => {
      if (confirming) return;
      confirming = true;
      modals.updateModal({
        modalId,
        closeOnClickOutside: false,
        closeOnEscape: false,
        withCloseButton: false,
        confirmProps: {
          ...(destructive ? { color: "red" } : {}),
          loading: true,
        },
        cancelProps: { disabled: true },
      });
      try {
        await onConfirm();
      } finally {
        modals.closeModal(modalId, false);
      }
    },
    onCancel,
  });
};

export default showConfirmDialog;
