import { describe, expect, it } from 'vitest';
import { beepSchedule, chimeReport, MAX_BEEPS, pickPortugueseVoice, whistleWav } from './chime.ts';
import { clockLagMs, droppedFrames, FRAME_MS, LagMonitor, LagStats, type LagEnv } from './lag-monitor.ts';
import { adjustEnd, isDue, lateMs, RestTimer, remainingMs, type RestEnd, type RestTimerEnv } from './rest-timer.ts';
import { shouldRequest, WakeLock, type WakeLockEnv, type WakeLockEvent } from './wake-lock.ts';

describe('wake lock', () => {
  it('requests only when wanted, visible and not held', () => {
    expect(shouldRequest(true, true, false)).toBe(true);
    expect(shouldRequest(false, true, false)).toBe(false);
    expect(shouldRequest(true, false, false)).toBe(false);
    expect(shouldRequest(true, true, true)).toBe(false);
  });

  function fake() {
    let visible = true;
    let visibleCallback: () => void = () => {};
    let fail = false;
    const sentinels: { fireRelease: () => void }[] = [];
    const env: WakeLockEnv = {
      request: async () => {
        if (fail) throw new Error('NotAllowedError');
        let onRelease: () => void = () => {};
        const s = { release: async () => onRelease(), addEventListener: (_: 'release', l: () => void) => (onRelease = l) };
        sentinels.push({ fireRelease: () => onRelease() });
        return s;
      },
      isVisible: () => visible,
      onVisible: (cb) => ((visibleCallback = cb), () => {}),
      now: () => 1,
    };
    const events: WakeLockEvent[] = [];
    const lock = new WakeLock(env);
    lock.subscribe((e) => events.push(e));
    return {
      lock,
      events,
      sentinels,
      setFail: (v: boolean) => (fail = v),
      returnFromBackground: async () => {
        visible = true;
        visibleCallback();
        await Promise.resolve();
        await Promise.resolve();
      },
    };
  }

  it('reports granted, then released, and asks again when the page comes back', async () => {
    const f = fake();
    await f.lock.start();
    expect(f.events.map((e) => e.status)).toEqual(['granted']);
    f.sentinels[0]!.fireRelease(); // the system drops it in the background
    expect(f.lock.held).toBe(false);
    await f.returnFromBackground();
    expect(f.events.map((e) => e.status)).toEqual(['granted', 'released', 'granted']);
    expect(f.lock.held).toBe(true);
  });

  it('reports an error with its detail, and does not ask again after stop', async () => {
    const f = fake();
    f.setFail(true);
    await f.lock.start();
    expect(f.events[0]).toMatchObject({ status: 'error', detail: 'NotAllowedError' });
    await f.lock.stop();
    f.setFail(false);
    await f.returnFromBackground();
    expect(f.events).toHaveLength(1);
  });

  it('says unsupported when the browser has no wake lock', async () => {
    const lock = new WakeLock({ request: null, isVisible: () => true, onVisible: () => () => {}, now: () => 0 });
    const events: WakeLockEvent[] = [];
    lock.subscribe((e) => events.push(e));
    await lock.start();
    expect(events.map((e) => e.status)).toEqual(['unsupported']);
  });
});

