// The iPad test as a state machine: seven steps (0 to 6), each pending, done or skipped,
// with the Yes/No answers the trainer gives. Pure data in, pure data out.

export const STEP_COUNT = 7;
export const LAST_STEP = 6;
export type StepId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type StepStatus = 'pending' | 'done' | 'skipped';

const STEP_IDS: readonly StepId[] = [0, 1, 2, 3, 4, 5, 6];

/** Every question the screen asks. "yes" means "Sim" or "Ouvi". */
export type QuestionId =
  | 'sound-beeps'
  | 'sound-whistle'
  | 'sound-words'
  | 'timers-heard'
  | 'timers-smooth'
  | 'airplane-opened'
  | 'screen-awake'
  | 'no-lag';

export const QUESTIONS_BY_STEP: Readonly<Record<StepId, readonly QuestionId[]>> = {
  0: [],
  1: [],
  2: ['sound-beeps', 'sound-whistle', 'sound-words'],
  3: ['timers-heard', 'timers-smooth'],
  4: ['airplane-opened'],
  5: ['screen-awake', 'no-lag'],
  6: [],
};

export const MAX_COMMENT_LENGTH = 500;

export interface Answer {
  readonly yes: boolean;
  /** Only kept for a "No". */
  readonly comment?: string;
}

export interface StepState {
  readonly status: StepStatus;
  readonly answers: Readonly<Partial<Record<QuestionId, Answer>>>;
}

export interface TestState {
  readonly version: 1;
  readonly current: StepId;
  readonly steps: readonly StepState[];
}

export function isStepId(value: unknown): value is StepId {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= LAST_STEP;
}

export function initialTest(): TestState {
  return {
    version: 1,
    current: 0,
    steps: STEP_IDS.map(() => ({ status: 'pending' as const, answers: {} })),
  };
}

function withStep(state: TestState, step: StepId, change: Partial<StepState>): TestState {
  return { ...state, steps: state.steps.map((s, i) => (i === step ? { ...s, ...change } : s)) };
}

export function progress(state: TestState): { number: number; total: number } {
  return { number: state.current + 1, total: STEP_COUNT };
}

export function stepOfQuestion(id: QuestionId): StepId {
  return STEP_IDS.find((s) => QUESTIONS_BY_STEP[s].includes(id))!;
}

export function answerOf(state: TestState, id: QuestionId): Answer | undefined {
  return state.steps[stepOfQuestion(id)]?.answers[id];
}

export function unansweredQuestions(state: TestState, step: StepId = state.current): QuestionId[] {
  const answers = state.steps[step]?.answers ?? {};
  return QUESTIONS_BY_STEP[step].filter((q) => answers[q] === undefined);
}

export function answerQuestion(
  state: TestState,
  id: QuestionId,
  yes: boolean,
  comment?: string,
): TestState {
  const step = stepOfQuestion(id);
  const text = comment?.trim().slice(0, MAX_COMMENT_LENGTH);
  const answer: Answer = !yes && text ? { yes, comment: text } : { yes };
  return withStep(state, step, { answers: { ...state.steps[step]!.answers, [id]: answer } });
}

export function canComplete(state: TestState): boolean {
  return unansweredQuestions(state).length === 0;
}

function advance(state: TestState, status: 'done' | 'skipped'): TestState {
  const marked = withStep(state, state.current, { status });
  return { ...marked, current: Math.min(state.current + 1, LAST_STEP) as StepId };
}

/** Marks the current step done and moves on; does nothing while a question is unanswered. */
export function completeStep(state: TestState): TestState {
  return canComplete(state) ? advance(state, 'done') : state;
}

/** "Pular esta etapa". The last step cannot be skipped: it only shows the result. */
export function skipStep(state: TestState): TestState {
  return state.current === LAST_STEP ? state : advance(state, 'skipped');
}

/** Lets the trainer come back to a step, for instance to do step 5 another day. */
export function goToStep(state: TestState, step: StepId): TestState {
  return { ...state, current: step };
}

export function isFinished(state: TestState): boolean {
  return state.steps[LAST_STEP]?.status === 'done';
}

export function statusOf(state: TestState, step: StepId): StepStatus {
  return state.steps[step]?.status ?? 'pending';
}
