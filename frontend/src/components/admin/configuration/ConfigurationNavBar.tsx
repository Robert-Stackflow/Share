import {
  AtSign,
  Database,
  Mail,
  Network,
  Palette,
  Scale,
  ServerCog,
  Settings,
  Share,
  Workflow,
} from "lucide-react";
import { Box, Button, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import Link from "next/link";
import { Dispatch, SetStateAction } from "react";
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
  { name: "Legal", icon: <Scale /> },
  { name: "Cache", icon: <ServerCog /> },
];

const ConfigurationNavBar = ({
  categoryId,
  setIsMobileNavBarOpened,
  onCategoryChange,
}: {
  categoryId: string;
  isMobileNavBarOpened: boolean;
  setIsMobileNavBarOpened: Dispatch<SetStateAction<boolean>>;
  onCategoryChange: (category: string) => void;
}) => {
  return (
    <Box
      className={classes.navbar}
      p="md"
      h="100%"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <Box>
        <Text size="xs" c="dimmed" mb="sm">
          <FormattedMessage id="admin.config.title" />
        </Text>
        <Stack gap="xs">
          {categories.map((category) => (
            <Box
              component="a"
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                event.preventDefault();
                onCategoryChange(category.name.toLowerCase());
                setIsMobileNavBarOpened(false);
              }}
              className={`${classes.navLink} ${
                categoryId == category.name.toLowerCase()
                  ? classes.activeLink
                  : ""
              }`}
              key={category.name}
              href={`/admin/config/${category.name.toLowerCase()}/`}
            >
              <Group>
                <ThemeIcon
                  variant={
                    categoryId == category.name.toLowerCase()
                      ? "filled"
                      : "light"
                  }
                >
                  {category.icon}
                </ThemeIcon>
                <Text size="sm">
                  <FormattedMessage
                    id={`admin.config.category.${category.name.toLowerCase()}`}
                  />
                </Text>
              </Group>
            </Box>
          ))}
        </Stack>
      </Box>
      <Button
        hiddenFrom="sm"
        mt="xl"
        pt="sm"
        pb="sm"
        variant="light"
        component={Link}
        href="/admin"
      >
        <FormattedMessage id="common.button.go-back" />
      </Button>
    </Box>
  );
};

export default ConfigurationNavBar;
