import { Check, KeyRound, Pencil, Trash2 } from "lucide-react";
import { ActionIcon, Badge, Box, Group, Skeleton, Table } from "@mantine/core";
import { useModals } from "@mantine/modals";
import User from "../../../types/user.type";
import showChangeUserPasswordModal from "./showChangeUserPasswordModal";
import showUpdateUserModal from "./showUpdateUserModal";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../../hooks/useTranslate.hook";
import tableClasses from "../../core/DataTable.module.css";
import { HoverTip } from "../../core/HoverTip";

const ManageUserTable = ({
  users,
  getUsers,
  deleteUser,
  isLoading,
}: {
  users: User[];
  getUsers: () => void;
  deleteUser: (user: User) => void;
  isLoading: boolean;
}) => {
  const modals = useModals();
  const t = useTranslate();

  return (
    <Box className={tableClasses.tablePanel}>
      <Table className={tableClasses.table}>
        <thead>
          <tr>
            <th>
              <FormattedMessage id="admin.users.table.username" />
            </th>
            <th>
              <FormattedMessage id="admin.users.table.email" />
            </th>
            <th>
              <FormattedMessage id="admin.users.table.admin" />
            </th>
            <th className={tableClasses.actionCell}></th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? skeletonRows
            : users.map((user) => (
                <tr className={tableClasses.tableRow} key={user.id}>
                  <td>
                    {user.username}{" "}
                    {user.isLdap ? (
                      <Badge style={{ marginLeft: "1em" }}>LDAP</Badge>
                    ) : null}
                  </td>
                  <td>{user.email}</td>
                  <td>{user.isAdmin && <Check />}</td>
                  <td className={tableClasses.actionCell}>
                    <Group
                      className={tableClasses.actions}
                      justify="flex-end"
                      wrap="nowrap"
                    >
                      {user.isLdap ? null : (
                        <HoverTip label={t("common.button.edit")}>
                          <ActionIcon
                            aria-label={t("common.button.edit")}
                            variant="subtle"
                            color="gray"
                            size={25}
                            onClick={() =>
                              showUpdateUserModal(modals, user, getUsers)
                            }
                          >
                            <Pencil />
                          </ActionIcon>
                        </HoverTip>
                      )}
                      {user.isLdap ? null : (
                        <HoverTip label={t("admin.users.edit.password.action")}>
                          <ActionIcon
                            aria-label={t("admin.users.edit.password.action")}
                            variant="subtle"
                            color="gray"
                            size={25}
                            onClick={() =>
                              showChangeUserPasswordModal(
                                modals,
                                user,
                                getUsers,
                              )
                            }
                          >
                            <KeyRound />
                          </ActionIcon>
                        </HoverTip>
                      )}
                      <HoverTip label={t("common.button.delete")}>
                        <ActionIcon
                          aria-label={t("common.button.delete")}
                          variant="subtle"
                          color="red"
                          size={25}
                          onClick={() => deleteUser(user)}
                        >
                          <Trash2 />
                        </ActionIcon>
                      </HoverTip>
                    </Group>
                  </td>
                </tr>
              ))}
        </tbody>
      </Table>
    </Box>
  );
};

const skeletonRows = [...Array(10)].map((v, i) => (
  <tr key={i}>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
  </tr>
));

export default ManageUserTable;
