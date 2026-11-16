// The Markdown report the trainer sends. Two parts: the summary goes in the WhatsApp link,
// the whole thing (summary plus "Registro") goes in the file and in "Copiar".

import { evaluate, type Evaluation } from './evaluation';
import type { LogEntry } from './log';
import { MARKS, NEXT_STEPS, PROOF_TITLES, REPORT_TEXTS, SOUND_TITLES } from './report-texts';
import type { TestState } from './steps';

export interface Report {
  /** Everything but "Registro". This is what the WhatsApp link carries. */
  readonly summary: string;
  /** Summary plus "Registro". For the file and for "Copiar". */
  readonly full: string;
  readonly filename: string;
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

function dateOf(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function clockOf(at: number): string {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function minutesOf(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function reportFilename(now: Date): string {
  return `teste-ipad-${dateOf(now)}.md`;
}

function headerLine(now: Date, log: readonly LogEntry[]): string {
  const env = [...log].reverse().find((e) => e.kind === 'env');
  const date = `${REPORT_TEXTS.dateLabel}: ${dateOf(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (env?.kind !== 'env') return `${date} · ${REPORT_TEXTS.noEnvironment}`;
  const orientation = env.width >= env.height ? REPORT_TEXTS.landscapeLabel : REPORT_TEXTS.portraitLabel;
  const installed = env.standalone ? REPORT_TEXTS.yes : REPORT_TEXTS.no;
  return [
    date,
    `${env.browser} ${env.version}`.trim(),
    env.device,
    `${REPORT_TEXTS.installedLabel}: ${installed}`,
    `${env.width}×${env.height} ${orientation}`,
  ].join(' · ');
}

function resultLines(result: Evaluation): string[] {
  const lines = result.proofs.map((p) => {
    const detail = p.verdict === 'unknown' ? [REPORT_TEXTS.unknownNote] : p.facts;
    const facts = detail.length > 0 ? ` (${detail.join('; ')})` : '';
    return `- ${MARKS[p.verdict]} ${p.id} ${PROOF_TITLES[p.id]}${facts}`;
  });
  const sounds = result.sounds
    .map((s) => `${SOUND_TITLES[s.technique]} ${MARKS[s.verdict]}${s.note ? ` (${s.note})` : ''}`)
    .join(' · ');
  lines.push(`- ${REPORT_TEXTS.soundsLabel}: ${sounds}`);
  if (result.comments.length > 0) {
    const quoted = result.comments.map((c) => `"${c.replace(/\s+/g, ' ')}"`).join(' · ');
    lines.push(`- ${REPORT_TEXTS.commentsLabel}: ${quoted}`);
  }
  return lines;
}

/** Chooses, for each result, the row of the table "O que depende do teste". */
export function nextSteps(result: Evaluation): string[] {
  const out: string[] = [];
  for (const proof of result.proofs) {
    if (proof.verdict === 'unknown') {
      out.push(NEXT_STEPS.unknown(proof.id));
      continue;
    }
    const line = NEXT_STEPS[proof.id][proof.verdict];
    if (line) out.push(line);
    if (proof.id === 'P3') {
      const words = result.sounds.find((s) => s.technique === 'words');
      if (words?.verdict === 'unknown') out.push(NEXT_STEPS.unknownWords);
      else if (words) out.push(NEXT_STEPS.words[words.verdict]);
    }
  }
  if (result.browser?.toLowerCase().includes('chrome')) out.push(NEXT_STEPS.chrome);
  return out;
}

export function formatLogLine(entry: LogEntry): string {
  const head = `${clockOf(entry.at)} (+${minutesOf(entry.sinceStepMs)}) etapa ${entry.step}`;
  return `${head} ${describe(entry)}`;
}

function describe(e: LogEntry): string {
  switch (e.kind) {
    case 'step-start':
      return 'começou';
    case 'step-end':
      return e.status === 'done' ? 'terminou' : 'pulada';
    case 'answer':
      return `resposta ${e.question}: ${e.yes ? 'sim' : 'não'}${e.comment ? ` "${e.comment}"` : ''}`;
    case 'wakelock':
      return `wakelock ${e.state}${e.detail ? ` ${e.detail}` : ''}`;
    case 'audio-state':
      return `audio ${e.state}`;
    case 'sound':
      return `som ${e.technique}/${e.purpose} previsto ${clockOf(e.plannedAt)} real ${clockOf(e.actualAt)} atraso ${e.delayMs} ms audio ${e.audioState ?? '-'} ${e.ok ? 'ok' : `falhou${e.detail ? ` ${e.detail}` : ''}`}`;
    case 'heard':
      return `ouvi aviso ${e.noticeIndex} após ${e.reactionMs} ms`;
    case 'visibility':
      return e.hidden ? 'app foi para o fundo' : 'app voltou';
    case 'network':
      return e.online ? 'online' : 'offline';
    case 'page-error':
      return `erro ${e.message}`;
    case 'alive':
      return `ainda acesa, pior atraso ${e.worstLagMs} ms, quadros perdidos ${e.droppedFrames}`;
    case 'env':
      return `aparelho ${e.browser} ${e.version} ${e.device} instalado ${e.standalone ? 'sim' : 'não'} ${e.width}×${e.height}${e.fromCache === undefined ? '' : ` cache ${e.fromCache ? 'sim' : 'não'}`}`;
    case 'summary':
      return `resumo de ${e.lines} linhas (${clockOf(e.fromAt)}–${clockOf(e.toAt)}): pior atraso ${e.worstLagMs} ms, quadros perdidos ${e.droppedFrames}, avisos ${e.noticesPlayed}, ouvidos ${e.noticesHeard}, sem AudioContext running ${e.noticesNotRunning}${e.firstNotRunning ? ` (o ${e.firstNotRunning.index}º: ${e.firstNotRunning.state})` : ''}`;
  }
}

export function buildReport(state: TestState, log: readonly LogEntry[], now: Date): Report {
  const result = evaluate(state, log);
  const steps = nextSteps(result);
  const summary = [
    REPORT_TEXTS.title,
    headerLine(now, log),
    '',
    REPORT_TEXTS.resultHeading,
    ...resultLines(result),
    '',
    REPORT_TEXTS.nextStepsHeading,
    ...(steps.length > 0 ? steps.map((s) => `- ${s}`) : [REPORT_TEXTS.noNextSteps]),
    '',
  ].join('\n');
  const full = `${summary}\n${REPORT_TEXTS.logHeading}\n${log.map(formatLogLine).join('\n')}\n`;
  return { summary, full, filename: reportFilename(now) };
}
