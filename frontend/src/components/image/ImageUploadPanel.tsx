import {
  Button,
  FileButton,
  Group,
  Paper,
  SegmentedControl,
  Text,
} from "@mantine/core";
import { Clipboard, UploadCloud } from "lucide-react";
import { DragEvent, useState } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import { ImageVisibility } from "../../types/image.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import classes from "../../pages/account/images.module.css";

type ImageUploadPanelProps = {
  uploadEnabled: boolean;
  allowPublic: boolean;
  uploading: boolean;
  uploadVisibility: ImageVisibility;
  maxImageBytes: number;
  acceptedTypes: string[];
  onVisibilityChange: (visibility: ImageVisibility) => void;
  onFiles: (files: File[]) => void;
};

const ImageUploadPanel = ({
  uploadEnabled,
  allowPublic,
  uploading,
  uploadVisibility,
  maxImageBytes,
  acceptedTypes,
  onVisibilityChange,
  onFiles,
}: ImageUploadPanelProps) => {
  const t = useTranslate();
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    onFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <Paper
      withBorder
      className={`${classes.dropzone} ${
        dragging ? classes.dropzoneActive : ""
      } ${!uploadEnabled ? classes.dropzoneDisabled : ""}`}
      onDragEnter={() => uploadEnabled && setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <Group wrap="nowrap">
        <div className={classes.dropIcon}>
          <UploadCloud size={25} />
        </div>
        <div>
          <Text fw={650}>{t("images.upload.title")}</Text>
          <Text size="sm" c="dimmed">
            {t("images.upload.description", {
              size: byteToHumanSizeString(maxImageBytes),
            })}
          </Text>
          <Group gap={6} mt={6}>
            <Clipboard size={14} />
            <Text size="xs" c="dimmed">
              {t("images.upload.paste")}
            </Text>
          </Group>
        </div>
      </Group>
      <Group>
        <SegmentedControl
          size="xs"
          value={uploadVisibility}
          onChange={(value) => onVisibilityChange(value as ImageVisibility)}
          data={
            allowPublic
              ? [
                  {
                    value: "PUBLIC",
                    label: t("images.visibility.public"),
                  },
                  {
                    value: "PRIVATE",
                    label: t("images.visibility.private"),
                  },
                ]
              : [
                  {
                    value: "PRIVATE",
                    label: t("images.visibility.private"),
                  },
                ]
          }
          disabled={!uploadEnabled}
        />
        <FileButton
          onChange={(files) => onFiles(files ?? [])}
          accept={acceptedTypes.join(",")}
          multiple
        >
          {(props) => (
            <Button
              {...props}
              loading={uploading}
              disabled={!uploadEnabled}
              leftSection={<UploadCloud size={17} />}
            >
              {t("images.upload.button")}
            </Button>
          )}
        </FileButton>
      </Group>
    </Paper>
  );
};

export default ImageUploadPanel;
