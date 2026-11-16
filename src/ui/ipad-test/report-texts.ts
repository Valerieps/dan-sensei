// Texts of the Markdown report. The step texts live in strings.ts (session T4).
// The report goes to the owner, so it is plain Portuguese with the proof names.

import type { SoundTechnique } from './log';
import type { ProofId, Verdict } from './evaluation';

export const REPORT_TEXTS = {
  title: '# Teste do iPad — Dan Sensei',
  resultHeading: '## Resultado',
  nextStepsHeading: '## Próximos passos',
  logHeading: '## Registro',
  commentsLabel: 'Comentários do Dan',
  soundsLabel: 'Sons',
  noNextSteps: '- Nada a mudar: tudo passou.',
  yes: 'sim',
  no: 'não',
  unknownNote: 'sem resultado',
  portraitLabel: 'vertical',
  landscapeLabel: 'horizontal',
  installedLabel: 'instalado',
  dateLabel: 'Data',
  noEnvironment: 'aparelho não registrado',
} as const;

export const MARKS: Record<Verdict, string> = { pass: '✓', fail: '✗', unknown: '–' };

export const PROOF_TITLES: Record<ProofId, string> = {
  P1: 'Tela acesa 60 min',
  P2: 'Som depois de muito tempo',
  P3: 'Dois cronômetros',
  P4: 'Modo avião',
  P5: 'Sem lentidão',
};

export const SOUND_TITLES: Record<SoundTechnique, string> = {
  beeps: 'bipes',
  whistle: 'apito',
  words: 'palavras',
};

/** "Próximos passos" chosen by the table "O que depende do teste". "Se passou" / "Se falhou". */
export const NEXT_STEPS = {
  P1: {
    pass: 'C5: usar navigator.wakeLock, pedir de novo ao voltar do fundo.',
    fail: 'C5: plano B para a tela acesa, vídeo mudo em loop (técnica do NoSleep, sem biblioteca); a T6 escreve um ADR.',
  },
  P2: {
    pass: 'C5: usar Web Audio, liberado no primeiro toque da aula.',
    fail: 'C5: AudioContext.resume() antes de cada aviso; usar o <audio> como reserva. Se nenhum funcionar, a T6 abre uma pergunta para a Valéria (vibração não existe no iPad).',
  },
  P3: {
    pass: 'C6: rodar dois cronômetros num só relógio da página.',
    fail: 'C6: agendar os sons pelo relógio do AudioContext (start(when)), não por setTimeout.',
  },
  words: {
    pass: 'C6: oferecer a opção "palavras".',
    fail: 'C6: opção "palavras" fica fora até haver voz pt-BR; a T6 muda a regra no spec e lista em "Revisar as lacunas".',
  },
  P4: {
    pass: 'ADR-009: o service worker da T3 vira o do app; a "Aula sem internet" do roadmap fica só com IndexedDB e ServicesProvider.',
    fail: 'T6: investigar com o registro e abrir issue t:bug p:alta antes da C5.',
  },
  P5: {
    pass: undefined,
    fail: 'C5: medir antes de animar; as trocas de cor ficam instantâneas, sem animação.',
  },
  chrome: 'C5: conferir o mesmo no Chrome; o passo de instalar da etapa 1 vira o texto de ajuda do app.',
  unknown: (id: string) => `Repetir a prova ${id} antes da C5: ficou sem resultado.`,
  unknownWords: 'Repetir o som "palavras" antes da C6: ficou sem resultado.',
} as const;
