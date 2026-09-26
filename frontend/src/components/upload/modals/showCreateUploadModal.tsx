import {
  Captions,
  CircleAlert,
  FileIcon,
  Link2,
  RefreshCw,
  Send,
  Share2,
} from "lucide-react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  NumberInput,
  PasswordInput,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Tabs,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { useModals } from "@mantine/modals";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import moment from "moment";
import { AxiosError } from "axios";
import React, { useState } from "react";
import FormattedMessage from "../../core/FormattedMessage";
import * as yup from "yup";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";
import shareService from "../../../services/share.service";
import { CreateAsset } from "../../../types/asset.type";
import { FileUpload } from "../../../types/File.type";
import { CreateShare } from "../../../types/share.type";
import {
  AccessControl,
  toAccessControlPayload,
} from "../../../types/accessControl.type";
import AccessControlForm from "../../access/AccessControlForm";
import { getExpirationPreview } from "../../../utils/date.util";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import toast from "../../../utils/toast.util";
import { Timespan } from "../../../types/timespan.type";
import modalClasses from "../../core/ModalForm.module.css";
import { HoverTip } from "../../core/HoverTip";

type UploadCallback = (
  createShare: CreateShare,
  files: FileUpload[],
  pendingAssets: CreateAsset[],
) => Promise<void>;

const showCreateUploadModal = (
  modals: ModalsContextProps,
  options: {
    isUserSignedIn: boolean;
    isReverseShare: boolean;
    isInbox?: boolean;
    appUrl: string;
    defaultAppUrl: string;
    allowUnauthenticatedShares: boolean;
    enableEmailRecepients: boolean;
    maxExpiration: Timespan;
    defaultExpiration: Timespan;
    shareIdLength: number;
    simplified: boolean;
  },
  files: FileUpload[],
  initialAssets: CreateAsset[],
  uploadCallback: UploadCallback,
) => {
  const t = translateOutsideContext();

  if (options.simplified) {
    return modals.openModal({
      title: t(options.isInbox ? "inbox.submit.review" : "upload.modal.title"),
      centered: true,
      size: "lg",
      children: (
        <SimplifiedCreateUploadModalModal
          options={options}
          files={files}
          initialAssets={initialAssets}
          uploadCallback={uploadCallback}
        />
      ),
    });
  }

  return modals.openModal({
    title: t(options.isInbox ? "inbox.submit.review" : "upload.modal.title"),
    centered: true,
    size: 860,
    children: (
      <CreateUploadModalBody
        options={options}
        files={files}
        initialAssets={initialAssets}
        uploadCallback={uploadCallback}
      />
    ),
  });
};

const generateShareId = (length: number = 16) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomArray = new Uint8Array(length >= 3 ? length : 3);
  crypto.getRandomValues(randomArray);
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
};

const generatePickupCode = () => {
  const random = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  do {
    crypto.getRandomValues(random);
  } while (random[0] >= limit);
  return (random[0] % 1_000_000).toString().padStart(6, "0");
};

const generateAvailableLink = async (
  shareIdLength: number,
  times: number = 10,
): Promise<string> => {
  if (times <= 0) {
    throw new Error("Could not generate available link");
  }
  const _link = generateShareId(shareIdLength);
  if (!(await shareService.isShareIdAvailable(_link))) {
    return await generateAvailableLink(shareIdLength, times - 1);
  } else {
    return _link;
  }
};

