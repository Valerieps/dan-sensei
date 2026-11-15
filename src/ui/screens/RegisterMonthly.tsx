import { useState, type ReactNode } from "react";
import type { PaymentMethod } from "../../application/api-contract";
import { dataEmSaoPaulo, mesDe, somarMeses } from "../../domain/pacotes";
import { formatMonth, strings } from "../../domain/strings";
import { useServices } from "../backend-context";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import { Notice } from "../components/Notice";
import { RouteSheet } from "../components/RouteSheet";
import { SelectField } from "../components/SelectField";
import { navigate } from "../router";
import { useQuery } from "../use-query";
import { PaymentFields } from "./RegisterPayment";

const TOPICS = ["monthly", "students"] as const;
const FORM_ID = "monthly-form";

/** Registers a monthly fee as paid: from the + button (no student yet) or from a profile. */
export function RegisterMonthly({
  studentId = "",
  behind,
}: {
  studentId?: string;
  behind?: ReactNode;
}) {
  const { backend } = useServices();
  const t = strings.packages.monthly;
  const students = useQuery("students", {}, ["students", "monthly"]);
  const [student, setStudent] = useState(studentId);
  const [chosenMonth, setChosenMonth] = useState("");
  const monthly = useQuery("monthly", { studentId: student }, TOPICS);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const back = studentId ? `/alunos/${studentId}/mensalidades` : "/";
  const sheet = (children: ReactNode, saveable = false) => (
    <RouteSheet
      title={t.title}
      back={back}
      behind={behind}
      formId={saveable ? FORM_ID : undefined}
      busy={busy}
    >
      {children}
    </RouteSheet>
  );

  if (!students.data)
    return sheet(
      students.error ? (
        <Notice tone="error">{strings.genericError}</Notice>
      ) : (
        <Loading />
      ),
    );
  const eligible = students.data.filter((s) => s.billing === "monthly");
  if (eligible.length === 0) {
    return sheet(<EmptyState>{t.noStudents}</EmptyState>);
  }

  const today = dataEmSaoPaulo(new Date());
  const fee = student ? monthly.data : null;
  // The oldest pending month first; with none pending, the month after the last paid one, never a future one.
  const suggested = fee
    ? (fee.pendingMonths[0] ??
      (fee.lastPaidMonth ? somarMeses(fee.lastPaidMonth, 1) : mesDe(today)))
    : "";
  const month =
    chosenMonth || (suggested > mesDe(today) ? mesDe(today) : suggested);
  const options = fee ? monthOptions(fee.lastPaidMonth, mesDe(today)) : [];

  async function save(value: {
    paidOn: string;
    amountCents: number;
    method: PaymentMethod;
  }) {
    setBusy(true);
    setFailed(false);
    const result = await backend.command("monthly.registerPayment", {
      studentId: student,
      month,
      ...value,
    });
    setBusy(false);
    if (!result.ok) setFailed(true);
    else navigate(`/alunos/${student}/mensalidades`);
  }

  return sheet(
    <div className="stack">
      <SelectField
        label={t.student}
        value={student}
        onChange={(e) => {
          setStudent(e.target.value);
          setChosenMonth("");
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
          <SelectField
            label={t.month}
            value={month}
            onChange={(e) => setChosenMonth(e.target.value)}
          >
            {options.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </SelectField>
          <PaymentFields
            key={`${student}-${month}`}
            formId={FORM_ID}
            initial={{
              amountCents: fee.amountCents,
              paidOn: today,
              method: "pix",
            }}
            submitLabel={t.submit}
            maxCents={null}
            busy={busy}
            failed={failed}
            onSubmit={(value) => void save(value)}
          />
        </>
      )}
    </div>,
    Boolean(fee),
  );
}

/** From the month after the last paid one (or six months back) up to this month, plus any pending one. */
function monthOptions(lastPaid: string | null, current: string): string[] {
  const first = lastPaid ? somarMeses(lastPaid, 1) : somarMeses(current, -5);
  const months: string[] = [];
  for (
    let m = first > current ? current : first;
    m <= current;
    m = somarMeses(m, 1)
  )
    months.push(m);
  return months;
}