describe('chime plan', () => {
  it('lays beeps out one after the other, and keeps the count between 1 and 6', () => {
    const beeps = beepSchedule({ length: 'short', count: 3 });
    expect(beeps).toHaveLength(3);
    expect(beeps[0]!.offsetSec).toBe(0);
    expect(beeps[1]!.offsetSec).toBeGreaterThan(beeps[0]!.durationSec);
    expect(beepSchedule({ length: 'long', count: 99 })).toHaveLength(MAX_BEEPS);
    expect(beepSchedule({ length: 'long', count: 0 })).toHaveLength(1);
  });

  it('long beeps last longer than short ones', () => {
    expect(beepSchedule({ length: 'long', count: 1 })[0]!.durationSec).toBeGreaterThan(
      beepSchedule({ length: 'short', count: 1 })[0]!.durationSec,
    );
  });

  it('generates a valid 16-bit mono WAV that is not silent', () => {
    const wav = whistleWav();
    const view = new DataView(wav.buffer);
    const tag = (o: number) => String.fromCharCode(...wav.slice(o, o + 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(view.getUint32(4, true)).toBe(wav.length - 8);
    expect(view.getUint32(40, true)).toBe(wav.length - 44);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    let peak = 0;
    for (let o = 44; o < wav.length; o += 2) peak = Math.max(peak, Math.abs(view.getInt16(o, true)));
    expect(peak).toBeGreaterThan(10_000);
    expect(view.getInt16(44, true)).toBe(0); // starts silent: no click
  });

  it('builds the report with the lateness, never negative', () => {
    expect(chimeReport('beep', 1000, 1250, 'running')).toEqual({
      technique: 'beep',
      expectedAt: 1000,
      actualAt: 1250,
      lateMs: 250,
      contextState: 'running',
    });
    expect(chimeReport('speech', 1000, 900, 'none', 'x')).toMatchObject({ lateMs: 0, error: 'x' });
  });

  it('prefers a pt-BR voice, then any Portuguese, else none', () => {
    const voices = [{ lang: 'en-US' }, { lang: 'pt_PT' }, { lang: 'pt-BR' }];
    expect(pickPortugueseVoice(voices)).toEqual({ lang: 'pt-BR' });
    expect(pickPortugueseVoice(voices.slice(0, 2))).toEqual({ lang: 'pt_PT' });
    expect(pickPortugueseVoice(voices.slice(0, 1))).toBeNull();
  });
});

describe('rest timer arithmetic', () => {
  it('measures remaining and lateness from the real clock', () => {
    expect(remainingMs(10_000, 4_000)).toBe(6_000);
    expect(remainingMs(10_000, 12_000)).toBe(0);
    expect(isDue(10_000, 10_000)).toBe(true);
    expect(isDue(10_000, 9_999)).toBe(false);
    expect(lateMs(10_000, 10_350)).toBe(350);
    expect(lateMs(10_000, 9_000)).toBe(0);
  });

  it('adjusts by 15 s but never before now', () => {
    expect(adjustEnd(60_000, 15_000, 10_000)).toBe(75_000);
    expect(adjustEnd(20_000, -15_000, 10_000)).toBe(10_000);
  });
});

describe('RestTimer', () => {
  function fake() {
    let now = 1_000_000;
    let check: () => void = () => {};
    let running = false;
    const env: RestTimerEnv = {
      now: () => now,
      every: (_ms, cb) => ((check = cb), (running = true), () => (running = false)),
    };
    return {
      timer: new RestTimer(env),
      advance: (ms: number) => (now += ms),
      tick: () => check(),
      isChecking: () => running,
    };
  }

  it('runs several rests at once and ends each at its own time', () => {
    const f = fake();
    const ends: RestEnd[] = [];
    f.timer.onEnd((e) => ends.push(e));
    f.timer.start('a', 30_000);
    f.timer.start('b', 60_000);
    f.advance(30_000);
    f.tick();
    expect(ends.map((e) => e.id)).toEqual(['a']);
    expect(f.timer.remaining('b')).toBe(30_000);
    f.advance(30_000);
    f.tick();
    expect(ends.map((e) => e.id)).toEqual(['a', 'b']);
    expect(f.isChecking()).toBe(false);
  });

  it('after a long time in the background it ends at once, saying how late, and remaining never grows', () => {
    const f = fake();
    const ends: RestEnd[] = [];
    f.timer.onEnd((e) => ends.push(e));
    f.timer.start('a', 20_000);
    f.advance(5_000);
    const before = f.timer.remaining('a')!;
    f.advance(40_000); // page was suspended: no ticks in between
    expect(f.timer.remaining('a')).toBeLessThanOrEqual(before);
    f.tick();
    expect(ends).toHaveLength(1);
    expect(ends[0]!.lateMs).toBe(25_000);
    expect(f.timer.remaining('a')).toBeNull();
  });

  it('adjust moves the end; cancel stops it', () => {
    const f = fake();
    const ends: RestEnd[] = [];
    f.timer.onEnd((e) => ends.push(e));
    f.timer.start('a', 30_000);
    expect(f.timer.adjust('a', 15_000)).toBe(1_045_000);
    expect(f.timer.adjust('nope', 1)).toBeNull();
    f.timer.cancel('a');
    f.advance(60_000);
    f.tick();
    expect(ends).toHaveLength(0);
    expect(f.timer.running).toBe(0);
  });
});

describe('lag arithmetic', () => {
  it('lag is how late the tick ran, never negative', () => {
    expect(clockLagMs(1000, 1180)).toBe(180);
    expect(clockLagMs(1000, 990)).toBe(0);
  });

  it('counts only whole lost frames, ignoring jitter and pauses', () => {
    expect(droppedFrames(FRAME_MS)).toBe(0);
    expect(droppedFrames(FRAME_MS * 1.4)).toBe(0);
    expect(droppedFrames(FRAME_MS * 3)).toBe(2);
    expect(droppedFrames(5_000)).toBe(0);
  });

  it('keeps the worst lag and only the last minute of dropped frames', () => {
    const stats = new LagStats();
    stats.recordLag(40);
    stats.recordLag(300);
    stats.recordLag(90);
    stats.recordDropped(1_000, 4);
    stats.recordDropped(50_000, 2);
    stats.recordDropped(55_000, 0);
    expect(stats.snapshot(60_000)).toEqual({ worstLagMs: 300, droppedFramesLastMinute: 6 });
    expect(stats.snapshot(62_000)).toEqual({ worstLagMs: 300, droppedFramesLastMinute: 2 });
  });
});

describe('LagMonitor', () => {
  it('measures a late clock tick and a slow frame, and stops cleanly', () => {
    let now = 0;
    let tick: () => void = () => {};
    let frame: () => void = () => {};
    let active = 0;
    const env: LagEnv = {
      now: () => now,
      setInterval: (cb) => ((tick = cb), active++, () => active--),
      requestFrame: (cb) => ((frame = cb), () => {}),
    };
    const monitor = new LagMonitor(env);
    monitor.start();
    now = FRAME_MS;
    frame(); // a normal frame
    now += FRAME_MS * 4;
    frame(); // three frames lost
    now = 350; // the clock was due at 100
    tick();
    expect(monitor.snapshot()).toEqual({ worstLagMs: 250, droppedFramesLastMinute: 3 });
    monitor.stop();
    expect(active).toBe(0);
  });
});
