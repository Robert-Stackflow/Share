import {
  NumberInput,
  PasswordInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { ReactNode } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import {
  AccessControl,
  AccessControlField,
  toAccessControlPayload,
} from "../../types/accessControl.type";
import classes from "./AccessControlForm.module.css";

export { toAccessControlPayload };
export type { AccessControl };

type AccessControlFormProps = {
  value: AccessControl;
  onChange: (value: AccessControl) => void;
  /**
   * Restrict which controls render for a given surface. When omitted, every
   * control is shown. Rooms hide `password` because they keep
   * their existing passcode field.
   */
  fields?: AccessControlField[];
};

const ALL_FIELDS: AccessControlField[] = [
  "password",
  "expiresAt",
  "maxViews",
  "allowDownload",
  "allowAnonymous",
  "oneTime",
];

const AccessControlForm = ({
  value,
  onChange,
  fields,
}: AccessControlFormProps) => {
  const t = useTranslate();

  const visible = (field: AccessControlField) =>
    fields ? fields.includes(field) : ALL_FIELDS.includes(field);

  const set = <K extends keyof AccessControl>(
    key: K,
    fieldValue: AccessControl[K],
  ) => {
    onChange({ ...value, [key]: fieldValue });
  };

  const switchRow = (
    checked: boolean,
    title: string,
    description: ReactNode,
    onToggle: (checked: boolean) => void,
  ) => (
    <div className={classes.switchRow}>
      <div className={classes.switchLabel}>
        <div className={classes.switchTitle}>{title}</div>
        <div className={classes.switchDescription}>{description}</div>
      </div>
      <Switch
        checked={checked}
        onChange={(event) => onToggle(event.currentTarget.checked)}
      />
    </div>
  );

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        {t("accessControl.title")}
      </Text>

      {visible("password") && (
        <PasswordInput
          autoComplete="new-password"
          label={t("accessControl.password")}
          placeholder={t("accessControl.password.placeholder")}
          value={value.password ?? ""}
          variant="filled"
          onChange={(event) => set("password", event.currentTarget.value)}
        />
      )}

      {visible("expiresAt") && (
        <TextInput
          label={t("accessControl.expiresAt")}
          type="datetime-local"
          value={value.expiresAt ?? ""}
          variant="filled"
          onChange={(event) => set("expiresAt", event.currentTarget.value)}
        />
      )}

      {visible("maxViews") && (
        <NumberInput
          hideControls
          label={t("accessControl.maxViews")}
          min={1}
          placeholder={t("accessControl.maxViews.placeholder")}
          value={value.maxViews ?? ""}
          variant="filled"
          onChange={(maxViews) =>
            set("maxViews", typeof maxViews === "number" ? maxViews : null)
          }
        />
      )}

      {(visible("allowDownload") ||
        visible("allowAnonymous") ||
        visible("oneTime")) && (
        <div className={classes.switchList}>
          {visible("allowDownload") &&
            switchRow(
              value.allowDownload ?? true,
              t("accessControl.allowDownload"),
              t("accessControl.allowDownload.description"),
              (checked) => set("allowDownload", checked),
            )}

          {visible("allowAnonymous") &&
            switchRow(
              value.allowAnonymous ?? true,
              t("accessControl.allowAnonymous"),
              t("accessControl.allowAnonymous.description"),
              (checked) => set("allowAnonymous", checked),
            )}

          {visible("oneTime") &&
            switchRow(
              value.oneTime ?? false,
              t("accessControl.oneTime"),
              t("accessControl.oneTime.description"),
              (checked) => set("oneTime", checked),
            )}
        </div>
      )}
    </Stack>
  );
};

export default AccessControlForm;
