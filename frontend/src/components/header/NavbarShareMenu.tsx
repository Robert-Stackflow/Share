import { Link2, Package, RotateCcw } from "lucide-react";
import { ActionIcon, Menu } from "@mantine/core";
import Link from "next/link";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "./Header.module.css";

const NavbarShareMneu = () => {
  const t = useTranslate();

  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <ActionIcon
          aria-label={t("common.button.shares")}
          className={classes.iconLink}
          color="gray"
          title={t("common.button.shares")}
          variant="subtle"
        >
          <Link2 />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          href="/account/shares"
          leftSection={<Link2 />}
        >
          <FormattedMessage id="navbar.links.shares" />
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/account/assets"
          leftSection={<Package />}
        >
          <FormattedMessage id="navbar.links.assets" />
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/account/reverseShares"
          leftSection={<RotateCcw />}
        >
          <FormattedMessage id="navbar.links.reverse" />
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default NavbarShareMneu;
