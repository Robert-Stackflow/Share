import {
  Captions,
  CircleAlert,
  FileIcon,
  Link2,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Trash2,
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
import React, { useState } from "react";
import { FormattedMessage } from "react-intl";
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
) => void;

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
    size: 760,
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
  const [pendingTextAssets, setPendingTextAssets] = useState<string[]>(
    initialAssets
      .filter((asset) => asset.type === "TEXT")
      .map((asset) => asset.content),
  );
  const [pendingLinkAssets, setPendingLinkAssets] = useState<string[]>(
    initialAssets
      .filter((asset) => asset.type === "LINK")
      .map((asset) => asset.url),
  );
  const [accessControl, setAccessControl] = useState<AccessControl>({});

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
    recipients: string[];
    password?: string;
    maxViews?: number;
    description?: string;
    expiration_num: number;
    expiration_unit: string;
    never_expires: boolean;
    textContent: string;
    linkUrl: string;
  }>({
    initialValues: {
      name: undefined,
      link: generatedLink,
      recipients: [] as string[],
      password: undefined,
      maxViews: undefined,
      description: undefined,
      expiration_num: defaultTimespan.value,
      expiration_unit: `-${defaultTimespan.unit}` as string,
      never_expires: false,
      textContent: "",
      linkUrl: "",
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

  const addPendingTextAsset = () => {
    const content = form.values.textContent.trim();
    if (!content) return;

    setPendingTextAssets((current) => [...current, content]);
    form.setFieldValue("textContent", "");
  };

  const addPendingLinkAsset = () => {
    const url = form.values.linkUrl.trim();
    if (!url) return;

    try {
      new URL(url);
    } catch {
      form.setFieldError("linkUrl", t("upload.modal.content.link.invalid"));
      return;
    }

    setPendingLinkAssets((current) => [...current, url]);
    form.setFieldValue("linkUrl", "");
    form.clearFieldError("linkUrl");
  };

  const onSubmit = form.onSubmit(async (values) => {
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

      uploadCallback(
        {
          id: options.isInbox
            ? generateShareId(options.shareIdLength)
            : values.link,
          name: values.name,
          expiration: expirationString,
          recipients: options.isInbox ? [] : values.recipients,
          description: values.description,
          security: {
            password: options.isInbox
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
      modals.closeAll();
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
            {!options.isInbox && (
              <section
                className={`${modalClasses.flatSection} ${modalClasses.createShareWide}`}
              >
                <div className={modalClasses.sectionHeader}>
                  <Text className={modalClasses.sectionTitle}>
                    {t("upload.modal.link.label")}
                  </Text>
                </div>
                <div className={modalClasses.inlineActionRow}>
                  <TextInput
                    placeholder="myAwesomeShare"
                    variant="filled"
                    {...form.getInputProps("link")}
                  />
                  <HoverTip label={t("common.button.generate")}>
                    <ActionIcon
                      aria-label={t("common.button.generate")}
                      color="gray"
                      size="lg"
                      variant="default"
                      onClick={() =>
                        form.setFieldValue(
                          "link",
                          generateShareId(options.shareIdLength),
                        )
                      }
                    >
                      <RefreshCw />
                    </ActionIcon>
                  </HoverTip>
                </div>
                <div className={modalClasses.previewBar}>
                  {`${options.appUrl !== options.defaultAppUrl ? options.appUrl : window.location.origin}/s/${form.values.link}`}
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
                  <Text className={modalClasses.sectionDescription}>
                    {t(
                      options.isInbox
                        ? "inbox.submit.contentDescription"
                        : "upload.modal.content.description",
                    )}
                  </Text>
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
                  <Tabs.Tab value="files" leftSection={<FileIcon size={15} />}>
                    {t("upload.modal.content.files")}
                  </Tabs.Tab>
                  <Tabs.Tab value="text" leftSection={<Captions size={15} />}>
                    {t("upload.modal.content.text")}
                  </Tabs.Tab>
                  <Tabs.Tab value="link" leftSection={<Link2 size={15} />}>
                    {t("upload.modal.content.link")}
                  </Tabs.Tab>
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
                  <Stack gap="sm">
                    <Textarea
                      autosize
                      label={t("upload.modal.content.text.label")}
                      minRows={3}
                      placeholder={t("upload.modal.content.text.placeholder")}
                      variant="filled"
                      {...form.getInputProps("textContent")}
                    />
                    <Group justify="flex-end">
                      <Button
                        color="gray"
                        disabled={!form.values.textContent.trim()}
                        leftSection={<Plus />}
                        type="button"
                        variant="default"
                        onClick={addPendingTextAsset}
                      >
                        {t("upload.modal.content.text.add")}
                      </Button>
                    </Group>
                    <div className={modalClasses.pendingAssetList}>
                      {pendingTextAssets.length === 0 ? (
                        <Text className={modalClasses.emptyState}>
                          {t("upload.modal.content.text.empty")}
                        </Text>
                      ) : (
                        pendingTextAssets.map((content, index) => (
                          <div
                            className={modalClasses.assetSummaryRow}
                            key={`${content}-${index}`}
                          >
                            <div className={modalClasses.assetSummaryMain}>
                              <Captions size={16} />
                              <Text
                                className={modalClasses.pendingAssetValue}
                                lineClamp={1}
                              >
                                {content}
                              </Text>
                            </div>
                            <HoverTip label={t("common.button.delete")}>
                              <ActionIcon
                                aria-label={t("common.button.delete")}
                                color="gray"
                                size="sm"
                                type="button"
                                variant="subtle"
                                onClick={() =>
                                  setPendingTextAssets((current) =>
                                    current.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  )
                                }
                              >
                                <Trash2 />
                              </ActionIcon>
                            </HoverTip>
                          </div>
                        ))
                      )}
                    </div>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel
                  className={modalClasses.contentTabPanel}
                  value="link"
                >
                  <Stack gap="sm">
                    <div className={modalClasses.inlineActionRow}>
                      <TextInput
                        error={form.errors.linkUrl}
                        label={t("upload.modal.content.link.label")}
                        placeholder="https://example.com"
                        variant="filled"
                        {...form.getInputProps("linkUrl")}
                      />
                      <Button
                        color="gray"
                        disabled={!form.values.linkUrl.trim()}
                        leftSection={<Plus />}
                        type="button"
                        variant="default"
                        onClick={addPendingLinkAsset}
                      >
                        {t("upload.modal.content.link.add")}
                      </Button>
                    </div>
                    <div className={modalClasses.pendingAssetList}>
                      {pendingLinkAssets.length === 0 ? (
                        <Text className={modalClasses.emptyState}>
                          {t("upload.modal.content.link.empty")}
                        </Text>
                      ) : (
                        pendingLinkAssets.map((url, index) => (
                          <div
                            className={modalClasses.assetSummaryRow}
                            key={`${url}-${index}`}
                          >
                            <div className={modalClasses.assetSummaryMain}>
                              <Link2 size={16} />
                              <Text
                                className={modalClasses.pendingAssetValue}
                                lineClamp={1}
                              >
                                {url}
                              </Text>
                            </div>
                            <HoverTip label={t("common.button.delete")}>
                              <ActionIcon
                                aria-label={t("common.button.delete")}
                                color="gray"
                                size="sm"
                                type="button"
                                variant="subtle"
                                onClick={() =>
                                  setPendingLinkAssets((current) =>
                                    current.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  )
                                }
                              >
                                <Trash2 />
                              </ActionIcon>
                            </HoverTip>
                          </div>
                        ))
                      )}
                    </div>
                  </Stack>
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

            {options.enableEmailRecepients && !options.isInbox && (
              <section className={modalClasses.flatSection}>
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
                    const trimmed = values.map((v) => v.trim()).filter(Boolean);
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
              <section className={modalClasses.flatSection}>
                <div className={modalClasses.sectionHeader}>
                  <Text className={modalClasses.sectionTitle}>
                    {t("upload.modal.access.security.title")}
                  </Text>
                </div>
                <Stack align="stretch" gap="sm">
                  <PasswordInput
                    autoComplete="new-password"
                    label={t("upload.modal.access.security.password.label")}
                    placeholder={t(
                      "upload.modal.access.security.password.placeholder",
                    )}
                    variant="filled"
                    {...form.getInputProps("password")}
                  />
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
                    fields={[
                      "expiresAt",
                      "allowDownload",
                      "allowAnonymous",
                      "oneTime",
                    ]}
                  />
                </Stack>
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
              color="gray"
              data-autofocus
              disabled={contentCount === 0}
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
              color="gray"
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
