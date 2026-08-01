import { HOUR_VALUES, combineStoreLocalInput, formatHourValue, splitStoreLocalInput } from "../date";

interface HourSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minValue?: string;
  maxValue?: string;
  required?: boolean;
  ariaLabel?: string;
}

export function HourSelect({ id, value, onChange, disabled, minValue, maxValue, required = true, ariaLabel }: HourSelectProps) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required} aria-label={ariaLabel}>
      {HOUR_VALUES.map((hour) => (
        <option key={hour} value={hour} disabled={Boolean((minValue && hour < minValue) || (maxValue && hour > maxValue))}>
          {formatHourValue(hour)}
        </option>
      ))}
    </select>
  );
}

interface DateHourFieldsProps {
  idPrefix: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  dateLabel?: string;
  hourLabel?: string;
}

export function DateHourFields({ idPrefix, value, onChange, min, max, dateLabel = "Date", hourLabel = "Start time" }: DateHourFieldsProps) {
  const current = splitStoreLocalInput(value);
  const minParts = splitStoreLocalInput(min ?? "");
  const maxParts = splitStoreLocalInput(max ?? "");
  const minimumHour = current.date && current.date === minParts.date ? minParts.hour : undefined;
  const maximumHour = current.date && current.date === maxParts.date ? maxParts.hour : undefined;

  const changeDate = (date: string) => {
    let hour = current.hour;
    if (date === minParts.date && hour < minParts.hour) hour = minParts.hour;
    if (date === maxParts.date && hour > maxParts.hour) hour = maxParts.hour;
    onChange(combineStoreLocalInput(date, hour));
  };

  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-date`}>{dateLabel}</label>
        <input id={`${idPrefix}-date`} type="date" min={minParts.date || undefined} max={maxParts.date || undefined} value={current.date} onChange={(event) => changeDate(event.target.value)} required />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-hour`}>{hourLabel}</label>
        <HourSelect id={`${idPrefix}-hour`} value={current.hour} minValue={minimumHour} maxValue={maximumHour} onChange={(hour) => onChange(combineStoreLocalInput(current.date, hour))} />
      </div>
    </>
  );
}
