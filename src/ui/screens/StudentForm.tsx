import { useState, type FormEvent } from 'react';
import type { StudentView } from '../../application/api-contract';
import { MAX_ADDRESSES, normalizeStudentInput, STUDENT_NAME_MAX_LENGTH, type StudentField } from '../../domain/alunos/student';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';

interface AddressDraft {
  key: number;
  id?: string;
  label: string;
  address: string;
  isDefault: boolean;
}

export const STUDENT_FORM_ID = 'student-form';

let nextKey = 0;
const blankAddress = (isDefault: boolean): AddressDraft => ({ key: nextKey++, label: '', address: '', isDefault });

/** The registration form: creates a student (no `student`) or edits one. */
export function StudentForm({ student, onSaved, formId }: { student?: StudentView; onSaved: (saved: StudentView) => void; formId?: string }) {
  const { backend } = useServices();
  const [name, setName] = useState(student?.name ?? '');
  const [phone, setPhone] = useState(student?.phone ?? '');
  const [birthDate, setBirthDate] = useState(student?.birthDate ?? '');
  const [height, setHeight] = useState(student?.heightCm?.toString() ?? '');
  const [emergency, setEmergency] = useState(student?.emergencyContact ?? '');
  const [addresses, setAddresses] = useState<AddressDraft[]>(
    student?.addresses.map((a) => ({ key: nextKey++, ...a })) ?? [],
  );
  const [errors, setErrors] = useState<ReadonlySet<StudentField>>(new Set());
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function patchAddress(key: number, patch: Partial<AddressDraft>) {
    setAddresses((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function makeDefault(key: number) {
    setAddresses((rows) => rows.map((r) => ({ ...r, isDefault: r.key === key })));
  }

  function removeAddress(key: number) {
    setAddresses((rows) => {
      const left = rows.filter((r) => r.key !== key);
      return left.length > 0 && !left.some((r) => r.isDefault) ? left.map((r, i) => ({ ...r, isDefault: i === 0 })) : left;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setFailed(false);
    const input = {
      name,
      phone,
      birthDate: birthDate || null,
      heightCm: height.trim() === '' ? null : Number(height),
      emergencyContact: emergency,
      addresses: addresses.map(({ id, label, address, isDefault }) => ({ id, label, address, isDefault })),
    };
    const checked = normalizeStudentInput(input);
    if (!checked.ok) {
      setErrors(new Set(checked.fields));
      return;
    }
    setErrors(new Set());
    setBusy(true);
    const result = student
      ? await backend.command('student.update', { ...input, id: student.id })
      : await backend.command('student.create', input);
    setBusy(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    setSaved(true);
    onSaved(result.value);
  }

  const f = strings.students.form;
  const error = (field: StudentField) => (errors.has(field) ? f.errors[field === 'heightCm' ? 'height' : field] : null);

  return (
    <form id={formId} className="stack" onSubmit={submit} noValidate>
      <Field label={f.name} required maxLength={STUDENT_NAME_MAX_LENGTH} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} error={error('name')} />
      <Field label={f.phone} required type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} error={error('phone')} />
      <div className="row end">
        <Field className="grow" label={f.birthDate} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} error={error('birthDate')} />
        <Field className="grow" label={f.height} type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} error={error('heightCm')} />
      </div>
      <Field label={f.emergency} autoComplete="off" value={emergency} onChange={(e) => setEmergency(e.target.value)} error={error('emergencyContact')} />

      <fieldset className="addresses">
        <legend className="field-label">{f.addresses}</legend>
        {errors.has('addresses') && <p className="field-error">{f.errors.addresses}</p>}
        {addresses.map((row) => (
          <div key={row.key} className="stack card">
            <Field label={f.addressLabel} value={row.label} onChange={(e) => patchAddress(row.key, { label: e.target.value })} />
            <Field label={f.address} value={row.address} onChange={(e) => patchAddress(row.key, { address: e.target.value })} />
            <div className="row">
              <label className="row grow">
                <input type="radio" name="default-address" checked={row.isDefault} onChange={() => makeDefault(row.key)} />
                {f.isDefault}
              </label>
              <Button variant="secondary-danger" onClick={() => removeAddress(row.key)}>
                {f.removeAddress}
              </Button>
            </div>
          </div>
        ))}
        {addresses.length < MAX_ADDRESSES && (
          <Button variant="secondary" onClick={() => setAddresses((rows) => [...rows, blankAddress(rows.length === 0)])}>
            {f.addAddress}
          </Button>
        )}
      </fieldset>

      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      {saved && student && <Notice>{f.saved}</Notice>}
      {!formId && (
        <div className="row">
          <Button type="submit" disabled={busy}>
            {student ? f.save : f.create}
          </Button>
        </div>
      )}
    </form>
  );
}
