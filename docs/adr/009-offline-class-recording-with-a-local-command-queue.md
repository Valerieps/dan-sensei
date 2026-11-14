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
