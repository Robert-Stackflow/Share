import {
  Box,
  Collapse,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  AtSign,
  ChevronDown,
  Database,
  FolderSync,
  ImageUp,
  Mail,
  Network,
  Palette,
  Scale,
  ServerCog,
  Settings,
  Share,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";
import FormattedMessage from "../../core/FormattedMessage";
import classes from "./ConfigurationNavBar.module.css";

type ConfigurationCategory = {
  id: string;
  icon: ReactNode;
};

const categoryGroups: Array<{
  id: string;
  label: string;
  categories: ConfigurationCategory[];
}> = [
  {
    id: "site",
    label: "admin.config.group.site",
    categories: [
      { id: "general", icon: <Settings /> },
      { id: "appearance", icon: <Palette /> },
      { id: "share", icon: <Share /> },
      { id: "legal", icon: <Scale /> },
    ],
  },
  {
    id: "access",
    label: "admin.config.group.access",
    categories: [
      { id: "email", icon: <Mail /> },
      { id: "smtp", icon: <AtSign /> },
      { id: "oauth", icon: <Network /> },
      { id: "ldap", icon: <Workflow /> },
    ],
  },
  {
    id: "storage",
    label: "admin.config.group.storage",
    categories: [
      { id: "s3", icon: <Database /> },
      { id: "webdav", icon: <FolderSync /> },
      { id: "images", icon: <ImageUp /> },
      { id: "cache", icon: <ServerCog /> },
    ],
  },
];

const allCategories = categoryGroups.flatMap((group) => group.categories);
export const categories = allCategories.map((category) => category.id);

const ConfigurationCategoryLink = ({
  category,
  active,
}: {
  category: ConfigurationCategory;
  active: boolean;
}) => (
  <Link
    className={`${classes.navLink} ${active ? classes.activeLink : ""}`}
    href={`/admin/config/${category.id}/`}
    aria-current={active ? "page" : undefined}
  >
    <Group gap="md" wrap="nowrap">
      <span className={classes.navIcon}>{category.icon}</span>
      <Text size="sm">
        <FormattedMessage id={`admin.config.category.${category.id}`} />
      </Text>
    </Group>
  </Link>
);

const ConfigurationNavBar = ({ categoryId }: { categoryId: string }) => {
  const [expandedGroups, setExpandedGroups] = useState(
    () => new Set(categoryGroups.map((group) => group.id)),
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <Box className={classes.navbar} component="nav">
      <Stack className={classes.desktopNavigation} gap="sm">
        {categoryGroups.map((group) => {
          const expanded = expandedGroups.has(group.id);
          return (
            <section className={classes.navGroup} key={group.id}>
              <UnstyledButton
                className={classes.groupButton}
                onClick={() => toggleGroup(group.id)}
                aria-expanded={expanded}
                aria-controls={`admin-config-group-${group.id}`}
              >
                <Text size="xs" fw={650} tt="uppercase">
                  <FormattedMessage id={group.label} />
                </Text>
                <ChevronDown
                  className={`${classes.groupChevron} ${
                    expanded ? classes.groupChevronExpanded : ""
                  }`}
                />
              </UnstyledButton>
              <Collapse in={expanded}>
                <Stack
                  className={classes.groupLinks}
                  gap={3}
                  id={`admin-config-group-${group.id}`}
                >
                  {group.categories.map((category) => (
                    <ConfigurationCategoryLink
                      category={category}
                      active={categoryId === category.id}
                      key={category.id}
                    />
                  ))}
                </Stack>
              </Collapse>
            </section>
          );
        })}
      </Stack>

      <Stack className={classes.mobileNavigation} gap={4}>
        {allCategories.map((category) => (
          <ConfigurationCategoryLink
            category={category}
            active={categoryId === category.id}
            key={category.id}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default ConfigurationNavBar;
