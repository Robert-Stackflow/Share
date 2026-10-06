import {
  FolderClosed,
  Images,
  Inbox,
  Link2,
  KeyRound,
  LogOut,
  MessageCircleMore,
  Settings2,
  Share2,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  Box,
  Burger,
  Container,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import clsx from "clsx";
import classes from "./Header.module.css";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useEffect } from "react";
import useConfig from "../../hooks/config.hook";
import useUser from "../../hooks/user.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import authService from "../../services/auth.service";
import Logo from "../Logo";
import ActionAvatar from "./ActionAvatar";
import NavbarShareMenu from "./NavbarShareMenu";
import {
  isContentRoute,
  isProfileRoute,
  isRouteWithin,
} from "./navigation.util";

const HEADER_HEIGHT = 68;

type NavLink = {
  link?: string;
  label?: string;
  icon?: ReactNode;
  component?: ReactNode;
  action?: () => Promise<void>;
};

const Header = () => {
  const { user } = useUser();
  const router = useRouter();
  const config = useConfig();
  const t = useTranslate();

  const [opened, { toggle, close }] = useDisclosure(false);
  const currentRoute = router.asPath.split("?")[0];

  useEffect(() => {
    close();
  }, [close, router.asPath]);

  const authenticatedLinks: NavLink[] = [
    {
      link: "/upload",
      label: t("navbar.upload"),
    },
    { link: "/rooms", label: t("navbar.rooms") },
    { link: "/account/images", label: t("navbar.links.images") },
    {
      link: "/short-links",
      label: t("navbar.links.shortLinks"),
    },
    {
      component: <NavbarShareMenu active={isContentRoute(currentRoute)} />,
    },
    {
      component: <ActionAvatar active={isProfileRoute(currentRoute)} />,
    },
  ];

  let unauthenticatedLinks: NavLink[] = [
    {
      link: "/auth/signIn",
      label: t("navbar.signin"),
    },
  ];

  if (config.get("share.allowUnauthenticatedShares")) {
    unauthenticatedLinks.unshift({
      link: "/upload",
      label: t("navbar.upload"),
    });
  }

  unauthenticatedLinks.unshift({ link: "/pickup", label: t("pickup.nav") });

  if (config.get("general.showHomePage"))
    unauthenticatedLinks.unshift({
      link: "/",
      label: t("navbar.home"),
    });

  if (config.get("share.allowRegistration"))
    unauthenticatedLinks.push({
      link: "/auth/signUp",
      label: t("navbar.signup"),
    });

  const mobilePrimaryLinks: NavLink[] = user
    ? [
        {
          link: "/upload",
          label: t("navbar.upload"),
          icon: <Upload size={19} />,
        },
        {
          link: "/rooms",
          label: t("navbar.rooms"),
          icon: <MessageCircleMore size={19} />,
        },
        {
          link: "/account/images",
          label: t("navbar.links.images"),
          icon: <Images size={19} />,
        },
        {
          link: "/short-links",
          label: t("navbar.links.shortLinks"),
          icon: <Link2 size={19} />,
        },
      ]
    : unauthenticatedLinks.map((link) => ({
        ...link,
        icon:
          link.link === "/pickup" ? (
            <KeyRound size={19} />
          ) : link.link === "/upload" ? (
            <Upload size={19} />
          ) : (
            <UserRound size={19} />
          ),
      }));

  const mobileShareLinks: NavLink[] = [
    {
      link: "/pickup",
      label: t("pickup.nav"),
      icon: <KeyRound size={19} />,
    },
    {
      link: "/account/shares",
      label: t("navbar.links.shares"),
      icon: <Share2 size={19} />,
    },
    {
      link: "/account/assets",
      label: t("navbar.links.assets"),
      icon: <FolderClosed size={19} />,
    },
    {
      link: "/account/reverseShares",
      label: t("navbar.links.reverse"),
      icon: <Inbox size={19} />,
    },
  ];

  const mobileAdminLinks: NavLink[] = user?.isAdmin
    ? [
        {
          link: "/admin/users",
          label: t("admin.button.users"),
          icon: <UsersRound size={19} />,
        },
        {
          link: "/admin/shares",
          label: t("admin.button.shares"),
          icon: <Share2 size={19} />,
        },
        {
          link: "/admin/config/general",
          label: t("admin.button.config"),
          icon: <Settings2 size={19} />,
        },
      ]
    : [];

  const mobileAccountLinks: NavLink[] = [
    {
      link: "/account",
      label: t("navbar.avatar.account"),
      icon: <UserRound size={19} />,
    },
  ];

  const desktopItems = (
    <>
      {(user ? authenticatedLinks : unauthenticatedLinks).map((link, i) => {
        if (link.component) {
          return (
            <Box pl={5} py={15} key={i}>
              {link.component}
            </Box>
          );
        }
        return (
          <Link
            key={link.label}
            href={link.link ?? ""}
            onClick={close}
            aria-current={
              link.link && isRouteWithin(currentRoute, link.link)
                ? "page"
                : undefined
            }
            className={clsx(classes.link, {
              [classes.linkActive]:
                !!link.link && isRouteWithin(currentRoute, link.link),
            })}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );

  const renderMobileEntry = (link: NavLink) => {
    const active =
      link.link === "/account"
        ? currentRoute.replace(/\/$/, "") === "/account"
        : !!link.link && isRouteWithin(currentRoute, link.link);
    return (
      <Link
        key={link.link}
        href={link.link ?? ""}
        aria-current={active ? "page" : undefined}
        onClick={close}
        className={clsx(classes.mobileLink, {
          [classes.mobileLinkActive]: active,
        })}
      >
        <span className={classes.mobileLinkIcon}>{link.icon}</span>
        <span>{link.label}</span>
      </Link>
    );
  };
  return (
    <>
      <Box component="header" h={HEADER_HEIGHT} mb={0} className={classes.root}>
        <Container size={1200} className={classes.header}>
          <Link href="/" passHref>
            <Group>
              <Logo height={35} width={35} />
              <Text fw={600}>{config.get("general.appName")}</Text>
            </Group>
          </Link>
          <Group gap={5} className={classes.links}>
            <Group>{desktopItems}</Group>
          </Group>
          <Burger
            opened={opened}
            onClick={toggle}
            className={classes.burger}
            size="sm"
            aria-label={opened ? t("navbar.menu.close") : t("navbar.menu.open")}
            aria-controls="mobile-navigation"
          />
        </Container>
      </Box>
      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="min(88vw, 360px)"
        title={
          <Group gap="sm">
            <Logo height={28} width={28} />
            <Text fw={700}>{config.get("general.appName")}</Text>
          </Group>
        }
        classNames={{
          body: classes.mobileDrawerBody,
          header: classes.mobileDrawerHeader,
        }}
        zIndex={300}
      >
        <nav id="mobile-navigation" aria-label={t("navbar.menu.open")}>
          <Stack gap={4}>
            {mobilePrimaryLinks.map(renderMobileEntry)}
            {user && (
              <>
                <Divider my="sm" label={t("navbar.contentAndSharing")} />
                {mobileShareLinks.map(renderMobileEntry)}
                <Divider my="sm" label={t("common.button.profile")} />
                {mobileAccountLinks.map(renderMobileEntry)}
                {mobileAdminLinks.length > 0 && (
                  <>
                    <Divider my="sm" label={t("admin.title")} />
                    {mobileAdminLinks.map(renderMobileEntry)}
                  </>
                )}
                <Divider my="sm" />
                <UnstyledButton
                  className={classes.mobileLink}
                  onClick={() => {
                    void authService.signOut();
                    close();
                  }}
                >
                  <span className={classes.mobileLinkIcon}>
                    <LogOut size={19} />
                  </span>
                  <span>{t("navbar.avatar.signout")}</span>
                </UnstyledButton>
              </>
            )}
          </Stack>
        </nav>
      </Drawer>
    </>
  );
};

export default Header;
