import { useState } from "react";
import { Button, Group, Box, useComputedColorScheme } from "@mantine/core";
import dynamic from "next/dynamic";
import { commands } from "@uiw/react-md-editor";
import FormattedMessage from "../core/FormattedMessage";
import classes from "./TextEditor.module.css";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false },
);

const TextEditor = ({
  initialText,
  onSave,
  onCancel,
}: {
  initialText: string;
  onSave: (newText: string) => void;
  onCancel: () => void;
}) => {
  const [text, setText] = useState<string | undefined>(initialText);
  const colorScheme = useComputedColorScheme("light");

  return (
    <Box>
      <Box
        data-color-mode={colorScheme}
        className={classes.editor}
      >
        <MDEditor
          value={text}
          onChange={setText}
          height={400}
          preview="live"
          extraCommands={[
            commands.codeEdit,
            commands.codeLive,
            commands.codePreview,
          ]}
        />
      </Box>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onCancel}>
          <FormattedMessage id="common.button.cancel" />
        </Button>
        <Button onClick={() => onSave(text || "")}>
          <FormattedMessage id="common.button.save" />
        </Button>
      </Group>
    </Box>
  );
};

export default TextEditor;
