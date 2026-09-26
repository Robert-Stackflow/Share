import { Box, Group, Select, Stack, Table, Text, Title } from "@mantine/core";
import { History } from "lucide-react";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import FormattedMessage from "../../components/core/FormattedMessage";
import Meta from "../../components/Meta";
import CenterLoader from "../../components/core/CenterLoader";
import EmptyState from "../../components/core/EmptyState";
import tableClasses from "../../components/core/DataTable.module.css";
import useTranslate from "../../hooks/useTranslate.hook";
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

const MyActivity = () => {
  const t = useTranslate();

  const [events, setEvents] = useState<ActivityEvent[]>();
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [targetTypeFilter, setTargetTypeFilter] = useState<string | null>(null);

  const actionData = useMemo(() => buildActivityActionOptions(t), [t]);
  const targetTypeData = useMemo(() => buildActivityTargetOptions(t), [t]);

  useEffect(() => {
    setEvents(undefined);
    activityService
      .list({
        action: actionFilter ?? undefined,
        targetType: targetTypeFilter ?? undefined,
      })
      .then(setEvents)
      .catch(toast.axiosError);
  }, [actionFilter, targetTypeFilter]);

  return (
    <>
      <Meta title={t("account.activity.title")} />
      <Title mb={30} order={3}>
        <FormattedMessage id="account.activity.title" />
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
        <EmptyState
          icon={<History size={22} />}
          title={<FormattedMessage id="account.activity.empty" />}
        />
      ) : (
        <Box className={tableClasses.tablePanel}>
          <Table className={tableClasses.table}>
            <thead>
              <tr>
                <th>
                  <FormattedMessage id="account.activity.table.time" />
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

export default MyActivity;
