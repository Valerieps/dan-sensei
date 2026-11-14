# ADR-010: Scheduled lessons are generated eight weeks ahead, by the command and the cron

**Status:** Accepted
**Date:** 2026-11-14
**Decision:** A fixed weekly time is a row of `recurrences` (`weekday` ISO 1-7, `time` "HH:MM" in
`America/Sao_Paulo`, `starts_on`, `ends_on`). Its lessons are real `classes` rows with status
`scheduled`, generated **56 days ahead** (`HORIZONTE_DIAS` in `src/domain/agenda/recorrencia.ts`):
- **In the command:** `recurrence.create` and `class.reschedule` with scope `following` call
  `generateAhead`, so the grid is right the moment the trainer saves.
- **In the cron:** `GroupService.tick()` calls `generateAhead` on every tick (ADR-004), which tops the
  horizon up as days pass. It is idempotent and writes nothing when the horizon is already full.
- **Never in a read:** queries do not write, so a read cannot race a command or wake other screens.

Each generated lesson carries `recurrence_id` and `slot_on` (the day of the fixed time it stands for);
a unique index on `(recurrence_id, slot_on)` makes generation safe to repeat. A lesson that is
cancelled, rescheduled, given or missed keeps its `slot_on`, so the generator never makes that day
again. Deleting a scheduled lesson of a fixed time therefore cancels it instead of removing the row.

"Esta e as seguintes" ends the old recurrence the day before and creates a new one with the new
weekday and time. The scheduled lessons from that day on are replaced by new ones (the old rows become
`rescheduled`, linked by `rescheduled_from`), and the settled days after it move their `slot_on` to the
new recurrence, shifted by the same number of days. "Só esta" creates one lesson linked to the original,
which becomes `rescheduled`.

A scheduled lesson's `class_students.charge` is `waived` and its package is null: it consumes nothing
until `class.complete` (given) or a charged absence sets `consumes` and the package, by the rules of
phase 1a. `loadPackages` only counts lessons whose status is `given` or `missed`.

The **validity forecast** does not depend on the horizon. It takes the package's remaining lessons, the
scheduled lessons ahead of its students and, when they are not enough, projects the running fixed times
past the horizon with `projetarDatas` (pure arithmetic, at most two years). A 20-lesson package at two
a week is 10 weeks, longer than the 8 generated.
**Why:** The grid, the confirmation and the Início read lessons as ordinary rows, with one query and no
special case for "lessons that do not exist yet"; a lesson can be cancelled, confirmed or moved on its
own. Eight weeks covers the 7-day to 90-day plans well enough to see the next renewals, while keeping
the table small (a few hundred rows). Generating in the command shows the result at once, and the cron
(already there) needs no new infrastructure.
**Alternatives:** Generating on read: reads would write, and every screen would pay for it. Generating
only in the cron: a new fixed time would show up to five minutes late. Not storing lessons and
expanding recurrences on every read, with exceptions in a side table: every query (balance, forecast,
confirmation) would have to merge two sources, and "this and the following" would need an exception
language. Generating a whole year: thousands of rows that every schedule change must rewrite.
