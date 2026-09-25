import { AxiosError } from "axios";
import { useRef } from "react";
import useConfig from "../../hooks/config.hook";
import { Asset, CreateAsset } from "../../types/asset.type";
import { FileUploadResponse } from "../../types/File.type";
import toast from "../../utils/toast.util";
import ContentIntake, { PendingContent } from "./ContentIntake";

export default function AssetContentComposer({
  target,
  buttonLabel,
  sendAction = false,
  onCreate,
  onFilesUploaded,
  uploadFile,
}: {
  target: string;
  buttonLabel: string;
  sendAction?: boolean;
  onCreate: (asset: CreateAsset) => Promise<void>;
  onFilesUploaded: (assets: Asset[]) => void;
  uploadFile: (
    chunk: Blob,
    file: { id?: string; name: string },
    chunkIndex: number,
    totalChunks: number,
  ) => Promise<FileUploadResponse & Partial<Asset>>;
}) {
  const config = useConfig();
  const maxSize = parseInt(config.get("share.maxSize"));
  const uploads = useRef(
    new Map<string, { fileId?: string; nextChunk: number }>(),
  );

  const submit = async (items: PendingContent[]) => {
    const completed: string[] = [];
    const chunkSize = parseInt(config.get("share.chunkSize"));
    for (const item of items) {
      try {
        if (item.type === "FILE") {
          const total = Math.max(1, Math.ceil(item.file.size / chunkSize));
          const upload = uploads.current.get(item.id) ?? { nextChunk: 0 };
          uploads.current.set(item.id, upload);
          while (upload.nextChunk < total) {
            try {
              const result = await uploadFile(
                item.file.slice(
                  upload.nextChunk * chunkSize,
                  (upload.nextChunk + 1) * chunkSize,
                ),
                { id: upload.fileId, name: item.file.name },
                upload.nextChunk,
                total,
              );
              upload.fileId = result.id;
              upload.nextChunk += 1;
              if (result.type === "FILE") onFilesUploaded([result as Asset]);
            } catch (error) {
              const expected =
                error instanceof AxiosError &&
                error.response?.data?.error === "unexpected_chunk_index"
                  ? Number(error.response.data.expectedChunkIndex)
                  : NaN;
              if (
                upload.fileId &&
                Number.isInteger(expected) &&
                expected >= 0 &&
                expected < total &&
                expected !== upload.nextChunk
              ) {
                upload.nextChunk = expected;
                continue;
              }
              throw error;
            }
          }
          uploads.current.delete(item.id);
        } else {
          await onCreate(
            item.type === "TEXT"
              ? { type: "TEXT", content: item.value }
              : { type: "LINK", url: item.value.trim() },
          );
        }
        completed.push(item.id);
      } catch (error) {
        toast.axiosError(error);
      }
    }
    return completed;
  };

  return (
    <ContentIntake
      target={target}
      buttonLabel={buttonLabel}
      sendAction={sendAction}
      maxSize={maxSize}
      onSubmit={submit}
    />
  );
}
