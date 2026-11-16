import type { ReactNode } from 'react';
import { strings } from '../../domain/strings';
import { navigate } from '../router';
import { SegmentedControl } from './Controls';
import { Sheet } from './Sheet';

type RouteSheetProps = {
  title: string;
  /** Where Cancelar, Esc and a swipe down lead: the screen the person came from. */
  back: string;
  /** The `id` of the form inside; the ✓ button submits it. Leave out for a panel with no save. */
  formId?: string;
  busy?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  /** The screen the panel keeps in view while it is open. */
  behind?: ReactNode;
  children: ReactNode;
};

/**
 * A short action that has its own address (docs/spec/telas-de-gestao.md, "Navegação"): it opens
 * in the panel over the screen it came from, so closing it puts the person back there.
 */
export function RouteSheet({ title, back, formId, busy = false, saveDisabled = false, saveLabel = strings.save, behind, children }: RouteSheetProps) {
  return (
    <>
      {behind}
      <Sheet
        title={title}
        detent="large"
        onClose={() => navigate(back)}
        onSave={formId ? () => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit() : undefined}
        saveLabel={saveLabel}
        saveDisabled={busy || saveDisabled}
      >
        {children}
      </Sheet>
    </>
  );
}

type ChoiceFieldProps<T extends string> = {
  label: string;
  options: readonly { readonly value: T; readonly label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** A labeled segmented control: the choice among 2 to 4 options that a select used to hold. */
export function ChoiceField<T extends string>({ label, options, value, onChange }: ChoiceFieldProps<T>) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <SegmentedControl label={label} options={options} value={value} onChange={onChange} />
    </div>
  );
}
