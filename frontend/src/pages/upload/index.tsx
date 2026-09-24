import { Alert, Button, Stack } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { cleanNotifications } from "@mantine/notifications";
import { AxiosError } from "axios";
import { CircleCheck } from "lucide-react";
import pLimit from "p-limit";
import { useEffect, useRef, useState } from "react";
import Meta from "../../components/Meta";
import ContentIntake, {
  PendingContent,
} from "../../components/content/ContentIntake";
import FileList from "../../components/upload/FileList";
import showCompletedUploadModal from "../../components/upload/modals/showCompletedUploadModal";
import showCreateUploadModal from "../../components/upload/modals/showCreateUploadModal";
import useConfig from "../../hooks/config.hook";
import useConfirmLeave from "../../hooks/confirm-leave.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import inboxService from "../../services/inbox.service";
import shareService from "../../services/share.service";
import { CreateAsset } from "../../types/asset.type";
import { FileUpload, FileUploadResponse } from "../../types/File.type";
import { InboxSubmission } from "../../types/inbox.type";
import { CreateShare, Share } from "../../types/share.type";
import toast from "../../utils/toast.util";

const promiseLimit = pLimit(3);
let errorToastShown = false;
let createdShare: Share;
let createdSubmission: InboxSubmission;

const Upload = ({
  maxShareSize,
  maxFileCount,
  isReverseShare = false,
  inboxToken,
  inboxName,
  simplified,
}: {
  maxShareSize?: number;
  maxFileCount?: number;
  isReverseShare: boolean;
  inboxToken?: string;
  inboxName?: string;
  simplified: boolean;
}) => {
  const modals = useModals();
  const t = useTranslate();

  const { user } = useUser();
  const config = useConfig();
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isUploading, setisUploading] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [unfinishedSubmissionId, setUnfinishedSubmissionId] = useState<
    string | null
  >(null);

  const pendingStorageKey = inboxToken ? `inbox-pending:${inboxToken}` : "";
  const rememberSubmission = (id: string) => {
    try {
      sessionStorage.setItem(pendingStorageKey, id);
    } catch {
      // The submission can still be finished or cancelled in this tab.
    }
  };
  const forgetSubmission = () => {
    try {
      sessionStorage.removeItem(pendingStorageKey);
    } catch {
      // Session storage can be unavailable in private browsing modes.
    }
    setUnfinishedSubmissionId(null);
  };
  const cancelUnfinishedSubmission = async (id: string) => {
    try {
      await inboxService.cancelSubmission(inboxToken!, id);
      forgetSubmission();
      return true;
    } catch {
      setUnfinishedSubmissionId(id);
      return false;
    }
  };
  const completeInboxSubmission = async (id: string) => {
    try {
      return await inboxService.completeSubmission(inboxToken!, id);
    } catch (error) {
      if (
        error instanceof AxiosError &&
        (!error.response || error.response.status >= 500)
      ) {
        return inboxService.completeSubmission(inboxToken!, id);
      }
      throw error;
    }
  };

  useEffect(() => {
    if (!inboxToken) return;
    try {
      const previous = sessionStorage.getItem(`inbox-pending:${inboxToken}`);
      if (previous) void cancelUnfinishedSubmission(previous);
    } catch {
      // No saved submission to recover.
    }
  }, [inboxToken]);

  useConfirmLeave({
    message: t("upload.notify.confirm-leave"),
    enabled: isUploading,
  });

  const chunkSize = useRef(parseInt(config.get("share.chunkSize")));

  maxShareSize ??= parseInt(config.get("share.maxSize"));
  const isInboxUpload = !!inboxToken;

  const uploadFiles = async (
    share: CreateShare,
    files: FileUpload[],
    pendingAssets: CreateAsset[] = [],
  ) => {
    setisUploading(true);
    setReceiptId(null);
    setFiles(files);

    try {
      if (isInboxUpload) {
        createdSubmission = await inboxService.createSubmission(inboxToken!, {
          message: [share.name, share.description].filter(Boolean).join("\n\n"),
          assets: pendingAssets,
          hasFiles: files.length > 0,
          fileCount: files.length,
        });
        rememberSubmission(createdSubmission.id);
      } else {
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        createdShare = await shareService.create(
          { ...share, size: totalSize },
          isReverseShare,
        );
        const assetUploadPromises = pendingAssets.map((asset) =>
          shareService.addAsset(createdShare.id, asset),
        );
        await Promise.all(assetUploadPromises);
      }
    } catch (e) {
      toast.axiosError(e);
      setisUploading(false);
      return;
    }

    if (files.length === 0) {
      if (isInboxUpload) {
        try {
          await completeInboxSubmission(createdSubmission.id);
          setisUploading(false);
          toast.success(t("inbox.submission.created"));
          setReceiptId(createdSubmission.id);
          forgetSubmission();
          setFiles([]);
          setResetSignal((value) => value + 1);
        } catch (error) {
          await cancelUnfinishedSubmission(createdSubmission.id);
          toast.axiosError(error);
          setisUploading(false);
        }
        return;
      }

      shareService
        .completeShare(createdShare.id)
        .then((share) => {
          setisUploading(false);
          showCompletedUploadModal(
            modals,
            share,
            config.get("general.appUrl"),
            config.get("general.appUrl", true),
          );
          setResetSignal((value) => value + 1);
        })
        .catch(() => {
          setisUploading(false);
          toast.error(t("upload.notify.generic-error"));
        });
      return;
    }

    const fileUploadPromises = files.map(async (file, fileIndex) =>
      // Limit the number of concurrent uploads to 3
      promiseLimit(async () => {
        let fileId: string | undefined;
        let failures = 0;

        const setFileProgress = (progress: number) => {
          setFiles((files) =>
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
            const response: FileUploadResponse = isInboxUpload
              ? await inboxService.uploadSubmissionFile(
                  inboxToken!,
                  createdSubmission.id,
                  blob,
                  {
                    id: fileId,
                    name: file.name,
                  },
                  chunkIndex,
                  chunks,
                )
              : await shareService.uploadFile(
                  createdShare.id,
                  blob,
                  {
                    id: fileId,
                    name: file.name,
                  },
                  chunkIndex,
                  chunks,
                );
            fileId = response.id;
            failures = 0;

            setFileProgress(((chunkIndex + 1) / chunks) * 100);
          } catch (e) {
            if (
              e instanceof AxiosError &&
              e.response?.data.error == "unexpected_chunk_index"
            ) {
              failures += 1;
              if (failures >= 3) throw e;
              // Retry with the expected chunk index
              chunkIndex = e.response!.data!.expectedChunkIndex - 1;
              continue;
            }
            setFileProgress(-1);
            failures += 1;
            if (
              (e instanceof AxiosError &&
                e.response?.status &&
                e.response.status >= 400 &&
                e.response.status < 500) ||
              failures >= 3
            ) {
              throw e;
            }
            await new Promise((resolve) => setTimeout(resolve, 5000));
            chunkIndex -= 1;
          }
        }
      }),
    );

    if (isInboxUpload) {
      const outcomes = await Promise.allSettled(fileUploadPromises);
      if (outcomes.some((outcome) => outcome.status === "rejected")) {
        await cancelUnfinishedSubmission(createdSubmission.id);
        toast.error(t("inbox.submit.failed"));
        setisUploading(false);
        setFiles([]);
        return;
      }
      try {
        await completeInboxSubmission(createdSubmission.id);
        toast.success(t("inbox.submission.created"));
        setReceiptId(createdSubmission.id);
        forgetSubmission();
        setFiles([]);
        setResetSignal((value) => value + 1);
      } catch (error) {
        await cancelUnfinishedSubmission(createdSubmission.id);
        toast.axiosError(error);
        setFiles([]);
      } finally {
        setisUploading(false);
      }
    } else {
      void Promise.all(fileUploadPromises).catch(() => {
        toast.error(t("upload.notify.generic-error"));
        setisUploading(false);
      });
    }
  };

  const showCreateUploadModalCallback = (items: PendingContent[]) => {
    const selectedFiles = items
      .filter(
        (item): item is Extract<PendingContent, { type: "FILE" }> =>
          item.type === "FILE",
      )
      .map(
        (item) =>
          Object.assign(item.file, { uploadingProgress: 0 }) as FileUpload,
      );
    const initialAssets: CreateAsset[] = items.flatMap((item) => {
      if (item.type === "FILE") return [];
      return [
        item.type === "TEXT"
          ? { type: "TEXT" as const, content: item.value }
          : { type: "LINK" as const, url: item.value.trim() },
      ];
    });
    showCreateUploadModal(
      modals,
      {
        isUserSignedIn: user ? true : false,
        isReverseShare,
        isInbox: isInboxUpload,
        appUrl: config.get("general.appUrl"),
        defaultAppUrl: config.get("general.appUrl", true),
        allowUnauthenticatedShares: config.get(
          "share.allowUnauthenticatedShares",
        ),
        enableEmailRecepients: config.get("email.enableShareEmailRecipients"),
        maxExpiration: config.get("share.maxExpiration"),
        defaultExpiration: config.get("share.defaultExpiration"),
        shareIdLength: config.get("share.shareIdLength"),
        simplified,
      },
      selectedFiles,
      initialAssets,
      uploadFiles,
    );
  };

  useEffect(() => {
    // Check if there are any files that failed to upload
    const fileErrorCount = files.filter(
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

    // Complete share
    if (
      !isInboxUpload &&
      files.length > 0 &&
      files.every((file) => file.uploadingProgress >= 100) &&
      fileErrorCount == 0
    ) {
      shareService
        .completeShare(createdShare.id)
        .then((share) => {
          setisUploading(false);
          showCompletedUploadModal(
            modals,
            share,
            config.get("general.appUrl"),
            config.get("general.appUrl", true),
          );
          setFiles([]);
          setResetSignal((value) => value + 1);
        })
        .catch(() => toast.error(t("upload.notify.generic-error")));
    }
  }, [files, isInboxUpload]);

  return (
    <>
      <Meta
        title={
          isInboxUpload
            ? inboxName || t("inbox.submit.title")
            : t("upload.title")
        }
      />
      {isInboxUpload && receiptId && (
        <Alert
          color="green"
          icon={<CircleCheck size={16} />}
          mb="md"
          title={t("inbox.submit.receiptTitle")}
        >
          {t("inbox.submit.receipt", { id: receiptId })}
        </Alert>
      )}
      {isInboxUpload && unfinishedSubmissionId && (
        <Alert color="red" mb="md" title={t("inbox.submit.cancelFailed")}>
          <Stack gap="xs">
            <span>{unfinishedSubmissionId}</span>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                void cancelUnfinishedSubmission(unfinishedSubmissionId)
              }
            >
              {t("inbox.submit.retryCancel")}
            </Button>
          </Stack>
        </Alert>
      )}
      <ContentIntake
        target={
          isInboxUpload
            ? inboxName || t("content.target.inbox")
            : t("content.target.upload")
        }
        buttonLabel={t(
          isInboxUpload ? "inbox.submit.review" : "content.continue",
        )}
        maxSize={maxShareSize}
        maxFiles={maxFileCount}
        disabled={
          isUploading || !!unfinishedSubmissionId || modals.modals.length > 0
        }
        resetSignal={resetSignal}
        onSubmit={(items) => {
          showCreateUploadModalCallback(items);
          return false;
        }}
      />
      {isUploading && files.length > 0 && (
        <Stack mt="md">
          <FileList<FileUpload> files={files} setFiles={setFiles} />
        </Stack>
      )}
    </>
  );
};
export default Upload;
