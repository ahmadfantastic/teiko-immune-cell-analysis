import { titleCaseLabel } from "./formatters";

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string | number; label?: string }>;
  onChange: (value: string) => void;
  allLabel?: string;
  includeAll?: boolean;
};

export function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  allLabel = "All",
  includeAll = true,
}: FilterSelectProps) {
  return (
    <label className="filter-field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {includeAll && <option value="all">{allLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label ?? titleCaseLabel(option.value)}
          </option>
        ))}
      </select>
    </label>
  );
}
