import { Box, Group, Stack, Text, Title } from "@mantine/core";
import {
  CircleUser,
  History,
  KeyRound,
  Palette,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import Meta from "../Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "./AccountSettingsLayout.module.css";

export type AccountSettingsSection =
  | "profile"
  | "security"
  | "credentials"
  | "preferences"
  | "activity";

type AccountSettingsLayoutProps = {
  active: AccountSettingsSection;
  title: string;
  description?: string;
  children: ReactNode;
};

type AccountPanelProps = {
  title?: string;
  description?: string;
  danger?: boolean;
  children: ReactNode;
};

const navigation = [
  {
    id: "profile" as const,
    href: "/account",
    label: "account.nav.profile",
    icon: <CircleUser />,
  },
  {
    id: "security" as const,
    href: "/account/security",
    label: "account.nav.security",
    icon: <ShieldCheck />,
  },
  {
    id: "credentials" as const,
    href: "/account/credentials",
    label: "account.nav.credentials",
    icon: <KeyRound />,
  },
  {
    id: "preferences" as const,
    href: "/account/preferences",
    label: "account.nav.preferences",
    icon: <Palette />,
  },
  {
    id: "activity" as const,
    href: "/account/activity",
    label: "account.activity.title",
    icon: <History />,
  },
];

export const AccountPanel = ({
  title,
  description,
  danger = false,
  children,
}: AccountPanelProps) => {
  const t = useTranslate();

  return (
    <section
      className={`${classes.panel} ${danger ? classes.dangerPanel : ""}`}
    >
      {title ? (
        <header className={classes.panelHeader}>
          <Title order={4}>{t(title)}</Title>
          {description ? (
            <Text c="dimmed" size="sm">
              {t(description)}
            </Text>
          ) : null}
        </header>
      ) : null}
      <div className={classes.panelBody}>{children}</div>
    </section>
  );
};

const AccountSettingsLayout = ({
  active,
  title,
  description,
  children,
}: AccountSettingsLayoutProps) => {
  const t = useTranslate();

  return (
    <>
      <Meta title={t(title)} />
      <div className={classes.layout}>
        <aside className={classes.sidebar}>
          <Box
            component="nav"
            className={classes.navbar}
            aria-label={t("account.title")}
          >
            <Stack gap={4}>
              {navigation.map((item) => (
                <Link
                  className={`${classes.navLink} ${
                    active === item.id ? classes.activeLink : ""
                  }`}
                  href={item.href}
                  key={item.id}
                  aria-current={active === item.id ? "page" : undefined}
                >
                  <Group gap="md" wrap="nowrap">
                    <span className={classes.navIcon}>{item.icon}</span>
                    <Text size="sm">{t(item.label)}</Text>
                  </Group>
                </Link>
              ))}
            </Stack>
          </Box>
        </aside>
        <main className={classes.content}>
          <header className={classes.pageHeader}>
            <Title order={3}>{t(title)}</Title>
            {description ? (
              <Text c="dimmed" size="sm">
                {t(description)}
              </Text>
            ) : null}
          </header>
          <Stack gap="lg">{children}</Stack>
        </main>
      </div>
    </>
  );
};

export default AccountSettingsLayout;
