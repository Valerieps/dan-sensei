// Rest timers (issue #7, P3; spec "Cronômetro" and "Aula em dupla"). Time always comes from the
// real clock against a planned end, never from counting ticks, so a page that was in the
// background catches up at once and the display never runs backwards. Several can run together.

export function remainingMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

export function isDue(endsAt: number, now: number): boolean {
  return now >= endsAt;
}

/** How late the end was noticed. Never negative. */
export function lateMs(endsAt: number, firedAt: number): number {
  return Math.max(0, firedAt - endsAt);
}

/** Moves the end by `deltaMs` (+15 s / -15 s). The end never goes before `now`. */
export function adjustEnd(endsAt: number, deltaMs: number, now: number): number {
  return Math.max(now, endsAt + deltaMs);
}

export interface RestEnd {
  readonly id: string;
  readonly endsAt: number;
  readonly firedAt: number;
  readonly lateMs: number;
}

export interface RestTimerEnv {
  readonly now: () => number;
  /** Runs `callback` about every `ms` and on the page returning to the foreground. Returns the stop. */
  readonly every: (ms: number, callback: () => void) => () => void;
}

export function browserRestTimerEnv(): RestTimerEnv {
  return {
    now: () => Date.now(),
    every: (ms, callback) => {
      const interval = setInterval(callback, ms);
      const wake = () => callback();
      document.addEventListener('visibilitychange', wake);
      window.addEventListener('pageshow', wake);
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', wake);
        window.removeEventListener('pageshow', wake);
      };
    },
  };
}

const CHECK_EVERY_MS = 100;

export class RestTimer {
  private readonly ends = new Map<string, number>();
  private stopChecking: (() => void) | null = null;
  private readonly endListeners = new Set<(end: RestEnd) => void>();
  private readonly tickListeners = new Set<() => void>();

  constructor(private readonly env: RestTimerEnv = browserRestTimerEnv()) {}

  onEnd(listener: (end: RestEnd) => void): () => void {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  /** Called at each check while any timer runs, so a screen can redraw. */
  onTick(listener: () => void): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  /** Starts (or restarts) the rest `id`. Returns the planned end. */
  start(id: string, durationMs: number): number {
    const endsAt = this.env.now() + durationMs;
    this.ends.set(id, endsAt);
    this.stopChecking ??= this.env.every(CHECK_EVERY_MS, () => this.check());
    return endsAt;
  }

  adjust(id: string, deltaMs: number): number | null {
    const endsAt = this.ends.get(id);
    if (endsAt === undefined) return null;
    const next = adjustEnd(endsAt, deltaMs, this.env.now());
    this.ends.set(id, next);
    return next;
  }

  cancel(id: string): void {
    this.ends.delete(id);
    this.idleCheck();
  }

  endsAt(id: string): number | null {
    return this.ends.get(id) ?? null;
  }

  remaining(id: string): number | null {
    const endsAt = this.ends.get(id);
    return endsAt === undefined ? null : remainingMs(endsAt, this.env.now());
  }

  get running(): number {
    return this.ends.size;
  }

  dispose(): void {
    this.ends.clear();
    this.idleCheck();
  }

  private check(): void {
    const firedAt = this.env.now();
    for (const [id, endsAt] of [...this.ends]) {
      if (!isDue(endsAt, firedAt)) continue;
      this.ends.delete(id);
      const end: RestEnd = { id, endsAt, firedAt, lateMs: lateMs(endsAt, firedAt) };
      this.endListeners.forEach((l) => l(end));
    }
    this.tickListeners.forEach((l) => l());
    this.idleCheck();
  }

  private idleCheck(): void {
    if (this.ends.size === 0 && this.stopChecking) {
      this.stopChecking();
      this.stopChecking = null;
    }
  }
}
