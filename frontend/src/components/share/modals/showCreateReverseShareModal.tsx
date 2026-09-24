import { Plus } from "lucide-react";
import {
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { useModals } from "@mantine/modals";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import moment from "moment";
import FormattedMessage from "../../core/FormattedMessage";
import * as yup from "yup";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";
import { useState } from "react";
import inboxService from "../../../services/inbox.service";
import { Timespan } from "../../../types/timespan.type";
import { getExpirationPreview } from "../../../utils/date.util";
import toast from "../../../utils/toast.util";
import modalClasses from "../../core/ModalForm.module.css";
import FileSizeInput from "../../core/FileSizeInput";
import showCompletedReverseShareModal from "./showCompletedReverseShareModal";

const showCreateReverseShareModal = (
  modals: ModalsContextProps,
  maxExpiration: Timespan,
  defaultExpiration: Timespan,
  appUrl: string,
  defaultAppUrl: string,
  getReverseShares: () => void,
) => {
  const t = translateOutsideContext();

  return modals.openModal({
    title: t("account.reverseShares.modal.title"),
    centered: true,
    size: "lg",
    children: (
      <Body
        getReverseShares={getReverseShares}
        maxExpiration={maxExpiration}
        defaultExpiration={defaultExpiration}
        appUrl={appUrl}
        defaultAppUrl={defaultAppUrl}
      />
    ),
  });
};

const Body = ({
  getReverseShares,
  maxExpiration,
  defaultExpiration,
  appUrl,
  defaultAppUrl,
}: {
  getReverseShares: () => void;
  maxExpiration: Timespan;
  defaultExpiration: Timespan;
  appUrl: string;
  defaultAppUrl: string;
}) => {
  const modals = useModals();
  const t = useTranslate();
  const [submissionMode, setSubmissionMode] = useState("ongoing");

  const defaultTimespan = defaultExpiration
    ? defaultExpiration
    : { value: 7, unit: "days" };

  const form = useForm({
    initialValues: {
      name: "",
      description: "",
      maxShareSize: 104857600,
      maxFileCount: 10,
      maxUseCount: 10,
      expiration_num: defaultTimespan.value,
      expiration_unit: `-${defaultTimespan.unit}` as string,
      simplified: false,
      publicAccess: false,
    },
    validate: yupResolver(
      yup.object().shape({
        name: yup
          .string()
          .trim()
          .max(120)
          .required(t("common.error.field-required")),
        description: yup.string().max(1000),
        maxUseCount: yup
          .number()
          .typeError(t("common.error.invalid-number"))
          .min(1, t("common.error.number-too-small", { min: 1 }))
          .max(1000, t("common.error.number-too-large", { max: 1000 }))
          .required(t("common.error.field-required")),
        maxFileCount: yup
          .number()
          .integer()
          .min(0)
          .max(100)
          .required(t("common.error.field-required")),
      }),
    ),
  });

  const onSubmit = form.onSubmit(async (values) => {
    const expirationDate = moment().add(
      form.values.expiration_num,
      form.values.expiration_unit.replace(
        "-",
        "",
      ) as moment.unitOfTime.DurationConstructor,
    );
    if (
      maxExpiration.value != 0 &&
      expirationDate.isAfter(
        moment().add(maxExpiration.value, maxExpiration.unit),
      )
    ) {
      form.setFieldError(
        "expiration_num",
        t("upload.modal.expires.error.too-long", {
          max: moment
            .duration(maxExpiration.value, maxExpiration.unit)
            .humanize(),
        }),
      );
      return;
    }

    inboxService
      .create({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        shareExpiration: values.expiration_num + values.expiration_unit,
        maxShareSize: String(values.maxShareSize),
        maxFileCount: values.maxFileCount,
        maxUseCount: submissionMode === "once" ? 1 : values.maxUseCount,
        sendEmailNotification: false,
        simplified: values.simplified,
        publicAccess: values.publicAccess,
      })
      .then(({ link }) => {
        modals.closeAll();
        showCompletedReverseShareModal(modals, link, getReverseShares);
      })
      .catch(toast.axiosError);
  });

  return (
    <form onSubmit={onSubmit}>
      <Stack align="stretch" className={modalClasses.modalStack}>
        <section className={modalClasses.section}>
          <div className={modalClasses.sectionHeader}>
            <Text className={modalClasses.sectionTitle}>
              {t("account.reverseShares.modal.details")}
            </Text>
          </div>
          <Stack gap="sm">
            <TextInput
              label={t("account.reverseShares.modal.name")}
              maxLength={120}
              required
              variant="filled"
              {...form.getInputProps("name")}
            />
            <Textarea
              autosize
              label={t("account.reverseShares.modal.description")}
              maxLength={1000}
              maxRows={4}
              minRows={2}
              variant="filled"
              {...form.getInputProps("description")}
            />
          </Stack>
        </section>
        <section className={modalClasses.section}>
          <div className={modalClasses.sectionHeader}>
            <Text className={modalClasses.sectionTitle}>
              {t("account.reverseShares.modal.expiration.label")}
            </Text>
          </div>
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
              <NumberInput
                decimalScale={0}
                label={t("account.reverseShares.modal.expiration.label")}
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
                label={t("upload.modal.expires.unit-label")}
                variant="filled"
                {...form.getInputProps("expiration_unit")}
              />
            </SimpleGrid>
            <Text className={modalClasses.subtleText}>
              {getExpirationPreview(
                {
                  expiresOn: t("account.reverseShare.expires-on"),
                  neverExpires: t("account.reverseShare.never-expires"),
                },
                form,
              )}
            </Text>
          </Stack>
        </section>

        <section className={modalClasses.section}>
          <div className={modalClasses.sectionHeader}>
            <Text className={modalClasses.sectionTitle}>
              {t("account.reverseShares.modal.max-size.label")}
            </Text>
          </div>
          <Stack gap="sm">
            <FileSizeInput
              label={t("account.reverseShares.modal.max-size.label")}
              value={form.values.maxShareSize}
              onChange={(number) => form.setFieldValue("maxShareSize", number)}
            />
            <NumberInput
              decimalScale={0}
              label={t("account.reverseShares.modal.max-files.label")}
              max={100}
              min={0}
              variant="filled"
              {...form.getInputProps("maxFileCount")}
            />
            <SegmentedControl
              aria-label={t("account.reverseShares.modal.mode.label")}
              data={[
                {
                  label: t("account.reverseShares.modal.mode.ongoing"),
                  value: "ongoing",
                },
                {
                  label: t("account.reverseShares.modal.mode.once"),
                  value: "once",
                },
              ]}
              onChange={setSubmissionMode}
              value={submissionMode}
            />
            {submissionMode === "ongoing" && (
              <NumberInput
                decimalScale={0}
                description={t(
                  "account.reverseShares.modal.max-use.description",
                )}
                label={t("account.reverseShares.modal.max-use.label")}
                max={1000}
                min={1}
                variant="filled"
                {...form.getInputProps("maxUseCount")}
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
          <div className={modalClasses.switchList}>
            <Text size="sm" c="dimmed">
              {t("account.reverseShares.modal.reviewNotice")}
            </Text>
            <Switch
              className={modalClasses.switchRow}
              description={t(
                "account.reverseShares.modal.simplified.description",
              )}
              label={t("account.reverseShares.modal.simplified")}
              {...form.getInputProps("simplified", {
                type: "checkbox",
              })}
            />
            <Switch
              className={modalClasses.switchRow}
              description={t(
                "account.reverseShares.modal.public-access.description",
              )}
              label={t("account.reverseShares.modal.public-access")}
              {...form.getInputProps("publicAccess", {
                type: "checkbox",
              })}
            />
          </div>
        </section>

        <Group className={modalClasses.footer}>
          <Button leftSection={<Plus />} type="submit">
            <FormattedMessage id="common.button.create" />
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

export default showCreateReverseShareModal;
