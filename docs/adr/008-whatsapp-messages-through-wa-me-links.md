# ADR-008: WhatsApp messages through wa.me links

**Status:** Accepted
**Date:** 2026-11-14
**Decision:** Every message to a student (statement, class summary, renewal, confirmation, monthly
fee reminder, `docs/spec/whatsapp.md`) is built in the app from a template and opened as a link
`https://wa.me/<phone>?text=<message>`, with `target="_blank" rel="noopener noreferrer"`. The member
reviews and sends it in WhatsApp. No WhatsApp API is called, so nothing is added to the
CSP origins in `network-policy.ts`; `https://wa.me` only goes into `LINK_ORIGINS`, which says where a
tapped link may lead and which the CSP never sees: following a link is navigation, not a `fetch`, and the CSP's `connect-src` does
not apply. The rule "no personal data in the URL" (`docs/SEGURANCA.md`) is about the app's own API;
this link is the intended way out, so it carries the phone and the text, and the message builder
never puts health data (anamnese, PAR-Q, health alerts) in the text. The app records that a message
was opened, not that it was sent, since it cannot know.
**Why:** The owner wants one-tap messages without a paid service. Automatic sending needs the paid
WhatsApp Business API and risks a ban of the trainer's number.
**Alternatives:** WhatsApp Business Cloud API: paid, needs a business account, a webhook and a
secret in the Worker, and sends without the trainer seeing the text. Copy to clipboard: one more
step per message and no recipient.