const CreateUploadModalBody = ({
  uploadCallback,
  files,
  initialAssets,
  options,
}: {
  files: FileUpload[];
  initialAssets: CreateAsset[];
  uploadCallback: UploadCallback;
  options: {
    isUserSignedIn: boolean;
    isReverseShare: boolean;
    isInbox?: boolean;
    appUrl: string;
    defaultAppUrl: string;
    allowUnauthenticatedShares: boolean;
    enableEmailRecepients: boolean;
    maxExpiration: Timespan;
    defaultExpiration: Timespan;
    shareIdLength: number;
  };
}) => {
  const modals = useModals();
  const t = useTranslate();

  const generatedLink = generateShareId(options.shareIdLength);

  const [showNotSignedInAlert, setShowNotSignedInAlert] = useState(true);
  const [activeContentTab, setActiveContentTab] = useState<string | null>(
    files.length > 0
      ? "files"
      : (initialAssets[0]?.type.toLowerCase() ?? "files"),
  );
  const pendingTextAssets = initialAssets
    .filter((asset) => asset.type === "TEXT")
    .map((asset) => asset.content);
  const pendingLinkAssets = initialAssets
    .filter((asset) => asset.type === "LINK")
    .map((asset) => asset.url);
  const [accessControl, setAccessControl] = useState<AccessControl>({});
  const [deliveryMode, setDeliveryMode] = useState<"LINK" | "PICKUP">("LINK");
  const [submitting, setSubmitting] = useState(false);

  const validationSchema = yup.object().shape({
    link: yup
      .string()
      .transform((value) => value || undefined)
      .when([], {
        is: () => !options.isInbox,
        then: (schema) => schema.required(t("common.error.field-required")),
        otherwise: (schema) => schema.optional(),
      })
      .min(3, t("common.error.too-short", { length: 3 }))
      .max(50, t("common.error.too-long", { length: 50 }))
      .matches(new RegExp("^[a-zA-Z0-9_-]*$"), {
        message: t("upload.modal.link.error.invalid"),
      }),
    name: yup
      .string()
      .transform((value) => value || undefined)
      .min(3, t("common.error.too-short", { length: 3 }))
      .max(30, t("common.error.too-long", { length: 30 })),
    password: yup
      .string()
      .transform((value) => value || undefined)
      .min(3, t("common.error.too-short", { length: 3 }))
      .max(30, t("common.error.too-long", { length: 30 })),
    maxViews: yup
      .number()
      .transform((value) => value || undefined)
      .min(1),
  });

  const defaultTimespan = options.defaultExpiration
    ? options.defaultExpiration
    : { value: 7, unit: "days" };

  const form = useForm<{
    name?: string;
    link: string;
    pickupCode: string;
    recipients: string[];
    password?: string;
    maxViews?: number;
    description?: string;
    expiration_num: number;
    expiration_unit: string;
    never_expires: boolean;
  }>({
    initialValues: {
      name: undefined,
      link: generatedLink,
      pickupCode: generatePickupCode(),
      recipients: [] as string[],
      password: undefined,
      maxViews: undefined,
      description: undefined,
      expiration_num: defaultTimespan.value,
      expiration_unit: `-${defaultTimespan.unit}` as string,
      never_expires: false,
    },
    validate: yupResolver(validationSchema),
  });

  const pendingAssets: CreateAsset[] = [
    ...pendingTextAssets.map((content) => ({
      type: "TEXT" as const,
      content,
    })),
    ...pendingLinkAssets.map((url) => ({
      type: "LINK" as const,
      url,
    })),
  ];
  const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
  const contentCount = files.length + pendingAssets.length;

  const onSubmit = form.onSubmit(async (values) => {
    if (submitting) return;
    if (deliveryMode === "PICKUP" && !/^\d{6}$/.test(values.pickupCode)) {
      form.setFieldError(
        "pickupCode",
        t("upload.modal.delivery.customInvalid"),
      );
      return;
    }
    if (
      !options.isInbox &&
      !(await shareService.isShareIdAvailable(values.link))
    ) {
      form.setFieldError("link", t("upload.modal.link.error.taken"));
    } else {
      const expirationString = form.values.never_expires
        ? "never"
        : form.values.expiration_num + form.values.expiration_unit;

      const expirationDate = moment().add(
        form.values.expiration_num,
        form.values.expiration_unit.replace(
          "-",
          "",
        ) as moment.unitOfTime.DurationConstructor,
      );

      if (
        options.maxExpiration.value != 0 &&
        (form.values.never_expires ||
          expirationDate.isAfter(
            moment().add(
              options.maxExpiration.value,
              options.maxExpiration.unit,
            ),
          ))
      ) {
        form.setFieldError(
          "expiration_num",
          t("upload.modal.expires.error.too-long", {
            max: moment
              .duration(options.maxExpiration.value, options.maxExpiration.unit)
              .humanize(),
          }),
        );
        return;
      }

      const createPromise = uploadCallback(
        {
          id: options.isInbox
            ? generateShareId(options.shareIdLength)
            : values.link,
          name: values.name,
          expiration: expirationString,
          recipients:
            options.isInbox || deliveryMode === "PICKUP"
              ? []
              : values.recipients,
          deliveryMode: options.isInbox ? "LINK" : deliveryMode,
          pickupCode: deliveryMode === "PICKUP" ? values.pickupCode : undefined,
          description: values.description,
          security: {
            password:
              options.isInbox || deliveryMode === "PICKUP"
                ? undefined
                : values.password || undefined,
            maxViews: options.isInbox
              ? undefined
              : values.maxViews || undefined,
          },
          accessControl: toAccessControlPayload(accessControl),
        },
        files,
        pendingAssets,
      );
      if (deliveryMode === "PICKUP") {
        setSubmitting(true);
        try {
          await createPromise;
          modals.closeAll();
        } catch (error) {
          if (
            error instanceof AxiosError &&
            error.response?.data?.error === "pickup_code_taken"
          ) {
            form.setFieldError(
              "pickupCode",
              t("upload.modal.delivery.customTaken"),
            );
          } else {
            toast.axiosError(error);
          }
        } finally {
          setSubmitting(false);
        }
      } else {
        modals.closeAll();
      }
    }
  });

  return (
    <Stack className={modalClasses.modalStack}>
      {showNotSignedInAlert && !options.isUserSignedIn && (
        <Alert
          withCloseButton
          onClose={() => setShowNotSignedInAlert(false)}
          icon={<CircleAlert size={16} />}
          title={t("upload.modal.not-signed-in")}
          color="yellow"
        >
          <FormattedMessage id="upload.modal.not-signed-in-description" />
        </Alert>
      )}
      <form onSubmit={onSubmit}>
        <Stack align="stretch" className={modalClasses.modalStack}>
          <div className={modalClasses.createShareGrid}>
            {!options.isInbox && !options.isReverseShare && (
              <section
                className={`${modalClasses.flatSection} ${modalClasses.createShareWide}`}
              >
                <div className={modalClasses.sectionHeader}>
                  <Text className={modalClasses.sectionTitle}>
                    {t("upload.modal.delivery.title")}
                  </Text>
                </div>
                <SegmentedControl
                  fullWidth
                  value={deliveryMode}
                  onChange={(value) => {
                    const nextMode = value as "LINK" | "PICKUP";
                    setDeliveryMode(nextMode);
                    if (nextMode === "PICKUP") {
                      form.setFieldValue(
                        "link",
                        generateShareId(options.shareIdLength),
                      );
                      form.setFieldValue("password", undefined);
                      form.setFieldValue("recipients", []);
                      form.clearFieldError("link");
                      form.clearFieldError("password");
                      form.clearFieldError("recipients");
                    }
                  }}
                  data={[
                    { label: t("upload.modal.delivery.link"), value: "LINK" },
                    {
                      label: t("upload.modal.delivery.pickup"),
                      value: "PICKUP",
                    },
                  ]}
                />
                <Text className={modalClasses.sectionDescription} mt="xs">
                  {t(
                    deliveryMode === "PICKUP"
                      ? "upload.modal.delivery.pickupDescription"
                      : "upload.modal.delivery.linkDescription",
                  )}
                </Text>
              </section>
            )}
            {!options.isInbox && (
              <section
                className={`${modalClasses.flatSection} ${modalClasses.createShareWide}`}
              >
                <div className={modalClasses.sectionHeader}>
                  <Text className={modalClasses.sectionTitle}>
                    {t(
                      deliveryMode === "PICKUP"
                        ? "pickup.code"
                        : "upload.modal.link.label",
                    )}
                  </Text>
                </div>
                <div className={modalClasses.inlineActionRow}>
                  {deliveryMode === "PICKUP" ? (
                    <TextInput
                      placeholder={t("upload.modal.delivery.customPlaceholder")}
                      variant="filled"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      {...form.getInputProps("pickupCode")}
                      onChange={(event) => {
                        form.setFieldValue(
                          "pickupCode",
                          event.currentTarget.value
                            .replace(/\D/g, "")
                            .slice(0, 6),
                        );
                        form.clearFieldError("pickupCode");
                      }}
                    />
                  ) : (
                    <TextInput
                      placeholder="myAwesomeShare"
                      variant="filled"
                      {...form.getInputProps("link")}
                    />
                  )}
                  <HoverTip
                    label={t(
                      deliveryMode === "PICKUP"
                        ? "upload.modal.delivery.resetCode"
                        : "common.button.generate",
                    )}
                  >
                    <ActionIcon
                      aria-label={t(
                        deliveryMode === "PICKUP"
                          ? "upload.modal.delivery.resetCode"
                          : "common.button.generate",
                      )}
                      color="gray"
                      size="lg"
                      variant="default"
                      onClick={() => {
                        if (deliveryMode === "PICKUP") {
                          form.setFieldValue(
                            "pickupCode",
                            generatePickupCode(),
                          );
                          form.clearFieldError("pickupCode");
                        } else {
                          form.setFieldValue(
                            "link",
                            generateShareId(options.shareIdLength),
                          );
                          form.clearFieldError("link");
                        }
                      }}
                    >
                      <RefreshCw />
                    </ActionIcon>
                  </HoverTip>
                </div>
                <div className={modalClasses.previewBar}>
                  {deliveryMode === "PICKUP"
                    ? `${t("pickup.entry")} · ${options.appUrl !== options.defaultAppUrl ? options.appUrl : window.location.origin}/pickup`
                    : `${options.appUrl !== options.defaultAppUrl ? options.appUrl : window.location.origin}/s/${form.values.link}`}
                </div>
              </section>
            )}

            <section
              className={`${modalClasses.flatSection} ${modalClasses.createShareWide}`}
            >
              <div className={modalClasses.sectionHeader}>
                <div>
                  <Text className={modalClasses.sectionTitle}>
                    {t(
                      options.isInbox
                        ? "inbox.submit.contentTitle"
                        : "upload.modal.content.title",
                    )}
                  </Text>
                  {options.isInbox && (
                    <Text className={modalClasses.sectionDescription}>
                      {t("inbox.submit.contentDescription")}
                    </Text>
                  )}
                </div>
                <Badge
                  className={modalClasses.countBadge}
                  color="gray"
                  variant="light"
                >
                  {t("upload.modal.content.total", { count: contentCount })}
                </Badge>
              </div>

              <Tabs
                className={modalClasses.contentTabs}
                value={activeContentTab}
                onChange={setActiveContentTab}
              >
                <Tabs.List>
                  {files.length > 0 && (
                    <Tabs.Tab
                      value="files"
                      leftSection={<FileIcon size={15} />}
                    >
                      {t("upload.modal.content.files")}
                    </Tabs.Tab>
                  )}
                  {pendingTextAssets.length > 0 && (
                    <Tabs.Tab value="text" leftSection={<Captions size={15} />}>
                      {t("upload.modal.content.text")}
                    </Tabs.Tab>
                  )}
                  {pendingLinkAssets.length > 0 && (
                    <Tabs.Tab value="link" leftSection={<Link2 size={15} />}>
                      {t("upload.modal.content.link")}
                    </Tabs.Tab>
                  )}
                </Tabs.List>

                <Tabs.Panel
                  className={modalClasses.contentTabPanel}
                  value="files"
                >
                  <div className={modalClasses.assetSummary}>
                    <Group justify="space-between" gap="xs" wrap="wrap">
                      <Text className={modalClasses.subtleText}>
                        {t("upload.modal.content.files.summary", {
                          count: files.length,
                          size: byteToHumanSizeString(totalFileSize),
                        })}
                      </Text>
                    </Group>
                    <div className={modalClasses.pendingAssetList}>
                      {files.length === 0 ? (
                        <Text className={modalClasses.emptyState}>
                          {t("upload.modal.content.files.empty")}
                        </Text>
                      ) : (
                        files.slice(0, 5).map((file) => (
                          <div
                            className={modalClasses.assetSummaryRow}
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                          >
                            <div className={modalClasses.assetSummaryMain}>
                              <FileIcon size={16} />
                              <Text lineClamp={1}>{file.name}</Text>
                            </div>
                            <Text className={modalClasses.assetSummaryMeta}>
                              {byteToHumanSizeString(file.size)}
                            </Text>
                          </div>
                        ))
                      )}
                      {files.length > 5 && (
                        <Text className={modalClasses.subtleText}>
                          {t("upload.modal.content.files.more", {
                            count: files.length - 5,
                          })}
                        </Text>
                      )}
                    </div>
                  </div>
                </Tabs.Panel>

                <Tabs.Panel
                  className={modalClasses.contentTabPanel}
                  value="text"
                >
                  <div className={modalClasses.pendingAssetList}>
                    {pendingTextAssets.map((content, index) => (
                      <div
                        className={modalClasses.assetSummaryRow}
                        key={`${content}-${index}`}
                      >
                        <div className={modalClasses.assetSummaryMain}>
                          <Captions size={16} />
                          <Text
                            className={modalClasses.pendingAssetValue}
                            lineClamp={2}
                          >
                            {content}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </Tabs.Panel>

                <Tabs.Panel
                  className={modalClasses.contentTabPanel}
                  value="link"
                >
                  <div className={modalClasses.pendingAssetList}>
                    {pendingLinkAssets.map((url, index) => (
                      <div
                        className={modalClasses.assetSummaryRow}
                        key={`${url}-${index}`}
                      >
                        <div className={modalClasses.assetSummaryMain}>
                          <Link2 size={16} />
                          <Text
                            className={modalClasses.pendingAssetValue}
                            lineClamp={2}
                          >
                            {url}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </Tabs.Panel>
              </Tabs>
            </section>

            {!options.isReverseShare && !options.isInbox && (
              <section className={modalClasses.flatSection}>
                <div className={modalClasses.sectionHeader}>
                  <Text className={modalClasses.sectionTitle}>
                    {t("upload.modal.access.expiration.title")}
                  </Text>
                </div>
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                    <NumberInput
                      decimalScale={0}
                      disabled={form.values.never_expires}
                      hideControls
                      label={t("upload.modal.expires.label")}
                      max={99999}
                      min={1}
                      variant="filled"
                      {...form.getInputProps("expiration_num")}
                    />
                    <Select
                      data={[
                        {
                          value: "-minutes",
                          label:
                            form.values.expiration_num == 1
                              ? t("upload.modal.expires.minute-singular")
                              : t("upload.modal.expires.minute-plural"),
                        },
                        {
                          value: "-hours",
                          label:
                            form.values.expiration_num == 1
                              ? t("upload.modal.expires.hour-singular")
                              : t("upload.modal.expires.hour-plural"),
                        },
                        {
                          value: "-days",
                          label:
                            form.values.expiration_num == 1
                              ? t("upload.modal.expires.day-singular")
                              : t("upload.modal.expires.day-plural"),
                        },
                        {
                          value: "-weeks",
                          label:
                            form.values.expiration_num == 1
                              ? t("upload.modal.expires.week-singular")
                              : t("upload.modal.expires.week-plural"),
                        },
                        {
                          value: "-months",
                          label:
                            form.values.expiration_num == 1
                              ? t("upload.modal.expires.month-singular")
                              : t("upload.modal.expires.month-plural"),
                        },
                        {
                          value: "-years",
                          label:
                            form.values.expiration_num == 1
                              ? t("upload.modal.expires.year-singular")
                              : t("upload.modal.expires.year-plural"),
                        },
                      ]}
                      disabled={form.values.never_expires}
                      label={t("upload.modal.expires.unit-label")}
                      variant="filled"
                      {...form.getInputProps("expiration_unit")}
                    />
                  </SimpleGrid>
                  {options.maxExpiration.value == 0 && (
                    <Checkbox
                      label={t("upload.modal.expires.never-long")}
                      {...form.getInputProps("never_expires", {
                        type: "checkbox",
                      })}
                    />
                  )}
                  <Text className={modalClasses.subtleText}>
                    {getExpirationPreview(
                      {
                        neverExpires: t("upload.modal.completed.never-expires"),
                        expiresOn: t("upload.modal.completed.expires-on"),
                      },
                      form,
                    )}
                  </Text>
                </Stack>
              </section>
            )}

            <section className={modalClasses.flatSection}>
              <div className={modalClasses.sectionHeader}>
                <Text className={modalClasses.sectionTitle}>
                  {t(
                    options.isInbox
                      ? "inbox.submit.messageTitle"
                      : "upload.modal.details.title",
                  )}
                </Text>
              </div>
              <Stack align="stretch" gap="sm">
                {!options.isInbox && (
                  <TextInput
                    placeholder={t("upload.modal.details.name.placeholder")}
                    variant="filled"
                    {...form.getInputProps("name")}
                  />
                )}
                <Textarea
                  autosize
                  minRows={3}
                  placeholder={t(
                    options.isInbox
                      ? "inbox.submit.messagePlaceholder"
                      : "upload.modal.details.description.placeholder",
                  )}
                  variant="filled"
                  {...form.getInputProps("description")}
                />
              </Stack>
            </section>

            {options.enableEmailRecepients &&
              !options.isInbox &&
              deliveryMode === "LINK" && (
                <section
                  className={`${modalClasses.flatSection} ${modalClasses.createShareWide}`}
                >
                  <div className={modalClasses.sectionHeader}>
                    <Text className={modalClasses.sectionTitle}>
                      {t("upload.modal.access.email.title")}
                    </Text>
                  </div>
                  <TagsInput
                    error={form.errors.recipients}
                    id="recipient-emails"
                    inputMode="email"
                    placeholder={t("upload.modal.access.email.placeholder")}
                    splitChars={[",", ";", " "]}
                    value={form.values.recipients}
                    onChange={(values) => {
                      const trimmed = values
                        .map((v) => v.trim())
                        .filter(Boolean);
                      const valid = trimmed.filter((v) =>
                        /^\S+@\S+\.\S+$/.test(v),
                      );
                      const hasInvalid = trimmed.length !== valid.length;
                      form.setFieldValue(
                        "recipients",
                        Array.from(new Set(valid)),
                      );
                      if (hasInvalid) {
                        form.setFieldError(
                          "recipients",
                          t("upload.modal.access.email.invalid-email"),
                        );
                      } else {
                        form.clearFieldError("recipients");
                      }
                    }}
                  />
                </section>
              )}

            {!options.isInbox && (
              <section
                className={`${modalClasses.flatSection} ${modalClasses.createShareWide}`}
              >
                <div className={modalClasses.sectionHeader}>
                  <Text className={modalClasses.sectionTitle}>
                    {t("upload.modal.access.security.title")}
                  </Text>
                </div>
                <div className={modalClasses.shareAccessGrid}>
                  <Stack className={modalClasses.shareAccessColumn} gap="md">
                    {deliveryMode === "LINK" && (
                      <PasswordInput
                        autoComplete="new-password"
                        label={t("upload.modal.access.security.password.label")}
                        placeholder={t(
                          "upload.modal.access.security.password.placeholder",
                        )}
                        variant="filled"
                        {...form.getInputProps("password")}
                      />
                    )}
                    <NumberInput
                      hideControls
                      label={t("upload.modal.access.security.max-views.label")}
                      min={1}
                      placeholder={t(
                        "upload.modal.access.security.max-views.placeholder",
                      )}
                      variant="filled"
                      {...form.getInputProps("maxViews")}
                    />
                    <AccessControlForm
                      value={accessControl}
                      onChange={setAccessControl}
                      fields={["expiresAt"]}
                      showTitle={false}
                    />
                  </Stack>
                  <AccessControlForm
                    value={accessControl}
                    onChange={setAccessControl}
                    fields={["allowDownload", "allowAnonymous", "oneTime"]}
                    showTitle={false}
                  />
                </div>
              </section>
            )}
          </div>

          <Group className={modalClasses.footer}>
            <Button
              color="gray"
              type="button"
              variant="default"
              onClick={() => modals.closeAll()}
            >
              <FormattedMessage id="common.button.cancel" />
            </Button>
            <Button
              data-autofocus
              disabled={contentCount === 0 || submitting}
              loading={submitting}
              leftSection={options.isInbox ? <Send /> : <Share2 />}
              type="submit"
            >
              <FormattedMessage
                id={
                  options.isInbox
                    ? "upload.modal.inbox.submit"
                    : "common.button.share"
                }
              />
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
};

const SimplifiedCreateUploadModalModal = ({
  uploadCallback,
  files,
  initialAssets,
  options,
}: {
  files: FileUpload[];
  initialAssets: CreateAsset[];
  uploadCallback: UploadCallback;
  options: {
    isUserSignedIn: boolean;
    isReverseShare: boolean;
    isInbox?: boolean;
    allowUnauthenticatedShares: boolean;
    enableEmailRecepients: boolean;
    maxExpiration: Timespan;
    shareIdLength: number;
  };
}) => {
  const modals = useModals();
  const t = useTranslate();

  const [showNotSignedInAlert, setShowNotSignedInAlert] = useState(true);

  const validationSchema = yup.object().shape({
    name: yup
      .string()
      .transform((value) => value || undefined)
      .min(3, t("common.error.too-short", { length: 3 }))
      .max(30, t("common.error.too-long", { length: 30 })),
  });

  const form = useForm({
    initialValues: {
      name: undefined,
      description: undefined,
    },
    validate: yupResolver(validationSchema),
  });

  const onSubmit = form.onSubmit(async (values) => {
    const link = options.isInbox
      ? generateShareId(options.shareIdLength)
      : await generateAvailableLink(options.shareIdLength).catch(() => {
          toast.error(t("upload.modal.link.error.taken"));
          return undefined;
        });

    if (!link) {
      return;
    }

    uploadCallback(
      {
        id: link,
        name: values.name,
        expiration: "never",
        recipients: [],
        description: values.description,
        security: {
          password: undefined,
          maxViews: undefined,
        },
      },
      files,
      initialAssets,
    );
    modals.closeAll();
  });

  return (
    <Stack className={modalClasses.modalStack}>
      {showNotSignedInAlert && !options.isUserSignedIn && (
        <Alert
          withCloseButton
          onClose={() => setShowNotSignedInAlert(false)}
          icon={<CircleAlert size={16} />}
          title={t("upload.modal.not-signed-in")}
          color="yellow"
        >
          <FormattedMessage id="upload.modal.not-signed-in-description" />
        </Alert>
      )}
      <form onSubmit={onSubmit}>
        <Stack align="stretch" className={modalClasses.modalStack}>
          <div className={modalClasses.createShareGrid}>
            <section
              className={`${modalClasses.flatSection} ${modalClasses.createShareWide}`}
            >
              <div className={modalClasses.sectionHeader}>
                <Text className={modalClasses.sectionTitle}>
                  {t(
                    options.isInbox
                      ? "inbox.submit.messageTitle"
                      : "upload.modal.details.title",
                  )}
                </Text>
              </div>
              <Stack align="stretch" gap="sm">
                {!options.isInbox && (
                  <TextInput
                    variant="filled"
                    placeholder={t("upload.modal.details.name.placeholder")}
                    {...form.getInputProps("name")}
                  />
                )}
                <Textarea
                  variant="filled"
                  placeholder={t(
                    options.isInbox
                      ? "inbox.submit.messagePlaceholder"
                      : "upload.modal.details.description.placeholder",
                  )}
                  {...form.getInputProps("description")}
                />
              </Stack>
            </section>
          </div>
          <Group className={modalClasses.footer}>
            <Button
              color="gray"
              type="button"
              variant="default"
              onClick={() => modals.closeAll()}
            >
              <FormattedMessage id="common.button.cancel" />
            </Button>
            <Button
              data-autofocus
              leftSection={options.isInbox ? <Send /> : <Share2 />}
              type="submit"
            >
              <FormattedMessage
                id={
                  options.isInbox
                    ? "upload.modal.inbox.submit"
                    : "common.button.share"
                }
              />
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
};

export default showCreateUploadModal;
