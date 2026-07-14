'use client';

import {
  BEFIRST_FREQUENCY_PRESETS,
  CUSTOM_FREQUENCY_VALUE,
  buildCustomFrequency,
  customFrequencyParts,
  frequencySelectValue,
  formatFrequencyLabel,
  isPresetFrequency,
} from '@/lib/beFirstFrequency';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  id?: string;
};

export function BeFirstFrequencySelect({
  value,
  onChange,
  disabled = false,
  className = 'input',
  label = 'Be-First monitor frequency',
  id,
}: Props) {
  const selectValue = frequencySelectValue(value);
  const custom = customFrequencyParts(value);

  return (
    <div className="be-first-frequency">
      {label && <label className="ac-label" htmlFor={id}>{label}</label>}
      <select
        id={id}
        className={className}
        value={selectValue}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_FREQUENCY_VALUE) {
            const built = buildCustomFrequency(custom.amount, custom.unit);
            onChange(built || '15m');
          } else {
            onChange(next);
          }
        }}
      >
        {BEFIRST_FREQUENCY_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
        <option value={CUSTOM_FREQUENCY_VALUE}>Custom interval…</option>
      </select>
      {selectValue === CUSTOM_FREQUENCY_VALUE && (
        <div className="be-first-frequency-custom" style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>Every</span>
          <input
            className={className}
            type="number"
            min={1}
            max={9999}
            style={{ width: 88 }}
            value={custom.amount}
            disabled={disabled}
            onChange={(e) => {
              const built = buildCustomFrequency(e.target.value, custom.unit);
              if (built) onChange(built);
            }}
          />
          <select
            className={className}
            style={{ width: 120 }}
            value={custom.unit}
            disabled={disabled}
            onChange={(e) => {
              const built = buildCustomFrequency(custom.amount, e.target.value as 'm' | 'h' | 'd');
              if (built) onChange(built);
            }}
          >
            <option value="m">minutes</option>
            <option value="h">hours</option>
            <option value="d">days</option>
          </select>
          {!isPresetFrequency(value) && (
            <span className="muted" style={{ fontSize: '0.8rem' }}>({formatFrequencyLabel(value)})</span>
          )}
        </div>
      )}
    </div>
  );
}