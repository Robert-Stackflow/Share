import { Box, Text } from "@mantine/core";
import { Files } from "lucide-react";
import { ReactNode } from "react";
import classes from "./EmptyState.module.css";

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  embedded?: boolean;
  className?: string;
};

const EmptyState = ({
  title,
  description,
  action,
  icon = <Files size={22} />,
  compact = false,
  embedded = false,
  className,
}: EmptyStateProps) => (
  <Box
    className={`${classes.panel} ${compact ? classes.compact : ""} ${embedded ? classes.embedded : ""} ${className ?? ""}`}
    role="status"
  >
    <Box className={classes.icon}>{icon}</Box>
    <Text className={classes.title}>{title}</Text>
    {description && <Text className={classes.description}>{description}</Text>}
    {action && <Box className={classes.action}>{action}</Box>}
  </Box>
);

export default EmptyState;
