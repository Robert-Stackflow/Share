import { Pencil, Save } from "lucide-react";
import {
  Button,
  Checkbox,
  Collapse,
  Group,
  NumberInput,
  PasswordInput,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import moment from "moment";
import { useState } from "react";
import * as yup from "yup";
import { translateOutsideContext } from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import { MyShare, UpdateShare } from "../../types/share.type";
import { Timespan } from "../../types/timespan.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import modalClasses from "../core/ModalForm.module.css";
import DateTimeField from "../core/DateTimeField";
import CopyTextField from "../upload/CopyTextField";
import QRCode from "./QRCode";

const showShareInformationsModal = (
  modals: ModalsContextProps,
  share: MyShare,
  maxShareSize: number,
  appUrl: string,
  defaultAppUrl: string,
  maxExpiration?: Timespan,
  onShareUpdated?: (share: MyShare) => void,
  initiallyEditing = false,
) => {
  const t = translateOutsideContext();

  return modals.openModal({
    title: t("account.shares.modal.share-informations"),
    centered: true,
    size: "lg",
    children: (
      <Body
        share={share}
        maxShareSize={maxShareSize}
        appUrl={appUrl}
        defaultAppUrl={defaultAppUrl}
        maxExpiration={maxExpiration}
        onShareUpdated={onShareUpdated}
        initiallyEditing={initiallyEditing}
      />
    ),
  });
};

const Body = ({
  share,
  maxShareSize,
  appUrl,
  defaultAppUrl,
  maxExpiration,
  onShareUpdated,
  initiallyEditing,
}: {
  share: MyShare;
  maxShareSize: number;
  appUrl: string;
  defaultAppUrl: string;
  maxExpiration?: Timespan;
  onShareUpdated?: (share: MyShare) => void;
  initiallyEditing: boolean;
}) => {
  const t = translateOutsideContext();
  const [currentShare, setCurrentShare] = useState(share);
  const [showQR, setShowQR] = useState(false);
  const [isEditing, setIsEditing] = useState(initiallyEditing);

  const handleToggleQR = () => {
    setShowQR(!showQR);
  };

  const link = `${appUrl !== defaultAppUrl ? appUrl : window.location.origin}/s/${currentShare.id}`;

  const formattedShareSize = byteToHumanSizeString(currentShare.size);
  const formattedMaxShareSize = byteToHumanSizeString(maxShareSize);
  const shareSizeProgress = (currentShare.size / maxShareSize) * 100;

  const formattedCreatedAt = moment(currentShare.createdAt).format("LLL");
  const formattedExpiration =
    moment(currentShare.expiration).unix() === 0
      ? "Never"
      : moment(currentShare.expiration).format("LLL");

  if (isEditing) {
    return (
      <EditShareBody
        share={currentShare}
        maxExpiration={maxExpiration}
        onCancel={() => setIsEditing(false)}
        onShareUpdated={(updatedShare) => {
          setCurrentShare(updatedShare);
          onShareUpdated?.(updatedShare);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <Stack align="stretch" className={modalClasses.modalStack}>
      <div className={modalClasses.metaGrid}>
        {[
          [t("account.shares.table.id"), currentShare.id],
          [t("account.shares.table.name"), currentShare.name || "-"],
          [
            t("account.shares.table.description"),
            currentShare.description || "-",
          ],
          [t("account.shares.table.createdAt"), formattedCreatedAt],
          [t("account.shares.table.expiresAt"), formattedExpiration],
        ].map(([label, value]) => (
          <div className={modalClasses.metaRow} key={label}>
            <div className={modalClasses.metaLabel}>{label}</div>
            <div className={modalClasses.metaValue}>{value}</div>
          </div>
        ))}
      </div>

      <section className={modalClasses.section}>
        <div className={modalClasses.sectionHeader}>
          <Text className={modalClasses.sectionTitle}>
            {t("common.text.link")}
          </Text>
        </div>
        <CopyTextField link={link} toggleQR={handleToggleQR} />
      </section>
      <Collapse in={showQR}>
        <div className={modalClasses.qrWrap}>
          <QRCode link={link} />
        </div>
      </Collapse>

      <section className={modalClasses.section}>
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <Text className={modalClasses.sectionTitle}>
            {t("account.shares.table.size")}
          </Text>
          <Text c="dimmed" size="sm">
            {shareSizeProgress.toFixed(1)}%
          </Text>
        </Group>
        <Progress
          color="gray"
          radius="xl"
          size="sm"
          value={shareSizeProgress}
        />
        <Group justify="space-between" mt={6}>
          <Text c="dimmed" size="xs">
            {formattedShareSize}
          </Text>
          <Text c="dimmed" size="xs">
            {formattedMaxShareSize}
          </Text>
        </Group>
      </section>
      <Group className={modalClasses.footer}>
        <Button
          leftSection={<Pencil />}
          variant="default"
          onClick={() => setIsEditing(true)}
        >
          {t("common.button.edit")}
        </Button>
      </Group>
    </Stack>
  );
};

const formatDateTimeLocal = (date: Date) => {
  return moment(date).format("YYYY-MM-DDTHH:mm");
};

const EditShareBody = ({
  share,
  maxExpiration,
  onCancel,
  onShareUpdated,
}: {
  share: MyShare;
  maxExpiration?: Timespan;
  onCancel: () => void;
  onShareUpdated: (share: MyShare) => void;
}) => {
  const t = translateOutsideContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPermanentShare = moment(share.expiration).unix() === 0;
  const security = share.security ?? {
    passwordProtected: false,
    maxViews: undefined,
  };

  const validationSchema = yup.object().shape({
    name: yup
      .string()
      .transform((value) => value || undefined)
      .min(3, t("common.error.too-short", { length: 3 }))
      .max(30, t("common.error.too-long", { length: 30 })),
    description: yup
      .string()
      .transform((value) => value || undefined)
      .max(512, t("common.error.too-long", { length: 512 })),
    password: yup
      .string()
      .transform((value) => value || undefined)
      .min(3, t("common.error.too-short", { length: 3 }))
      .max(30, t("common.error.too-long", { length: 30 })),
    maxViews: yup
      .number()
      .nullable()
      .transform((value) => value || undefined)
      .min(1, t("common.error.number-too-small", { min: 1 })),
  });

  const form = useForm({
    initialValues: {
      name: share.name || "",
      description: share.description || "",
      expiration: isPermanentShare
        ? formatDateTimeLocal(moment().add(1, "day").toDate())
        : formatDateTimeLocal(share.expiration),
      never_expires: isPermanentShare,
      password: "",
      removePassword: false,
      maxViews: security.maxViews || undefined,
    },
    validate: yupResolver(validationSchema),
  });

  const onSubmit = form.onSubmit(async (values) => {
    const expirationDate = moment(values.expiration);

    if (!values.never_expires && !expirationDate.isValid()) {
      form.setFieldError("expiration", t("common.error.field-required"));
      return;
    }

    if (
      !values.never_expires &&
      maxExpiration &&
      maxExpiration.value !== 0 &&
      expirationDate.isAfter(
        moment().add(maxExpiration.value, maxExpiration.unit),
      )
    ) {
      form.setFieldError(
        "expiration",
        t("upload.modal.expires.error.too-long", {
          max: moment
            .duration(maxExpiration.value, maxExpiration.unit)
            .humanize(),
        }),
      );
      return;
    }

    const updateShare: UpdateShare = {
      name: values.name || null,
      description: values.description || null,
      expiration: values.never_expires ? "never" : expirationDate.toISOString(),
      security: {
        password: values.password || undefined,
        removePassword: values.removePassword,
        maxViews: values.maxViews || null,
      },
    };

    setIsSubmitting(true);
    try {
      const updatedShare = await shareService.update(share.id, updateShare);
      toast.success(t("share.edit.notify.save-success"));
      onShareUpdated(updatedShare);
    } catch (e) {
      toast.axiosError(e);
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit}>
      <Stack align="stretch" className={modalClasses.modalStack}>
        <section className={modalClasses.section}>
          <div className={modalClasses.sectionHeader}>
            <Text className={modalClasses.sectionTitle}>
              {t("upload.modal.accordion.name-and-description.title")}
            </Text>
          </div>
          <Stack gap="sm">
            <TextInput
              label={t("account.shares.table.name")}
              placeholder={t(
                "upload.modal.accordion.name-and-description.name.placeholder",
              )}
              variant="filled"
              {...form.getInputProps("name")}
            />
            <Textarea
              label={t("account.shares.table.description")}
              placeholder={t(
                "upload.modal.accordion.name-and-description.description.placeholder",
              )}
              variant="filled"
              {...form.getInputProps("description")}
            />
          </Stack>
        </section>

        <section className={modalClasses.section}>
          <div className={modalClasses.sectionHeader}>
            <Text className={modalClasses.sectionTitle}>
              {t("account.shares.table.expiresAt")}
            </Text>
          </div>
          <Stack gap="sm">
            <DateTimeField
              disabled={form.values.never_expires}
              label={t("account.shares.table.expiresAt")}
              value={form.values.expiration}
              error={form.errors.expiration as string | undefined}
              onChange={(next) => form.setFieldValue("expiration", next ?? "")}
            />
            {(!maxExpiration || maxExpiration.value === 0) && (
              <Checkbox
                label={t("upload.modal.expires.never-long")}
                {...form.getInputProps("never_expires", { type: "checkbox" })}
              />
            )}
          </Stack>
        </section>

        <section className={modalClasses.section}>
          <div className={modalClasses.sectionHeader}>
            <Text className={modalClasses.sectionTitle}>
              {t("upload.modal.accordion.security.title")}
            </Text>
          </div>
          <Stack gap="sm">
            <PasswordInput
              autoComplete="new-password"
              disabled={form.values.removePassword}
              label={t("upload.modal.accordion.security.password.label")}
              placeholder={
                security.passwordProtected
                  ? t("account.shares.modal.edit.password.keep")
                  : t("upload.modal.accordion.security.password.placeholder")
              }
              variant="filled"
              {...form.getInputProps("password")}
            />
            {security.passwordProtected && (
              <Checkbox
                label={t("account.shares.modal.edit.password.remove")}
                {...form.getInputProps("removePassword", { type: "checkbox" })}
              />
            )}
            <NumberInput
              label={t("upload.modal.accordion.security.max-views.label")}
              min={1}
              placeholder={t(
                "upload.modal.accordion.security.max-views.placeholder",
              )}
              variant="filled"
              {...form.getInputProps("maxViews")}
            />
          </Stack>
        </section>

        <Group className={modalClasses.footer}>
          <Button variant="default" onClick={onCancel}>
            {t("common.button.cancel")}
          </Button>
          <Button leftSection={<Save />} loading={isSubmitting} type="submit">
            {t("common.button.save")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

export default showShareInformationsModal;
