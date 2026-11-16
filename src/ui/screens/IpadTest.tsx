import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { strings } from '../../domain/strings';
import { Chime, pickPortugueseVoice, type ChimeTechnique } from '../../infrastructure/device/chime';
import { LagMonitor } from '../../infrastructure/device/lag-monitor';
import { RestTimer } from '../../infrastructure/device/rest-timer';
import { WakeLock } from '../../infrastructure/device/wake-lock';
import { Button, ButtonLink } from '../components/Button';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { useConfirm } from '../components/use-confirm';
import { evaluate } from '../ipad-test/evaluation';
import { parseUserAgent } from '../ipad-test/environment';
import { localStorageTestStore } from '../ipad-test/local-store';
import type { SoundPurpose, SoundTechnique } from '../ipad-test/log';
import { buildReport } from '../ipad-test/report';
import { MARKS, PROOF_TITLES } from '../ipad-test/report-texts';
import { answerOf, canComplete, progress, STEP_COUNT, type QuestionId, type StepId } from '../ipad-test/steps';
import { useTestSession, type PageFacts, type TestSession } from '../ipad-test/use-test-session';
import { whatsappLink } from '../ipad-test/whatsapp';

const t = strings.ipadTest;

const TECHNIQUE: Record<ChimeTechnique, SoundTechnique> = { beep: 'beeps', whistle: 'whistle', speech: 'words' };

/** `?rapido=1` shortens step 5: 2 minutes instead of 60, a notice every 20 seconds instead of 5 minutes. */
const FULL = { totalMs: 60 * 60_000, noticeEveryMs: 5 * 60_000, heardWindowMs: 60_000 };
const QUICK = { totalMs: 2 * 60_000, noticeEveryMs: 20_000, heardWindowMs: 15_000 };

const TIMER_ROUNDS = 3;
const TIMER_A_MS = 20_000;
const TIMER_B_MS = 35_000;
const GAP_BETWEEN_SOUNDS_MS = 1_800;

const store = localStorageTestStore();

