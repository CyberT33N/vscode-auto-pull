/**
 * Interval scheduler with reentrancy protection for auto pull cycles.
 *
 * The scheduler owns only timing semantics: start/stop lifecycle and skipping
 * a tick while a previous tick is still running. The actual cycle is injected
 * as an async callback, and the timer primitive is injected as a port so the
 * whole surface is testable without real time.
 */

/**
 * Port abstracting the interval primitive of the host runtime.
 */
export interface TimerAdapter {
  /**
   * Schedules a repeating callback at the given interval.
   *
   * @param callback - Invoked on every interval tick.
   * @param intervalMs - Interval length in milliseconds.
   * @returns A function cancelling the scheduled repetition.
   */
  schedule(callback: () => void, intervalMs: number): () => void;
}

/**
 * Repeating scheduler guarded against overlapping cycles.
 */
export class AutoPullScheduler {
  private cancelSchedule: (() => void) | undefined;
  private inFlight = false;

  /**
   * Creates the scheduler.
   *
   * @param timer - Timer port supplying the interval primitive.
   * @param onTick - Async cycle executed on each interval tick.
   */
  constructor(
    private readonly timer: TimerAdapter,
    private readonly onTick: () => Promise<void>,
  ) {}

  /**
   * (Re)starts the repeating cycle at the given interval.
   *
   * Any previously active schedule is cancelled first, making repeated calls
   * safe after a configuration change.
   *
   * @param intervalMs - Interval length in milliseconds.
   */
  start(intervalMs: number): void {
    this.stop();
    this.cancelSchedule = this.timer.schedule(() => {
      void this.tick();
    }, intervalMs);
  }

  /**
   * Stops the repeating cycle; safe to call when not running.
   */
  stop(): void {
    if (this.cancelSchedule !== undefined) {
      this.cancelSchedule();
      this.cancelSchedule = undefined;
    }
  }

  /**
   * Executes one cycle unless a previous cycle is still running.
   *
   * @returns Promise settling when this tick's cycle finished or was skipped.
   */
  tick(): Promise<void> {
    if (this.inFlight) {
      return Promise.resolve();
    }

    this.inFlight = true;

    return this.onTick().finally(() => {
      this.inFlight = false;
    });
  }
}
