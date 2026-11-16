import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluation';
import { runTest } from './fixtures';
import { MAX_LINK_TEXT_LETTERS, fitForLink, whatsappLink } from './whatsapp';
import { buildReport } from './report';
import { isFinished, initialTest } from './steps';
import { freshTest, parseTest, serializeTest } from './store';

const NOW = new Date(2026, 10, 20, 14, 3);

describe('a whole test that passed', () => {
  const { state, log } = runTest();

  it('finishes and passes P1 to P5', () => {
    expect(isFinished(state)).toBe(true);
    const result = evaluate(state, log);
    expect(result.proofs.map((p) => p.verdict)).toEqual(['pass', 'pass', 'pass', 'pass', 'pass']);
    expect(result.allPassed).toBe(true);
  });

  it('writes the report with the numbers and the next steps from the table', () => {
    const report = buildReport(state, log, NOW);
    expect(report.summary).toContain('# Teste do iPad — Dan Sensei');
    expect(report.summary).toContain(
      'Data: 2026-11-20 14:03 · Safari 26.6 · iPad · instalado: sim · 1180×820 horizontal',
    );
    expect(report.summary).toContain('- ✓ P1 Tela acesa 60 min (wake lock concedido, 0 soltas)');
    expect(report.summary).toContain('- ✓ P2 Som depois de muito tempo (ouviu 12 de 12)');
    expect(report.summary).toContain('- ✓ P3 Dois cronômetros (atraso máximo 180 ms)');
    expect(report.summary).toContain('- ✓ P4 Modo avião (abriu do cache)');
    expect(report.summary).toContain('- ✓ P5 Sem lentidão (pior atraso do relógio 90 ms)');
    expect(report.summary).toContain('- Sons: bipes ✓ · apito ✓ · palavras ✓');
    expect(report.summary).toContain('- C5: usar navigator.wakeLock, pedir de novo ao voltar do fundo.');
    expect(report.summary).toContain('- C5: usar Web Audio, liberado no primeiro toque da aula.');
    expect(report.summary).toContain('- C6: rodar dois cronômetros num só relógio da página.');
    expect(report.summary).not.toContain('plano B');
    expect(report.summary).not.toContain('## Registro');
    expect(report.filename).toBe('teste-ipad-2026-11-20.md');
  });

  it('puts the log only in the full report', () => {
    const report = buildReport(state, log, NOW);
    expect(report.full.startsWith(report.summary)).toBe(true);
    expect(report.full).toContain('## Registro');
    expect(report.full).toContain('ouvi aviso 12');
    expect(report.full.split('\n').length).toBeGreaterThan(log.length);
  });
});

describe('a test where P2 failed', () => {
  const { state, log } = runTest({
    missedNotices: [10, 11, 12],
    audioStateOf: { 10: 'interrupted' },
    wordsFail: true,
  });

  it('fails only P2 and says why', () => {
    const result = evaluate(state, log);
    expect(result.proofs.map((p) => p.verdict)).toEqual(['pass', 'fail', 'pass', 'pass', 'pass']);
    expect(result.proofs[1]?.facts).toEqual(['ouviu 9 de 12', 'o 10º saiu com AudioContext "interrupted"']);
    expect(result.sounds.map((s) => s.verdict)).toEqual(['pass', 'pass', 'fail']);
  });

  it('writes the failing line, the comments and the P2 plan from the table', () => {
    const { summary } = buildReport(state, log, NOW);
    expect(summary).toContain(
      '- ✗ P2 Som depois de muito tempo (ouviu 9 de 12; o 10º saiu com AudioContext "interrupted")',
    );
    expect(summary).toContain('- Sons: bipes ✓ · apito ✓ · palavras ✗ (sem voz pt-BR)');
    expect(summary).toContain('- Comentários do Dan: "não ouvi a voz"');
    expect(summary).toContain('- C5: AudioContext.resume() antes de cada aviso; usar o <audio> como reserva.');
    expect(summary).toContain('- C6: opção "palavras" fica fora até haver voz pt-BR');
    expect(summary).not.toContain('usar Web Audio, liberado');
  });
});

