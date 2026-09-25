import { useState } from "react";
import { Timespan } from "../../types/timespan.type";
import { NumberInput, Select } from "@mantine/core";
import useTranslate from "../../hooks/useTranslate.hook";

const TimespanInput = ({
  label,
  value,
  onChange,
  ...restProps
}: {
  label?: string;
  value: Timespan;
  onChange: (timespan: Timespan) => void;
  [key: string]: any;
}) => {
  const [unit, setUnit] = useState(value.unit);
  const [inputValue, setInputValue] = useState(value.value);
  const t = useTranslate();

  const version = inputValue == 1 ? "singular" : "plural";
  const unitSelect = (
    <Select
      data={[
        {
          value: "minutes",
          label: t(`upload.modal.expires.minute-${version}`),
        },
        {
          value: "hours",
          label: t(`upload.modal.expires.hour-${version}`),
        },
        {
          value: "days",
          label: t(`upload.modal.expires.day-${version}`),
        },
        {
          value: "weeks",
          label: t(`upload.modal.expires.week-${version}`),
        },
        {
          value: "months",
          label: t(`upload.modal.expires.month-${version}`),
        },
        {
          value: "years",
          label: t(`upload.modal.expires.year-${version}`),
        },
      ]}
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
          width: 120,
        },
      }}
      onChange={(value) => {
        if (!value) return;
        const nextUnit = value as Timespan["unit"];
        setUnit(nextUnit);
        onChange({ value: inputValue, unit: nextUnit });
      }}
    />
  );

  return (
    <NumberInput
      label={label}
      value={inputValue}
      min={0}
      max={999999}
      decimalScale={0}
      rightSection={unitSelect}
      rightSectionWidth={120}
      onChange={(value) => {
        const inputVal = typeof value === "number" ? value : Number(value) || 0;
        setInputValue(inputVal);
        onChange({ value: inputVal, unit });
      }}
      {...restProps}
    />
  );
};

export default TimespanInput;
