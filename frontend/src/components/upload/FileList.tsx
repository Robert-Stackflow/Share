import { ArrowRight, Pencil, Trash2, Undo2 } from "lucide-react";
import { ActionIcon, Box, Table, Group, Text } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useEffect, useState } from "react";
import { FileListItem } from "../../types/File.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import UploadProgressIndicator from "./UploadProgressIndicator";
import FormattedMessage from "../core/FormattedMessage";
import useTranslate from "../../hooks/useTranslate.hook";
import { HoverTip } from "../core/HoverTip";
import showTextEditorModal from "./modals/showTextEditorModal";
import shareService from "../../services/share.service";
import configService from "../../services/config.service";
import { applyRenameRules } from "../../utils/fileRename.util";
import tableClasses from "../core/DataTable.module.css";

const FileListRow = ({
  file,
  previewName,
  onRemove,
  onRestore,
  onEdit,
}: {
  file: FileListItem;
  previewName?: string;
  onRemove?: () => void;
  onRestore?: () => void;
  onEdit?: () => void;
}) => {
  {
    const uploadable = "uploadingProgress" in file;
    const uploading = uploadable && file.uploadingProgress !== 0;
    const removable = uploadable
      ? file.uploadingProgress === 0
      : onRemove && !file.deleted;
    const restorable = onRestore && !uploadable && !!file.deleted;
    const deleted = !uploadable && !!file.deleted;

    const isTextFile = shareService.isShareTextFile(file.name);
    const editable = isTextFile && uploadable && file.uploadingProgress === 0;

    const t = useTranslate();

    return (
      <tr
        className={`${tableClasses.tableRow} ${
          deleted ? tableClasses.deletedRow : ""
        }`}
        style={{
          textDecoration: deleted ? "line-through" : "none",
        }}
      >
        <td>
          {previewName && previewName !== file.name ? (
            <Group gap={6} wrap="nowrap">
              <Text span c="dimmed" style={{ textDecoration: "line-through" }}>
                {file.name}
              </Text>
              <ArrowRight style={{ flexShrink: 0, opacity: 0.6 }} />
              <Text span fw={500}>
                {previewName}
              </Text>
            </Group>
          ) : (
            file.name
          )}
        </td>
        <td>{byteToHumanSizeString(+file.size)}</td>
        <td className={tableClasses.actionCell}>
          <Group justify="flex-end" gap="xs" wrap="nowrap">
            {editable && (
              <HoverTip label={t("common.button.edit")}>
                <ActionIcon
                  color="gray"
                  variant="subtle"
                  size={25}
                  onClick={onEdit}
                >
                  <Pencil />
                </ActionIcon>
              </HoverTip>
            )}
            {removable && (
              <HoverTip label={t("common.button.delete")}>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size={25}
                  onClick={onRemove}
                >
                  <Trash2 />
                </ActionIcon>
              </HoverTip>
            )}
            {uploading && (
              <UploadProgressIndicator progress={file.uploadingProgress} />
            )}
            {restorable && (
              <HoverTip label={t("common.button.undo")}>
                <ActionIcon
                  color="gray"
                  variant="subtle"
                  size={25}
                  onClick={onRestore}
                >
                  <Undo2 />
                </ActionIcon>
              </HoverTip>
            )}
          </Group>
        </td>
      </tr>
    );
  }
};

const FileList = <T extends FileListItem = FileListItem>({
  files,
  setFiles,
}: {
  files: T[];
  setFiles: (files: T[]) => void;
}) => {
  const modals = useModals();

  // Fetch the S3 auto-rename rules so we can preview the final file name before
  // upload. Only active when S3 storage is enabled.
  const [renameRules, setRenameRules] = useState<string>("");
  useEffect(() => {
    configService
      .getFileRenameRules()
      .then(({ enabled, rules }) => setRenameRules(enabled ? rules : ""))
      .catch(() => setRenameRules(""));
  }, []);

  const remove = (index: number) => {
    const file = files[index];

    if ("uploadingProgress" in file) {
      files.splice(index, 1);
    } else {
      files[index] = { ...file, deleted: true };
    }

    setFiles([...files]);
  };

  const restore = (index: number) => {
    const file = files[index];

    if ("uploadingProgress" in file) {
      return;
    } else {
      files[index] = { ...file, deleted: false };
    }

    setFiles([...files]);
  };

  const edit = async (index: number) => {
    const originalFile = files[index] as unknown as File;
    const text = await originalFile.text();

    showTextEditorModal(index, files, setFiles, text, modals);
  };

  const rows = files.map((file, i) => {
    // Preview only applies to pending uploads; already-stored files keep their
    // (already-renamed) name.
    const isPendingUpload =
      "uploadingProgress" in file && file.uploadingProgress === 0;
    const previewName =
      isPendingUpload && renameRules
        ? applyRenameRules(file.name, renameRules)
        : undefined;

    return (
      <FileListRow
        key={i}
        file={file}
        previewName={previewName}
        onRemove={() => remove(i)}
        onRestore={() => restore(i)}
        onEdit={() => edit(i)}
      />
    );
  });

  return (
    <Box className={tableClasses.tablePanel}>
      <Table className={tableClasses.table}>
        <thead>
          <tr>
            <th>
              <FormattedMessage id="upload.filelist.name" />
            </th>
            <th>
              <FormattedMessage id="upload.filelist.size" />
            </th>
            <th className={tableClasses.actionCell}></th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    </Box>
  );
};

export default FileList;
