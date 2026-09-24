import { ChevronDown, Inbox, Link2, Package } from "lucide-react";
import { Group, Menu, UnstyledButton } from "@mantine/core";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import FormattedMessage from "../core/FormattedMessage";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "./Header.module.css";
import { isRouteWithin } from "./navigation.util";

const NavbarShareMenu = ({ active }: { active: boolean }) => {
  const t = useTranslate();
  const { pathname } = useRouter();
  const menuItemProps = (href: string) => ({
    "aria-current": isRouteWithin(pathname, href)
      ? ("page" as const)
      : undefined,
    className: clsx({
      [classes.menuItemActive]: isRouteWithin(pathname, href),
    }),
  });

  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <UnstyledButton
          className={clsx(classes.link, { [classes.linkActive]: active })}
          aria-current={active ? "location" : undefined}
        >
          <Group gap={6} wrap="nowrap">
            <span>{t("navbar.contentAndSharing")}</span>
            <ChevronDown size={14} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          href="/account/assets"
          {...menuItemProps("/account/assets")}
          leftSection={<Package />}
        >
          <FormattedMessage id="navbar.links.assets" />
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/account/shares"
          {...menuItemProps("/account/shares")}
          leftSection={<Link2 />}
        >
          <FormattedMessage id="navbar.links.shares" />
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/account/reverseShares"
          {...menuItemProps("/account/reverseShares")}
          leftSection={<Inbox />}
        >
          <FormattedMessage id="navbar.links.reverse" />
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default NavbarShareMenu;
