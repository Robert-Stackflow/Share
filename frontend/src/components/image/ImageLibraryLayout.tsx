import { Box, Group, Stack, Text, Title } from "@mantine/core";
import {
  FolderOpen,
  Images,
  KeyRound,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import Meta from "../Meta";
import classes from "./ImageLibraryLayout.module.css";

export type ImageLibrarySection =
  | "library"
  | "albums"
  | "trash"
  | "preferences"
  | "clients";

type ImageLibraryLayoutProps = {
  active: ImageLibrarySection;
  title: string;
  description?: string;
  children: ReactNode;
};

type ImagePanelProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

const navigation = [
  {
    id: "library" as const,
    href: "/account/images",
    label: "images.nav.library",
    icon: <Images />,
  },
  {
    id: "albums" as const,
    href: "/account/image-albums",
    label: "images.nav.albums",
    icon: <FolderOpen />,
  },
  {
    id: "trash" as const,
    href: "/account/image-trash",
    label: "images.nav.trash",
    icon: <Trash2 />,
  },
  {
    id: "preferences" as const,
    href: "/account/image-preferences",
    label: "images.nav.preferences",
    icon: <SlidersHorizontal />,
  },
  {
    id: "clients" as const,
    href: "/account/image-clients",
    label: "images.nav.clients",
    icon: <KeyRound />,
  },
];

export const ImagePanel = ({
  title,
  description,
  children,
}: ImagePanelProps) => {
  const t = useTranslate();

  return (
    <section className={classes.panel}>
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

const ImageLibraryLayout = ({
  active,
  title,
  description,
  children,
}: ImageLibraryLayoutProps) => {
  const t = useTranslate();

  return (
    <>
      <Meta title={t(title)} />
      <div className={classes.layout}>
        <aside className={classes.sidebar}>
          <Box
            component="nav"
            className={classes.navbar}
            aria-label={t("images.title")}
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

export default ImageLibraryLayout;
