# ADR-009: Offline class recording with a local command queue

**Status:** Accepted
**Date:** 2026-11-14
**Decision:** Phases 1a and 1b stay online, as the template is: every write is a command the
`Group` Durable Object checks and stores, and the app shows an error when there is no connection.
Phase 1c (`docs/spec/aula-ao-vivo.md`) adds offline recording for the class only:
- The service worker caches the app shell, so the app opens without a connection.
- Before a class starts, the app keeps in IndexedDB what the class needs: the students, their health
  alerts, the workout, the previous loads and the exercise library.
- During the class, each action (set recorded, exercise added, PSE, class finished) becomes a command
  with a client-generated id, stored in an IndexedDB queue and applied to the local copy at once.
- When the connection returns, the queue is sent in order. The server applies each command once
  (the id makes a resend harmless) and stays the only writer and the source of truth; the local copy
  is then replaced by the server's answer.
- A command the server refuses (the student was removed meanwhile, for example) is kept and shown to
  the member, never dropped silently.
The details (the queue's schema, the conflict rule "last edit of each field wins" from the PRD, and
the Screen Wake Lock and audio unlock) are designed with phase 1c, after the test on the trainer's
iPad, and recorded as an update here.
**Why:** The spec requires the whole class to work without internet, and classes happen in students'
homes with unreliable Wi-Fi. Pacotes, payments and the schedule are used at home or between classes,
where the connection is fine, so the online model of ADR-004 covers phases 1a and 1b without new
moving parts. Keeping the server as the only writer keeps the invariants of `docs/ARQUITETURA.md`
(one transaction per command, roles checked on the server).
**Alternatives:** Full offline-first with a synced local database (CRDT or a sync engine): far more
code and dependencies for one maintainer, and it would move the business rules to the client.
Online-only classes: breaks the spec and loses classes when the Wi-Fi drops.

## Update (phase 1c, server and queue)

- **Queue:** `src/application/live-queue.ts` over a `QueueStore` (IndexedDB in
  `src/infrastructure/indexeddb-queue-store.ts`, one record with `pending` and `refused`). `enqueue`
  saves to the device before it returns; `flush` sends in order, one call at a time, saving after each
  answer. `unavailable` and `unauthenticated` stop the send and keep the command; any other error moves
  it to `refused` and the send goes on.
- **Idempotency:** every `live.*` command carries `clientCommandId`; the `Group` stores it with the
  answer (`client_commands`) in the same transaction, and a resend gets the stored answer with
  `changed: []`. The id of a set is its command id, and plan ids are derived
  (`<classId>:<studentId>:<n>`), so a command queued offline can refer to what an earlier queued
  command creates.
- **Time:** each command carries `at`, the device's time; the server believes it when it is not in the
  future and not older than a week, so a class sent later keeps its real start, end and duration.
- **Local copy:** `src/application/live-local.ts` applies the same commands to the same view
  (`startLocal`, `applyLocal`), using the rules of `src/domain/aula`. The server's answer replaces it.
- **Conflicts:** commands touch different things (a set has its own id), so the "last edit of each
  field wins" rule only matters for `live.editSet`, where the order of the queue decides.
- Still to do in the app: wiring the queue to the screens, the cache before the class, the service
  worker, the Screen Wake Lock and the audio unlock (`docs/ROADMAP.md`).
