import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { StudentView } from "../../application/api-contract";
import { initials, NOTES_MAX_LENGTH } from "../../domain/alunos/student";
import { strings } from "../../domain/strings";
import { useServices } from "../backend-context";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SegmentedControl } from "../components/Controls";
import { ListContent, ListRow, ListSection } from "../components/GroupedList";
import { Loading } from "../components/Loading";
import { Notice } from "../components/Notice";
import { RouteSheet } from "../components/RouteSheet";
import { Link, navigate } from "../router";
import { useQuery } from "../use-query";
import { MonthlyTab } from "./MonthlyTab";
import { PackagesTab } from "./PackagesTab";
import { StudentForm, STUDENT_FORM_ID } from "./StudentForm";

/** Tabs of the profile. Later sessions add Treinos and Histórico here. */
export type ProfileTab = "registration" | "packages" | "monthly" | "notes";

const TABS: { tab: ProfileTab; label: string; path: (id: string) => string }[] =
  [
    {
      tab: "registration",
      label: strings.students.tabs.registration,
      path: (id) => `/alunos/${id}`,
    },
    {
      tab: "packages",
      label: strings.students.tabs.packages,
      path: (id) => `/alunos/${id}/pacotes`,
    },
    {
      tab: "monthly",
      label: strings.students.tabs.monthly,
      path: (id) => `/alunos/${id}/mensalidades`,
    },
    {
      tab: "notes",
      label: strings.students.tabs.notes,
      path: (id) => `/alunos/${id}/notas`,
    },
  ];

export function NewStudent({ behind }: { behind?: ReactNode }) {
  return (
    <RouteSheet title={strings.students.newTitle} back="/alunos" behind={behind} formId={STUDENT_FORM_ID}>
      <StudentForm formId={STUDENT_FORM_ID} onSaved={(student) => navigate(`/alunos/${student.id}`)} />
    </RouteSheet>
  );
}

export function StudentProfile({ id, tab }: { id: string; tab: ProfileTab }) {
  const student = useQuery("student", { id }, ["students"]);

  if (student.error === "not_found") {
    return (
      <section>
        <Notice tone="error">{strings.students.notFound}</Notice>
        <Link to="/alunos">{strings.students.back}</Link>
      </section>
    );
  }
  if (!student.data)
    return student.error ? (
      <Notice tone="error">{strings.genericError}</Notice>
    ) : (
      <Loading />
    );

  const data = student.data;
  return (
    <section>
      <ListSection>
        <ListContent>
          <header className="profile-header">
            <span className="initials large" aria-hidden="true">
              {initials(data.name)}
            </span>
            <div className="grow">
              <h1>{data.name}</h1>
              <span className="muted small">
                {strings.students.billing[data.billing]} ·{" "}
                {strings.students.status[data.status]}
              </span>
              <HeaderPackage student={data} />
            </div>
          </header>
        </ListContent>
      </ListSection>
      <SegmentedControl
        label={strings.students.tabs.label}
        options={TABS.map((t) => ({ value: t.tab, label: t.label }))}
        value={tab}
        onChange={(next) =>
          navigate(TABS.find((t) => t.tab === next)!.path(id))
        }
      />
      {tab === "registration" && <Registration student={data} />}
      {tab === "packages" && <PackagesTab student={data} />}
      {tab === "monthly" && <MonthlyTab student={data} />}
      {tab === "notes" && <Notes student={data} />}
    </section>
  );
}

/** The header's package line: the plan, the lessons used and the status. */
function HeaderPackage({ student }: { student: StudentView }) {
  const packages = useQuery("studentPackages", { studentId: student.id }, [
    "packages",
    "classes",
  ]);
  if (student.billing === "monthly") return null;
  const current = packages.data?.find((p) => p.status !== "encerrado");
  if (!current) return null;
  return (
    <p className="small strong">
      {current.planName} ·{" "}
      {strings.packages.card.lessonOf(current.used, current.total)} ·{" "}
      {strings.packages.status[current.status]}
    </p>
  );
}

function Registration({ student }: { student: StudentView }) {
  const { backend } = useServices();
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function setStatus(status: StudentView["status"]) {
    const result = await backend.command("student.setStatus", {
      id: student.id,
      status,
    });
    setFailed(!result.ok);
  }

  return (
    <>
      <StudentForm
        key={student.id}
        student={student}
        onSaved={() => undefined}
      />
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      <ListSection header={strings.students.status[student.status]}>
        {student.status === "active" && (
          <ListRow
            title={strings.students.pause}
            action
            onClick={() => void setStatus("paused")}
          />
        )}
        {student.status === "paused" && (
          <ListRow
            title={strings.students.unpause}
            action
            onClick={() => void setStatus("active")}
          />
        )}
        {student.status === "inactive" ? (
          <ListRow
            title={strings.students.reactivate}
            action
            onClick={() => void setStatus("active")}
          />
        ) : (
          <ListRow
            title={strings.students.deactivate}
            action
            onClick={() => setConfirming(true)}
          />
        )}
      </ListSection>
      {confirming && (
        <ConfirmDialog
          title={strings.students.deactivate}
          confirmLabel={strings.students.deactivate}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void setStatus("inactive");
          }}
        >
          {strings.students.deactivateConfirm(student.name)}
        </ConfirmDialog>
      )}
    </>
  );
}

function Notes({ student }: { student: StudentView }) {
  const { backend } = useServices();
  const [text, setText] = useState(student.notes);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");

  // Notes changed on another device: take them while this one has nothing unsaved.
  const [base, setBase] = useState(student.notes);
  useEffect(() => {
    if (student.notes !== base) {
      if (text === base) setText(student.notes);
      setBase(student.notes);
    }
  }, [student.notes, base, text]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await backend.command("student.setNotes", {
      id: student.id,
      notes: text,
    });
    setState(result.ok ? "saved" : "failed");
  }

  return (
    <form className="stack" onSubmit={submit}>
      <ListSection header={strings.students.notes.label}>
        <ListContent>
          <textarea
            aria-label={strings.students.notes.label}
            rows={10}
            maxLength={NOTES_MAX_LENGTH}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setState("idle");
            }}
          />
        </ListContent>
      </ListSection>
      {state === "failed" && (
        <Notice tone="error">{strings.genericError}</Notice>
      )}
      {state === "saved" && <Notice>{strings.students.notes.saved}</Notice>}
      <div className="row">
        <Button type="submit">{strings.students.notes.save}</Button>
      </div>
    </form>
  );
}
