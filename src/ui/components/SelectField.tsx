import type { SelectHTMLAttributes } from 'react';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Always visible: a placeholder is not a label. */
  label: string;
  className?: string;
};

/** A labeled select, the sibling of `Field`. */
export function SelectField({ label, className, children, ...select }: SelectFieldProps) {
  return (
    <label className={['field', className].filter(Boolean).join(' ')}>
      <span className="field-label">{label}</span>
      <select {...select}>{children}</select>
    </label>
  );
}
