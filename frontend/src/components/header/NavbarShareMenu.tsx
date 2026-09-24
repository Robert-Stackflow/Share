import { ChevronDown, Inbox, Link2, Package } from "lucide-react";
import { Group, Menu, UnstyledButton } from "@mantine/core";
import Link from "next/link";
import FormattedMessage from "../core/FormattedMessage";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "./Header.module.css";

const NavbarShareMenu = () => {
  const t = useTranslate();

  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <UnstyledButton className={classes.link}>
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
          leftSection={<Package />}
        >
          <FormattedMessage id="navbar.links.assets" />
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/account/shares"
          leftSection={<Link2 />}
        >
          <FormattedMessage id="navbar.links.shares" />
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/account/reverseShares"
          leftSection={<Inbox />}
        >
          <FormattedMessage id="navbar.links.reverse" />
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default NavbarShareMenu;
