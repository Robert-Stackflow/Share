import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Center,
  Group,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useClipboard, useDisclosure } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  TbCopy,
  TbExternalLink,
  TbLink,
  TbPlus,
  TbPower,
  TbTrash,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import tableClasses from "../../components/core/DataTable.module.css";
import CenterLoader from "../../components/core/CenterLoader";
import { HoverTip } from "../../components/core/HoverTip";
import modalClasses from "../../components/core/ModalForm.module.css";
import useTranslate from "../../hooks/useTranslate.hook";
import shortLinkService from "../../services/shortLink.service";
import { ShortLink, ShortLinkTargetType } from "../../types/shortLink.type";
import {
  AccessControl,
  toAccessControlPayload,
} from "../../types/accessControl.type";
import AccessControlForm from "../access/AccessControlForm";
import toast from "../../utils/toast.util";
import classes from "./ShortLinksWorkspace.module.css";

const ShortLinksWorkspace = () => {
  const t = useTranslate();
  const clipboard = useClipboard();
  const modals = useModals();
  const router = useRouter();
  const [links, setLinks] = useState<ShortLink[]>();
  const [isCreateOpen, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [isCreating, setIsCreating] = useState(false);
  const [accessControl, setAccessControl] = useState<AccessControl>({});
  const form = useForm({
    initialValues: {
      targetType: "URL" as ShortLinkTargetType,
      targetUrl: "",
      title: "",
      code: "",
    },
  });

  const publicLink = (code: string) => {
    if (typeof window === "undefined") return `/s/${code}`;
    return `${window.location.origin}/s/${code}`;
  };

  const loadLinks = () => {
    shortLinkService.list().then(setLinks).catch(toast.axiosError);
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const createShortLink = form.onSubmit((values) => {
    setIsCreating(true);
    shortLinkService
      .create({
        targetType: values.targetType,
        targetUrl: values.targetUrl,
        title: values.title.trim() || undefined,
        code: values.code.trim() || undefined,
        accessControl: toAccessControlPayload(accessControl),
      })
      .then((shortLink) => {
        setLinks((current) => [shortLink, ...(current ?? [])]);
        form.reset();
        setAccessControl({});
        closeCreate();
        toast.success(t("account.shortLinks.notify.created"));
        void router.push(`/short-links/${shortLink.code}`);
      })
      .catch(toast.axiosError)
      .finally(() => setIsCreating(false));
  });

  const copyLink = (code: string) => {
    clipboard.copy(publicLink(code));
    toast.success(t("common.notify.copied-link"));
  };

  const setLinkActive = (shortLink: ShortLink, isActive: boolean) => {
    shortLinkService
      .update(shortLink.code, { isActive })
      .then((updated) => {
        setLinks((current) =>
          current?.map((link) => (link.code === updated.code ? updated : link)),
        );
        toast.success(
          t(
            isActive
              ? "account.shortLinks.notify.enabled"
              : "account.shortLinks.notify.disabled",
          ),
        );
      })
      .catch(toast.axiosError);
  };

  const confirmRemove = (shortLink: ShortLink) => {
    modals.openConfirmModal({
      title: t("account.shortLinks.modal.delete.title"),
      children: (
        <Text size="sm">
          <FormattedMessage
            id="account.shortLinks.modal.delete.description"
            values={{ code: shortLink.code }}
          />
        </Text>
      ),
      confirmProps: { color: "red" },
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      onConfirm: () => {
        shortLinkService
          .remove(shortLink.code)
          .then(() => {
            setLinks((current) =>
              current?.filter((link) => link.code !== shortLink.code),
            );
            toast.success(t("account.shortLinks.notify.deleted"));
          })
          .catch(toast.axiosError);
      },
    });
  };

  if (!links) return <CenterLoader />;

  return (
    <>
      <Meta title={t("account.shortLinks.title")} />

      <Group align="flex-end" justify="space-between" mb={30}>
        <div>
          <Title order={3}>
            <FormattedMessage id="account.shortLinks.title" />
          </Title>
          <Text c="dimmed" size="sm">
            <FormattedMessage id="account.shortLinks.subtitle" />
          </Text>
        </div>
        <Group gap="sm">
          <Badge color="gray" size="lg" variant="light">
            {links.length} <FormattedMessage id="account.shortLinks.count" />
          </Badge>
          <Button leftSection={<TbPlus />} onClick={openCreate}>
            <FormattedMessage id="account.shortLinks.create" />
          </Button>
        </Group>
      </Group>

      <Modal
        centered
        opened={isCreateOpen}
        size="lg"
        title={<FormattedMessage id="account.shortLinks.create.title" />}
        onClose={closeCreate}
      >
        <form onSubmit={createShortLink}>
          <Stack className={modalClasses.modalStack}>
            <section className={modalClasses.section}>
              <div className={modalClasses.sectionHeader}>
                <Text className={modalClasses.sectionTitle}>
                  {t("account.shortLinks.form.target")}
                </Text>
              </div>
              <Stack gap="sm">
                <SegmentedControl
                  value={form.values.targetType}
                  onChange={(value) =>
                    form.setFieldValue(
                      "targetType",
                      value as ShortLinkTargetType,
                    )
                  }
                  data={[
                    {
                      value: "URL",
                      label: t("account.shortLinks.type.url"),
                    },
                    {
                      value: "INTERNAL_PATH",
                      label: t("account.shortLinks.type.internal"),
                    },
                  ]}
                />
                <TextInput
                  label={t("account.shortLinks.form.target")}
                  placeholder={
                    form.values.targetType === "URL"
                      ? "https://example.com"
                      : "/rooms"
                  }
                  {...form.getInputProps("targetUrl")}
                />
              </Stack>
            </section>

            <section className={modalClasses.section}>
              <div className={modalClasses.sectionHeader}>
                <Text className={modalClasses.sectionTitle}>
                  {t("upload.modal.accordion.name-and-description.title")}
                </Text>
              </div>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label={t("account.shortLinks.form.title")}
                  {...form.getInputProps("title")}
                />
                <TextInput
                  label={t("account.shortLinks.form.code")}
                  {...form.getInputProps("code")}
                />
              </SimpleGrid>
            </section>

            <section className={modalClasses.section}>
              <AccessControlForm
                value={accessControl}
                onChange={setAccessControl}
              />
            </section>

            <Group className={modalClasses.footer}>
              <Button
                leftSection={<TbPlus />}
                loading={isCreating}
                disabled={form.values.targetUrl.trim().length === 0}
                type="submit"
              >
                <FormattedMessage id="account.shortLinks.create" />
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <div
        className={`${tableClasses.tablePanel} ${classes.shortLinkListPanel}`}
      >
        {links.length === 0 ? (
          <Center py="xl">
            <Text c="dimmed">
              <FormattedMessage id="account.shortLinks.empty" />
            </Text>
          </Center>
        ) : (
          <Table className={`${tableClasses.table} ${classes.shortLinkTable}`}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <FormattedMessage id="account.shortLinks.table.code" />
                </Table.Th>
                <Table.Th>
                  <FormattedMessage id="account.shortLinks.form.title" />
                </Table.Th>
                <Table.Th>
                  <FormattedMessage id="account.shortLinks.table.target" />
                </Table.Th>
                <Table.Th>
                  <FormattedMessage id="account.shortLinks.table.visits" />
                </Table.Th>
                <Table.Th>
                  <FormattedMessage id="account.shortLinks.table.status" />
                </Table.Th>
                <Table.Th className={tableClasses.actionCell} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {links.map((shortLink) => {
                const openDetail = () => {
                  void router.push(`/short-links/${shortLink.code}`);
                };

                return (
                  <Table.Tr
                    key={shortLink.id}
                    className={`${tableClasses.tableRow} ${classes.shortLinkTableRow}`}
                    role="button"
                    tabIndex={0}
                    onClick={openDetail}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDetail();
                      }
                    }}
                  >
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <TbLink />
                        <Anchor
                          component={Link}
                          href={`/short-links/${shortLink.code}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          /s/{shortLink.code}
                        </Anchor>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500} lineClamp={1}>
                        {shortLink.title || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td className={classes.targetCell}>
                      <Text c="dimmed" lineClamp={1} size="sm">
                        {shortLink.targetUrl}
                      </Text>
                    </Table.Td>
                    <Table.Td>{shortLink.visits}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={shortLink.isActive ? "green" : "gray"}
                        variant={shortLink.isActive ? "light" : "outline"}
                      >
                        {shortLink.isActive
                          ? t("account.shortLinks.status.active")
                          : t("account.shortLinks.status.disabled")}
                      </Badge>
                    </Table.Td>
                    <Table.Td className={tableClasses.actionCell}>
                      <Group
                        className={tableClasses.actions}
                        gap={4}
                        justify="flex-end"
                        wrap="nowrap"
                      >
                        <HoverTip label={t("common.button.copy-link")}>
                          <ActionIcon
                            aria-label={t("common.button.copy-link")}
                            color="gray"
                            size="sm"
                            variant="subtle"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyLink(shortLink.code);
                            }}
                          >
                            <TbCopy />
                          </ActionIcon>
                        </HoverTip>
                        <HoverTip label={t("common.text.navigate-to-link")}>
                          <ActionIcon
                            aria-label={t("common.text.navigate-to-link")}
                            color="gray"
                            component={Link}
                            href={`/s/${shortLink.code}`}
                            target="_blank"
                            rel="noreferrer"
                            size="sm"
                            variant="subtle"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <TbExternalLink />
                          </ActionIcon>
                        </HoverTip>
                        <HoverTip
                          label={
                            shortLink.isActive
                              ? t("account.shortLinks.action.disable")
                              : t("account.shortLinks.action.enable")
                          }
                        >
                          <ActionIcon
                            aria-label={
                              shortLink.isActive
                                ? t("account.shortLinks.action.disable")
                                : t("account.shortLinks.action.enable")
                            }
                            color="gray"
                            size="sm"
                            variant="subtle"
                            onClick={(event) => {
                              event.stopPropagation();
                              setLinkActive(shortLink, !shortLink.isActive);
                            }}
                          >
                            <TbPower />
                          </ActionIcon>
                        </HoverTip>
                        <HoverTip label={t("common.button.delete")}>
                          <ActionIcon
                            aria-label={t("common.button.delete")}
                            color="red"
                            size="sm"
                            variant="subtle"
                            onClick={(event) => {
                              event.stopPropagation();
                              confirmRemove(shortLink);
                            }}
                          >
                            <TbTrash />
                          </ActionIcon>
                        </HoverTip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </div>
    </>
  );
};

export default ShortLinksWorkspace;
