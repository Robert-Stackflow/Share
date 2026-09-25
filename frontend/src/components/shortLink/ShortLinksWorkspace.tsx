import {
  Copy,
  Ellipsis,
  ExternalLink,
  Link2,
  Plus,
  Power,
  Search,
  Trash2,
} from "lucide-react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Center,
  Group,
  Menu,
  Modal,
  SegmentedControl,
  Select,
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
import { useEffect, useRef, useState } from "react";
import FormattedMessage from "../core/FormattedMessage";
import Meta from "../../components/Meta";
import tableClasses from "../../components/core/DataTable.module.css";
import CenterLoader from "../../components/core/CenterLoader";
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
import InternalTargetPicker from "./InternalTargetPicker";
import { getShortLinkStatus, ShortLinkStatus } from "./shortLinkStatus";
import { isValidTarget, isWebUrl } from "./shortLinkTarget";

const ShortLinksWorkspace = () => {
  const t = useTranslate();
  const clipboard = useClipboard();
  const modals = useModals();
  const router = useRouter();
  const [links, setLinks] = useState<ShortLink[]>();
  const [isCreateOpen, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [isCreating, setIsCreating] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShortLinkStatus | "all">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<ShortLinkTargetType | "all">(
    "all",
  );
  const internalDrag = useRef(false);
  const [accessControl, setAccessControl] = useState<AccessControl>({});
  const form = useForm({
    initialValues: {
      targetType: "URL" as ShortLinkTargetType,
      targetUrl: "",
      title: "",
      code: "",
    },
    validate: {
      targetUrl: (value, values) =>
        isValidTarget(values.targetType, value.trim())
          ? null
          : t("account.shortLinks.error.target"),
    },
  });

  const normalizedQuery = query.trim().toLowerCase();
  const filteredLinks = (links ?? []).filter((link) => {
    if (statusFilter !== "all" && getShortLinkStatus(link) !== statusFilter) {
      return false;
    }
    if (typeFilter !== "all" && link.targetType !== typeFilter) return false;
    return (
      !normalizedQuery ||
      [link.code, link.title ?? "", link.targetUrl].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      )
    );
  });
  const hasFilters = Boolean(
    normalizedQuery || statusFilter !== "all" || typeFilter !== "all",
  );

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
  };

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

  useEffect(() => {
    const onDragStart = () => {
      internalDrag.current = true;
    };
    const onDragEnd = () => {
      internalDrag.current = false;
    };
    const onPaste = (event: ClipboardEvent) => {
      if (
        isCreateOpen ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)))
      )
        return;
      const value = event.clipboardData?.getData("text/plain") ?? "";
      if (!isWebUrl(value)) return;
      event.preventDefault();
      form.setFieldValue("targetType", "URL");
      form.setFieldValue("targetUrl", value.trim());
      openCreate();
    };
    const onDragOver = (event: DragEvent) => {
      if (internalDrag.current) return;
      if (
        Array.from(event.dataTransfer?.types ?? []).some((type) =>
          ["Files", "text/plain", "text/uri-list"].includes(type),
        )
      )
        event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (internalDrag.current) return;
      const value =
        event.dataTransfer?.getData("text/uri-list") ||
        event.dataTransfer?.getData("text/plain") ||
        "";
      if (!value && !event.dataTransfer?.files.length) return;
      event.preventDefault();
      if (isCreateOpen) return;
      if (!isWebUrl(value)) {
        toast.error(t("account.shortLinks.error.drop-url"));
        return;
      }
      form.setFieldValue("targetType", "URL");
      form.setFieldValue("targetUrl", value.trim());
      openCreate();
    };
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [isCreateOpen, form, openCreate, t]);

  const prepareTarget = () => {
    if (!isWebUrl(targetDraft)) return;
    form.setFieldValue("targetType", "URL");
    form.setFieldValue("targetUrl", targetDraft.trim());
    openCreate();
  };

  const createShortLink = form.onSubmit((values) => {
    setIsCreating(true);
    shortLinkService
      .create({
        targetType: values.targetType,
        targetUrl: values.targetUrl.trim(),
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
      .then(() => shortLinkService.list())
      .then((updatedLinks) => {
        setLinks(updatedLinks);
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
        <Title order={3}>
          <FormattedMessage id="account.shortLinks.title" />
        </Title>
        <Group gap="sm">
          <Badge color="gray" size="lg" variant="light">
            {links.length} <FormattedMessage id="account.shortLinks.count" />
          </Badge>
          <Button leftSection={<Plus />} onClick={openCreate}>
            <FormattedMessage id="account.shortLinks.create" />
          </Button>
        </Group>
      </Group>

      <Group className={classes.quickCreate} gap="sm" mb="lg" align="flex-end">
        <TextInput
          aria-label={t("account.shortLinks.quick-url")}
          placeholder={t("account.shortLinks.quick-url")}
          value={targetDraft}
          onChange={(event) => setTargetDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") prepareTarget();
          }}
          style={{ flex: "1 1 260px" }}
        />
        <Button
          variant="light"
          disabled={!isWebUrl(targetDraft)}
          onClick={prepareTarget}
        >
          {t("account.shortLinks.quick-next")}
        </Button>
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
                  onChange={(value) => {
                    form.setFieldValue(
                      "targetType",
                      value as ShortLinkTargetType,
                    );
                    form.setFieldValue("targetUrl", "");
                  }}
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
                {form.values.targetType === "URL" ? (
                  <TextInput
                    label={t("account.shortLinks.form.target")}
                    placeholder="https://example.com"
                    {...form.getInputProps("targetUrl")}
                  />
                ) : (
                  <InternalTargetPicker
                    error={form.errors.targetUrl as string | undefined}
                    value={form.values.targetUrl}
                    onChange={(value) => form.setFieldValue("targetUrl", value)}
                  />
                )}
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
                fields={[
                  "password",
                  "expiresAt",
                  "maxViews",
                  "allowAnonymous",
                  "oneTime",
                ]}
              />
            </section>

            <Group className={modalClasses.footer}>
              <Button
                leftSection={<Plus />}
                loading={isCreating}
                disabled={
                  !isValidTarget(
                    form.values.targetType,
                    form.values.targetUrl.trim(),
                  )
                }
                type="submit"
              >
                <FormattedMessage id="account.shortLinks.create" />
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {links.length > 0 && (
        <Group className={classes.filters} align="flex-end" gap="sm" mb="md" wrap="wrap">
          <TextInput
            aria-label={t("account.shortLinks.filter.search")}
            leftSection={<Search size={16} />}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("account.shortLinks.filter.search")}
            style={{ flex: "1 1 220px" }}
            value={query}
          />
          <Select
            aria-label={t("account.shortLinks.filter.status")}
            data={["all", "active", "disabled", "expired", "limit"].map(
              (status) => ({
                value: status,
                label: t(
                  status === "all"
                    ? "account.shortLinks.filter.all"
                    : `account.shortLinks.status.${status}`,
                ),
              }),
            )}
            onChange={(value) =>
              setStatusFilter((value as ShortLinkStatus | "all") ?? "all")
            }
            value={statusFilter}
            w={145}
          />
          <Select
            aria-label={t("account.shortLinks.filter.type")}
            data={[
              { value: "all", label: t("account.shortLinks.filter.all") },
              { value: "URL", label: t("account.shortLinks.type.url") },
              {
                value: "INTERNAL_PATH",
                label: t("account.shortLinks.type.internal"),
              },
            ]}
            onChange={(value) =>
              setTypeFilter((value as ShortLinkTargetType | "all") ?? "all")
            }
            value={typeFilter}
            w={160}
          />
          {hasFilters && (
            <Button onClick={clearFilters} variant="subtle">
              {t("account.shortLinks.filter.clear")}
            </Button>
          )}
        </Group>
      )}

      <div
        className={`${tableClasses.tablePanel} ${classes.shortLinkListPanel}`}
      >
        {filteredLinks.length === 0 ? (
          <Center py="xl">
            <Text c="dimmed">
              {t(
                hasFilters
                  ? "account.shortLinks.filter.empty"
                  : "account.shortLinks.empty",
              )}
            </Text>
          </Center>
        ) : (
          <Table className={`${tableClasses.table} ${classes.shortLinkTable}`}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <FormattedMessage id="account.shortLinks.table.code" />
                </Table.Th>
                <Table.Th className={classes.secondaryColumn}>
                  <FormattedMessage id="account.shortLinks.form.title" />
                </Table.Th>
                <Table.Th className={classes.secondaryColumn}>
                  <FormattedMessage id="account.shortLinks.table.target" />
                </Table.Th>
                <Table.Th className={classes.secondaryColumn}>
                  <FormattedMessage id="account.shortLinks.table.visits" />
                </Table.Th>
                <Table.Th className={classes.statusColumn}>
                  <FormattedMessage id="account.shortLinks.table.status" />
                </Table.Th>
                <Table.Th
                  className={`${tableClasses.actionCell} ${classes.rowActionCell}`}
                />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredLinks.map((shortLink) => {
                const status = getShortLinkStatus(shortLink);
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
                    <Table.Td className={classes.codeCell}>
                      <Group gap="xs" wrap="nowrap">
                        <Link2 />
                        <Anchor
                          component={Link}
                          href={`/short-links/${shortLink.code}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          /s/{shortLink.code}
                        </Anchor>
                      </Group>
                      <div className={classes.mobileMeta}>
                        {shortLink.title && (
                          <Text size="xs" fw={600} lineClamp={1}>
                            {shortLink.title}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {shortLink.targetUrl}
                        </Text>
                        <Badge
                          size="xs"
                          color={
                            status === "active"
                              ? "green"
                              : status === "expired"
                                ? "orange"
                                : status === "limit"
                                  ? "red"
                                  : "gray"
                          }
                          variant="light"
                        >
                          {t(`account.shortLinks.status.${status}`)}
                        </Badge>
                      </div>
                    </Table.Td>
                    <Table.Td className={classes.secondaryColumn}>
                      <Text fw={500} lineClamp={1}>
                        {shortLink.title || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td
                      className={`${classes.targetCell} ${classes.secondaryColumn}`}
                    >
                      <Text c="dimmed" lineClamp={1} size="sm">
                        {shortLink.targetUrl}
                      </Text>
                    </Table.Td>
                    <Table.Td className={classes.secondaryColumn}>
                      {shortLink.visits}
                    </Table.Td>
                    <Table.Td className={classes.statusColumn}>
                      <Badge
                        color={
                          status === "active"
                            ? "green"
                            : status === "expired"
                              ? "orange"
                              : status === "limit"
                                ? "red"
                                : "gray"
                        }
                        variant={status === "disabled" ? "outline" : "light"}
                      >
                        {t(`account.shortLinks.status.${status}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td
                      className={`${tableClasses.actionCell} ${classes.rowActionCell}`}
                    >
                      <Group
                        className={tableClasses.actions}
                        gap={4}
                        justify="flex-end"
                        wrap="nowrap"
                      >
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<Copy size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            copyLink(shortLink.code);
                          }}
                        >
                          {t("common.button.copy")}
                        </Button>
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon
                              aria-label={t("account.shortLinks.action.more")}
                              variant="subtle"
                              color="gray"
                              size="md"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Ellipsis size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              component={Link}
                              href={`/s/${shortLink.code}`}
                              target="_blank"
                              rel="noreferrer"
                              leftSection={<ExternalLink size={14} />}
                            >
                              {t("common.text.navigate-to-link")}
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<Power size={14} />}
                              onClick={() =>
                                setLinkActive(shortLink, !shortLink.isActive)
                              }
                            >
                              {shortLink.isActive
                                ? t("account.shortLinks.action.disable")
                                : t("account.shortLinks.action.enable")}
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<Trash2 size={14} />}
                              onClick={() => confirmRemove(shortLink)}
                            >
                              {t("common.button.delete")}
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
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
