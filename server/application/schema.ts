// The group's database (docs/ARQUITETURA.md). Migrations run in order, once each, when the
// Durable Object starts. Never edit a migration that has shipped: add the next one.
import { seedStatements } from './exercise-seed';
import type { Sql } from './ports';

export const MIGRATIONS: readonly (readonly string[])[] = [
  // 1: members, their sessions and the invites.
  [
    `CREATE TABLE members (
      id TEXT PRIMARY KEY,
      google_sub TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      photo_url TEXT,
      roles TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      joined_at TEXT NOT NULL,
      removed_at TEXT
    )`,
    `CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`,
    `CREATE INDEX sessions_member ON sessions(member_id)`,
    `CREATE TABLE invites (
      email TEXT PRIMARY KEY,
      invited_by TEXT NOT NULL REFERENCES members(id),
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      revoked_at TEXT
    )`,
  ],
  // 2: students and their addresses (docs/spec/alunos.md).
  [
    `CREATE TABLE students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      birth_date TEXT,
      height_cm INTEGER,
      emergency_contact TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      billing TEXT NOT NULL DEFAULT 'package',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE student_addresses (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      label TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX student_addresses_student ON student_addresses(student_id)`,
  ],
  // 3: plans, packages, pauses, payments and the lessons that draw from packages
  // (docs/spec/pacotes-e-pagamentos.md). Balance, due date and status are never stored.
  [
    // `price_cents` is the price of ONE lesson; the plan's total is `classes * price_cents`.
    `CREATE TABLE plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      classes INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      validity_days INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL DEFAULT 0
    )`,
    `INSERT INTO plans (id, name, classes, price_cents, validity_days, sort) VALUES
      ('plan-avulso', 'Avulso', 1, 20000, 7, 1),
      ('plan-12', '12 aulas', 12, 12000, 60, 2),
      ('plan-16', '16 aulas', 16, 11000, 75, 3),
      ('plan-20', '20 aulas', 20, 10000, 90, 4)`,
    // The package keeps a copy of the plan's values. `first_class_on` is only the starting-balance
    // date; the real first lesson is the earlier of it and the first consuming lesson.
    `CREATE TABLE packages (
      id TEXT PRIMARY KEY,
      holder_id TEXT NOT NULL REFERENCES students(id),
      participant_id TEXT REFERENCES students(id),
      plan_id TEXT NOT NULL REFERENCES plans(id),
      classes INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      validity_days INTEGER NOT NULL,
      transferred_in INTEGER NOT NULL DEFAULT 0,
      used_before_app INTEGER NOT NULL DEFAULT 0,
      first_class_on TEXT,
      previous_package_id TEXT REFERENCES packages(id),
      created_on TEXT NOT NULL,
      closed_at TEXT,
      closed_note TEXT
    )`,
    `CREATE INDEX packages_holder ON packages(holder_id)`,
    `CREATE TABLE package_pauses (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL REFERENCES packages(id),
      starts_on TEXT NOT NULL,
      ends_on TEXT NOT NULL,
      reason TEXT
    )`,
    `CREATE INDEX package_pauses_package ON package_pauses(package_id)`,
    // "Pausar todos" applies to every package, so it is one row here, not one per package.
    `CREATE TABLE global_pauses (
      id TEXT PRIMARY KEY,
      starts_on TEXT NOT NULL,
      ends_on TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL REFERENCES packages(id),
      paid_on TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL
    )`,
    `CREATE INDEX payments_package ON payments(package_id)`,
    // 1a: only lessons recorded by hand ('given' or 'missed'); the agenda adds the rest.
    `CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      starts_at TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    // One row per student of the lesson; a pair lesson shares one package and one charge.
    // `package_id` NULL on a consuming lesson means "sem pacote".
    `CREATE TABLE class_students (
      class_id TEXT NOT NULL REFERENCES classes(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      package_id TEXT REFERENCES packages(id),
      charge TEXT NOT NULL,
      PRIMARY KEY (class_id, student_id)
    )`,
    `CREATE INDEX class_students_package ON class_students(package_id)`,
    `CREATE INDEX class_students_student ON class_students(student_id)`,
  ],
  // 4: monthly students' fee and payments (docs/spec/mensalistas.md). What is pending is never stored.
  [
    // `paid_through` is the last month paid before the app ("saldo inicial"); null when none.
    `CREATE TABLE monthly_fees (
      student_id TEXT PRIMARY KEY REFERENCES students(id),
      amount_cents INTEGER NOT NULL,
      due_day INTEGER NOT NULL,
      paid_through TEXT
    )`,
    `CREATE TABLE monthly_payments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      month TEXT NOT NULL,
      paid_on TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL,
      UNIQUE (student_id, month)
    )`,
  ],
  // 5: the trainer's message settings and the log of messages opened in WhatsApp
  // (docs/spec/whatsapp.md, ADR-008). The log says "opened", never "sent".
  [
    `CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE message_log (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      kind TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      opened_by TEXT REFERENCES members(id)
    )`,
    `CREATE INDEX message_log_student ON message_log(student_id, kind)`,
  ],
  // 6: the agenda (docs/spec/agenda.md, ADR-010). A scheduled lesson is a `classes` row with status
  // 'scheduled' whose students have charge 'waived' (it consumes nothing until it is given or missed).
  [
    // Fixed weekly time. `student_ids` is a JSON array of one or two ids; `weekday` is ISO (1 = Monday);
    // `time` is "HH:MM" in America/Sao_Paulo; `address` null means the first student's default.
    `CREATE TABLE recurrences (
      id TEXT PRIMARY KEY,
      student_ids TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      time TEXT NOT NULL,
      duration_min INTEGER NOT NULL DEFAULT 60,
      address TEXT,
      starts_on TEXT NOT NULL,
      ends_on TEXT,
      created_at TEXT NOT NULL
    )`,
    `ALTER TABLE classes ADD COLUMN duration_min INTEGER NOT NULL DEFAULT 60`,
    `ALTER TABLE classes ADD COLUMN address TEXT`,
    // The lesson this one replaced, when it came from a reschedule.
    `ALTER TABLE classes ADD COLUMN rescheduled_from TEXT REFERENCES classes(id)`,
    `ALTER TABLE classes ADD COLUMN recurrence_id TEXT REFERENCES recurrences(id)`,
    // The day of the fixed time this row stands for; it stays on a cancelled or rescheduled row, so the
    // generator never makes that day again. Null on a one-off lesson and on a rescheduled replacement.
    `ALTER TABLE classes ADD COLUMN slot_on TEXT`,
    `ALTER TABLE classes ADD COLUMN confirmed_at TEXT`,
    `CREATE UNIQUE INDEX classes_slot ON classes(recurrence_id, slot_on) WHERE slot_on IS NOT NULL`,
    `CREATE INDEX classes_starts_at ON classes(starts_at)`,
  ],
  [
    // When the trainer opened the confirmation in WhatsApp; a lesson asked but not confirmed is
    // highlighted on its day (docs/spec/agenda.md, Confirmação).
    `ALTER TABLE classes ADD COLUMN confirmation_asked_at TEXT`,
  ],
  // 8: the exercise library, programs, workouts and prescribed exercises (docs/spec/treinos-e-exercicios.md).
  // Group lists are JSON arrays of ids. `name_key` is the name without case or accents: one exercise
  // per name. Loads are in grams. A workout belongs to a student and, optionally, to a program.
  // Past classes copy what was done (performed_sets, phase 1c), so editing or deleting a workout
  // never reaches them.
  [
    `CREATE TABLE exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      aliases TEXT NOT NULL DEFAULT '[]',
      primary_groups TEXT NOT NULL DEFAULT '[]',
      secondary_groups TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      measure TEXT NOT NULL DEFAULT 'load_reps',
      load_step_g INTEGER NOT NULL DEFAULT 2500,
      equipment TEXT,
      media_url TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    ...seedStatements('2026-11-15T00:00:00.000Z'),
    `CREATE TABLE programs (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      name TEXT NOT NULL,
      starts_on TEXT,
      ends_on TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX programs_student ON programs(student_id)`,
    `CREATE TABLE workouts (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      program_id TEXT REFERENCES programs(id),
      label TEXT NOT NULL,
      sort INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX workouts_label ON workouts(student_id, COALESCE(program_id, ''), label COLLATE NOCASE)`,
    // Exercises done side by side: bi-set, tri-set or circuit.
    `CREATE TABLE workout_groups (
      id TEXT PRIMARY KEY,
      workout_id TEXT NOT NULL REFERENCES workouts(id),
      kind TEXT NOT NULL
    )`,
    `CREATE TABLE prescribed_exercises (
      id TEXT PRIMARY KEY,
      workout_id TEXT NOT NULL REFERENCES workouts(id),
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      sort INTEGER NOT NULL,
      sets INTEGER NOT NULL,
      reps_min INTEGER NOT NULL,
      reps_max INTEGER NOT NULL,
      load_g INTEGER,
      rest_s INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'normal',
      target_kind TEXT,
      target_value INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      group_id TEXT REFERENCES workout_groups(id)
    )`,
    `CREATE INDEX prescribed_workout ON prescribed_exercises(workout_id, sort)`,
  ],
  // 9: consent, PAR-Q, anamnesis and health alerts (docs/spec/termo-e-lgpd.md, alunos.md). Sensitive
  // data: nothing here is stored for a student without a signed term (checked by the use cases).
  // Each signature keeps the term's version and the member who collected it. The condition list is
  // the one the trainer edits; an alert points to one and carries its own note.
  [
    `CREATE TABLE consents (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      version INTEGER NOT NULL,
      signature TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      collected_by TEXT REFERENCES members(id)
    )`,
    `CREATE INDEX consents_student ON consents(student_id, signed_at)`,
    `CREATE TABLE parq_responses (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      answers TEXT NOT NULL,
      answered_at TEXT NOT NULL
    )`,
    `CREATE INDEX parq_student ON parq_responses(student_id, answered_at)`,
    `CREATE TABLE anamneses (
      student_id TEXT PRIMARY KEY REFERENCES students(id),
      main_goal TEXT NOT NULL DEFAULT '',
      secondary_goals TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE health_conditions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      archived INTEGER NOT NULL DEFAULT 0
    )`,
    `INSERT INTO health_conditions (id, name, name_key) VALUES
      ('cond-1', 'Diabetes', 'diabetes'), ('cond-2', 'Cardiopatia', 'cardiopatia'), ('cond-3', 'Hipertensão', 'hipertensao'),
      ('cond-4', 'Hérnia de disco', 'hernia de disco'), ('cond-5', 'Dor no joelho', 'dor no joelho'),
      ('cond-6', 'Dor no ombro', 'dor no ombro'), ('cond-7', 'Gestante', 'gestante'), ('cond-8', 'Asma', 'asma')`,
    `CREATE TABLE student_alerts (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      condition_id TEXT NOT NULL REFERENCES health_conditions(id),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE (student_id, condition_id)
    )`,
  ],
  // 10: the live class (docs/spec/aula-ao-vivo.md). A class is "open" from started_at to finished_at;
  // finishing is what draws it from the package. `class_plan` is the class's own copy of what to do
  // (editing a workout never reaches it); `performed_sets` is what was done and does not point to the
  // plan's workout. `client_commands` makes a resend from the offline queue harmless (ADR-009).
  [
    `ALTER TABLE classes ADD COLUMN started_at TEXT`,
    `ALTER TABLE classes ADD COLUMN finished_at TEXT`,
    `ALTER TABLE classes ADD COLUMN actual_min INTEGER`,
    `ALTER TABLE class_students ADD COLUMN pse INTEGER`,
    `CREATE TABLE class_plan (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      sort INTEGER NOT NULL,
      sets INTEGER NOT NULL,
      reps_min INTEGER NOT NULL,
      reps_max INTEGER NOT NULL,
      load_g INTEGER,
      rest_s INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      group_key TEXT,
      group_kind TEXT
    )`,
    `CREATE INDEX class_plan_class ON class_plan(class_id, student_id, sort)`,
    `CREATE TABLE performed_sets (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      plan_id TEXT NOT NULL REFERENCES class_plan(id),
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      "order" INTEGER NOT NULL,
      reps INTEGER,
      load_g INTEGER,
      seconds INTEGER,
      meters INTEGER,
      client_command_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX performed_sets_student ON performed_sets(student_id, exercise_id)`,
    `CREATE INDEX performed_sets_class ON performed_sets(class_id, student_id)`,
    `CREATE TABLE client_commands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      result TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  ],
];

export function migrate(sql: Sql): void {
  sql.run('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const [{ current }] = sql.all<{ current: number | null }>('SELECT MAX(version) AS current FROM schema_migrations');
  for (let version = (current ?? 0) + 1; version <= MIGRATIONS.length; version++) {
    sql.transaction(() => {
      for (const statement of MIGRATIONS[version - 1]) sql.run(statement);
      sql.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', version, new Date().toISOString());
    });
  }
}
