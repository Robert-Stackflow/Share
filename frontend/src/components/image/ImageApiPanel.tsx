import { Badge, Button, Code, Group, Paper, Text } from "@mantine/core";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "../../pages/account/images.module.css";

const ImageApiPanel = ({ enabled }: { enabled: boolean }) => {
  const t = useTranslate();

  return (
    <Paper withBorder className={classes.apiPanel}>
      <Group wrap="nowrap" align="flex-start">
        <div className={classes.apiIcon}>
          <KeyRound size={19} />
        </div>
        <div className={classes.apiCopy}>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={650}>{t("images.api.title")}</Text>
              <Text size="sm" c="dimmed">
                {t("images.api.description")}
              </Text>
            </div>
            <Badge variant="light" color={enabled ? "teal" : "gray"}>
              {t(
                enabled
                  ? "credentials.status.available"
                  : "credentials.status.disabled",
              )}
            </Badge>
          </Group>
          <Group mt="md" justify="space-between" wrap="wrap">
            <Code>/api/image-api/images</Code>
            <Button
              component={Link}
              href="#image-api-tokens"
              size="xs"
              variant="light"
            >
              {t("images.api.manageKeys")}
            </Button>
          </Group>
        </div>
      </Group>
    </Paper>
  );
};

export default ImageApiPanel;
