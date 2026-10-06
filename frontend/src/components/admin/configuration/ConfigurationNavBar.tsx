import {
  AtSign,
  Database,
  FolderSync,
  Mail,
  Network,
  Palette,
  Scale,
  ServerCog,
  Settings,
  Share,
  Workflow,
} from "lucide-react";
import { Box, Group, Stack, Text } from "@mantine/core";
import Link from "next/link";
import FormattedMessage from "../../core/FormattedMessage";
import classes from "./ConfigurationNavBar.module.css";

export const categories = [
  { name: "General", icon: <Settings /> },
  { name: "Appearance", icon: <Palette /> },
  { name: "Email", icon: <Mail /> },
  { name: "Share", icon: <Share /> },
  { name: "SMTP", icon: <AtSign /> },
  { name: "OAuth", icon: <Network /> },
  { name: "LDAP", icon: <Workflow /> },
  { name: "S3", icon: <Database /> },
  { name: "WebDAV", icon: <FolderSync /> },
  { name: "Legal", icon: <Scale /> },
  { name: "Cache", icon: <ServerCog /> },
];

const ConfigurationNavBar = ({ categoryId }: { categoryId: string }) => {
  return (
    <Box className={classes.navbar}>
      <Stack gap={4}>
        {categories.map((category) => (
          <Link
            className={`${classes.navLink} ${
              categoryId == category.name.toLowerCase()
                ? classes.activeLink
                : ""
            }`}
            key={category.name}
            href={`/admin/config/${category.name.toLowerCase()}/`}
          >
            <Group gap="md" wrap="nowrap">
              <span className={classes.navIcon}>{category.icon}</span>
              <Text size="sm">
                <FormattedMessage
                  id={`admin.config.category.${category.name.toLowerCase()}`}
                />
              </Text>
            </Group>
          </Link>
        ))}
      </Stack>
    </Box>
  );
};

export default ConfigurationNavBar;
