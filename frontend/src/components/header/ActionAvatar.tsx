import {
  Activity,
  CircleUser,
  Images,
  Link2,
  LogOut,
  Settings,
  User,
  Users,
} from "lucide-react";
import { ActionIcon, Menu } from "@mantine/core";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import useUser from "../../hooks/user.hook";
import authService from "../../services/auth.service";
import FormattedMessage from "../core/FormattedMessage";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "./Header.module.css";
import { isRouteWithin } from "./navigation.util";

const ActionAvatar = ({ active }: { active: boolean }) => {
  const { user } = useUser();
  const t = useTranslate();
  const { pathname } = useRouter();
  const menuItemProps = (href: string) => ({
    "aria-current": pathname === href ? ("page" as const) : undefined,
    className: clsx({ [classes.menuItemActive]: pathname === href }),
  });

  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <ActionIcon
          aria-label={t("common.button.profile")}
          className={clsx(classes.iconLink, {
            [classes.iconLinkActive]: active,
          })}
          color="gray"
          title={t("common.button.profile")}
          variant="subtle"
          aria-current={active ? "location" : undefined}
        >
          <CircleUser size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          href="/account"
          {...menuItemProps("/account")}
          leftSection={<User size={14} />}
        >
          <FormattedMessage id="navbar.avatar.account" />
        </Menu.Item>
        {user!.isAdmin && (
          <>
            <Menu.Divider />
            <Menu.Item
              component={Link}
              href="/admin/users"
              {...menuItemProps("/admin/users")}
              leftSection={<Users size={14} />}
            >
              <FormattedMessage id="admin.button.users" />
            </Menu.Item>
            <Menu.Item
              component={Link}
              href="/admin/shares"
              {...menuItemProps("/admin/shares")}
              leftSection={<Link2 size={14} />}
            >
              <FormattedMessage id="admin.button.shares" />
            </Menu.Item>
            <Menu.Item
              component={Link}
              href="/admin/images"
              {...menuItemProps("/admin/images")}
              leftSection={<Images size={14} />}
            >
              <FormattedMessage id="admin.button.images" />
            </Menu.Item>
            <Menu.Item
              component={Link}
              href="/admin/config/general"
              aria-current={
                isRouteWithin(pathname, "/admin/config") ? "page" : undefined
              }
              className={clsx({
                [classes.menuItemActive]: isRouteWithin(
                  pathname,
                  "/admin/config",
                ),
              })}
              leftSection={<Settings size={14} />}
            >
              <FormattedMessage id="admin.button.config" />
            </Menu.Item>
            <Menu.Item
              component={Link}
              href="/admin/activity"
              {...menuItemProps("/admin/activity")}
              leftSection={<Activity size={14} />}
            >
              <FormattedMessage id="admin.button.activity" />
            </Menu.Item>
          </>
        )}

        <Menu.Divider />
        <Menu.Item
          onClick={async () => {
            await authService.signOut();
          }}
          leftSection={<LogOut size={14} />}
        >
          <FormattedMessage id="navbar.avatar.signout" />
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default ActionAvatar;
