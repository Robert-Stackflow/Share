import { Plus, Trash2 } from "lucide-react";
import {
  ActionIcon,
  Button,
  Group,
  Select,
  Stack,
  Table,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import useTranslate from "../../../hooks/useTranslate.hook";
import {
  parseRenameRules,
  RenameRule,
  stringifyRenameRules,
} from "../../../utils/fileRename.util";

/**
 * Table editor for the S3 file-rename rules config. Keeps the editable rows in
 * local state (so a freshly-added blank row stays visible while typing) and
 * persists only the rules with a non-empty pattern, serialized to the JSON
 * string stored in the config value.
 */
const RenameRulesInput = ({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => {
  const t = useTranslate();
  const [rules, setRules] = useState<RenameRule[]>(() =>
    parseRenameRules(value),
  );

  const commit = (next: RenameRule[]) => {
    setRules(next);
    onChange(stringifyRenameRules(next.filter((rule) => rule.pattern !== "")));
  };

  const updateRule = (index: number, patch: Partial<RenameRule>) =>
    commit(
      rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    );

  const removeRule = (index: number) =>
    commit(rules.filter((_, i) => i !== index));

  const addRule = () =>
    commit([...rules, { pattern: "", replacement: "", type: "glob" }]);

  return (
    <Stack style={{ width: "100%" }} gap="xs">
      <Table verticalSpacing="xs" horizontalSpacing="xs">
        <thead>
          <tr>
            <th>{t("admin.config.s3.file-rename-rules.pattern")}</th>
            <th>{t("admin.config.s3.file-rename-rules.replacement")}</th>
            <th style={{ width: 110 }}>
              {t("admin.config.s3.file-rename-rules.type")}
            </th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, index) => (
            <tr key={index}>
              <td>
                <TextInput
                  variant="filled"
                  disabled={disabled}
                  placeholder="*.apk"
                  value={rule.pattern}
                  onChange={(e) =>
                    updateRule(index, { pattern: e.target.value })
                  }
                />
              </td>
              <td>
                <TextInput
                  variant="filled"
                  disabled={disabled}
                  placeholder="*.apk.1"
                  value={rule.replacement}
                  onChange={(e) =>
                    updateRule(index, { replacement: e.target.value })
                  }
                />
              </td>
              <td>
                <Select
                  variant="filled"
                  disabled={disabled}
                  data={[
                    {
                      value: "glob",
                      label: t("admin.config.s3.file-rename-rules.glob"),
                    },
                    {
                      value: "regex",
                      label: t("admin.config.s3.file-rename-rules.regex"),
                    },
                  ]}
                  value={rule.type}
                  onChange={(v) =>
                    updateRule(index, {
                      type: (v as RenameRule["type"]) ?? "glob",
                    })
                  }
                  allowDeselect={false}
                />
              </td>
              <td>
                <ActionIcon
                  color="red"
                  variant="light"
                  disabled={disabled}
                  onClick={() => removeRule(index)}
                >
                  <Trash2 size={16} />
                </ActionIcon>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Group justify="flex-start">
        <Button
          variant="light"
          size="xs"
          leftSection={<Plus size={16} />}
          disabled={disabled}
          onClick={addRule}
        >
          {t("admin.config.s3.file-rename-rules.add")}
        </Button>
      </Group>
    </Stack>
  );
};

export default RenameRulesInput;
