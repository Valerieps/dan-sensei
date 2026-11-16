// Measures how sluggish the page is (issue #7, P5): the worst delay of a steady clock and the
// frames lost per minute. The arithmetic is pure; `LagMonitor` only listens to the browser.

export const FRAME_MS = 1000 / 60;
const WINDOW_MS = 60_000;
/** A gap this long is the page being paused (background, locked screen), not lost frames. */
const PAUSE_MS = 1000;

/** How late a tick that was due at `expectedAt` actually ran. */
export function clockLagMs(expectedAt: number, actualAt: number): number {
  return Math.max(0, actualAt - expectedAt);
}

/** Frames that should have been drawn in a gap between two frames but were not. */
export function droppedFrames(gapMs: number, frameMs: number = FRAME_MS): number {
  if (gapMs > PAUSE_MS) return 0;
  // 1.5 frames of tolerance, so ordinary jitter is not counted.
  if (gapMs < frameMs * 1.5) return 0;
  return Math.round(gapMs / frameMs) - 1;
}

export interface LagSnapshot {
  /** Worst clock delay seen since the start, in ms. */
  readonly worstLagMs: number;
  /** Frames lost in the last 60 seconds. */
  readonly droppedFramesLastMinute: number;
}

export class LagStats {
  private worst = 0;
  private drops: { at: number; frames: number }[] = [];

  recordLag(lag: number): void {
    this.worst = Math.max(this.worst, lag);
  }

  recordDropped(at: number, frames: number): void {
    if (frames > 0) this.drops.push({ at, frames });
  }

  snapshot(now: number): LagSnapshot {
    this.drops = this.drops.filter((d) => now - d.at < WINDOW_MS);
    return {
      worstLagMs: this.worst,
      droppedFramesLastMinute: this.drops.reduce((sum, d) => sum + d.frames, 0),
    };
  }
}

export interface LagEnv {
  readonly now: () => number;
  readonly setInterval: (callback: () => void, ms: number) => () => void;
  readonly requestFrame: (callback: () => void) => () => void;
}

export function browserLagEnv(): LagEnv {
  return {
    now: () => performance.now(),
    setInterval: (callback, ms) => {
      const id = setInterval(callback, ms);
      return () => clearInterval(id);
    },
    requestFrame: (callback) => {
      const id = requestAnimationFrame(callback);
      return () => cancelAnimationFrame(id);
    },
  };
}

const CLOCK_MS = 100;

export class LagMonitor {
  private readonly stats = new LagStats();
  private stops: (() => void)[] = [];

  constructor(private readonly env: LagEnv = browserLagEnv()) {}

  start(): void {
    if (this.stops.length > 0) return;
    let expected = this.env.now() + CLOCK_MS;
    this.stops.push(
      this.env.setInterval(() => {
        const now = this.env.now();
        this.stats.recordLag(clockLagMs(expected, now));
        expected = now + CLOCK_MS;
      }, CLOCK_MS),
    );
    let last = this.env.now();
    let stopFrame = () => {};
    const frame = () => {
      const now = this.env.now();
      this.stats.recordDropped(now, droppedFrames(now - last));
      last = now;
      stopFrame = this.env.requestFrame(frame);
    };
    stopFrame = this.env.requestFrame(frame);
    this.stops.push(() => stopFrame());
  }

  stop(): void {
    this.stops.forEach((s) => s());
    this.stops = [];
  }

  snapshot(): LagSnapshot {
    return this.stats.snapshot(this.env.now());
  }
}