function readFacts(): PageFacts {
  const env = parseUserAgent(navigator.userAgent, navigator.maxTouchPoints);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return {
    ...env,
    standalone,
    width: window.innerWidth,
    height: window.innerHeight,
    // Offline and still here: the service worker answered from its cache.
    fromCache: !navigator.onLine && navigator.serviceWorker?.controller != null,
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const clock = (at: number) =>
  new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The iPad test (issue #7). Opens without a session: it reads and writes no data of the group. */
export function IpadTest() {
  const session = useTestSession(store, readFacts);
  const chime = useRef<Chime | null>(null);
  chime.current ??= new Chime();
  const { confirm, dialog } = useConfirm();
  const quick = useMemo(() => new URLSearchParams(window.location.search).get('rapido') === '1', []);

  useEffect(() => {
    const current = chime.current;
    return () => current?.dispose();
  }, []);

  const step = session.saved.state.current;
  const { number, total } = progress(session.saved.state);

  return (
    <main className="app ipad-test">
      <div className="row">
        <h1 className="grow">{t.title}</h1>
        <ButtonLink to="/" variant="text">
          {t.backToApp}
        </ButtonLink>
      </div>
      <label className="test-progress">
        <span className="strong">{t.progress(number, total)}</span>
        <progress value={number} max={STEP_COUNT} aria-label={t.progress(number, total)} />
      </label>
      <section className="card stack" aria-labelledby="test-step-title">
        <h2 id="test-step-title">{t.steps[step].title}</h2>
        <StepBody key={step} step={step} session={session} chime={chime.current} quick={quick} />
      </section>
      <div className="row">
        {step !== 6 && (
          <Button variant="text" onClick={session.skip}>
            {t.skip}
          </Button>
        )}
        <Button
          variant="secondary-danger"
          onClick={() => confirm({ title: t.restartTitle, message: t.restartMessage, run: session.restart })}
        >
          {t.restart}
        </Button>
      </div>
      {dialog}
    </main>
  );
}

interface StepProps {
  readonly session: TestSession;
  readonly chime: Chime;
  readonly quick: boolean;
}

function StepBody({ step, ...props }: StepProps & { step: StepId }) {
  switch (step) {
    case 0:
      return <StepIntro {...props} />;
    case 1:
      return <StepInstall {...props} />;
    case 2:
      return <StepSound {...props} />;
    case 3:
      return <StepTimers {...props} />;
    case 4:
      return <StepAirplane {...props} />;
    case 5:
      return <StepLong {...props} />;
    case 6:
      return <StepSend {...props} />;
  }
}

/** Plays a sound and writes it to the log. */
async function playLogged(
  { session, chime }: Pick<StepProps, 'session' | 'chime'>,
  technique: ChimeTechnique,
  purpose: SoundPurpose,
  options: Parameters<Chime['play']>[1] = {},
) {
  const report = await chime.play(technique, options);
  const noVoice = technique === 'speech' && !report.error && pickPortugueseVoice(window.speechSynthesis.getVoices()) === null;
  const detail = report.error ?? (noVoice ? 'sem voz pt-BR' : undefined);
  session.log({
    kind: 'sound',
    technique: TECHNIQUE[technique],
    purpose,
    plannedAt: report.expectedAt,
    actualAt: report.actualAt,
    delayMs: report.lateMs,
    audioState: report.contextState,
    ok: detail === undefined,
    ...(detail ? { detail } : {}),
  });
  return report;
}

/** Sound only starts after a tap: the first button of the test releases it. */
async function unlockSound({ session, chime }: Pick<StepProps, 'session' | 'chime'>) {
  const state = await chime.unlock();
  session.log({ kind: 'audio-state', state });
}

/** "Sim" / "Não" (or "Ouvi" / "Não ouvi") and, after a "Não", the optional comment. */
function Question({
  id,
  prompt,
  session,
  labels = [t.yes, t.no],
}: {
  id: QuestionId;
  prompt: string;
  session: TestSession;
  labels?: readonly [string, string];
}) {
  const answer = answerOf(session.saved.state, id);
  const [comment, setComment] = useState(answer?.comment ?? '');
  return (
    <fieldset className="test-question stack tight">
      <legend className="strong">{prompt}</legend>
      <div className="row">
        <Button size="large" variant="secondary" aria-pressed={answer?.yes === true} onClick={() => session.answer(id, true)}>
          {labels[0]}
        </Button>
        <Button size="large" variant="secondary" aria-pressed={answer?.yes === false} onClick={() => session.answer(id, false, comment)}>
          {labels[1]}
        </Button>
      </div>
      {answer?.yes === false && (
        <Field
          label={t.whatHappened}
          value={comment}
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
          onBlur={() => session.answer(id, false, comment)}
        />
      )}
    </fieldset>
  );
}

/** The "Continuar" button, enabled once the step's action is done and every question answered. */
function Continue({ session, ready = true }: { session: TestSession; ready?: boolean }) {
  return (
    <Button size="large" disabled={!ready || !canComplete(session.saved.state)} onClick={session.finish}>
      {t.next}
    </Button>
  );
}

function StepIntro({ session, chime }: StepProps) {
  return (
    <>
      <p>{t.steps[0].text}</p>
      <Button
        size="large"
        onClick={async () => {
          await unlockSound({ session, chime });
          session.finish();
        }}
      >
        {t.steps[0].action}
      </Button>
    </>
  );
}

function StepInstall({ session }: StepProps) {
  const facts = useMemo(readFacts, []);
  const text = facts.browser === 'Safari' ? t.steps[1].safari : facts.browser === 'Chrome' ? t.steps[1].chrome : t.steps[1].other;
  return (
    <>
      {facts.standalone ? <Notice>{t.steps[1].installed}</Notice> : <p>{text}</p>}
      {!facts.standalone && <p className="muted">{t.steps[1].notInstalled}</p>}
      <Button size="large" disabled={!facts.standalone} onClick={session.finish}>
        {t.steps[1].action}
      </Button>
    </>
  );
}

function StepSound({ session, chime }: StepProps) {
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const text = t.steps[2];
  async function playAll() {
    setPlaying(true);
    await unlockSound({ session, chime });
    await playLogged({ session, chime }, 'beep', 'check');
    await sleep(GAP_BETWEEN_SOUNDS_MS);
    await playLogged({ session, chime }, 'whistle', 'check');
    await sleep(GAP_BETWEEN_SOUNDS_MS);
    await playLogged({ session, chime }, 'speech', 'check', { words: text.spoken });
    setPlaying(false);
    setPlayed(true);
  }
  const hasAnswers = answerOf(session.saved.state, 'sound-beeps') !== undefined;
  const ready = played || hasAnswers;
  const labels = [t.heard, t.notHeard] as const;
  return (
    <>
      <p>{text.text}</p>
      <Button size="large" disabled={playing} onClick={() => void playAll()}>
        {playing ? text.playing : text.action}
      </Button>
      {ready && (
        <>
          <Question id="sound-beeps" prompt={text.beeps} session={session} labels={labels} />
          <Question id="sound-whistle" prompt={text.whistle} session={session} labels={labels} />
          <Question id="sound-words" prompt={text.words} session={session} labels={labels} />
        </>
      )}
      <Continue session={session} ready={ready} />
    </>
  );
}

function StepTimers({ session, chime }: StepProps) {
  const timer = useRef<RestTimer | null>(null);
  timer.current ??= new RestTimer();
  const [started, setStarted] = useState(false);
  const [runs, setRuns] = useState({ a: 0, b: 0 });
  const [, redraw] = useState(0);
  const runsRef = useRef({ a: 0, b: 0 });
  const text = t.steps[3];
  const finished = runs.a >= TIMER_ROUNDS && runs.b >= TIMER_ROUNDS;

  useEffect(() => {
    const rest = timer.current!;
    const offEnd = rest.onEnd((end) => {
      const id = end.id as 'a' | 'b';
      runsRef.current = { ...runsRef.current, [id]: runsRef.current[id] + 1 };
      setRuns(runsRef.current);
      if (runsRef.current[id] < TIMER_ROUNDS) rest.start(id, id === 'a' ? TIMER_A_MS : TIMER_B_MS);
      void playLogged(
        { session, chime },
        id === 'a' ? 'beep' : 'whistle',
        id === 'a' ? 'timer-a' : 'timer-b',
        id === 'a' ? { at: end.endsAt, pattern: { length: 'short', count: 2 } } : { at: end.endsAt },
      );
    });
    const offTick = rest.onTick(() => redraw((n) => n + 1));
    return () => {
      offEnd();
      offTick();
      rest.dispose();
    };
    // The session and the chime keep their identity for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    await unlockSound({ session, chime });
    runsRef.current = { a: 0, b: 0 };
    setRuns(runsRef.current);
    setStarted(true);
    timer.current!.start('a', TIMER_A_MS);
    timer.current!.start('b', TIMER_B_MS);
  }

  const running = started && !finished;
  const clockOf = (id: 'a' | 'b') => countdown(timer.current!.remaining(id) ?? 0);
  return (
    <>
      <p>{text.text}</p>
      <div className="test-timers">
        {(['a', 'b'] as const).map((id) => (
          <div key={id} className="test-timer">
            <span className="strong">{id === 'a' ? text.timerA : text.timerB}</span>
            <span className="test-clock" role="timer">
              {clockOf(id)}
            </span>
            <span className="muted">{text.round(runs[id], TIMER_ROUNDS)}</span>
          </div>
        ))}
      </div>
      <Button size="large" disabled={running} onClick={() => void start()}>
        {running ? text.running : text.action}
      </Button>
      {finished && (
        <>
          <Question id="timers-heard" prompt={text.heard} session={session} />
          <Question id="timers-smooth" prompt={text.smooth} session={session} />
        </>
      )}
      <Continue session={session} ready={finished} />
    </>
  );
}

function StepAirplane({ session }: StepProps) {
  const text = t.steps[4];
  const [online, setOnline] = useState(navigator.onLine);
  const fromCache = useMemo(() => readFacts().fromCache, []);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return (
    <>
      <p>{text.text}</p>
      {online ? <p className="muted">{text.online}</p> : <Notice>{text.offline}</Notice>}
      {!online && <p className="muted">{fromCache ? text.fromCache : text.notFromCache}</p>}
      {!online && <Question id="airplane-opened" prompt={text.opened} session={session} />}
      <Continue session={session} ready={!online} />
    </>
  );
}

function StepLong({ session, chime, quick }: StepProps) {
  const text = t.steps[5];
  const config = quick ? QUICK : FULL;
  const [phase, setPhase] = useState<'idle' | 'running' | 'finished'>('idle');
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState(0);
  const [notice, setNotice] = useState<{ index: number; at: number } | null>(null);
  const [heardCount, setHeardCount] = useState(0);
  const wake = useRef<WakeLock | null>(null);
  const lag = useRef<LagMonitor | null>(null);
  const counters = useRef({ notices: 0, minutes: 0 });

  const stopMeasuring = useCallback(() => {
    void wake.current?.stop();
    lag.current?.stop();
  }, []);

  useEffect(() => stopMeasuring, [stopMeasuring]);

  useEffect(() => {
    if (phase !== 'running') return;
    const logAlive = () => {
      const snapshot = lag.current!.snapshot();
      session.log({ kind: 'alive', worstLagMs: Math.round(snapshot.worstLagMs), droppedFrames: snapshot.droppedFramesLastMinute });
    };
    const id = window.setInterval(() => {
      const at = Date.now();
      const elapsed = at - startedAt;
      setNow(at);
      const minutes = Math.floor(Math.min(elapsed, config.totalMs) / 60_000);
      while (counters.current.minutes < minutes) {
        counters.current.minutes += 1;
        logAlive();
      }
      const due = Math.floor(Math.min(elapsed, config.totalMs) / config.noticeEveryMs);
      while (counters.current.notices < due) {
        counters.current.notices += 1;
        const index = counters.current.notices;
        setNotice({ index, at: Date.now() });
        void playLogged({ session, chime }, 'beep', 'notice', { pattern: { length: 'long', count: 2 } });
      }
      if (elapsed >= config.totalMs) {
        logAlive();
        stopMeasuring();
        setPhase('finished');
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, startedAt, config, session, chime, stopMeasuring]);

  async function start() {
    await unlockSound({ session, chime });
    wake.current = new WakeLock();
    wake.current.subscribe((event) => {
      if (event.status === 'idle') return;
      session.log({
        kind: 'wakelock',
        state: event.status === 'granted' ? 'granted' : event.status,
        ...(event.detail ? { detail: event.detail } : {}),
      });
    });
    lag.current = new LagMonitor();
    lag.current.start();
    session.log({ kind: 'wakelock', state: 'requested' });
    await wake.current.start();
    counters.current = { notices: 0, minutes: 0 };
    const at = Date.now();
    setStartedAt(at);
    setNow(at);
    setHeardCount(0);
    setNotice(null);
    setPhase('running');
  }

  function heard() {
    if (!notice) return;
    session.log({ kind: 'heard', noticeIndex: notice.index, reactionMs: Date.now() - notice.at });
    setHeardCount((n) => n + 1);
    setNotice(null);
  }

  const remaining = Math.max(0, config.totalMs - (now - startedAt));
  const canHear = notice !== null && now - notice.at < config.heardWindowMs;
  return (
    <>
      <p>{text.text}</p>
      {phase === 'idle' && (
        <Button size="large" onClick={() => void start()}>
          {text.action}
        </Button>
      )}
      {phase !== 'idle' && (
        <div className="stack tight">
          <span className="muted">{text.remaining}</span>
          <span className="test-clock" role="timer">
            {countdown(remaining)}
          </span>
          <span className="muted">{notice ? text.lastNotice(clock(notice.at)) : text.noNotice}</span>
          <span className="muted">{text.heardCount(heardCount)}</span>
        </div>
      )}
      {phase === 'running' && (
        <Button size="large" disabled={!canHear} onClick={heard}>
          {t.heard}
        </Button>
      )}
      {phase === 'finished' && (
        <>
          <Notice>{text.finished}</Notice>
          <Question id="screen-awake" prompt={text.awake} session={session} />
          <Question id="no-lag" prompt={text.noLag} session={session} />
        </>
      )}
      <Continue session={session} ready={phase === 'finished'} />
    </>
  );
}

/** A file of the report that this device can share, or null. */
function shareableFile(content: string, filename: string): File | null {
  if (typeof File === 'undefined' || typeof navigator.canShare !== 'function') return null;
  for (const type of ['text/markdown', 'text/plain']) {
    const file = new File([content], filename, { type });
    if (navigator.canShare({ files: [file] })) return file;
  }
  return null;
}

function StepSend({ session }: StepProps) {
  const text = t.steps[6];
  const { state, log } = session.saved;
  const report = useMemo(() => buildReport(state, log, new Date()), [state, log]);
  const result = useMemo(() => evaluate(state, log), [state, log]);
  const file = useMemo(() => shareableFile(report.full, report.filename), [report]);
  const [message, setMessage] = useState<ReactNode>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(report.full);
      setMessage(text.copied);
    } catch {
      setMessage(text.copyFailed);
    }
  }

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: report.filename });
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage(text.shareFailed);
    }
  }

  return (
    <>
      <p>{text.text}</p>
      <ul className="list stack tight" aria-label={text.summaryHeading}>
        {result.proofs.map((proof) => (
          <li key={proof.id}>
            <span className="strong">
              {MARKS[proof.verdict]} {proof.id} {PROOF_TITLES[proof.id]}
            </span>
            {proof.facts.length > 0 && <span className="muted"> ({proof.facts.join('; ')})</span>}
          </li>
        ))}
      </ul>
      <ButtonLink size="large" href={whatsappLink(report.summary)} target="_blank" rel="noopener noreferrer">
        {text.whatsapp}
      </ButtonLink>
      {file && (
        <Button size="large" variant="secondary" onClick={() => void share()}>
          {text.share}
        </Button>
      )}
      <Button size="large" variant="secondary" onClick={() => void copy()}>
        {text.copy}
      </Button>
      {message && <Notice>{message}</Notice>}
    </>
  );
}
