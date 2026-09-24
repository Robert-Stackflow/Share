import { Clipboard, FileIcon, Plus, Trash2, Upload } from "lucide-react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import classes from "./ContentIntake.module.css";

export type PendingContent =
  | { id: string; type: "FILE"; file: File; error?: string }
  | { id: string; type: "TEXT" | "LINK"; value: string; error?: string };

const newId = () => crypto.randomUUID();
const isSingleUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};
const itemError = (
  item: PendingContent,
  t: (id: string, values?: Record<string, string>) => string,
) => {
  if (item.error) return item.error;
  if (item.type === "FILE") return "";
  if (!item.value.trim()) return t("content.error.empty");
  if (item.type === "LINK" && !isSingleUrl(item.value))
    return t("content.error.link");
  return "";
};

const editableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    Boolean(target.closest("[contenteditable=true]")));

export default function ContentIntake({
  target,
  buttonLabel,
  maxSize,
  disabled = false,
  resetSignal = 0,
  onSubmit,
}: {
  target: string;
  buttonLabel: string;
  maxSize: number;
  disabled?: boolean;
  resetSignal?: number;
  onSubmit: (
    items: PendingContent[],
  ) => Promise<boolean | string[] | void> | boolean | string[] | void;
}) {
  const t = useTranslate();
  const [items, setItems] = useState<PendingContent[]>([]);
  const [draft, setDraft] = useState("");
  const [draftOverride, setDraftOverride] = useState<"TEXT" | "LINK" | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pasteShortcut, setPasteShortcut] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const dragDepth = useRef(0);
  const internalDrag = useRef(false);

  useEffect(() => {
    setPasteShortcut(
      /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘V" : "Ctrl+V",
    );
  }, []);

  useEffect(() => {
    if (!resetSignal) return;
    setItems([]);
    setDraft("");
    setDraftOverride(null);
    setError("");
  }, [resetSignal]);

  const addFiles = (files: File[]) => {
    setItems((previous) => {
      const currentSize = previous.reduce(
        (sum, item) =>
          sum + (item.type === "FILE" && !item.error ? item.file.size : 0),
        0,
      );
      let acceptedSize = currentSize;
      return [
        ...previous,
        ...files.map((file): PendingContent => {
          const tooLarge =
            file.size > maxSize || acceptedSize + file.size > maxSize;
          if (!tooLarge) acceptedSize += file.size;
          return {
            id: newId(),
            type: "FILE",
            file,
            error: tooLarge
              ? t("content.error.size", { max: byteToHumanSizeString(maxSize) })
              : undefined,
          };
        }),
      ];
    });
  };

  const addText = (value: string) => {
    if (!value.trim()) return;
    setItems((previous) => [
      ...previous,
      { id: newId(), type: isSingleUrl(value) ? "LINK" : "TEXT", value },
    ]);
  };

  useEffect(() => {
    const supports = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).some((type) =>
        ["Files", "text/plain", "text/uri-list"].includes(type),
      );
    const onDragStart = () => {
      internalDrag.current = true;
    };
    const onDragEnd = () => {
      internalDrag.current = false;
      dragDepth.current = 0;
      setDragging(false);
    };
    const onDragEnter = (event: DragEvent) => {
      if (internalDrag.current || disabled || !supports(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (internalDrag.current || !supports(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (event: DragEvent) => {
      if (!dragging) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0 || event.relatedTarget === null) {
        dragDepth.current = 0;
        setDragging(false);
      }
    };
    const onDrop = (event: DragEvent) => {
      if (internalDrag.current || !supports(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (disabled) return;
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length) addFiles(files);
      else {
        const value =
          event.dataTransfer?.getData("text/uri-list") ||
          event.dataTransfer?.getData("text/plain") ||
          "";
        if (value) addText(value);
        else setError(t("content.error.unsupported"));
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      if (disabled || !event.clipboardData) return;
      const files = Array.from(event.clipboardData.files);
      if (editableTarget(event.target) && event.target !== draftRef.current)
        return;
      if (files.length) {
        event.preventDefault();
        addFiles(files);
      } else if (!editableTarget(event.target)) {
        const value = event.clipboardData.getData("text/plain");
        if (value) {
          event.preventDefault();
          addText(value);
        }
      }
    };
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [disabled, dragging, maxSize, t]);

  const draftItem: PendingContent | null = draft.trim()
    ? {
        id: "draft",
        type: draftOverride ?? (isSingleUrl(draft) ? "LINK" : "TEXT"),
        value: draft,
      }
    : null;
  const validCount =
    items.filter((item) => !itemError(item, t)).length +
    Number(Boolean(draftItem && !itemError(draftItem, t)));

  const pasteFromClipboard = async () => {
    try {
      if (navigator.clipboard.read) {
        const entries = await navigator.clipboard.read();
        const files: File[] = [];
        for (const entry of entries) {
          const imageType = entry.types.find((type) =>
            type.startsWith("image/"),
          );
          if (imageType) {
            const blob = await entry.getType(imageType);
            files.push(
              new File(
                [blob],
                `pasted-image-${Date.now()}.${imageType.split("/")[1] || "png"}`,
                { type: imageType },
              ),
            );
          } else if (entry.types.includes("text/plain")) {
            addText(await (await entry.getType("text/plain")).text());
          }
        }
        if (files.length) addFiles(files);
        return;
      }
      addText(await navigator.clipboard.readText());
    } catch {
      setError(t("content.error.clipboard"));
    }
  };

  const submit = async () => {
    if (submitting || disabled || validCount === 0) return;
    const pending = [
      ...items.filter((item) => !itemError(item, t)),
      ...(draftItem && !itemError(draftItem, t) ? [draftItem] : []),
    ];
    setSubmitting(true);
    setError("");
    try {
      const completed = await onSubmit(pending);
      if (completed === true || Array.isArray(completed)) {
        const ids = new Set(
          completed === true ? pending.map((item) => item.id) : completed,
        );
        setItems((current) => current.filter((item) => !ids.has(item.id)));
        if (ids.has("draft")) {
          setDraft("");
          setDraftOverride(null);
        }
      }
    } catch {
      setError(t("content.error.submit"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={classes.container}>
      {dragging && (
        <div className={classes.overlay} aria-hidden="true">
          <Upload size={36} />
          <Text fw={700}>{t("content.drop")}</Text>
          <Text size="sm">{target}</Text>
        </div>
      )}
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600}>
            {t("content.target", { target })}
          </Text>
          <Badge variant="light">
            {t("content.pending", {
              count: items.length + Number(Boolean(draftItem)),
            })}
          </Badge>
        </Group>
        <Textarea
          ref={draftRef}
          aria-label={t("content.input")}
          placeholder={t("content.placeholder")}
          minRows={3}
          autosize
          value={draft}
          disabled={disabled || submitting}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            if (!event.currentTarget.value) setDraftOverride(null);
          }}
        />
        {pasteShortcut && (
          <Text size="xs" c="dimmed">
            {t("content.shortcut", { shortcut: pasteShortcut })}
          </Text>
        )}
        <Group justify="space-between">
          <Group gap="xs">
            <FileButton multiple onChange={(files) => addFiles(files)}>
              {(props) => (
                <Button
                  variant="light"
                  leftSection={<FileIcon />}
                  disabled={disabled || submitting}
                  {...props}
                >
                  {t("content.choose-file")}
                </Button>
              )}
            </FileButton>
            <Button
              variant="subtle"
              leftSection={<Clipboard />}
              disabled={disabled || submitting}
              onClick={() => void pasteFromClipboard()}
            >
              {t("content.paste")}
            </Button>
          </Group>
          <Button
            leftSection={<Plus />}
            disabled={!validCount || disabled}
            loading={submitting}
            onClick={() => void submit()}
          >
            {buttonLabel}
          </Button>
        </Group>
        {draftItem && (
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              {t("content.detected", {
                type: t(`room.asset.type.${draftItem.type.toLowerCase()}`),
              })}
            </Text>
            <Select
              size="xs"
              w={120}
              aria-label={t("content.type")}
              data={[
                { value: "TEXT", label: t("room.asset.type.text") },
                { value: "LINK", label: t("room.asset.type.link") },
              ]}
              value={draftItem.type}
              onChange={(value) => setDraftOverride(value as "TEXT" | "LINK")}
            />
            {itemError(draftItem, t) && (
              <Text size="xs" c="red">
                {itemError(draftItem, t)}
              </Text>
            )}
          </Group>
        )}
        {items.map((item) => (
          <Paper key={item.id} withBorder p="xs">
            <Group align="flex-start" wrap="nowrap">
              <div className={classes.preview}>
                {item.type === "FILE" ? (
                  <Text size="sm">
                    {item.file.name} · {byteToHumanSizeString(item.file.size)}
                  </Text>
                ) : (
                  <>
                    <Select
                      size="xs"
                      aria-label={t("content.type")}
                      data={[
                        { value: "TEXT", label: t("room.asset.type.text") },
                        { value: "LINK", label: t("room.asset.type.link") },
                      ]}
                      value={item.type}
                      onChange={(value) =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id && entry.type !== "FILE"
                              ? { ...entry, type: value as "TEXT" | "LINK" }
                              : entry,
                          ),
                        )
                      }
                    />
                    {item.type === "TEXT" ? (
                      <Textarea
                        size="xs"
                        autosize
                        minRows={2}
                        aria-label={t("content.value")}
                        value={item.value}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((entry) =>
                              entry.id === item.id && entry.type !== "FILE"
                                ? { ...entry, value: event.currentTarget.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    ) : (
                      <TextInput
                        size="xs"
                        aria-label={t("content.value")}
                        value={item.value}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((entry) =>
                              entry.id === item.id && entry.type !== "FILE"
                                ? { ...entry, value: event.currentTarget.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    )}
                  </>
                )}
                {itemError(item, t) && (
                  <Text size="xs" c="red">
                    {itemError(item, t)}
                  </Text>
                )}
              </div>
              <ActionIcon
                aria-label={t("common.button.delete")}
                variant="subtle"
                color="red"
                onClick={() =>
                  setItems((current) =>
                    current.filter((entry) => entry.id !== item.id),
                  )
                }
              >
                <Trash2 />
              </ActionIcon>
            </Group>
          </Paper>
        ))}
        {error && <Alert color="red">{error}</Alert>}
      </Stack>
    </div>
  );
}
