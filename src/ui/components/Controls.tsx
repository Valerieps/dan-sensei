import { useRef, type KeyboardEvent } from 'react';
import { strings } from '../../domain/strings';
import { Icon } from './Icon';
import { nextSegmentIndex } from './segmented-logic';
import { stepValue } from './stepper-logic';

type SegmentedControlProps<T extends string> = {
  /** What the choice is about, for screen readers: "Vista da agenda". */
  label: string;
  options: readonly { readonly value: T; readonly label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * The segmented control: 2 to 5 views of the same thing. It is a radio group: one tab stop, and
 * the arrows move the choice.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));

  function onKeyDown(event: KeyboardEvent, index: number) {
    const next = nextSegmentIndex(event.key, index, options.length);
    if (next === null) return;
    event.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === selected ? 0 : -1}
          className="segment"
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type SwitchProps = {
  /** Always visible, beside the switch. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** The switch: an option that takes effect at once. */
export function Switch({ label, checked, onChange, disabled = false }: SwitchProps) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} className="switch" onClick={() => onChange(!checked)}>
        <span className="switch-knob" />
      </button>
    </label>
  );
}

type StepperProps = {
  /** What it adjusts, for screen readers and the buttons' names: "Carga". */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** How the value reads: "20 kg". */
  format?: (value: number) => string;
};

/** The stepper: − and + beside the value, for load and repetitions. */
export function Stepper({ label, value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, format = String }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper-button" aria-label={strings.decrease(label)} disabled={value <= min} onClick={() => onChange(stepValue(value, -step, min, max))}>
        <Icon name="minus" />
      </button>
      <output className="stepper-value">{format(value)}</output>
      <button type="button" className="stepper-button" aria-label={strings.increase(label)} disabled={value >= max} onClick={() => onChange(stepValue(value, step, min, max))}>
        <Icon name="plus" />
      </button>
    </div>
  );
}
