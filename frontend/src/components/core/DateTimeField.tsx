import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Button, Group, Input, Popover, Text } from "@mantine/core";
import { useState } from "react";
import useLocale from "../../hooks/locale.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "./DateTimeField.module.css";

type DateTimeFieldProps = {
  label: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  error?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");
const toLocalValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const parseValue = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

export default function DateTimeField({
  label,
  value,
  onChange,
  disabled,
  error,
}: DateTimeFieldProps) {
  const t = useTranslate();
  const { language } = useLocale();
  const locale = language || "zh-CN";
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState(() => parseValue(value) ?? new Date());
  const [month, setMonth] = useState(
    () => new Date(draft.getFullYear(), draft.getMonth(), 1),
  );
  const [hourText, setHourText] = useState(() => pad(draft.getHours()));
  const [minuteText, setMinuteText] = useState(() => pad(draft.getMinutes()));
  const selected = parseValue(value);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  });
  const weekdayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
  });

  const openPicker = () => {
    if (disabled) return;
    const initial = parseValue(value) ?? new Date(Date.now() + 60 * 60 * 1000);
    setDraft(initial);
    setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
    setHourText(pad(initial.getHours()));
    setMinuteText(pad(initial.getMinutes()));
    setOpened(true);
  };

  const changeMonth = (offset: number) =>
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(
    month.getFullYear(),
    month.getMonth(),
    1 - startOffset,
  );
  const days = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        calendarStart.getFullYear(),
        calendarStart.getMonth(),
        calendarStart.getDate() + index,
      ),
  );
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    weekdayFormatter.format(new Date(2024, 0, index + 1)),
  );

  const normalizedTime = (value: string, max: number) =>
    Math.min(max, Math.max(0, Number(value) || 0));

  const confirm = () => {
    const next = new Date(draft);
    next.setHours(normalizedTime(hourText, 23));
    next.setMinutes(normalizedTime(minuteText, 59));
    onChange(toLocalValue(next));
    setOpened(false);
  };

  return (
    <Input.Wrapper label={label} error={error}>
      <Popover
        opened={opened}
        onChange={setOpened}
        position="bottom-start"
        width={332}
        withinPortal
      >
        <Popover.Target>
          <button
            type="button"
            className={classes.field}
            aria-label={label}
            aria-expanded={opened}
            disabled={disabled}
            onClick={openPicker}
          >
            <span className={selected ? classes.value : classes.placeholder}>
              {selected ? dateFormatter.format(selected) : t("dateTime.choose")}
            </span>
            <CalendarDays size={17} aria-hidden="true" />
          </button>
        </Popover.Target>
        <Popover.Dropdown className={classes.dropdown}>
          <div className={classes.monthBar}>
            <Text fw={650} size="sm">
              {monthFormatter.format(month)}
            </Text>
            <Group gap={4}>
              <button
                type="button"
                className={classes.navButton}
                aria-label={t("dateTime.previousMonth")}
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                className={classes.navButton}
                aria-label={t("dateTime.nextMonth")}
                onClick={() => changeMonth(1)}
              >
                <ChevronRight size={17} />
              </button>
            </Group>
          </div>
          <div
            className={classes.calendar}
            role="grid"
            aria-label={monthFormatter.format(month)}
          >
            {weekdays.map((weekday, index) => (
              <span className={classes.weekday} key={index}>
                {weekday}
              </span>
            ))}
            {days.map((day) => (
              <button
                className={`${classes.day} ${day.getMonth() !== month.getMonth() ? classes.outside : ""} ${sameDay(day, draft) ? classes.selected : ""}`}
                type="button"
                key={toLocalValue(day)}
                aria-label={new Intl.DateTimeFormat(locale, {
                  dateStyle: "full",
                }).format(day)}
                aria-selected={sameDay(day, draft)}
                onClick={() => {
                  setDraft(
                    (current) =>
                      new Date(
                        day.getFullYear(),
                        day.getMonth(),
                        day.getDate(),
                        current.getHours(),
                        current.getMinutes(),
                      ),
                  );
                  if (day.getMonth() !== month.getMonth())
                    setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                }}
              >
                {day.getDate()}
              </button>
            ))}
          </div>
          <div className={classes.timeRow}>
            <div className={classes.timeHeading}>
              <Text size="sm" fw={600} className={classes.timeLabel}>
                <Clock3 size={16} /> {t("dateTime.time")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("dateTime.hourFormat")}
              </Text>
            </div>
            <div className={classes.timeControl}>
              <input
                aria-label={t("dateTime.hours")}
                inputMode="numeric"
                maxLength={2}
                value={hourText}
                onChange={(event) =>
                  setHourText(
                    event.currentTarget.value.replace(/\D/g, "").slice(0, 2),
                  )
                }
                onBlur={() => setHourText(pad(normalizedTime(hourText, 23)))}
              />
              <span aria-hidden="true">:</span>
              <input
                aria-label={t("dateTime.minutes")}
                inputMode="numeric"
                maxLength={2}
                value={minuteText}
                onChange={(event) =>
                  setMinuteText(
                    event.currentTarget.value.replace(/\D/g, "").slice(0, 2),
                  )
                }
                onBlur={() =>
                  setMinuteText(pad(normalizedTime(minuteText, 59)))
                }
              />
            </div>
          </div>
          <div className={classes.footer}>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                const today = new Date();
                setDraft(
                  (current) =>
                    new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      today.getDate(),
                      current.getHours(),
                      current.getMinutes(),
                    ),
                );
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              }}
            >
              {t("dateTime.today")}
            </Button>
            <Group gap={6}>
              <Button
                size="xs"
                color="gray"
                variant="subtle"
                onClick={() => {
                  onChange(null);
                  setOpened(false);
                }}
              >
                {t("dateTime.clear")}
              </Button>
              <Button size="xs" onClick={confirm}>
                {t("common.button.confirm")}
              </Button>
            </Group>
          </div>
        </Popover.Dropdown>
      </Popover>
    </Input.Wrapper>
  );
}
