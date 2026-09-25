import { NumberInput, Select } from "@mantine/core";
import { useState } from "react";

const multipliers = {
  B: 1,
  KB: 1000,
  KiB: 1024,
  MB: 1000 ** 2,
  MiB: 1024 ** 2,
  GB: 1000 ** 3,
  GiB: 1024 ** 3,
  TB: 1000 ** 4,
  TiB: 1024 ** 4,
};

const units = (
  ["B", "KB", "KiB", "MB", "MiB", "GB", "GiB", "TB", "TiB"] as const
).map((unit) => ({ label: unit, value: unit }));

function getLargestApplicableUnit(value: number) {
  return (
    units.findLast((unit) => value % multipliers[unit.value] === 0) || units[0]
  );
}

const FileSizeInput = ({
  label,
  value,
  onChange,
  ...restProps
}: {
  label?: string;
  value: number;
  onChange: (number: number) => void;
  [key: string]: any;
}) => {
  const [unit, setUnit] = useState(getLargestApplicableUnit(value).value);
  const [inputValue, setInputValue] = useState(value / multipliers[unit]);
  const unitSelect = (
    <Select
      data={units}
      value={unit}
      disabled={restProps.disabled}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true, zIndex: 400 }}
      rightSectionWidth={28}
      styles={{
        input: {
          fontWeight: 500,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          width: 94,
        },
      }}
      onChange={(value) => {
        if (!value) return;
        const nextUnit = value as keyof typeof multipliers;
        setUnit(nextUnit);
        onChange(multipliers[nextUnit] * inputValue);
      }}
    />
  );

  return (
    <NumberInput
      label={label}
      value={inputValue}
      min={1}
      max={999999}
      decimalScale={0}
      rightSection={unitSelect}
      rightSectionWidth={94}
      onChange={(value) => {
        const inputVal = typeof value === "number" ? value : Number(value) || 0;
        setInputValue(inputVal);
        onChange(multipliers[unit] * inputVal);
      }}
      {...restProps}
    />
  );
};

export default FileSizeInput;
