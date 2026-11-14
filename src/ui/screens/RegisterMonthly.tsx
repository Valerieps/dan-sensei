import { useState } from 'react';
import type { PaymentMethod } from '../../application/api-contract';
import { dataEmSaoPaulo, mesDe, somarMeses } from '../../domain/pacotes';
import { formatMonth, strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { EmptyState } from '../components/EmptyState';
import { Notice } from '../components/Notice';
import { SelectField } from '../components/SelectField';
import { navigate } from '../router';
import { useQuery } from '../use-query';
import { PaymentFields } from './RegisterPayment';

const TOPICS = ['monthly', 'students'] as const;

/** Registers a monthly fee as paid: from the + button (no student yet) or from a profile. */
export function RegisterMonthly({ studentId = '' }: { studentId?: string }) {
  const { backend } = useServices();
  const t = strings.packages.monthly;
  const students = useQuery('students', {}, ['students', 'monthly']);
  const [student, setStudent] = useState(studentId);
  const [chosenMonth, setChosenMonth] = useState('');
  const monthly = useQuery('monthly', { studentId: student }, TOPICS);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!students.data) return students.error ? <Notice tone="error">{strings.genericError}</Notice> : null;
  const eligible = students.data.filter((s) => s.billing === 'monthly');
  if (eligible.length === 0) {
    return (
      <section>
        <h1>{t.title}</h1>
        <EmptyState>{t.noStudents}</EmptyState>
      </section>
    );
  }

  const today = dataEmSaoPaulo(new Date());
  const fee = student ? monthly.data : null;
  // The oldest pending month first; with none pending, the month after the last paid one, never a future one.
  const suggested = fee ? (fee.pendingMonths[0] ?? (fee.lastPaidMonth ? somarMeses(fee.lastPaidMonth, 1) : mesDe(today))) : '';
  const month = chosenMonth || (suggested > mesDe(today) ? mesDe(today) : suggested);
  const options = fee ? monthOptions(fee.lastPaidMonth, mesDe(today)) : [];

  async function save(value: { paidOn: string; amountCents: number; method: PaymentMethod }) {
    setBusy(true);
    setFailed(false);
    const result = await backend.command('monthly.registerPayment', { studentId: student, month, ...value });
    setBusy(false);
    if (!result.ok) setFailed(true);
    else navigate(`/alunos/${student}/mensalidades`);
  }

  return (
    <section>
      <h1>{t.title}</h1>
      <div className="stack">
        <SelectField
          label={t.student}
          value={student}
          onChange={(e) => {
            setStudent(e.target.value);
            setChosenMonth('');
          }}
        >
          <option value="">{t.pickStudent}</option>
          {eligible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>

        {fee && (
          <>
            <SelectField label={t.month} value={month} onChange={(e) => setChosenMonth(e.target.value)}>
              {options.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </SelectField>
            <PaymentFields
              key={`${student}-${month}`}
              initial={{ amountCents: fee.amountCents, paidOn: today, method: 'pix' }}
              submitLabel={t.submit}
              maxCents={null}
              busy={busy}
              failed={failed}
              onSubmit={(value) => void save(value)}
            />
          </>
        )}
      </div>
    </section>
  );
}

/** From the month after the last paid one (or six months back) up to this month, plus any pending one. */
function monthOptions(lastPaid: string | null, current: string): string[] {
  const first = lastPaid ? somarMeses(lastPaid, 1) : somarMeses(current, -5);
  const months: string[] = [];
  for (let m = first > current ? current : first; m <= current; m = somarMeses(m, 1)) months.push(m);
  return months;
}
