import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { ActionIcon } from "@mantine/core";
import { Dispatch, SetStateAction } from "react";

export type TableSort = {
  property?: string;
  direction: "asc" | "desc";
};

const TableSortIcon = ({
  sort,
  setSort,
  property,
}: {
  sort: TableSort;
  setSort: Dispatch<SetStateAction<TableSort>>;
  property: string;
}) => {
  if (sort.property === property) {
    return (
      <ActionIcon
        onClick={() =>
          setSort({
            property,
            direction: sort.direction === "asc" ? "desc" : "asc",
          })
        }
      >
        {sort.direction === "asc" ? <ChevronDown /> : <ChevronUp />}
      </ActionIcon>
    );
  } else {
    return (
      <ActionIcon onClick={() => setSort({ property, direction: "asc" })}>
        <ChevronsUpDown />
      </ActionIcon>
    );
  }
};

export default TableSortIcon;
