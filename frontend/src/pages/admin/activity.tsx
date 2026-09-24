import { Box, Center, Group, Select, Stack, Table, Text, Title } from "@mantine/core";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import FormattedMessage from "../../components/core/FormattedMessage";
import Meta from "../../components/Meta";
import CenterLoader from "../../components/core/CenterLoader";
import tableClasses from "../../components/core/DataTable.module.css";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import activityService from "../../services/activity.service";
import { ActivityEvent } from "../../types/activity.type";
import {
  buildActivityActionOptions,
  buildActivityTargetOptions,
  getActivityActionLabel,
  getActivityTargetLabel,
} from "../../utils/activity.util";
import toast from "../../utils/toast.util";

const formatMetadata = (event: ActivityEvent) => {
  const parts: string[] = [];
  if (event.metadata && Object.keys(event.metadata).length > 0) {
    parts.push(JSON.stringify(event.metadata));
  }
  if (event.userAgent) {
    parts.push(event.userAgent);
  }
  return parts.join(" · ");
};

const AdminActivity = () => {
  const t = useTranslate();
  const { user } = useUser();

  const [events, setEvents] = useState<ActivityEvent[]>();
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [targetTypeFilter, setTargetTypeFilter] = useState<string | null>(null);

  const actionData = useMemo(() => buildActivityActionOptions(t), [t]);
  const targetTypeData = useMemo(() => buildActivityTargetOptions(t), [t]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    setEvents(undefined);
    activityService.listAll({
      action: actionFilter ?? undefined,
      targetType: targetTypeFilter ?? undefined,
    })
      .then(setEvents)
      .catch(toast.axiosError);
  }, [user, actionFilter, targetTypeFilter]);

  if (!user?.isAdmin) return null;

  return (
    <>
      <Meta title={t("admin.activity.title")} />
      <Title mb={30} order={3}>
        <FormattedMessage id="admin.activity.title" />
      </Title>

      <Group mb={20} gap="sm">
        <Select
          clearable
          data={actionData}
          value={actionFilter}
          onChange={setActionFilter}
          placeholder={t("account.activity.filter.all")}
          label={t("account.activity.filter.action")}
          w={220}
        />
        <Select
          clearable
          data={targetTypeData}
          value={targetTypeFilter}
          onChange={setTargetTypeFilter}
          placeholder={t("account.activity.filter.all")}
          label={t("account.activity.filter.target")}
          w={220}
        />
      </Group>

      {!events ? (
        <CenterLoader />
      ) : events.length == 0 ? (
        <Center style={{ height: "40vh" }}>
          <Stack align="center" gap={10}>
            <Text>
              <FormattedMessage id="account.activity.empty" />
            </Text>
          </Stack>
        </Center>
      ) : (
        <Box className={tableClasses.tablePanel}>
          <Table className={tableClasses.table}>
            <thead>
              <tr>
                <th>
                  <FormattedMessage id="account.activity.table.time" />
                </th>
                <th>
                  <FormattedMessage id="admin.activity.table.actor" />
                </th>
                <th>
                  <FormattedMessage id="account.activity.table.action" />
                </th>
                <th>
                  <FormattedMessage id="account.activity.table.target" />
                </th>
                <th>
                  <FormattedMessage id="account.activity.table.detail" />
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr className={tableClasses.tableRow} key={event.id}>
                  <td>{moment(event.createdAt).format("LLL")}</td>
                  <td>{event.actorId ?? "—"}</td>
                  <td>{getActivityActionLabel(t, event.action)}</td>
                  <td>
                    <Stack gap={0}>
                      <Text size="sm">
                        {getActivityTargetLabel(t, event.targetType)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {event.targetId}
                      </Text>
                    </Stack>
                  </td>
                  <td>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {formatMetadata(event)}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      )}
    </>
  );
};

export default AdminActivity;
