import { CloudUpload, Upload } from "lucide-react";
import { Button, Center, Group, Text } from "@mantine/core";
import { Dropzone as MantineDropzone, FileWithPath } from "@mantine/dropzone";
import { ForwardedRef, useRef } from "react";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import { FileUpload } from "../../types/File.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import classes from "./Dropzone.module.css";

const Dropzone = ({
  title,
  isUploading,
  maxShareSize,
  compact = false,
  onFilesChanged,
}: {
  title?: string;
  isUploading: boolean;
  maxShareSize: number;
  compact?: boolean;
  onFilesChanged: (files: FileUpload[]) => void;
}) => {
  const t = useTranslate();

  const openRef = useRef<() => void>();

  const handleDrop = (droppedFiles: FileWithPath[]) => {
    let files = droppedFiles as FileUpload[];
    const fileSizeSum = files.reduce((n, { size }) => n + size, 0);

    if (fileSizeSum > maxShareSize) {
      toast.error(
        t("upload.dropzone.notify.file-too-big", {
          maxSize: byteToHumanSizeString(maxShareSize),
        }),
      );
    } else {
      files = files.map((newFile) => {
        newFile.uploadingProgress = 0;
        return newFile;
      });
      onFilesChanged(files);
    }
  };

  if (compact) {
    return (
      <div className={classes.compactWrapper}>
        <MantineDropzone
          onReject={(e) => toast.error(e[0].errors[0].message)}
          disabled={isUploading}
          onDrop={handleDrop}
          className={classes.compactDropzone}
          radius="md"
        >
          <Group
            justify="center"
            gap="sm"
            wrap="nowrap"
            style={{ pointerEvents: "none" }}
          >
            <CloudUpload size={26} />
            <div>
              <Text fw={600} size="sm">
                {title || <FormattedMessage id="upload.dropzone.title" />}
              </Text>
              <Text size="xs" c="dimmed">
                <FormattedMessage
                  id="upload.dropzone.description"
                  values={{ maxSize: byteToHumanSizeString(maxShareSize) }}
                />
              </Text>
            </div>
          </Group>
        </MantineDropzone>
      </div>
    );
  }

  return (
    <div className={classes.wrapper}>
      <MantineDropzone
        onReject={(e) => {
          toast.error(e[0].errors[0].message);
        }}
        disabled={isUploading}
        openRef={openRef as ForwardedRef<() => void>}
        onDrop={handleDrop}
        className={classes.dropzone}
        radius="md"
      >
        <div style={{ pointerEvents: "none" }}>
          <Group justify="center">
            <CloudUpload size={50} />
          </Group>
          <Text ta="center" fw={700} size="lg" mt="xl">
            {title || <FormattedMessage id="upload.dropzone.title" />}
          </Text>
          <Text ta="center" size="sm" mt="xs" c="dimmed">
            <FormattedMessage
              id="upload.dropzone.description"
              values={{ maxSize: byteToHumanSizeString(maxShareSize) }}
            />
          </Text>
        </div>
      </MantineDropzone>
      <Center>
        <Button
          className={classes.control}
          variant="light"
          size="sm"
          radius="xl"
          disabled={isUploading}
          onClick={() => openRef.current && openRef.current()}
        >
          {<Upload />}
        </Button>
      </Center>
    </div>
  );
};
export default Dropzone;
