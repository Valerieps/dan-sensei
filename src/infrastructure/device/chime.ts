// Rest-end sounds (issue #7, P2/P3; spec "Cronômetro" and "Aula em dupla"). Three techniques so the
// test can tell which one survives on the iPad: beeps (Web Audio), a whistle (<audio> playing a WAV
// generated here and served from a blob: URL), and words (speechSynthesis, Portuguese voice).
// The sound is unlocked on the first tap. Reused by Modo Ao Vivo (C5) and the pair class (C6).
// Needs `media-src 'self' blob:` in the CSP (T3 adds it).

export type ChimeTechnique = 'beep' | 'whistle' | 'speech';

export interface BeepPattern {
  readonly length: 'long' | 'short';
  readonly count: number;
}

export interface Beep {
  /** Seconds after the start of the pattern. */
  readonly offsetSec: number;
  readonly durationSec: number;
  readonly hz: number;
}

const BEEP_HZ = 880;
const BEEP_SEC = { long: 0.6, short: 0.15 } as const;
const BEEP_GAP_SEC = 0.12;
export const MAX_BEEPS = 6;

/** The beeps of a pattern, back to back with a short gap. The count is kept between 1 and 6. */
export function beepSchedule(pattern: BeepPattern): Beep[] {
  const count = Math.min(MAX_BEEPS, Math.max(1, Math.floor(pattern.count)));
  const durationSec = BEEP_SEC[pattern.length];
  return Array.from({ length: count }, (_, i) => ({
    offsetSec: i * (durationSec + BEEP_GAP_SEC),
    durationSec,
    hz: BEEP_HZ,
  }));
}

const WHISTLE_RATE = 22_050;
const WHISTLE_SEC = 0.7;
const WHISTLE_HZ = 2800;
const TRILL_HZ = 38;
const TRILL_DEPTH_HZ = 250;

/** A 16-bit mono WAV of a trilled whistle: no file from the internet. */
export function whistleWav(): Uint8Array {
  const samples = Math.round(WHISTLE_RATE * WHISTLE_SEC);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, WHISTLE_RATE, true);
  view.setUint32(28, WHISTLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  let phase = 0;
  for (let i = 0; i < samples; i++) {
    const t = i / WHISTLE_RATE;
    const hz = WHISTLE_HZ + TRILL_DEPTH_HZ * Math.sin(2 * Math.PI * TRILL_HZ * t);
    phase += (2 * Math.PI * hz) / WHISTLE_RATE;
    const edge = Math.min(1, t / 0.02, (WHISTLE_SEC - t) / 0.05); // no click at start and end
    view.setInt16(44 + i * 2, Math.round(Math.sin(phase) * 0.6 * edge * 32767), true);
  }
  return bytes;
}

/** One play, as the test log needs it. */
export interface ChimeReport {
  readonly technique: ChimeTechnique;
  /** When the sound was meant to start (epoch ms). */
  readonly expectedAt: number;
  /** When it actually started, or was handed to the browser (epoch ms). */
  readonly actualAt: number;
  readonly lateMs: number;
  /** "running", "suspended", "interrupted"... or "none" when no AudioContext was used. */
  readonly contextState: string;
  /** Set when the sound could not be played. */
  readonly error?: string;
}

export function chimeReport(
  technique: ChimeTechnique,
  expectedAt: number,
  actualAt: number,
  contextState: string,
  error?: string,
): ChimeReport {
  return {
    technique,
    expectedAt,
    actualAt,
    lateMs: Math.max(0, actualAt - expectedAt),
    contextState,
    ...(error === undefined ? {} : { error }),
  };
}

/** Prefers a pt-BR voice, then any Portuguese one. */
export function pickPortugueseVoice<T extends { lang: string }>(voices: readonly T[]): T | null {
  const lang = (v: T) => v.lang.replace('_', '-').toLowerCase();
  return voices.find((v) => lang(v) === 'pt-br') ?? voices.find((v) => lang(v).startsWith('pt')) ?? null;
}

