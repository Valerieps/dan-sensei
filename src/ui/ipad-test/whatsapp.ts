// The WhatsApp link (ADR-008): no phone number, the trainer picks the contact.

export const MAX_LINK_TEXT_LETTERS = 1800;
const CUT_MARK = '…';

/** Cuts the text to the limit, at the last line break when there is one, and marks the cut. */
export function fitForLink(text: string, max = MAX_LINK_TEXT_LETTERS): string {
  const letters = Array.from(text);
  if (letters.length <= max) return text;
  const room = letters.slice(0, max - 2).join('');
  const lineBreak = room.lastIndexOf('\n');
  const body = lineBreak > 0 ? room.slice(0, lineBreak) : room;
  return `${body.trimEnd()}\n${CUT_MARK}`;
}

/** `summary` is the report without "Registro" (Report.summary). */
export function whatsappLink(summary: string): string {
  return `https://wa.me/?text=${encodeURIComponent(fitForLink(summary))}`;
}
