import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { FormEvent } from "react";

type PromptDialogProps = {
  opened: boolean;
  title: string;
  label: string;
  value: string;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  maxLength?: number;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const PromptDialog = ({
  opened,
  title,
  label,
  value,
  confirmLabel,
  cancelLabel,
  loading = false,
  maxLength = 255,
  onChange,
  onCancel,
  onConfirm,
}: PromptDialogProps) => {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onConfirm();
  };

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={title}
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <form onSubmit={submit}>
        <Stack gap="lg">
          <TextInput
            autoFocus
            required
            label={label}
            value={value}
            maxLength={maxLength}
            disabled={loading}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <Group justify="flex-end" gap="sm">
            <Button
              type="button"
              variant="default"
              disabled={loading}
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" loading={loading} disabled={!value.trim()}>
              {confirmLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default PromptDialog;
