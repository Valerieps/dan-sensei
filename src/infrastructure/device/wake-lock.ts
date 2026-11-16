// Keeps the screen on during a class (issue #7, P1). The pure part decides what to do; `WakeLock`
// only talks to the browser. Reused by Modo Ao Vivo (C5).

export type WakeLockStatus = 'idle' | 'granted' | 'released' | 'error' | 'unsupported';

export interface WakeLockEvent {
  readonly status: WakeLockStatus;
  readonly at: number;
  /** The browser's error text, when status is "error". */
  readonly detail?: string;
}

/** A request is only worth making while wanted, on screen and not already held. */
export function shouldRequest(wanted: boolean, visible: boolean, held: boolean): boolean {
  return wanted && visible && !held;
}

interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export interface WakeLockEnv {
  readonly request: (() => Promise<Sentinel>) | null;
  readonly isVisible: () => boolean;
  /** Registers a callback for the page coming back to the foreground; returns the unsubscribe. */
  readonly onVisible: (callback: () => void) => () => void;
  readonly now: () => number;
}

export function browserWakeLockEnv(): WakeLockEnv {
  const wl = typeof navigator === 'undefined' ? undefined : navigator.wakeLock;
  return {
    request: wl ? () => wl.request('screen') : null,
    isVisible: () => document.visibilityState === 'visible',
    onVisible: (callback) => {
      const handler = () => {
        if (document.visibilityState === 'visible') callback();
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
    now: () => Date.now(),
  };
}

export class WakeLock {
  private sentinel: Sentinel | null = null;
  private wanted = false;
  private pending = false;
  private unsubscribe: (() => void) | null = null;
  private readonly listeners = new Set<(event: WakeLockEvent) => void>();

  constructor(private readonly env: WakeLockEnv = browserWakeLockEnv()) {}

  /** Calls back on every change (granted, released, error) and returns the unsubscribe. */
  subscribe(listener: (event: WakeLockEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get held(): boolean {
    return this.sentinel !== null;
  }

  /** Starts keeping the screen on, and asks again each time the page returns from the background. */
  async start(): Promise<void> {
    this.wanted = true;
    if (!this.env.request) {
      this.emit('unsupported');
      return;
    }
    this.unsubscribe ??= this.env.onVisible(() => void this.acquire());
    await this.acquire();
  }

  async stop(): Promise<void> {
    this.wanted = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) await sentinel.release().catch(() => undefined);
  }

  private async acquire(): Promise<void> {
    if (!this.env.request || this.pending) return;
    if (!shouldRequest(this.wanted, this.env.isVisible(), this.held)) return;
    this.pending = true;
    try {
      const sentinel = await this.env.request();
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null;
        this.emit('released');
      });
      this.sentinel = sentinel;
      this.emit('granted');
    } catch (error) {
      this.emit('error', error instanceof Error ? error.message : String(error));
    } finally {
      this.pending = false;
    }
  }

  private emit(status: WakeLockStatus, detail?: string): void {
    const event: WakeLockEvent = { status, at: this.env.now(), ...(detail === undefined ? {} : { detail }) };
    this.listeners.forEach((l) => l(event));
  }
}
