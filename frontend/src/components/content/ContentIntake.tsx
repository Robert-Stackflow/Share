import {
  Clipboard,
  FileIcon,
  Link2,
  Plus,
  Send,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import {
  ActionIcon,
  Alert,
  Button,
  FileButton,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
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
  maxFiles = Number.POSITIVE_INFINITY,
  disabled = false,
  resetSignal = 0,
  presentation = "standard",
  sendAction = false,
  onQueueEmpty,
  onSubmit,
}: {
  target: string;
  buttonLabel: string;
  maxSize: number;
  maxFiles?: number;
  disabled?: boolean;
  resetSignal?: number;
  presentation?: "standard" | "immersive";
  sendAction?: boolean;
  onQueueEmpty?: () => void;
  onSubmit: (
    items: PendingContent[],
  ) => Promise<boolean | string[] | void> | boolean | string[] | void;
}) {
  const t = useTranslate();
  const [items, setItems] = useState<PendingContent[]>([]);
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pasteShortcut, setPasteShortcut] = useState("");
  const [showEditor, setShowEditor] = useState(false);
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
    setError("");
    setShowEditor(false);
  }, [resetSignal]);

  useEffect(() => {
    if (!items.length && !draft.trim() && !submitting) onQueueEmpty?.();
  }, [items, draft, submitting, onQueueEmpty]);

  const addFiles = (files: File[]) => {
    if (files.length && !draft.trim()) setShowEditor(false);
    setItems((previous) => {
      const currentSize = previous.reduce(
        (sum, item) =>
          sum + (item.type === "FILE" && !item.error ? item.file.size : 0),
        0,
      );
      let acceptedSize = currentSize;
      let acceptedFiles = previous.filter(
        (item) => item.type === "FILE" && !item.error,
      ).length;
      return [
        ...previous,
        ...files.map((file): PendingContent => {
          const tooLarge =
            file.size > maxSize || acceptedSize + file.size > maxSize;
          const tooMany = acceptedFiles >= maxFiles;
          if (!tooLarge && !tooMany) {
            acceptedSize += file.size;
            acceptedFiles += 1;
          }
          return {
            id: newId(),
            type: "FILE",
            file,
            error: tooMany
              ? t("content.error.fileCount", { max: String(maxFiles) })
              : tooLarge
                ? t("content.error.size", {
                    max: byteToHumanSizeString(maxSize),
                  })
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
  }, [disabled, dragging, maxSize, maxFiles, t]);

  const draftItem: PendingContent | null =
    presentation === "standard" && draft.trim()
      ? {
          id: "draft",
          type: isSingleUrl(draft) ? "LINK" : "TEXT",
          value: draft.trim(),
        }
      : null;
  const validCount =
    items.filter((item) => !itemError(item, t)).length +
    Number(Boolean(draftItem));

  const addDraft = () => {
    if (!draft.trim()) return;
    addText(draft.trim());
    setDraft("");
    draftRef.current?.focus();
  };

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
      ...(draftItem ? [draftItem] : []),
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
        if (ids.has("draft")) setDraft("");
      }
    } catch {
      setError(t("content.error.submit"));
    } finally {
      setSubmitting(false);
    }
  };

  const immersive = presentation === "immersive";
  const compactHero = immersive && (showEditor || items.length > 0);
  const draftEditor = (
    <Textarea
      ref={draftRef}
      aria-label={t("content.input")}
      placeholder={t("content.placeholder")}
      minRows={immersive ? 4 : 3}
      autosize
      value={draft}
      disabled={disabled || submitting}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          addDraft();
        }
      }}
    />
  );

  return (
    <div
      className={`${classes.container} ${immersive ? classes.immersive : ""}`}
    >
      {dragging && (
        <div className={classes.overlay} aria-hidden="true">
          <Upload size={36} />
          <Text fw={700}>{t("content.drop")}</Text>
          <Text size="sm">{target}</Text>
        </div>
      )}
      <Stack gap="xs">
        {immersive ? (
          <>
            <div
              className={`${classes.hero} ${compactHero ? classes.heroCompact : ""}`}
            >
              <div className={classes.heroIcon}>
                <Upload size={30} strokeWidth={1.7} />
              </div>
              <Text className={classes.heroTitle} fw={700}>
                {t(
                  compactHero ? "upload.intake.addMore" : "upload.intake.title",
                )}
              </Text>
              {!compactHero && (
                <Text c="dimmed" ta="center" size="sm">
                  {t("upload.intake.description")}
                </Text>
              )}
              <Group
                className={classes.heroActions}
                justify="center"
                gap="sm"
                mt={compactHero ? 0 : "md"}
              >
                <FileButton multiple onChange={(files) => addFiles(files)}>
                  {(props) => (
                    <Button
                      size={compactHero ? "sm" : "md"}
                      leftSection={<FileIcon size={18} />}
                      disabled={disabled || submitting || maxFiles === 0}
                      {...props}
                    >
                      {t("content.choose-file")}
                    </Button>
                  )}
                </FileButton>
                <Button
                  size={compactHero ? "sm" : "md"}
                  variant="light"
                  leftSection={<Type size={18} />}
                  disabled={disabled || submitting}
                  onClick={() => {
                    setShowEditor(true);
                    requestAnimationFrame(() => draftRef.current?.focus());
                  }}
                >
                  {t("upload.intake.write")}
                </Button>
                <Button
                  size={compactHero ? "sm" : "md"}
                  variant="subtle"
                  leftSection={<Clipboard size={18} />}
                  disabled={disabled || submitting}
                  onClick={() => void pasteFromClipboard()}
                >
                  {t("content.paste")}
                </Button>
              </Group>
              {!compactHero && pasteShortcut && (
                <Text
                  className={classes.keyboardHint}
                  size="xs"
                  c="dimmed"
                  mt="lg"
                >
                  {t("content.shortcut", { shortcut: pasteShortcut })}
                </Text>
              )}
            </div>
            {showEditor && (
              <div className={classes.heroEditor}>
                {draftEditor}
                <Group justify="flex-end" mt="xs">
                  <Button
                    size="sm"
                    disabled={!draft.trim() || disabled || submitting}
                    onClick={addDraft}
                  >
                    {t("content.add")}
                  </Button>
                </Group>
              </div>
            )}
          </>
        ) : (
          <>
            {draftEditor}
            <Group justify="space-between">
              <Group gap="xs">
                <FileButton multiple onChange={(files) => addFiles(files)}>
                  {(props) => (
                    <Button
                      variant="light"
                      leftSection={<FileIcon />}
                      disabled={disabled || submitting || maxFiles === 0}
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
              <Group gap="xs" wrap="nowrap" className={classes.sendActions}>
                {sendAction && (
                  <Button
                    variant="light"
                    leftSection={<Plus size={17} />}
                    disabled={!draft.trim() || disabled || submitting}
                    onClick={addDraft}
                  >
                    {t("content.add")}
                  </Button>
                )}
                <Button
                  leftSection={sendAction ? <Send /> : <Plus />}
                  disabled={!validCount || disabled}
                  loading={submitting}
                  onClick={() => void submit()}
                >
                  {buttonLabel}
                  {sendAction && validCount > 1 ? ` (${validCount})` : ""}
                </Button>
              </Group>
            </Group>
          </>
        )}
        {items.map((item) => (
          <Paper key={item.id} className={classes.itemRow} withBorder p="xs">
            <Group align="flex-start" wrap="nowrap">
              <div className={classes.preview}>
                {item.type === "FILE" ? (
                  <Group gap="sm" wrap="nowrap" className={classes.fileSummary}>
                    <span className={classes.fileIcon}>
                      <FileIcon size={17} />
                    </span>
                    <Text size="sm" fw={600} lineClamp={1}>
                      {item.file.name}
                    </Text>
                    <Text size="xs" c="dimmed" className={classes.fileSize}>
                      {byteToHumanSizeString(item.file.size)}
                    </Text>
                  </Group>
                ) : (
                  <Group gap="sm" wrap="nowrap" className={classes.fileSummary}>
                    <span className={classes.fileIcon}>
                      {item.type === "LINK" ? (
                        <Link2 size={17} />
                      ) : (
                        <Type size={17} />
                      )}
                    </span>
                    <Text
                      size="sm"
                      fw={600}
                      lineClamp={2}
                      className={classes.contentValue}
                    >
                      {item.value}
                    </Text>
                  </Group>
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
        {immersive && validCount > 0 && (
          <Group justify="flex-end" mt="sm">
            <Button
              size="md"
              leftSection={<Plus size={18} />}
              disabled={disabled}
              loading={submitting}
              onClick={() => void submit()}
            >
              {buttonLabel}
            </Button>
          </Group>
        )}
        {error && <Alert color="red">{error}</Alert>}
      </Stack>
    </div>
  );
}
