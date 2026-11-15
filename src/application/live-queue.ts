// The local command queue of the live class (ADR-009). Each action becomes a command with a
// client-made id, stored on the device before anything is sent and sent in order when the connection
// allows. The server applies each id once, so a resend after a lost answer is harmless. A command
// the server refuses is kept in `refused` for the trainer to see, never dropped.
import type { ApiError, ApiResult, CommandName } from './api-contract';

export interface QueuedCommand {
  /** Also the `clientCommandId` the server deduplicates on. */
  readonly id: string;
  readonly name: CommandName;
  readonly input: Record<string, unknown>;
  readonly queuedAt: string;
}

export interface RefusedCommand extends QueuedCommand {
  readonly error: ApiError;
}

export interface QueueState {
  readonly pending: readonly QueuedCommand[];
  readonly refused: readonly RefusedCommand[];
}

/** Where the queue survives a reload: IndexedDB in the app, memory in tests. */
export interface QueueStore {
  load(): Promise<QueueState>;
  save(state: QueueState): Promise<void>;
}

/** The one call the queue makes: the backend's command, with the input as the queue stored it. */
export type SendCommand = (name: CommandName, input: Record<string, unknown>) => Promise<ApiResult<unknown>>;

export interface FlushResult {
  readonly sent: number;
  readonly refused: number;
  /** The connection (or the session) stopped the send; what is left stays queued. */
  readonly stopped: boolean;
}

/** Errors that mean "not now" rather than "no": the command stays queued and the send stops. */
const TRANSIENT: readonly ApiError[] = ['unavailable', 'unauthenticated'];

export class LiveQueue {
  private state: QueueState = { pending: [], refused: [] };
  private loaded = false;
  private flushing: Promise<FlushResult> | null = null;
  private readonly listeners = new Set<(state: QueueState) => void>();

  constructor(
    private readonly store: QueueStore,
    private readonly send: SendCommand,
    private readonly newId: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Loads what an earlier session left; call once before anything else. */
  async init(): Promise<void> {
    if (this.loaded) return;
    this.state = await this.store.load();
    this.loaded = true;
    this.emit();
  }

  get snapshot(): QueueState {
    return this.state;
  }

  subscribe(listener: (state: QueueState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Stores the command, then returns its id. It is on the device before this resolves. */
  async enqueue(name: CommandName, input: Record<string, unknown>, id: string = this.newId()): Promise<string> {
    await this.init();
    await this.update({ ...this.state, pending: [...this.state.pending, { id, name, input, queuedAt: this.now().toISOString() }] });
    return id;
  }

  /** Sends the queue in order; calls overlap safely (a second call waits for the first). */
  flush(): Promise<FlushResult> {
    this.flushing ??= this.run().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  /** The trainer saw a refused command and chose to drop it. */
  async dismissRefused(id: string): Promise<void> {
    await this.init();
    await this.update({ ...this.state, refused: this.state.refused.filter((c) => c.id !== id) });
  }

  private async run(): Promise<FlushResult> {
    await this.init();
    let sent = 0;
    let refused = 0;
    for (;;) {
      const next = this.state.pending[0];
      if (!next) return { sent, refused, stopped: false };
      const result = await this.send(next.name, { at: next.queuedAt, ...next.input, clientCommandId: next.id });
      if (result.ok) {
        sent++;
        await this.update({ ...this.state, pending: this.state.pending.slice(1) });
      } else if (TRANSIENT.includes(result.error)) {
        return { sent, refused, stopped: true };
      } else {
        refused++;
        await this.update({ pending: this.state.pending.slice(1), refused: [...this.state.refused, { ...next, error: result.error }] });
      }
    }
  }

  private async update(state: QueueState): Promise<void> {
    // The device first: if saving fails, nothing is considered done and the same command is sent again.
    await this.store.save(state);
    this.state = state;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}

export function memoryQueueStore(initial: QueueState = { pending: [], refused: [] }): QueueStore {
  let saved = initial;
  return { load: async () => saved, save: async (state) => void (saved = state) };
}
