import {
  Button,
  Group,
  SegmentedControl,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { AxiosError } from "axios";
import pLimit from "p-limit";
import { useMemo, useState } from "react";
import { TbFile, TbLink, TbPlus, TbSend, TbTextCaption } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import { Asset, CreateAsset } from "../../types/asset.type";
import { FileUpload, FileUploadResponse } from "../../types/File.type";
import Dropzone from "../upload/Dropzone";
import FileList from "../upload/FileList";

const promiseLimit = pLimit(3);

// Shared height (px) for the chat-composer input area so the file dropzone,
// text box and link input all line up. Keep in sync with `.compactDropzone`
// min-height in Dropzone.module.css.
const CHAT_FIELD_HEIGHT = 112;

type AssetComposerType = "FILE" | "TEXT" | "LINK";

type AssetComposerProps = {
  /** Create a TEXT or LINK asset on the owning surface. */
  onCreate: (asset: CreateAsset) => Promise<void>;
  /** Upload a single file chunk. When omitted, the FILE tab is hidden. */
  uploadFile?: (
    chunk: Blob,
    file: { id?: string; name: string },
    chunkIndex: number,
    totalChunks: number,
  ) => Promise<FileUploadResponse & Partial<Asset>>;
  /** Called with any fully-uploaded FILE assets (when the upload returns them). */
  onFilesUploaded?: (assets: Asset[]) => void;
  /** Runs once before a file upload batch (e.g. revert a completed share). */
  beforeUpload?: () => Promise<void>;
  /** Runs once after a file upload batch (e.g. complete + reload a share). */
  afterUpload?: () => Promise<void>;
  variant?: "default" | "chat";
  /** Force-hide the file tab even when uploadFile is provided. */
  enableFile?: boolean;
};

const AssetComposer = ({
  onCreate,
  uploadFile,
  onFilesUploaded,
  beforeUpload,
  afterUpload,
  variant = "default",
  enableFile,
}: AssetComposerProps) => {
  const t = useTranslate();
  const config = useConfig();
  const fileEnabled = (enableFile ?? true) && Boolean(uploadFile);
  const [assetType, setAssetType] = useState<AssetComposerType>("TEXT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const form = useForm({
    initialValues: {
      content: "",
      url: "",
    },
  });

  const typeOptions = useMemo(
    () => [
      ...(fileEnabled
        ? [{ value: "FILE", label: t("room.asset.type.file") }]
        : []),
      { value: "TEXT", label: t("room.asset.type.text") },
      { value: "LINK", label: t("room.asset.type.link") },
    ],
    [fileEnabled, t],
  );

  const submit = form.onSubmit(async (values) => {
    if (assetType === "FILE") {
      await uploadFiles(files);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(
        assetType === "TEXT"
          ? { type: "TEXT", content: values.content }
          : { type: "LINK", url: values.url },
      );
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  });

  const uploadFiles = async (selectedFiles: FileUpload[]) => {
    if (!uploadFile) return;
    setIsSubmitting(true);
    const uploadedAssets: Asset[] = [];
    const chunkSize = parseInt(config.get("share.chunkSize"));

    try {
      await beforeUpload?.();

      const uploadPromises = selectedFiles.map(async (file, fileIndex) =>
        promiseLimit(async () => {
          let fileId: string | undefined;
          const setFileProgress = (progress: number) => {
            setFiles((currentFiles) =>
              currentFiles.map((currentFile, callbackIndex) => {
                if (fileIndex === callbackIndex) {
                  currentFile.uploadingProgress = progress;
                }
                return currentFile;
              }),
            );
          };

          setFileProgress(1);
          let chunks = Math.ceil(file.size / chunkSize);
          if (chunks === 0) chunks++;

          for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
            const from = chunkIndex * chunkSize;
            const to = from + chunkSize;
            const blob = file.slice(from, to);

            try {
              const response = await uploadFile(
                blob,
                { id: fileId, name: file.name },
                chunkIndex,
                chunks,
              );

              fileId = response.id;
              if (response.type === "FILE")
                uploadedAssets.push(response as Asset);
              setFileProgress(((chunkIndex + 1) / chunks) * 100);
            } catch (e) {
              if (
                e instanceof AxiosError &&
                e.response?.data.error === "unexpected_chunk_index"
              ) {
                chunkIndex = e.response.data.expectedChunkIndex - 1;
                continue;
              }

              setFileProgress(-1);
              await new Promise((resolve) => setTimeout(resolve, 5000));
              chunkIndex = -1;
            }
          }
        }),
      );

      await Promise.all(uploadPromises);
      if (uploadedAssets.length > 0) onFilesUploaded?.(uploadedAssets);
      setFiles([]);
      await afterUpload?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEmpty =
    assetType === "FILE"
      ? files.length === 0
      : assetType === "TEXT"
        ? form.values.content.trim().length === 0
        : form.values.url.trim().length === 0;

  return (
    <form onSubmit={submit}>
      <Stack gap={variant === "chat" ? "xs" : "sm"}>
        <Group justify="space-between" align="flex-end">
          <SegmentedControl
            value={assetType}
            onChange={(value) => setAssetType(value as AssetComposerType)}
            data={typeOptions}
          />
          <Button
            type="submit"
            leftSection={
              assetType === "FILE" ? (
                <TbFile />
              ) : assetType === "TEXT" ? (
                <TbTextCaption />
              ) : (
                <TbLink />
              )
            }
            rightSection={variant === "chat" ? <TbSend /> : <TbPlus />}
            loading={isSubmitting}
            disabled={isEmpty}
          >
            <FormattedMessage id="room.asset.create" />
          </Button>
        </Group>

        {assetType === "FILE" ? (
          <Stack gap="xs">
            <Dropzone
              compact={variant === "chat"}
              title={
                variant === "chat"
                  ? t("room.asset.file.choose")
                  : t("room.asset.file")
              }
              isUploading={isSubmitting}
              maxShareSize={parseInt(config.get("share.maxSize"))}
              onFilesChanged={(newFiles) => setFiles([...files, ...newFiles])}
            />
            {files.length > 0 && <FileList files={files} setFiles={setFiles} />}
          </Stack>
        ) : assetType === "TEXT" ? (
          variant === "chat" ? (
            // Fixed height (not autosize) so it lines up with the dropzone and
            // link input; react-textarea-autosize rejects height styles.
            <Textarea
              placeholder={t("room.asset.content")}
              styles={{ input: { height: CHAT_FIELD_HEIGHT } }}
              {...form.getInputProps("content")}
            />
          ) : (
            <Textarea
              minRows={4}
              autosize
              label={t("room.asset.content")}
              {...form.getInputProps("content")}
            />
          )
        ) : (
          <TextInput
            label={variant === "chat" ? undefined : t("room.asset.url")}
            placeholder="https://example.com"
            styles={
              variant === "chat"
                ? { input: { height: CHAT_FIELD_HEIGHT } }
                : undefined
            }
            {...form.getInputProps("url")}
          />
        )}
      </Stack>
    </form>
  );
};

export default AssetComposer;
