import { Paper, Text } from "@mantine/core";
import { Globe2, HardDrive, Images, Lock } from "lucide-react";
import useTranslate from "../../hooks/useTranslate.hook";
import { HostedImageStats } from "../../types/image.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import classes from "../../pages/account/images.module.css";

const ImageStats = ({ stats }: { stats: HostedImageStats }) => {
  const t = useTranslate();
  const items = [
    {
      label: t("images.stats.total"),
      value: stats.count,
      icon: <Images size={19} />,
    },
    {
      label: t("images.stats.public"),
      value: stats.publicCount,
      icon: <Globe2 size={19} />,
    },
    {
      label: t("images.stats.private"),
      value: stats.privateCount,
      icon: <Lock size={19} />,
    },
    {
      label: t("images.stats.storage"),
      value: byteToHumanSizeString(stats.totalSize),
      icon: <HardDrive size={19} />,
    },
  ];

  return (
    <div className={classes.statsGrid}>
      {items.map((item) => (
        <Paper withBorder className={classes.statCard} key={item.label}>
          {item.icon}
          <div>
            <Text size="xs" c="dimmed">
              {item.label}
            </Text>
            <Text fw={700}>{item.value}</Text>
          </div>
        </Paper>
      ))}
    </div>
  );
};

export default ImageStats;
