import { FileIcon, FileText, Link2 } from "lucide-react";
import { Anchor, Box, Group, Skeleton, Table, Text } from "@mantine/core";
import moment from "moment";
import { ReactNode } from "react";
import { useIntl } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import { Asset, AssetType } from "../../types/asset.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import tableClasses from "../core/DataTable.module.css";
import classes from "./AssetTable.module.css";

export type AssetTableColumn = "type" | "value" | "createdAt" | "size";

type AssetTableProps = {
  assets: Asset[];
  columns?: AssetTableColumn[];
  empty?: ReactNode;
  headers: Partial<Record<AssetTableColumn, ReactNode>>;
  isLoading?: boolean;
  loadingRows?: number;
  renderActions?: (asset: Asset) => ReactNode;
  responsiveCards?: boolean;
  showFileSizeInValue?: boolean;
  textLineClamp?: number;
  typeLabelPrefix?: string;
};

const typeIcon: Record<AssetType, ReactNode> = {
  FILE: <FileIcon />,
  TEXT: <FileText />,
  LINK: <Link2 />,
};

export const sortAssetsByCreatedAtDesc = (assets: Asset[]) =>
  assets.slice().sort((a, b) => {
    return moment(b.createdAt).valueOf() - moment(a.createdAt).valueOf();
  });

export const getAssetLabel = (asset: Asset) => {
  if (asset.type === "TEXT") return asset.content || "";
  if (asset.type === "LINK") return asset.url || "";
  return asset.name || asset.id;
};

export const getAssetSizeLabel = (asset: Asset) => {
  return asset.size ? byteToHumanSizeString(parseInt(asset.size)) : "-";
};

export const getAssetSortValue = (asset: Asset, property: string) => {
  if (property === "size") return asset.size || "0";
  return getAssetLabel(asset);
};

export const AssetTypeLabel = ({
  asset,
  labelPrefix = "account.assets.type",
}: {
  asset: Asset;
  labelPrefix?: string;
}) => {
  const t = useTranslate();

  return (
    <Group gap="xs" wrap="nowrap">
      {typeIcon[asset.type]}
      <Text size="sm">{t(`${labelPrefix}.${asset.type.toLowerCase()}`)}</Text>
    </Group>
  );
};

export const AssetValueCell = ({
  asset,
  showFileSize = false,
  textLineClamp = 2,
}: {
  asset: Asset;
  showFileSize?: boolean;
  textLineClamp?: number;
}) => {
  if (asset.type === "LINK") {
    return (
      <Box>
        {asset.name?.trim() && (
          <Text fw={600} lineClamp={1}>
            {asset.name}
          </Text>
        )}
        <Anchor href={asset.url} target="_blank" rel="noreferrer">
          {asset.url}
        </Anchor>
      </Box>
    );
  }

  if (asset.type === "FILE") {
    return (
      <Group gap="xs" wrap="nowrap">
        <Text lineClamp={1}>{getAssetLabel(asset)}</Text>
        {showFileSize && asset.size && (
          <Text c="dimmed" size="sm" style={{ whiteSpace: "nowrap" }}>
            {getAssetSizeLabel(asset)}
          </Text>
        )}
      </Group>
    );
  }

  return (
    <Box>
      {asset.name?.trim() && (
        <Text fw={600} lineClamp={1}>
          {asset.name}
        </Text>
      )}
      <Text lineClamp={textLineClamp} style={{ whiteSpace: "pre-wrap" }}>
        {asset.content || ""}
      </Text>
    </Box>
  );
};

const AssetTable = ({
  assets,
  columns = ["type", "value", "createdAt", "size"],
  empty,
  headers,
  isLoading = false,
  loadingRows = 5,
  renderActions,
  responsiveCards = false,
  showFileSizeInValue = !columns.includes("size"),
  textLineClamp = 2,
  typeLabelPrefix = "account.assets.type",
}: AssetTableProps) => {
  const intl = useIntl();
  const hasActions = Boolean(renderActions);

  if (!isLoading && assets.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <Box className={tableClasses.tablePanel}>
      <Table
        className={`${tableClasses.table} ${responsiveCards ? classes.responsiveTable : ""}`}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{headers[column]}</th>
            ))}
            {hasActions && <th className={tableClasses.actionCell}></th>}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? [...Array(loadingRows)].map((_, index) => (
                <tr className={tableClasses.tableRow} key={index}>
                  {columns.map((column) => (
                    <td key={column}>
                      <Skeleton height={column === "type" ? 14 : 16} />
                    </td>
                  ))}
                  {hasActions && (
                    <td className={tableClasses.actionCell}>
                      <Group justify="flex-end" wrap="nowrap">
                        <Skeleton height={25} width={25} />
                      </Group>
                    </td>
                  )}
                </tr>
              ))
            : assets.map((asset) => (
                <tr className={tableClasses.tableRow} key={asset.id}>
                  {columns.map((column) => (
                    <td
                      className={
                        column === "value" ? tableClasses.valueCell : undefined
                      }
                      key={column}
                    >
                      {column === "type" && (
                        <AssetTypeLabel
                          asset={asset}
                          labelPrefix={typeLabelPrefix}
                        />
                      )}
                      {column === "value" && (
                        <AssetValueCell
                          asset={asset}
                          showFileSize={showFileSizeInValue}
                          textLineClamp={textLineClamp}
                        />
                      )}
                      {column === "createdAt" &&
                        intl.formatDate(asset.createdAt, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      {column === "size" && getAssetSizeLabel(asset)}
                    </td>
                  ))}
                  {hasActions && (
                    <td className={tableClasses.actionCell}>
                      <div className={tableClasses.actions}>
                        {renderActions?.(asset)}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
        </tbody>
      </Table>
      {responsiveCards && (
        <div className={classes.mobileCards}>
          {isLoading
            ? [...Array(loadingRows)].map((_, index) => (
                <div className={classes.mobileCard} key={index}>
                  <Skeleton height={16} width="40%" />
                  <Skeleton height={18} mt="sm" />
                </div>
              ))
            : assets.map((asset) => (
                <div className={classes.mobileCard} key={asset.id}>
                  <Group
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                  >
                    <div className={classes.mobileCardContent}>
                      <AssetTypeLabel
                        asset={asset}
                        labelPrefix={typeLabelPrefix}
                      />
                      <div className={classes.mobileValue}>
                        <AssetValueCell
                          asset={asset}
                          textLineClamp={textLineClamp}
                        />
                      </div>
                    </div>
                    {hasActions && (
                      <div className={classes.mobileActions}>
                        {renderActions?.(asset)}
                      </div>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">
                    {intl.formatDate(asset.createdAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {asset.size && ` · ${getAssetSizeLabel(asset)}`}
                  </Text>
                </div>
              ))}
        </div>
      )}
    </Box>
  );
};

export default AssetTable;
