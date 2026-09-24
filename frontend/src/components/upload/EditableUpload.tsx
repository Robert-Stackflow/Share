import { Button, Group } from "@mantine/core";
import { cleanNotifications } from "@mantine/notifications";
import { AxiosError } from "axios";
import { useRouter } from "next/router";
import pLimit from "p-limit";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import FormattedMessage from "../core/FormattedMessage";
import Dropzone from "../../components/upload/Dropzone";
import FileList from "../../components/upload/FileList";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import { FileListItem, FileMetaData, FileUpload } from "../../types/File.type";
import toast from "../../utils/toast.util";

const promiseLimit = pLimit(3);
let errorToastShown = false;

type EditableUploadActionState = {
  dirty: boolean;
  isUploading: boolean;
};

const EditableUpload = ({
  maxShareSize,
  shareId,
  files: savedFiles = [],
  formId,
  hideActionButton = false,
  navigateBackOnSave = true,
  showExistingFiles = true,
  onActionStateChange,
  onFilesSaved,
}: {
  maxShareSize?: number;
  isReverseShare?: boolean;
  shareId: string;
  files?: FileMetaData[];
  formId?: string;
  hideActionButton?: boolean;
  navigateBackOnSave?: boolean;
  showExistingFiles?: boolean;
  onActionStateChange?: (state: EditableUploadActionState) => void;
  onFilesSaved?: (files: FileMetaData[]) => void;
}) => {
  const t = useTranslate();
  const router = useRouter();
  const config = useConfig();
  const generatedFormId = useId();
  const uploadFormId = formId ?? `editable-upload-${generatedFormId}`;

  const chunkSize = useRef(parseInt(config.get("share.chunkSize")));

  const [existingFiles, setExistingFiles] =
    useState<Array<FileMetaData & { deleted?: boolean }>>(savedFiles);
  const [uploadingFiles, setUploadingFiles] = useState<FileUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const existingAndUploadedFiles: FileListItem[] = useMemo(
    () => [...uploadingFiles, ...existingFiles],
    [existingFiles, uploadingFiles],
  );
  const dirty = useMemo(() => {
    return (
      existingFiles.some((file) => !!file.deleted) || !!uploadingFiles.length
    );
  }, [existingFiles, uploadingFiles]);

  const setFiles = (files: FileListItem[]) => {
    const _uploadFiles = files.filter(
      (file) => "uploadingProgress" in file,
    ) as FileUpload[];
    const _existingFiles = files.filter(
      (file) => !("uploadingProgress" in file),
    ) as FileMetaData[];

    setUploadingFiles(_uploadFiles);
    setExistingFiles(_existingFiles);
  };

  // When existing files are managed elsewhere (e.g. the share edit item list),
  // the dropzone only shows files staged for upload so it does not duplicate
  // the already-saved files. Editing this list must not clear existing files.
  const displayedFiles: FileListItem[] = showExistingFiles
    ? existingAndUploadedFiles
    : uploadingFiles;

  const setDisplayedFiles = (files: FileListItem[]) => {
    if (showExistingFiles) {
      setFiles(files);
      return;
    }
    setUploadingFiles(
      files.filter((file) => "uploadingProgress" in file) as FileUpload[],
    );
  };

  maxShareSize ??= parseInt(config.get("share.maxSize"));

  const uploadFiles = async (files: FileUpload[]): Promise<FileMetaData[]> => {
    const fileUploadPromises = files.map(async (file, fileIndex) =>
      // Limit the number of concurrent uploads to 3
      promiseLimit(async () => {
        let fileId: string | undefined;

        const setFileProgress = (progress: number) => {
          setUploadingFiles((files) =>
            files.map((file, callbackIndex) => {
              if (fileIndex == callbackIndex) {
                file.uploadingProgress = progress;
              }
              return file;
            }),
          );
        };

        setFileProgress(1);

        let chunks = Math.ceil(file.size / chunkSize.current);

        // If the file is 0 bytes, we still need to upload 1 chunk
        if (chunks == 0) chunks++;

        for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
          const from = chunkIndex * chunkSize.current;
          const to = from + chunkSize.current;
          const blob = file.slice(from, to);
          try {
            await shareService
              .uploadFile(
                shareId,
                blob,
                {
                  id: fileId,
                  name: file.name,
                },
                chunkIndex,
                chunks,
              )
              .then((response) => {
                fileId = response.id;
              });

            setFileProgress(((chunkIndex + 1) / chunks) * 100);
          } catch (e) {
            if (
              e instanceof AxiosError &&
              e.response?.data.error == "unexpected_chunk_index"
            ) {
              // Retry with the expected chunk index
              chunkIndex = e.response!.data!.expectedChunkIndex - 1;
              continue;
            } else {
              setFileProgress(-1);
              // Retry after 5 seconds
              await new Promise((resolve) => setTimeout(resolve, 5000));
              chunkIndex = -1;

              continue;
            }
          }
        }

        if (!fileId) return undefined;

        return {
          id: fileId,
          name: file.name,
          size: file.size.toString(),
        };
      }),
    );

    const uploadedFiles = await Promise.all(fileUploadPromises);
    return uploadedFiles.filter((file): file is FileMetaData => !!file);
  };

  const removeFiles = async () => {
    const removedFiles = existingFiles.filter((file) => !!file.deleted);

    if (removedFiles.length > 0) {
      await Promise.all(
        removedFiles.map(async (file) => {
          await shareService.removeFile(shareId, file.id);
        }),
      );

      setExistingFiles(existingFiles.filter((file) => !file.deleted));
    }
  };

  const revertComplete = async () => {
    await shareService.revertComplete(shareId).then();
  };

  const completeShare = async () => {
    return await shareService.completeShare(shareId);
  };

  const save = async () => {
    setIsUploading(true);

    try {
      await revertComplete();
      const uploadedFiles = await uploadFiles(uploadingFiles);

      const hasFailed = uploadingFiles.some(
        (file) => file.uploadingProgress == -1,
      );
      const nextFiles = [
        ...uploadedFiles,
        ...existingFiles.filter((file) => !file.deleted),
      ];

      if (!hasFailed) {
        await removeFiles();
      }

      await completeShare();

      if (!hasFailed) {
        setExistingFiles(nextFiles);
        setUploadingFiles([]);
        onFilesSaved?.(nextFiles);
        toast.success(
          !navigateBackOnSave && uploadedFiles.length > 0
            ? t("share.asset.notify.created")
            : t("share.edit.notify.save-success"),
        );
        if (navigateBackOnSave) {
          router.back();
        }
      }
    } catch {
      toast.error(t("share.edit.notify.generic-error"));
    } finally {
      setIsUploading(false);
    }
  };

  const appendFiles = (appendingFiles: FileUpload[]) => {
    setUploadingFiles([...appendingFiles, ...uploadingFiles]);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!dirty || isUploading) return;
    void save();
  };

  useEffect(() => {
    onActionStateChange?.({ dirty, isUploading });
  }, [dirty, isUploading, onActionStateChange]);

  useEffect(() => {
    // Check if there are any files that failed to upload
    const fileErrorCount = uploadingFiles.filter(
      (file) => file.uploadingProgress == -1,
    ).length;

    if (fileErrorCount > 0) {
      if (!errorToastShown) {
        toast.error(
          t("upload.notify.count-failed", { count: fileErrorCount }),
          {
            withCloseButton: false,
            autoClose: false,
          },
        );
      }
      errorToastShown = true;
    } else {
      cleanNotifications();
      errorToastShown = false;
    }
  }, [uploadingFiles]);

  return (
    <>
      <form id={uploadFormId} onSubmit={submit} />
      {!hideActionButton && (
        <Group justify="flex-end" mb={20}>
          <Button
            loading={isUploading}
            disabled={!dirty}
            form={uploadFormId}
            type="submit"
          >
            <FormattedMessage id="share.asset.add" />
          </Button>
        </Group>
      )}
      <Dropzone
        title={t("share.edit.append-upload")}
        maxShareSize={maxShareSize}
        onFilesChanged={appendFiles}
        isUploading={isUploading}
      />
      {displayedFiles.length > 0 && (
        <FileList files={displayedFiles} setFiles={setDisplayedFiles} />
      )}
    </>
  );
};
export default EditableUpload;