describe('other verdicts', () => {
  it('leaves P4 without result when the step was skipped and asks to repeat it', () => {
    const { state, log } = runTest({ skipAirplane: true });
    const result = evaluate(state, log);
    expect(result.proofs[3]?.verdict).toBe('unknown');
    const { summary } = buildReport(state, log, NOW);
    expect(summary).toContain('- – P4 Modo avião (sem resultado)');
    expect(summary).toContain('Repetir a prova P4');
  });

  it('fails P4 when the airplane step started and never finished', () => {
    const { state, log } = runTest({ skipAirplane: true });
    const started = [
      ...log,
      { kind: 'step-start', at: 1, sinceStepMs: 0, step: 4 } as const,
    ];
    const pending = { ...state, steps: state.steps.map((s, i) => (i === 4 ? { ...s, status: 'pending' as const } : s)) };
    expect(evaluate(pending, started).proofs[3]?.verdict).toBe('fail');
  });

  it('suggests checking Chrome when the trainer used Chrome', () => {
    const { state, log } = runTest({ browser: 'Chrome' });
    expect(buildReport(state, log, NOW).summary).toContain('conferir o mesmo no Chrome');
  });

  it('has no result at all before the test starts', () => {
    const result = evaluate(initialTest(), []);
    expect(result.proofs.every((p) => p.verdict === 'unknown')).toBe(true);
    expect(buildReport(initialTest(), [], NOW).summary).toContain('aparelho não registrado');
  });
});

describe('the WhatsApp link', () => {
  it('has no phone number and carries the whole summary when it is short', () => {
    const { state, log } = runTest();
    const { summary } = buildReport(state, log, NOW);
    const link = whatsappLink(summary);
    expect(link.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(link.slice('https://wa.me/?text='.length))).toBe(summary);
  });

  it('cuts a long text at 1.800 letters, at a line break, and marks the cut', () => {
    const long = Array.from({ length: 200 }, (_, i) => `linha ${i} com um texto comprido`).join('\n');
    const cut = fitForLink(long);
    expect(Array.from(cut).length).toBeLessThanOrEqual(MAX_LINK_TEXT_LETTERS);
    expect(cut.endsWith('\n…')).toBe(true);
    expect(long.startsWith(cut.slice(0, -2))).toBe(true);
    const link = whatsappLink(long);
    expect(decodeURIComponent(link.slice('https://wa.me/?text='.length))).toBe(cut);
  });

  it('cuts a text with no line break and does not split a letter', () => {
    const cut = fitForLink('é'.repeat(3000));
    expect(Array.from(cut).length).toBeLessThanOrEqual(MAX_LINK_TEXT_LETTERS);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('cuts a real report that grew with long comments, never carrying the log', () => {
    const { state, log } = runTest({ wordsFail: true });
    const noisy = {
      ...state,
      steps: state.steps.map((s) => ({
        ...s,
        answers: Object.fromEntries(
          Object.entries(s.answers).map(([k, a]) => [k, a.yes ? a : { ...a, comment: 'palavra '.repeat(70) }]),
        ),
      })),
    };
    const report = buildReport(noisy, log, NOW);
    expect(report.summary.length).toBeGreaterThan(0);
    const longSummary = `${report.summary}\n${'- mais um comentário comprido\n'.repeat(120)}`;
    const text = decodeURIComponent(whatsappLink(longSummary).slice('https://wa.me/?text='.length));
    expect(Array.from(text).length).toBeLessThanOrEqual(MAX_LINK_TEXT_LETTERS);
    expect(text).not.toContain('## Registro');
    expect(text.startsWith('# Teste do iPad')).toBe(true);
  });
});

describe('the store format', () => {
  it('round-trips a test', () => {
    const saved = runTest();
    expect(parseTest(serializeTest(saved))).toEqual(JSON.parse(serializeTest(saved)));
  });

  it('refuses missing, broken or foreign data', () => {
    expect(parseTest(null)).toBeNull();
    expect(parseTest('not json')).toBeNull();
    expect(parseTest('{"state":{"version":2},"log":[]}')).toBeNull();
    expect(parseTest(JSON.stringify({ state: freshTest().state, log: [{ kind: 1 }] }))).toBeNull();
  });

  it('accepts a fresh test', () => {
    expect(parseTest(serializeTest(freshTest()))).toEqual(freshTest());
  });
});