export interface PlayOptions {
  /** When the sound is due (epoch ms). Default: now. Beeps are scheduled on the audio clock for it. */
  readonly at?: number;
  readonly pattern?: BeepPattern;
  readonly words?: string;
}

const DEFAULT_PATTERN: BeepPattern = { length: 'long', count: 1 };
const DEFAULT_WORDS = 'Descanso acabou';

export class Chime {
  private context: AudioContext | null = null;
  private audio: HTMLAudioElement | null = null;
  private whistleUrl: string | null = null;
  private unlocked = false;

  constructor(private readonly now: () => number = () => Date.now()) {}

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  get contextState(): string {
    return this.context?.state ?? 'none';
  }

  /** Call from the first tap (a click handler): iOS only lets sound start after a gesture. */
  async unlock(): Promise<string> {
    if (this.unlocked) return this.contextState;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      this.context = new Ctor();
      await this.context.resume().catch(() => undefined);
      const silent = this.context.createBuffer(1, 1, this.context.sampleRate);
      const source = this.context.createBufferSource();
      source.buffer = silent;
      source.connect(this.context.destination);
      source.start();
    }
    this.whistleUrl = URL.createObjectURL(new Blob([whistleWav() as BlobPart], { type: 'audio/wav' }));
    this.audio = new Audio(this.whistleUrl);
    this.audio.preload = 'auto';
    // Touch the element inside the gesture so later plays are allowed.
    await this.audio.play().then(() => this.audio?.pause(), () => undefined);
    if (this.audio) this.audio.currentTime = 0;
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
    this.unlocked = true;
    return this.contextState;
  }

  async play(technique: ChimeTechnique, options: PlayOptions = {}): Promise<ChimeReport> {
    const expectedAt = options.at ?? this.now();
    try {
      if (technique === 'beep') return await this.beep(expectedAt, options.pattern ?? DEFAULT_PATTERN);
      if (technique === 'whistle') return await this.whistle(expectedAt);
      return this.speak(expectedAt, options.words ?? DEFAULT_WORDS);
    } catch (error) {
      return chimeReport(technique, expectedAt, this.now(), this.contextState, error instanceof Error ? error.message : String(error));
    }
  }

  dispose(): void {
    if (this.whistleUrl) URL.revokeObjectURL(this.whistleUrl);
    void this.context?.close();
    this.context = null;
    this.audio = null;
    this.whistleUrl = null;
    this.unlocked = false;
  }

  private async beep(expectedAt: number, pattern: BeepPattern): Promise<ChimeReport> {
    const ctx = this.context;
    if (!ctx) throw new Error('sound not unlocked');
    await ctx.resume(); // iOS suspends the context after a while or a call
    const nowMs = this.now();
    // Schedule on the audio clock: exact even if the page's timers are slow.
    const when = ctx.currentTime + Math.max(0, expectedAt - nowMs) / 1000;
    for (const beep of beepSchedule(pattern)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = beep.hz;
      const start = when + beep.offsetSec;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + beep.durationSec);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + beep.durationSec + 0.02);
    }
    return chimeReport('beep', expectedAt, Math.max(nowMs, expectedAt), ctx.state);
  }

  private async whistle(expectedAt: number): Promise<ChimeReport> {
    const audio = this.audio;
    if (!audio) throw new Error('sound not unlocked');
    audio.currentTime = 0;
    await audio.play();
    return chimeReport('whistle', expectedAt, this.now(), this.contextState);
  }

  private speak(expectedAt: number, words: string): ChimeReport {
    if (!('speechSynthesis' in window)) throw new Error('speechSynthesis not available');
    const utterance = new SpeechSynthesisUtterance(words);
    utterance.lang = 'pt-BR';
    const voice = pickPortugueseVoice(window.speechSynthesis.getVoices());
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
    return chimeReport('speech', expectedAt, this.now(), this.contextState);
  }
}
